/**
 * Real PTY-backed terminal sessions, backing bb's own `/api/v1/terminals`
 * REST surface + `/ws/terminals/:id` streaming socket (see
 * bb-packages/server-contract/src/api/terminals.ts for the wire contract
 * this mirrors field-for-field).
 *
 * bb's own real implementation runs this on Node (bb-app's package.json
 * pins `engines.node`) via `node-pty` — a native addon built against
 * Node's ABI. Under vozen's Bun server, node-pty installs but its I/O
 * events never fire (confirmed empirically: spawn succeeds, onData/onExit
 * never call back — Bun's Node-API compat layer doesn't wire node-pty's
 * internal libuv handles). Bun 1.4.0 ships its own native PTY instead
 * (`Bun.spawn({terminal: {...}})`).
 *
 * The PTY itself is not spawned in this process: it's owned by the
 * standalone terminalDaemon.ts process (reached through `DaemonClient`) so
 * a server restart/redeploy doesn't kill terminals the user is using. This
 * class keeps owning everything that's server domain state — session
 * metadata, history buffering for replay, and WS socket broadcast.
 */

import { randomUUID } from "node:crypto";
import os from "node:os";
import type {
  CloseTerminalRequest,
  CreateTerminalRequest,
  TerminalListQuery,
  TerminalOutputQuery,
  TerminalOutputResponse,
  TerminalServerMessage,
  TerminalSession,
} from "@bb/server-contract";
import { TERMINAL_DATA_MAX_BYTES } from "@bb/domain";
import { DaemonClient } from "./daemonClient.ts";
import type { ThreadManager } from "./engine.ts";
import { VOZEN_HOST_ID } from "./bbShim.ts";

const HISTORY_MAX_CHUNKS = 2000;
const HISTORY_MAX_BYTES = 2 * 1024 * 1024;

export interface TerminalWsSocket {
  send(data: string): void;
}

interface HistoryChunk {
  seq: number;
  dataBase64: string;
  bytes: number;
}

interface TerminalRuntime {
  session: TerminalSession;
  history: HistoryChunk[];
  historyBytes: number;
  truncated: boolean;
  nextSeq: number;
  sockets: Set<TerminalWsSocket>;
}

function newTerminalId(): string {
  return `term_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

function send(socket: TerminalWsSocket, message: TerminalServerMessage): void {
  try {
    socket.send(JSON.stringify(message));
  } catch {
    // socket is already gone — the caller's onClose handler will detach it
  }
}

export class TerminalManager {
  private readonly sessions = new Map<string, TerminalRuntime>();

  constructor(
    private readonly engine: ThreadManager,
    private readonly daemonClient: DaemonClient = new DaemonClient(),
  ) {}

  /** Every terminal needs a real starting directory. vozen has exactly one
   * synthetic environment and no per-host filesystem concept beyond "the
   * machine vozen itself runs on", so `environment`/`host_path` targets
   * both just fall back to the home directory — only `thread` gets a
   * meaningful cwd (the thread's own working directory). */
  private resolveTarget(
    target: CreateTerminalRequest["target"],
  ): { threadId: string | null; environmentId: string | null; hostId: string; cwd: string } | null {
    if (target.kind === "thread") {
      const thread = this.engine.show(target.threadId);
      if (!thread) return null;
      return { threadId: target.threadId, environmentId: null, hostId: VOZEN_HOST_ID, cwd: thread.cwd };
    }
    if (target.kind === "environment") {
      return { threadId: null, environmentId: target.environmentId, hostId: VOZEN_HOST_ID, cwd: os.homedir() };
    }
    return { threadId: null, environmentId: null, hostId: target.hostId, cwd: target.cwd ?? os.homedir() };
  }

  list(query: TerminalListQuery): TerminalSession[] {
    return [...this.sessions.values()].map((r) => r.session).filter((session) => {
      if (query.threadId !== undefined) return session.threadId === query.threadId;
      if (query.environmentId !== undefined) return session.environmentId === query.environmentId;
      if (query.hostId !== undefined) return session.hostId === query.hostId;
      return false;
    });
  }

  get(id: string): TerminalSession | null {
    return this.sessions.get(id)?.session ?? null;
  }

  /** Resolves once the daemon has confirmed the spawn (or it failed/timed
   * out), so the returned session's status is already "running" on success.
   * The HTTP client renders on the POST response and only attaches the
   * terminal WebSocket afterwards — returning at "starting" would leave it
   * waiting for a status change it can never observe. */
  async create(request: CreateTerminalRequest): Promise<TerminalSession | null> {
    const resolved = this.resolveTarget(request.target);
    if (!resolved) return null;

    const id = newTerminalId();
    const now = Date.now();
    const session: TerminalSession = {
      id,
      threadId: resolved.threadId,
      environmentId: resolved.environmentId,
      hostId: resolved.hostId,
      title: request.title ?? "Terminal",
      initialCwd: resolved.cwd,
      cols: request.cols,
      rows: request.rows,
      status: "starting",
      exitCode: null,
      closeReason: null,
      createdAt: now,
      updatedAt: now,
      lastUserInputAt: null,
    };
    const runtime: TerminalRuntime = {
      session, history: [], historyBytes: 0, truncated: false, nextSeq: 0, sockets: new Set(),
    };
    this.sessions.set(id, runtime);
    await this.spawn(runtime, request, resolved.cwd);
    return runtime.session;
  }

  /** Resolves when the daemon acks the spawn (spawned or spawn_failed), or
   * after a 10s timeout so a wedged daemon can't hang the HTTP request. */
  private spawn(runtime: TerminalRuntime, request: CreateTerminalRequest, cwd: string): Promise<void> {
    const id = runtime.session.id;
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, 10_000);
      const settle = () => {
        clearTimeout(timer);
        resolve();
      };
      this.daemonClient.onSpawned(id, () => {
        this.updateSession(runtime, { status: "running" });
        settle();
      });
      this.daemonClient.onSpawnFailed(id, (message) => {
        this.updateSession(runtime, { status: "exited", closeReason: "process-exit" });
        this.broadcast(runtime, { type: "error", code: "spawn_failed", message });
        settle();
      });
      this.daemonClient.onOutput(id, (dataBase64) => this.onData(runtime, dataBase64));
      this.daemonClient.onExit(id, (exitCode) => this.onExit(runtime, exitCode));
      this.daemonClient.create(id, cwd, request.cols, request.rows, request.start);
    });
  }

  private onData(runtime: TerminalRuntime, dataBase64: string): void {
    const data = Buffer.from(dataBase64, "base64");
    for (let offset = 0; offset < data.length; offset += TERMINAL_DATA_MAX_BYTES) {
      const piece = data.subarray(offset, offset + TERMINAL_DATA_MAX_BYTES);
      const chunk: HistoryChunk = { seq: runtime.nextSeq, dataBase64: Buffer.from(piece).toString("base64"), bytes: piece.length };
      runtime.nextSeq += 1;
      runtime.history.push(chunk);
      runtime.historyBytes += chunk.bytes;
      while (runtime.history.length > HISTORY_MAX_CHUNKS || runtime.historyBytes > HISTORY_MAX_BYTES) {
        const dropped = runtime.history.shift();
        if (!dropped) break;
        runtime.historyBytes -= dropped.bytes;
        runtime.truncated = true;
      }
      this.broadcast(runtime, { type: "output", chunk: { seq: chunk.seq, dataBase64: chunk.dataBase64 } });
    }
  }

  private onExit(runtime: TerminalRuntime, exitCode: number): void {
    this.updateSession(runtime, { status: "exited", exitCode, closeReason: runtime.session.closeReason ?? "process-exit" });
    this.broadcast(runtime, { type: "exited", session: runtime.session });
  }

  // Every status/field mutation broadcasts here — the client only learns
  // about state changes through WS ("session-updated" onwards), no polling
  // fallback exists. A caller that mutates without going through this method
  // silently leaves attached clients on stale state (e.g. stuck "starting").
  private updateSession(runtime: TerminalRuntime, patch: Partial<TerminalSession>): void {
    runtime.session = { ...runtime.session, ...patch, updatedAt: Date.now() };
    this.broadcast(runtime, { type: "session-updated", session: runtime.session });
  }

  private broadcast(runtime: TerminalRuntime, message: TerminalServerMessage): void {
    for (const socket of runtime.sockets) send(socket, message);
  }

  rename(id: string, title: string): TerminalSession | null {
    const runtime = this.sessions.get(id);
    if (!runtime) return null;
    this.updateSession(runtime, { title });
    return runtime.session;
  }

  resize(id: string, cols: number, rows: number): TerminalSession | null {
    const runtime = this.sessions.get(id);
    if (!runtime) return null;
    // Unknown/already-exited id — daemon silently ignores it; cols/rows
    // still update below for display.
    this.daemonClient.resize(id, cols, rows);
    this.updateSession(runtime, { cols, rows });
    return runtime.session;
  }

  input(id: string, dataBase64: string): TerminalSession | null {
    const runtime = this.sessions.get(id);
    if (!runtime) return null;
    // Unknown/already-exited id — daemon silently ignores it.
    this.daemonClient.input(id, dataBase64);
    this.updateSession(runtime, { lastUserInputAt: Date.now() });
    return runtime.session;
  }

  close(id: string, request: CloseTerminalRequest): TerminalSession | null {
    const runtime = this.sessions.get(id);
    if (!runtime) return null;
    this.updateSession(runtime, { closeReason: request.reason });
    this.daemonClient.close(id, request.mode);
    return runtime.session;
  }

  restart(id: string): TerminalSession | null {
    const runtime = this.sessions.get(id);
    if (!runtime) return null;
    this.daemonClient.close(id, "force");
    const resolved = this.resolveTarget(
      runtime.session.threadId
        ? { kind: "thread", threadId: runtime.session.threadId }
        : { kind: "host_path", hostId: runtime.session.hostId, cwd: runtime.session.initialCwd },
    );
    const cwd = resolved?.cwd ?? runtime.session.initialCwd;
    runtime.history = [];
    runtime.historyBytes = 0;
    runtime.truncated = false;
    runtime.nextSeq = 0;
    this.updateSession(runtime, { status: "starting", exitCode: null, closeReason: null });
    // Restart is observed over the already-attached socket's session-updated
    // broadcasts, so no need to hold the caller until the spawn ack here.
    void this.spawn(runtime, { cols: runtime.session.cols, rows: runtime.session.rows, target: { kind: "host_path", hostId: runtime.session.hostId, cwd }, }, cwd);
    return runtime.session;
  }

  output(id: string, query: TerminalOutputQuery): TerminalOutputResponse | null {
    const runtime = this.sessions.get(id);
    if (!runtime) return null;
    const sinceSeq = query.sinceSeq ?? 0;
    let chunks = runtime.history.filter((chunk) => chunk.seq >= sinceSeq);
    if (query.limitChunks !== undefined) chunks = chunks.slice(0, query.limitChunks);
    if (query.tailBytes !== undefined) {
      let total = 0;
      const kept: HistoryChunk[] = [];
      for (let i = chunks.length - 1; i >= 0; i -= 1) {
        const chunk = chunks[i]!;
        if (total + chunk.bytes > query.tailBytes && kept.length > 0) break;
        kept.unshift(chunk);
        total += chunk.bytes;
      }
      chunks = kept;
    }
    return {
      chunks: chunks.map((chunk) => ({ seq: chunk.seq, dataBase64: chunk.dataBase64 })),
      nextSeq: runtime.nextSeq,
      truncated: runtime.truncated,
    };
  }

  /** Attaches a WS client: replays buffered history from `sinceSeq`, then
   * streams live output until `detach()`. Returns null for an unknown
   * terminal (caller sends a `terminal_not_found` error and closes). */
  attach(id: string, socket: TerminalWsSocket, sinceSeq: number): TerminalSession | null {
    const runtime = this.sessions.get(id);
    if (!runtime) return null;
    runtime.sockets.add(socket);
    const replayStartSeq = runtime.history[0]?.seq ?? runtime.nextSeq;
    send(socket, { type: "attached", session: runtime.session, replayStartSeq, nextSeq: runtime.nextSeq });
    for (const chunk of runtime.history) {
      if (chunk.seq < sinceSeq) continue;
      send(socket, { type: "output", chunk: { seq: chunk.seq, dataBase64: chunk.dataBase64 } });
    }
    return runtime.session;
  }

  detach(id: string, socket: TerminalWsSocket): void {
    this.sessions.get(id)?.sockets.delete(socket);
  }

  handleClientMessage(
    id: string,
    message: { type: "input"; dataBase64: string } | { type: "resize"; cols: number; rows: number } | { type: "close"; reason: "user" } | { type: "ping" },
    socket: TerminalWsSocket,
  ): void {
    if (message.type === "input") this.input(id, message.dataBase64);
    else if (message.type === "resize") this.resize(id, message.cols, message.rows);
    else if (message.type === "close") this.close(id, { mode: "if-clean", reason: "user" });
    else if (message.type === "ping") send(socket, { type: "pong" });
  }
}
