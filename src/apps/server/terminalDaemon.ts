/**
 * Standalone PTY host. Runs as its own process so terminals survive a
 * server restart/redeploy — the server no longer holds the PTY file
 * descriptor. "Dumb" by design: knows only `terminalId + cwd + cols + rows
 * + start`, nothing about threads/environments/history. See daemonClient.ts
 * for the server-side counterpart and terminalDaemonProtocol.ts for the
 * wire contract.
 *
 * Started two ways:
 *  - `startDaemon(port)` in-process (used by tests, and by DaemonClient
 *    when it spawns this file as a subprocess via `bun terminalDaemon.ts
 *    <port>` — see the `import.meta.main` block below).
 */
import { accessSync, constants as fsConstants } from "node:fs";
import os from "node:os";
import {
  consumePrimaryDeviceAttributesQueries,
  MAX_PRIMARY_DEVICE_ATTRIBUTES_REPLIES_PER_CHUNK,
  PRIMARY_DEVICE_ATTRIBUTES_RESPONSE,
} from "./terminalDa1.ts";
import {
  TERMINAL_DAEMON_INTERNAL_ORIGIN,
  TERMINAL_DAEMON_PORT,
  type TerminalDaemonClientMessage,
  type TerminalDaemonServerMessage,
  type TerminalDaemonStart,
} from "./terminalDaemonProtocol.ts";

interface PtyEntry {
  proc: ReturnType<typeof Bun.spawn>;
}

function isExecutable(path: string): boolean {
  try {
    accessSync(path, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

// The account's registered default shell (os.userInfo().shell, backed by
// Directory Services on macOS / /etc/passwd elsewhere) — not
// process.env.SHELL. SHELL is just an inherited env var: it reflects
// whatever launched this process (an IDE, an agent CLI, a nested
// interactive shell someone typed for the moment), not the user's actual
// configured shell, so an unrelated fish session upstream shouldn't decide
// what shell a terminal panel opens.
function resolveDefaultShell(): string {
  const candidates = [os.userInfo().shell, "/bin/zsh", "/bin/bash", "/bin/sh"].filter(
    (candidate): candidate is string => Boolean(candidate),
  );
  for (const candidate of candidates) {
    if (isExecutable(candidate)) return candidate;
  }
  return "/bin/sh";
}

function shellCommand(start: TerminalDaemonStart | undefined): string[] {
  const shell = resolveDefaultShell();
  if (start?.mode === "command") return [shell, "-lc", start.command];
  return [shell, "-l"];
}

export function startDaemon(port: number): { port: number; stop(): void } {
  const ptys = new Map<string, PtyEntry>();
  const clients = new Set<import("bun").ServerWebSocket<unknown>>();

  function broadcast(message: TerminalDaemonServerMessage): void {
    const text = JSON.stringify(message);
    for (const client of clients) {
      try {
        client.send(text);
      } catch {
        // client already gone — its close handler will remove it
      }
    }
  }

  function handleCreate(message: Extract<TerminalDaemonClientMessage, { type: "create" }>): void {
    let pendingPrimaryDeviceAttributesQuery = "";
    // A restart (close id, then immediately create id again) can leave a
    // just-killed proc's async `data`/`exited` callbacks firing after the
    // new proc for the same id is already tracked. Guard by identity —
    // same pattern bb's own host-daemon uses — so a stale callback can't
    // broadcast for, or delete the map entry of, the new proc.
    let proc: ReturnType<typeof Bun.spawn> | undefined;
    try {
      proc = Bun.spawn(shellCommand(message.start), {
        cwd: message.cwd,
        env: { ...process.env, TERM: "xterm-256color" },
        terminal: {
          cols: message.cols,
          rows: message.rows,
          data: (terminal, data) => {
            if (ptys.get(message.id)?.proc !== proc) return;
            const text = Buffer.from(data).toString("utf8");
            const result = consumePrimaryDeviceAttributesQueries(pendingPrimaryDeviceAttributesQuery, text);
            pendingPrimaryDeviceAttributesQuery = result.pendingQuery;
            if (result.queryCount > 0) {
              const replyCount = Math.min(result.queryCount, MAX_PRIMARY_DEVICE_ATTRIBUTES_REPLIES_PER_CHUNK);
              try {
                terminal.write(PRIMARY_DEVICE_ATTRIBUTES_RESPONSE.repeat(replyCount));
              } catch {
                // process already exited — no-op
              }
            }
            if (result.output.length > 0) {
              broadcast({ type: "output", id: message.id, dataBase64: Buffer.from(result.output, "utf8").toString("base64") });
            }
          },
        },
      });
      ptys.set(message.id, { proc });
      broadcast({ type: "spawned", id: message.id });
      void proc.exited.then((exitCode) => {
        if (ptys.get(message.id)?.proc !== proc) return;
        ptys.delete(message.id);
        broadcast({ type: "exit", id: message.id, exitCode });
      });
    } catch (error) {
      broadcast({ type: "spawn_failed", id: message.id, message: error instanceof Error ? error.message : String(error) });
    }
  }

  function handleMessage(raw: string): void {
    let message: TerminalDaemonClientMessage;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    if (message.type === "create") {
      handleCreate(message);
      return;
    }
    const entry = ptys.get(message.id);
    if (!entry) return; // unknown/already-exited id — silently ignore
    try {
      if (message.type === "input") entry.proc.terminal?.write(Buffer.from(message.dataBase64, "base64"));
      else if (message.type === "resize") entry.proc.terminal?.resize(message.cols, message.rows);
      else if (message.type === "close") {
        // Plain `.kill()` sends SIGTERM, which an interactive login shell
        // (job control, its own trap handling) can simply not act on —
        // observed hanging indefinitely in practice. "force" means force:
        // SIGKILL actually guarantees termination.
        if (message.mode === "force") entry.proc.kill("SIGKILL");
        else entry.proc.terminal?.close();
      }
    } catch {
      // process already exited — no-op
    }
  }

  const server = Bun.serve({
    port,
    hostname: "127.0.0.1",
    fetch(req, srv) {
      // Only our own DaemonClient (daemonClient.ts) sends this Origin — a
      // real browser can't forge it, so this blocks every browser-
      // initiated WS connection to this port (e.g. a drive-by page on the
      // LAN spawning arbitrary shells via a `create` message).
      if (req.headers.get("origin") !== TERMINAL_DAEMON_INTERNAL_ORIGIN) {
        return new Response("forbidden", { status: 403 });
      }
      if (srv.upgrade(req)) return;
      return new Response("vozen terminal daemon", { status: 200 });
    },
    websocket: {
      open(ws) {
        clients.add(ws);
      },
      close(ws) {
        clients.delete(ws);
      },
      message(ws, raw) {
        handleMessage(typeof raw === "string" ? raw : Buffer.from(raw).toString("utf8"));
      },
    },
  });

  return {
    // Always set for a TCP (non-unix-socket) Bun.serve — we never pass
    // `unix`, so this is never actually undefined.
    port: server.port!,
    stop() {
      server.stop(true);
    },
  };
}

if (import.meta.main) {
  const port = process.argv[2] ? Number(process.argv[2]) : TERMINAL_DAEMON_PORT;
  startDaemon(port);
  console.log(`vozen terminal daemon listening on ws://127.0.0.1:${port}`);
}
