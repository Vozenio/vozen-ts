import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { unlinkSync } from "node:fs";
import * as sqlite from "../../packages/db/sqlite.ts";
import * as frames from "../../packages/tunnel_contract/frames.ts";
import { ThreadManager } from "../../apps/server/engine.ts";
import type { ConnectManager, ConnectStatus } from "../../apps/server/connectManager.ts";
import { createApp } from "../../apps/server/http.ts";
import { TunnelClient } from "./client.ts";

function seedThread(engine: ThreadManager, id: string): void {
  sqlite.insertThread(engine.db, id, "/tmp", "t", "idle", Math.floor(Date.now() / 1000));
}

// Fake ConnectManager — just enough of the interface for createApp's
// /vozen/connect/* routes; no real credentials file or network touched.
function makeFakeConnectManager(): ConnectManager {
  const status: ConnectStatus = {
    state: "disconnected", paired: false, handle: null, url: null,
    dashboardUrl: "https://register.vozen.io", lastError: null, since: null,
    nextRetryAt: null, remoteClients: 0, lastRemoteActivityAt: null,
  };
  return {
    getStatus: () => status,
    pair: async (_code: string) => {},
    disconnect: () => {},
  } as unknown as ConnectManager;
}

interface ClientInternals {
  sendFrame(frame: Uint8Array): void;
  dispatch(raw: Uint8Array): void;
}

interface DialUrlInternals {
  dialUrl: string;
}

async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await Bun.sleep(10);
  }
  throw new Error("waitFor timed out");
}

describe("TunnelClient HTTP proxy (against a real local vozen server)", () => {
  let dbPath: string;
  let engine: ThreadManager;
  let server: ReturnType<typeof Bun.serve>;
  let client: TunnelClient;
  let sent: Uint8Array[];

  beforeEach(() => {
    dbPath = `/tmp/vozen-test-${crypto.randomUUID()}.db`;
    engine = new ThreadManager(dbPath);
    const { app, websocket } = createApp(engine);
    server = Bun.serve({ port: 0, fetch: app.fetch, websocket });
    client = new TunnelClient("https://vozen.io", "abc", "secret", `http://127.0.0.1:${server.port}`);
    sent = [];
    (client as unknown as ClientInternals).sendFrame = (frame: Uint8Array) => sent.push(frame);
  });

  afterEach(() => {
    server.stop(true);
    engine.db.close();
    try {
      unlinkSync(dbPath);
    } catch {}
  });

  function dispatch(raw: Uint8Array): void {
    (client as unknown as ClientInternals).dispatch(raw);
  }

  async function framesForStream(streamId: number, timeoutMs = 2000): Promise<frames.DecodedFrame[]> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const decoded = sent.map((raw) => frames.decodeFrame(raw)).filter((f) => f.streamId === streamId);
      if (decoded.length && decoded[decoded.length - 1]?.type === frames.BODY_END) return decoded;
      await Bun.sleep(10);
    }
    throw new Error(`stream ${streamId} never reached BODY_END`);
  }

  test("GET request without a body is proxied", async () => {
    seedThread(engine, "thr_1");
    dispatch(frames.encodeJsonFrame(frames.OPEN_HTTP, 1, {
      method: "GET", path: "/api/threads/thr_1", headers: {}, hasBody: false,
    }));
    const result = await framesForStream(1);
    const respHead = result.find((f) => f.type === frames.RESP_HEAD)!;
    expect(frames.decodeJsonPayload<{ status: number }>(respHead.payload).status).toBe(200);
    const body = Buffer.concat(result.filter((f) => f.type === frames.BODY_CHUNK).map((f) => Buffer.from(f.payload)));
    expect(JSON.parse(body.toString()).id).toBe("thr_1");
  });

  test("unknown thread proxies a 404", async () => {
    dispatch(frames.encodeJsonFrame(frames.OPEN_HTTP, 1, {
      method: "GET", path: "/api/threads/thr_missing", headers: {}, hasBody: false,
    }));
    const result = await framesForStream(1);
    const respHead = result.find((f) => f.type === frames.RESP_HEAD)!;
    expect(frames.decodeJsonPayload<{ status: number }>(respHead.payload).status).toBe(404);
  });

  test("POST request body is buffered until BODY_END", async () => {
    // /send (not /threads, which would spawn a real codex subprocess with
    // no clean way to tear it down before the next test's db.close()) —
    // this thread has no session, so it 400s, but only after the handler
    // actually parses `message` out of the reassembled body.
    seedThread(engine, "thr_1");
    const body = new TextEncoder().encode(JSON.stringify({ message: "hello there" }));
    dispatch(frames.encodeJsonFrame(frames.OPEN_HTTP, 2, {
      method: "POST", path: "/api/threads/thr_1/tell",
      headers: { "Content-Type": "application/json" }, hasBody: true,
    }));
    // Split across two chunks, exercising the buffering path.
    dispatch(frames.encodeFrame(frames.BODY_CHUNK, 2, body.subarray(0, 5)));
    dispatch(frames.encodeFrame(frames.BODY_CHUNK, 2, body.subarray(5)));
    dispatch(frames.encodeFrame(frames.BODY_END, 2));
    const result = await framesForStream(2);
    const respHead = result.find((f) => f.type === frames.RESP_HEAD)!;
    expect(frames.decodeJsonPayload<{ status: number }>(respHead.payload).status).toBe(400);
    const responseBody = Buffer.concat(result.filter((f) => f.type === frames.BODY_CHUNK).map((f) => Buffer.from(f.payload)));
    expect(JSON.parse(responseBody.toString()).error).toContain("no active codex session");
  });

  test("two concurrent streams do not cross-talk", async () => {
    seedThread(engine, "thr_1");
    dispatch(frames.encodeJsonFrame(frames.OPEN_HTTP, 10, {
      method: "GET", path: "/api/threads/thr_1", headers: {}, hasBody: false,
    }));
    dispatch(frames.encodeJsonFrame(frames.OPEN_HTTP, 11, {
      method: "GET", path: "/api/threads/thr_1", headers: {}, hasBody: false,
    }));
    const result10 = await framesForStream(10);
    const result11 = await framesForStream(11);
    expect(result10.every((f) => f.streamId === 10)).toBe(true);
    expect(result11.every((f) => f.streamId === 11)).toBe(true);
  });
});

describe("TunnelClient.proxyHttp tags forwarded requests as tunnel traffic", () => {
  let dbPath: string;
  let engine: ThreadManager;
  let server: ReturnType<typeof Bun.serve>;
  let client: TunnelClient;
  let sent: Uint8Array[];

  beforeEach(() => {
    dbPath = `/tmp/vozen-test-${crypto.randomUUID()}.db`;
    engine = new ThreadManager(dbPath);
    const { app, websocket } = createApp(engine, makeFakeConnectManager());
    server = Bun.serve({ port: 0, fetch: app.fetch, websocket });
    client = new TunnelClient("https://vozen.io", "abc", "secret", `http://127.0.0.1:${server.port}`);
    sent = [];
    (client as unknown as ClientInternals).sendFrame = (frame: Uint8Array) => sent.push(frame);
  });

  afterEach(() => {
    server.stop(true);
    engine.db.close();
    try {
      unlinkSync(dbPath);
    } catch {}
  });

  function dispatch(raw: Uint8Array): void {
    (client as unknown as ClientInternals).dispatch(raw);
  }

  async function framesForStream(streamId: number, timeoutMs = 2000): Promise<frames.DecodedFrame[]> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const decoded = sent.map((raw) => frames.decodeFrame(raw)).filter((f) => f.streamId === streamId);
      if (decoded.length && decoded[decoded.length - 1]?.type === frames.BODY_END) return decoded;
      await Bun.sleep(10);
    }
    throw new Error(`stream ${streamId} never reached BODY_END`);
  }

  // The real security property: a tunnel-forwarded request hitting the
  // local-only pair/disconnect routes always gets the 403 guard, because
  // proxyHttp always stamps x-vozen-via-tunnel — regardless of what the
  // remote guest's own request headers said.
  test("a proxied /vozen/connect/pair call is rejected (403), not forwarded to connectManager.pair()", async () => {
    dispatch(frames.encodeJsonFrame(frames.OPEN_HTTP, 1, {
      method: "POST", path: "/vozen/connect/pair",
      headers: { "content-type": "application/json" }, hasBody: true,
    }));
    dispatch(frames.encodeFrame(frames.BODY_CHUNK, 1, new TextEncoder().encode(JSON.stringify({ code: "abc" }))));
    dispatch(frames.encodeFrame(frames.BODY_END, 1));
    const result = await framesForStream(1);
    const respHead = result.find((f) => f.type === frames.RESP_HEAD)!;
    expect(frames.decodeJsonPayload<{ status: number }>(respHead.payload).status).toBe(403);
  });

  // A guest can't un-mark their own request as tunnel traffic — proxyHttp
  // sets x-vozen-via-tunnel after copying the guest's headers, so even a
  // guest who sends their own "x-vozen-via-tunnel: 0" still gets 403.
  test("a guest-supplied x-vozen-via-tunnel header is overridden, not honored", async () => {
    dispatch(frames.encodeJsonFrame(frames.OPEN_HTTP, 2, {
      method: "POST", path: "/vozen/connect/disconnect",
      headers: { "x-vozen-via-tunnel": "0" }, hasBody: false,
    }));
    const result = await framesForStream(2);
    const respHead = result.find((f) => f.type === frames.RESP_HEAD)!;
    expect(frames.decodeJsonPayload<{ status: number }>(respHead.payload).status).toBe(403);
  });
});

describe("TunnelClient WS bridge (against a real local /ws)", () => {
  let dbPath: string;
  let engine: ThreadManager;
  let server: ReturnType<typeof Bun.serve>;
  let client: TunnelClient;
  let sent: Uint8Array[];

  beforeEach(() => {
    dbPath = `/tmp/vozen-test-${crypto.randomUUID()}.db`;
    engine = new ThreadManager(dbPath);
    const { app, websocket } = createApp(engine);
    server = Bun.serve({ port: 0, fetch: app.fetch, websocket });
    client = new TunnelClient("https://vozen.io", "abc", "secret", `http://127.0.0.1:${server.port}`);
    sent = [];
    (client as unknown as ClientInternals).sendFrame = (frame: Uint8Array) => sent.push(frame);
  });

  afterEach(() => {
    server.stop(true);
    engine.db.close();
    try {
      unlinkSync(dbPath);
    } catch {}
  });

  test("OPEN_WS acks and relays a broadcast as WS_DATA", async () => {
    (client as unknown as ClientInternals).dispatch(frames.encodeJsonFrame(frames.OPEN_WS, 5, {
      // A real remote visitor's browser always sends its own Origin
      // (https://<handle>.vozen.io), which the tunnel forwards verbatim —
      // http.ts's wsOriginGuard requires it, so an empty-headers OPEN_WS
      // (no real browser could produce that) is not a valid fixture.
      path: "/ws", headers: { origin: "https://abc.vozen.io" }, protocols: null,
    }));

    const deadline = Date.now() + 2000;
    let ack: frames.DecodedFrame | undefined;
    while (Date.now() < deadline && !ack) {
      ack = sent.map((raw) => frames.decodeFrame(raw)).find((f) => f.type === frames.WS_OPEN_ACK && f.streamId === 5);
      if (!ack) await Bun.sleep(10);
    }
    expect(ack).toBeDefined();

    // Subscribe (as the visitor's bb frontend would) so the broadcast reaches this socket.
    const subscribe = JSON.stringify({ type: "subscribe", target: { kind: "thread-detail", threadId: "thr_1" } });
    (client as unknown as ClientInternals).dispatch(frames.encodeWsData(5, new TextEncoder().encode(subscribe), false));
    await Bun.sleep(50);

    engine.broadcastChanged("thread", "thr_1", ["events-appended"]);

    let dataFrame: frames.DecodedFrame | undefined;
    const deadline2 = Date.now() + 2000;
    while (Date.now() < deadline2 && !dataFrame) {
      dataFrame = sent.map((raw) => frames.decodeFrame(raw)).find((f) => f.type === frames.WS_DATA && f.streamId === 5);
      if (!dataFrame) await Bun.sleep(10);
    }
    expect(dataFrame).toBeDefined();
    const { isBinary, data } = frames.decodeWsData(dataFrame!.payload);
    expect(isBinary).toBe(false);
    expect(JSON.parse(new TextDecoder().decode(data))).toEqual({
      type: "changed", entity: "thread", id: "thr_1", changes: ["events-appended"],
    });
  });

  test("activeStreamCount tracks a WS bridge opening and closing", async () => {
    expect(client.activeStreamCount).toBe(0);

    (client as unknown as ClientInternals).dispatch(frames.encodeJsonFrame(frames.OPEN_WS, 7, {
      path: "/ws", headers: { origin: "https://abc.vozen.io" }, protocols: null,
    }));
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline && client.activeStreamCount === 0) await Bun.sleep(10);
    expect(client.activeStreamCount).toBe(1);

    (client as unknown as ClientInternals).dispatch(frames.encodeFrame(frames.CLOSE_STREAM, 7));
    const deadline2 = Date.now() + 2000;
    while (Date.now() < deadline2 && client.activeStreamCount === 1) await Bun.sleep(10);
    expect(client.activeStreamCount).toBe(0);
  });

  test("lastActivityAt updates when a frame is dispatched", async () => {
    expect(client.lastActivityAt).toBeNull();

    const before = Date.now();
    (client as unknown as ClientInternals).dispatch(frames.encodeJsonFrame(frames.OPEN_WS, 9, {
      path: "/ws", headers: {}, protocols: null,
    }));

    expect(client.lastActivityAt).not.toBeNull();
    expect(client.lastActivityAt!).toBeGreaterThanOrEqual(before);
  });
});

describe("TunnelClient active heartbeat (against a fake tunnel WebSocket server)", () => {
  // A real WebSocket server standing in for the worker's /__tunnel — no
  // mocked socket, just a fake peer that can choose whether to ack.
  function fakeTunnelServer(respondToPing: boolean) {
    const pingsReceived: string[] = [];
    const server = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch(req, srv) {
        if (srv.upgrade(req)) return;
        return new Response("expected websocket", { status: 400 });
      },
      websocket: {
        message(ws, raw) {
          const text = typeof raw === "string" ? raw : Buffer.from(raw).toString("utf8");
          if (text === frames.HEARTBEAT_PING) {
            pingsReceived.push(text);
            if (respondToPing) ws.send(frames.HEARTBEAT_PONG);
          }
        },
      },
    });
    return { server, pingsReceived };
  }

  // dialUrl is normally built from workerUrl+handle (a real subdomain of a
  // real host) — pointed at the fake server by poking the private field
  // directly, same trick the other describe blocks use for sendFrame/dispatch.
  function dialAt(client: TunnelClient, url: string): void {
    (client as unknown as DialUrlInternals).dialUrl = url;
  }

  test("sends a heartbeat ping at the configured interval", async () => {
    const { server, pingsReceived } = fakeTunnelServer(true);
    const client = new TunnelClient("http://vozen.io", "abc", "secret", "http://127.0.0.1:1", { intervalMs: 30 });
    dialAt(client, `ws://127.0.0.1:${server.port}/__tunnel?v=1`);
    void client.runForever();
    try {
      await waitFor(() => pingsReceived.length >= 3);
    } finally {
      client.stop();
      server.stop(true);
    }
  });

  test("no ACK within the heartbeat deadline forces a reconnect", async () => {
    const { server } = fakeTunnelServer(false);
    const client = new TunnelClient("http://vozen.io", "abc", "secret", "http://127.0.0.1:1", {
      intervalMs: 20,
      deadlineMs: 60,
    });
    dialAt(client, `ws://127.0.0.1:${server.port}/__tunnel?v=1`);
    let disconnectCount = 0;
    void client.runForever(undefined, () => {
      disconnectCount += 1;
    });
    try {
      await waitFor(() => disconnectCount >= 1);
    } finally {
      client.stop();
      server.stop(true);
    }
  });
});

describe("TunnelClient.runForever reconnect scheduling", () => {
  test("reports a nextRetryAt after a failed dial, matching the backoff delay", async () => {
    // workerUrl itself points at a closed local port, so the outbound dial
    // (built from workerUrl + handle) fails immediately — no real network,
    // and importantly no request against the real vozen.io Worker.
    const client = new TunnelClient("http://127.0.0.1:1", "abc", "secret");
    const before = Date.now();
    let nextRetryAt: number | null | undefined;
    const runPromise = client.runForever(undefined, (_error, retryAt) => {
      nextRetryAt = retryAt;
      client.stop();
    });
    await runPromise;

    expect(nextRetryAt).not.toBeNull();
    expect(nextRetryAt).not.toBeUndefined();
    // RECONNECT_MIN_MS is 1000 — allow slack for test scheduling jitter.
    expect(nextRetryAt!).toBeGreaterThanOrEqual(before + 900);
    expect(nextRetryAt!).toBeLessThan(before + 5000);
  });
});
