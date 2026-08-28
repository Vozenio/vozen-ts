/**
 * Bun-native Unix socket client for herdr's own event-subscription channel
 * (internal/herdr/events.go in herdr-mobile-relay) — a real push channel,
 * unlike the CLI (`herdr agent list`), which is a poll-only snapshot.
 * Protocol (verified against a real herdr daemon, not guessed): newline-
 * delimited JSON, both directions. Subscribe request:
 * `{id, method:"events.subscribe", params:{subscriptions:[{type}...]}}`;
 * confirmation `{id, result:{type:"subscription_started"}}`; pushed events
 * `{event:"pane_updated"|"pane_agent_detected"|"pane_exited", data}` — note
 * the wire event names are underscored, not dotted like the subscription
 * request's `type` values.
 */

import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import type { Socket } from "bun";

const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 30_000;
const SUBSCRIPTION_TYPES = ["pane.updated", "pane.agent_detected", "pane.exited"] as const;
const EVENT_NAMES = new Set(["pane_updated", "pane_agent_detected", "pane_exited"]);

export interface HerdrPaneEvent {
  type: "pane_updated" | "pane_agent_detected" | "pane_exited";
  paneId: string;
  data: unknown;
}

export interface HerdrEventClientOptions {
  /** Test-only: overrides the resolved socket path. */
  socketPath?: string;
  /** Test-only: overrides `process.env` for socket-path resolution. */
  env?: Record<string, string | undefined>;
}

/** Same priority herdr-mobile-relay's own config.go uses: explicit env var,
 * then XDG, then the plain home-relative default. */
function resolveSocketPath(options?: HerdrEventClientOptions): string {
  if (options?.socketPath) return options.socketPath;
  const env = options?.env ?? process.env;
  const explicit = env.HERDR_SOCKET_PATH?.trim();
  if (explicit) return explicit;
  const configHome = env.XDG_CONFIG_HOME?.trim() || path.join(os.homedir(), ".config");
  return path.join(configHome, "herdr", "herdr.sock");
}

function paneIdOf(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const record = data as Record<string, unknown>;
  const pane = record.pane;
  if (pane && typeof pane === "object" && typeof (pane as Record<string, unknown>).pane_id === "string") {
    return (pane as Record<string, unknown>).pane_id as string;
  }
  return typeof record.pane_id === "string" ? record.pane_id : "";
}

type EventListener = (event: HerdrPaneEvent) => void;

export class HerdrEventClient {
  private readonly socketPath: string;
  private socket: Socket<undefined> | null = null;
  private buffer = "";
  private started = false;
  private stopping = false;
  private readonly listeners: EventListener[] = [];

  constructor(options?: HerdrEventClientOptions) {
    this.socketPath = resolveSocketPath(options);
  }

  onEvent(listener: EventListener): void {
    this.listeners.push(listener);
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.stopping = false;
    void this.runForever();
  }

  stop(): void {
    this.stopping = true;
    this.started = false;
    this.socket?.end();
    this.socket = null;
  }

  private async runForever(): Promise<void> {
    let delay = RECONNECT_MIN_MS;
    while (!this.stopping) {
      try {
        await this.connectOnce();
        delay = RECONNECT_MIN_MS;
      } catch {
        // connection never subscribed successfully — retry with backoff below
      }
      if (this.stopping) return;
      await Bun.sleep(delay);
      delay = Math.min(delay * 2, RECONNECT_MAX_MS);
    }
  }

  /** Resolves once the connection has subscribed and later closed normally
   * (so the caller resets its backoff); rejects if it never managed to
   * subscribe at all (so the caller backs off before retrying). */
  private connectOnce(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.buffer = "";
      const requestId = randomUUID();
      let subscribed = false;

      Bun.connect({
        unix: this.socketPath,
        socket: {
          open: (socket) => {
            // stop() can land between Bun.connect() and this callback (no
            // await between a caller's start()/stop() pair) — socket.end()
            // in stop() is a no-op against a socket that doesn't exist yet,
            // so the guard has to live here too, or the connection subscribes
            // and keeps delivering events after stop() already returned.
            if (this.stopping) {
              socket.end();
              return;
            }
            this.socket = socket;
            socket.write(`${JSON.stringify({
              id: requestId,
              method: "events.subscribe",
              params: { subscriptions: SUBSCRIPTION_TYPES.map((type) => ({ type })) },
            })}\n`);
          },
          data: (socket, data) => {
            this.buffer += data.toString();
            let newlineIndex: number;
            while ((newlineIndex = this.buffer.indexOf("\n")) !== -1) {
              const line = this.buffer.slice(0, newlineIndex);
              this.buffer = this.buffer.slice(newlineIndex + 1);
              if (!line.trim()) continue;
              let parsed: Record<string, unknown>;
              try {
                parsed = JSON.parse(line);
              } catch {
                continue;
              }
              if (!subscribed && parsed.id === requestId) {
                const result = parsed.result as Record<string, unknown> | undefined;
                if (result?.type === "subscription_started") {
                  subscribed = true;
                } else {
                  socket.end();
                  reject(new Error(parsed.error ? JSON.stringify(parsed.error) : "herdr event subscription failed"));
                }
                continue;
              }
              const eventName = parsed.event;
              if (typeof eventName !== "string" || !EVENT_NAMES.has(eventName)) continue;
              const eventData = parsed.data;
              const event: HerdrPaneEvent = {
                type: eventName as HerdrPaneEvent["type"],
                paneId: paneIdOf(eventData),
                data: eventData,
              };
              for (const listener of this.listeners) listener(event);
            }
          },
          close: () => {
            this.socket = null;
            if (subscribed) resolve();
            else reject(new Error("herdr event socket closed before subscribing"));
          },
          error: (_socket, error) => {
            if (!subscribed) reject(error);
          },
        },
      }).catch(reject);
    });
  }
}
