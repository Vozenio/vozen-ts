/**
 * vozen connect: the local half of vozen's remote-access relay (vozen's own
 * equivalent of bb connect). Dials out to the Cloudflare Worker relay
 * (apps/connect-worker) over one WebSocket and proxies each multiplexed
 * HTTP/WS stream it carries to vozen's own local HTTP server, using the
 * frame protocol in packages/tunnel_contract.
 *
 * Ported from the Python vozen's plugins/connect/client.py. No hand-rolled
 * WebSocket framing needed here (that Python version needed packages/ws/
 * client.py because stdlib has no WS client) — Bun/the browser both ship a
 * native WebSocket client, and local HTTP proxying uses native fetch()
 * instead of http.client.
 *
 * Scope: single credential, single handle, one tunnel connection at a time,
 * reconnect-on-drop. No multi-device pairing UI, no share-port registry
 * like bb's (vozen has exactly one thing to expose: its own local server).
 */

import * as frames from "../../packages/tunnel_contract/frames.ts";

const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 30_000;

// Actively keeps the tunnel alive: with neither side ever sending an
// unsolicited PING, the connection carries zero traffic while idle and gets
// dropped by Cloudflare's edge/Durable Object idle policies (the bug this
// fixes). Matches bb's own tunnel-client values (packages/tunnel-client/src/
// session.ts) — the worker's setWebSocketAutoResponse answers HEARTBEAT_PING
// with HEARTBEAT_PONG at the edge without waking the Durable Object, so this
// is pure keep-alive traffic, not a round trip through the worker's JS.
const HEARTBEAT_INTERVAL_MS = 20_000;
const HEARTBEAT_DEADLINE_MS = 60_000;

// Hop-by-hop headers that must not be forwarded to/from the local server —
// the tunnel connection itself already handles framing and keep-alive.
const HOP_BY_HOP_HEADERS = new Set(["connection", "keep-alive", "transfer-encoding", "upgrade", "host"]);

// fetch() always transparently decodes a gzip/br response body — and always
// negotiates its own Accept-Encoding regardless of what headers we pass it,
// since Accept-Encoding is a forbidden header user code cannot override —
// but response.headers still reports the original Content-Encoding
// unchanged. Relaying that header (and the now-wrong Content-Length) over
// the tunnel would tell the visitor's browser "this body is gzip" when it's
// actually the already-decoded plaintext proxyHttp() below sends onward,
// which then fails to gunzip and dies with a silent "Failed to fetch" for
// every asset (confirmed live: this produced a blank felix.vozen.io with
// zero console errors). Both headers describe a transport encoding fetch()
// already undid, so neither is honest to forward.
const STALE_AFTER_FETCH_DECODE_HEADERS = new Set(["content-encoding", "content-length"]);

// Cloudflare's edge WAF blocks a missing/generic-script User-Agent as a bot
// signature (a real, reproduced bug — see spec/plan.md) — every outbound
// request this module makes sets one explicitly rather than relying on the
// runtime's own default.
const USER_AGENT = "vozen-connect-cli";

export interface RegisterResult {
  handle: string;
  credential: string;
  serverUrl: string;
}

/** POST /api/connect/register on the Worker. Replaces bb's OAuth +
 * pairing-code redeem flow with a single shared setup-token check, since
 * vozen connect has exactly one user and no account system to log into.
 *
 * Hits register.<apex>, not the bare apex: the apex hostname is often
 * already claimed by an unrelated Worker/Custom Domain (Cloudflare Custom
 * Domains outrank this Worker's wildcard Route), so a request straight to
 * workerUrl's own host may never reach vozen-connect at all. Any *.<apex>
 * subdomain is guaranteed to route here (see apps/connect-worker/src/worker.ts). */
export async function register(workerUrl: string, handle: string, setupToken: string): Promise<RegisterResult> {
  const url = new URL(workerUrl);
  const registerUrl = `${url.protocol}//register.${url.host}/api/connect/register`;
  const response = await fetch(registerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
    body: JSON.stringify({ handle, setupToken }),
  });
  if (!response.ok) {
    throw new Error(`register failed: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as RegisterResult;
}

export type RedeemErrorCode = "invalid_code" | "expired_code" | "already_used" | "network";

export class RedeemError extends Error {
  constructor(readonly code: RedeemErrorCode, message: string) {
    super(message);
  }
}

/** POST /api/connect/redeem on the Worker — the web-login counterpart to
 * register() above. Matches bb's real redeemConnectCode(): a human already
 * got a short one-time code from register.<apex> (after logging in with
 * GitHub); this exchanges that code for the actual credential. Called by
 * the local server itself, never by the browser, so the credential never
 * transits a URL. */
export async function redeem(workerUrl: string, code: string): Promise<RegisterResult> {
  const url = new URL(workerUrl);
  const redeemUrl = `${url.protocol}//register.${url.host}/api/connect/redeem`;
  let response: Response;
  try {
    response = await fetch(redeemUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
      body: JSON.stringify({ code }),
    });
  } catch (error) {
    throw new RedeemError("network", error instanceof Error ? error.message : String(error));
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    const code_ = (["invalid_code", "expired_code", "already_used"] as const).includes(body.error as never)
      ? (body.error as RedeemErrorCode)
      : "network";
    throw new RedeemError(code_, body.error ?? `redeem failed: ${response.status}`);
  }
  return (await response.json()) as RegisterResult;
}

interface PendingBody {
  params: OpenHttpParams;
  chunks: Uint8Array[];
}

interface OpenHttpParams {
  method: string;
  path: string;
  headers: Record<string, string>;
  hasBody: boolean;
}

interface OpenWsParams {
  path: string;
  headers: Record<string, string>;
  protocols: string[] | null;
}

class WsBridge {
  constructor(
    private readonly localSocket: WebSocket,
    private readonly sendFrame: (frame: Uint8Array) => void,
    private readonly streamId: number,
  ) {}

  send(data: Uint8Array, isBinary: boolean): void {
    this.localSocket.send(isBinary ? data : new TextDecoder().decode(data));
  }

  close(): void {
    this.localSocket.close();
  }

  /** Wires the local WebSocket's own messages back over the tunnel as
   * WS_DATA frames, and forwards CLOSE_STREAM when it closes either way. */
  pump(): void {
    this.localSocket.addEventListener("message", (event) => {
      const isBinary = typeof event.data !== "string";
      const data = isBinary
        ? new Uint8Array(event.data instanceof ArrayBuffer ? event.data : (event.data as ArrayBufferView).buffer)
        : new TextEncoder().encode(event.data as string);
      this.sendFrame(frames.encodeWsData(this.streamId, data, isBinary));
    });
    const onClose = () => this.sendFrame(frames.encodeFrame(frames.CLOSE_STREAM, this.streamId));
    this.localSocket.addEventListener("close", onClose);
    this.localSocket.addEventListener("error", onClose);
  }
}

export class TunnelClient {
  private readonly dialUrl: string;
  private readonly credential: string;
  private readonly localOrigin: string;
  private socket: WebSocket | null = null;
  private stopping = false;
  private readonly pendingBodies = new Map<number, PendingBody>();
  private readonly wsBridges = new Map<number, WsBridge>();
  private lastActivityAtMs: number | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  private lastHeartbeatAckAt = 0;
  private readonly heartbeatIntervalMs: number;
  private readonly heartbeatDeadlineMs: number;

  constructor(
    workerUrl: string,
    handle: string,
    credential: string,
    localBaseUrl = "http://127.0.0.1:38890",
    /** Test-only: shrinks the heartbeat interval/deadline so reconnect tests don't wait 20-60s. */
    heartbeat?: { intervalMs?: number; deadlineMs?: number },
  ) {
    const parsed = new URL(workerUrl);
    const scheme = parsed.protocol === "https:" ? "wss" : "ws";
    this.dialUrl = `${scheme}://${handle}.${parsed.host}/__tunnel?v=1`;
    this.credential = credential;
    this.localOrigin = localBaseUrl;
    this.heartbeatIntervalMs = heartbeat?.intervalMs ?? HEARTBEAT_INTERVAL_MS;
    this.heartbeatDeadlineMs = heartbeat?.deadlineMs ?? HEARTBEAT_DEADLINE_MS;
  }

  async runForever(
    onConnected?: () => void,
    onDisconnected?: (error: Error | null, nextRetryAt: number | null) => void,
  ): Promise<void> {
    let delay = RECONNECT_MIN_MS;
    while (!this.stopping) {
      try {
        await this.connectOnce(onConnected);
        delay = RECONNECT_MIN_MS;
        if (!this.stopping) onDisconnected?.(null, this.stopping ? null : Date.now() + delay);
      } catch (error) {
        onDisconnected?.(error instanceof Error ? error : new Error(String(error)), this.stopping ? null : Date.now() + delay);
      }
      if (this.stopping) break;
      await Bun.sleep(delay);
      delay = Math.min(delay * 2, RECONNECT_MAX_MS);
    }
  }

  /** Timestamp of the last real (non-heartbeat) frame received over the
   * tunnel — the closest signal to "a remote device did something" vozen's
   * wire protocol carries. */
  get lastActivityAt(): number | null {
    return this.lastActivityAtMs;
  }

  /** Approximates "how many remote devices are connected" as the count of
   * live WS bridges the tunnel is currently proxying — each device viewing
   * the app keeps exactly one open (its own realtime /ws channel), so this
   * undercounts a device only mid-HTTP-request with no tab open, which is
   * close enough for a status display (vozen's wire protocol has no actual
   * per-device identity to count instead). */
  get activeStreamCount(): number {
    return this.wsBridges.size;
  }

  stop(): void {
    this.stopping = true;
    this.stopHeartbeat();
    this.socket?.close();
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private connectOnce(onConnected?: () => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.dialUrl, {
        headers: { Authorization: `Bearer ${this.credential}`, "User-Agent": USER_AGENT },
      } as unknown as string[]); // Bun's WebSocket accepts a headers option beyond the DOM lib's typing
      ws.binaryType = "arraybuffer";
      this.socket = ws;

      ws.addEventListener("open", () => {
        // Actively keep the tunnel alive (see HEARTBEAT_INTERVAL_MS above) —
        // the worker's edge auto-responds to HEARTBEAT_PING with
        // HEARTBEAT_PONG without waking its Durable Object.
        this.lastHeartbeatAckAt = Date.now();
        this.heartbeatTimer = setInterval(() => {
          if (Date.now() - this.lastHeartbeatAckAt > this.heartbeatDeadlineMs) {
            ws.close(1001, "heartbeat timeout");
            return;
          }
          ws.send(frames.HEARTBEAT_PING);
        }, this.heartbeatIntervalMs);
        onConnected?.();
      });
      ws.addEventListener("message", (event) => {
        if (typeof event.data === "string") {
          if (event.data === frames.HEARTBEAT_PONG) this.lastHeartbeatAckAt = Date.now();
          return;
        }
        this.dispatch(new Uint8Array(event.data as ArrayBuffer));
      });
      ws.addEventListener("close", () => {
        this.stopHeartbeat();
        this.socket = null;
        resolve();
      });
      ws.addEventListener("error", () => {
        this.stopHeartbeat();
        this.socket = null;
        reject(new Error("tunnel socket error"));
      });
    });
  }

  private sendFrame(frame: Uint8Array): void {
    this.socket?.send(frame);
  }

  private dispatch(raw: Uint8Array): void {
    this.lastActivityAtMs = Date.now();
    const { type, streamId, payload } = frames.decodeFrame(raw);
    if (type === frames.OPEN_HTTP) {
      const params = frames.decodeJsonPayload<OpenHttpParams>(payload);
      if (!params.hasBody) {
        void this.proxyHttp(streamId, params, new Uint8Array(0));
      } else {
        this.pendingBodies.set(streamId, { params, chunks: [] });
      }
    } else if (type === frames.BODY_CHUNK) {
      this.pendingBodies.get(streamId)?.chunks.push(payload);
    } else if (type === frames.BODY_END) {
      const pending = this.pendingBodies.get(streamId);
      this.pendingBodies.delete(streamId);
      if (pending) {
        const total = pending.chunks.reduce((n, c) => n + c.length, 0);
        const body = new Uint8Array(total);
        let offset = 0;
        for (const chunk of pending.chunks) {
          body.set(chunk, offset);
          offset += chunk.length;
        }
        void this.proxyHttp(streamId, pending.params, body);
      }
    } else if (type === frames.OPEN_WS) {
      void this.handleWsOpen(streamId, frames.decodeJsonPayload<OpenWsParams>(payload));
    } else if (type === frames.WS_DATA) {
      const { isBinary, data } = frames.decodeWsData(payload);
      this.wsBridges.get(streamId)?.send(data, isBinary);
    } else if (type === frames.CLOSE_STREAM) {
      this.wsBridges.get(streamId)?.close();
    }
  }

  private async proxyHttp(streamId: number, params: OpenHttpParams, body: Uint8Array): Promise<void> {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(params.headers)) {
      if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) headers[key] = value;
    }
    // Mark this request as tunnel-forwarded so local-only routes (e.g. the
    // remote-access pair/disconnect endpoints) can refuse it. Set after the
    // loop above so a guest can't smuggle their own value through.
    headers["x-vozen-via-tunnel"] = "1";
    try {
      const response = await fetch(`${this.localOrigin}${params.path}`, {
        method: params.method,
        headers,
        body: body.length > 0 ? (body as BodyInit) : undefined,
      });
      const respHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        const k = key.toLowerCase();
        if (!HOP_BY_HOP_HEADERS.has(k) && !STALE_AFTER_FETCH_DECODE_HEADERS.has(k)) respHeaders[key] = value;
      });
      this.sendFrame(frames.encodeJsonFrame(frames.RESP_HEAD, streamId, { status: response.status, headers: respHeaders }));
      const respBody = new Uint8Array(await response.arrayBuffer());
      for (const chunk of frames.iterChunks(respBody)) {
        this.sendFrame(frames.encodeFrame(frames.BODY_CHUNK, streamId, chunk));
      }
    } catch (error) {
      this.sendFrame(frames.encodeJsonFrame(frames.RESP_HEAD, streamId, {
        status: 502, headers: { "content-type": "application/json" },
      }));
      this.sendFrame(frames.encodeFrame(
        frames.BODY_CHUNK, streamId,
        new TextEncoder().encode(JSON.stringify({ error: error instanceof Error ? error.message : String(error) })),
      ));
    }
    this.sendFrame(frames.encodeFrame(frames.BODY_END, streamId));
  }

  private async handleWsOpen(streamId: number, params: OpenWsParams): Promise<void> {
    const localUrl = `${this.localOrigin.replace(/^http/, "ws")}${params.path}`;
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(params.headers)) {
      if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) headers[key] = value;
    }
    // Same tunnel marker as proxyHttp (not consumed anywhere yet on the WS
    // path, but set for consistency / future use).
    headers["x-vozen-via-tunnel"] = "1";
    let localSocket: WebSocket;
    try {
      localSocket = new WebSocket(localUrl, { headers } as unknown as string[]);
      localSocket.binaryType = "arraybuffer";
      await new Promise<void>((resolve, reject) => {
        localSocket.addEventListener("open", () => resolve(), { once: true });
        localSocket.addEventListener("error", () => reject(new Error("local ws connect failed")), { once: true });
      });
    } catch {
      this.sendFrame(frames.encodeFrame(frames.CLOSE_STREAM, streamId));
      return;
    }
    const bridge = new WsBridge(localSocket, (frame) => this.sendFrame(frame), streamId);
    this.wsBridges.set(streamId, bridge);
    this.sendFrame(frames.encodeJsonFrame(frames.WS_OPEN_ACK, streamId, { protocol: null }));
    bridge.pump();
    localSocket.addEventListener("close", () => this.wsBridges.delete(streamId));
  }
}
