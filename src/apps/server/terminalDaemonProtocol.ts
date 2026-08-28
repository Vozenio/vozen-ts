/**
 * Wire contract between the server's `DaemonClient` and the standalone
 * `terminalDaemon.ts` process. The daemon is a "dumb" PTY host — it only
 * knows `terminalId + cwd + cols + rows + start`, no server domain concepts
 * (threadId/environmentId/history/seq). See terminalDaemon.ts and
 * daemonClient.ts.
 */

export const TERMINAL_DAEMON_PORT = 38891;

/** Origin value `daemonClient.ts` sends on its WS upgrade, and the only one
 * `terminalDaemon.ts` accepts. A real browser can't forge its Origin
 * header, so requiring this exact (browser-unreachable) value blocks every
 * browser-initiated connection to the daemon's port — including a drive-by
 * page on the LAN — while still letting our own `DaemonClient` connect. */
export const TERMINAL_DAEMON_INTERNAL_ORIGIN = "vozen-internal-daemon-client";

export type TerminalDaemonStart =
  | { mode: "shell" }
  | { mode: "command"; command: string };

export type TerminalDaemonClientMessage =
  | { type: "create"; id: string; cwd: string; cols: number; rows: number; start?: TerminalDaemonStart }
  | { type: "input"; id: string; dataBase64: string }
  | { type: "resize"; id: string; cols: number; rows: number }
  | { type: "close"; id: string; mode: "force" | "if-clean" };

export type TerminalDaemonServerMessage =
  | { type: "spawned"; id: string }
  | { type: "spawn_failed"; id: string; message: string }
  | { type: "output"; id: string; dataBase64: string }
  | { type: "exit"; id: string; exitCode: number };
