/**
 * Server-side counterpart to terminalDaemon.ts: connects to the local PTY
 * daemon over WS, spawning it (detached — see terminalManager.test.ts /
 * the task notes for what was verified about Bun.spawn + unref surviving a
 * parent exit) if it isn't already running, and reconnecting with backoff
 * if the connection drops. `TerminalManager` is the only caller.
 */
import path from "node:path";
import {
  TERMINAL_DAEMON_INTERNAL_ORIGIN,
  TERMINAL_DAEMON_PORT,
  type TerminalDaemonClientMessage,
  type TerminalDaemonServerMessage,
  type TerminalDaemonStart,
} from "./terminalDaemonProtocol.ts";

const RECONNECT_MIN_DELAY_MS = 250;
const RECONNECT_MAX_DELAY_MS = 5_000;

export class DaemonClient {
  private ws: WebSocket | null = null;
  private connectPromise: Promise<void> | null = null;
  private reconnectDelayMs = RECONNECT_MIN_DELAY_MS;
  private daemonSpawnAttempted = false;
  private disposed = false;
  private readonly sendQueue: TerminalDaemonClientMessage[] = [];

  private readonly outputHandlers = new Map<string, (dataBase64: string) => void>();
  private readonly spawnedHandlers = new Map<string, () => void>();
  private readonly spawnFailedHandlers = new Map<string, (message: string) => void>();
  private readonly exitHandlers = new Map<string, (exitCode: number) => void>();

  constructor(private readonly port: number = TERMINAL_DAEMON_PORT) {}

  onOutput(id: string, cb: (dataBase64: string) => void): void {
    this.outputHandlers.set(id, cb);
  }

  onSpawned(id: string, cb: () => void): void {
    this.spawnedHandlers.set(id, cb);
  }

  onSpawnFailed(id: string, cb: (message: string) => void): void {
    this.spawnFailedHandlers.set(id, cb);
  }

  onExit(id: string, cb: (exitCode: number) => void): void {
    this.exitHandlers.set(id, cb);
  }

  create(id: string, cwd: string, cols: number, rows: number, start: TerminalDaemonStart | undefined): void {
    this.send({ type: "create", id, cwd, cols, rows, start });
  }

  input(id: string, dataBase64: string): void {
    this.send({ type: "input", id, dataBase64 });
  }

  resize(id: string, cols: number, rows: number): void {
    this.send({ type: "resize", id, cols, rows });
  }

  close(id: string, mode: "force" | "if-clean"): void {
    this.send({ type: "close", id, mode });
  }

  /** Stops reconnecting/auto-spawning and closes the socket — for tests
   * tearing down their own daemon, so an orphaned reconnect loop doesn't
   * outlive it and spawn a redundant real daemon subprocess once the test's
   * port frees up. Not used by the long-running server itself. */
  dispose(): void {
    this.disposed = true;
    this.ws?.close();
    this.ws = null;
  }

  private cleanupHandlers(id: string): void {
    this.outputHandlers.delete(id);
    this.spawnedHandlers.delete(id);
    this.spawnFailedHandlers.delete(id);
    this.exitHandlers.delete(id);
  }

  private send(message: TerminalDaemonClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return;
    }
    this.sendQueue.push(message);
    this.ensureConnecting();
  }

  private flushQueue(): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    for (const message of this.sendQueue.splice(0)) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private ensureConnecting(): void {
    if (this.disposed || this.ws || this.connectPromise) return;
    this.connectPromise = this.connectLoop();
  }

  private async connectLoop(): Promise<void> {
    let attempt = 0;
    for (;;) {
      if (this.disposed) {
        this.connectPromise = null;
        return;
      }
      try {
        this.ws = await this.openSocket();
        this.connectPromise = null;
        this.reconnectDelayMs = RECONNECT_MIN_DELAY_MS;
        this.flushQueue();
        return;
      } catch {
        attempt += 1;
        // Don't spawn off one failed attempt — a fresh WS server can flake
        // on its very first handshake. Only conclude "nothing is listening,
        // start the daemon" after a second consecutive failure.
        if (attempt >= 2) this.spawnDaemonIfNeeded();
        await Bun.sleep(this.reconnectDelayMs);
        this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, RECONNECT_MAX_DELAY_MS);
      }
    }
  }

  private openSocket(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      // Origin is otherwise a browser-only header (Bun's WebSocket accepts
      // a headers option beyond the DOM lib's typing) — sending it here is
      // what lets terminalDaemon.ts's fetch() distinguish us from any
      // browser-initiated connection. See TERMINAL_DAEMON_INTERNAL_ORIGIN.
      const ws = new WebSocket(`ws://127.0.0.1:${this.port}/`, {
        headers: { Origin: TERMINAL_DAEMON_INTERNAL_ORIGIN },
      } as unknown as string[]);
      const onOpen = () => {
        cleanup();
        resolve(ws);
      };
      const onError = () => {
        cleanup();
        reject(new Error(`failed to connect to terminal daemon on port ${this.port}`));
      };
      const cleanup = () => {
        ws.removeEventListener("open", onOpen);
        ws.removeEventListener("error", onError);
      };
      ws.addEventListener("open", onOpen);
      ws.addEventListener("error", onError);
      ws.addEventListener("message", (event) => this.handleMessage(event.data));
      ws.addEventListener("close", () => this.handleDisconnect(ws));
    });
  }

  private handleDisconnect(ws: WebSocket): void {
    if (this.ws !== ws) return; // stale listener from a socket we already replaced
    this.ws = null;
    this.ensureConnecting();
  }

  private handleMessage(raw: unknown): void {
    let message: TerminalDaemonServerMessage;
    try {
      message = JSON.parse(typeof raw === "string" ? raw : String(raw));
    } catch {
      return;
    }
    if (message.type === "spawned") {
      this.spawnedHandlers.get(message.id)?.();
    } else if (message.type === "spawn_failed") {
      this.spawnFailedHandlers.get(message.id)?.(message.message);
      this.cleanupHandlers(message.id);
    } else if (message.type === "output") {
      this.outputHandlers.get(message.id)?.(message.dataBase64);
    } else if (message.type === "exit") {
      this.exitHandlers.get(message.id)?.(message.exitCode);
      this.cleanupHandlers(message.id);
    }
  }

  /** Spawns terminalDaemon.ts as a detached subprocess, at most once per
   * DaemonClient. Detached: no stdio pipes held open, `unref()`'d, and we
   * never await its exit — verified empirically that this keeps it alive
   * after this (server) process exits. */
  private spawnDaemonIfNeeded(): void {
    if (this.daemonSpawnAttempted) return;
    this.daemonSpawnAttempted = true;
    const daemonPath = path.join(import.meta.dir, "terminalDaemon.ts");
    const proc = Bun.spawn(["bun", daemonPath, String(this.port)], {
      stdio: ["ignore", "ignore", "ignore"],
    });
    proc.unref();
  }
}
