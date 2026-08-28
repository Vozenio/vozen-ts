/**
 * Real end-to-end coverage for the Origin guard in front of `/ws` and
 * `/ws/terminals/:id` (http.ts's `wsOriginGuard`/`isAllowedWsOrigin`) — a
 * browser's WebSocket upgrade can't be same-origin-policed by the browser
 * itself (no preflight, any page can `new WebSocket(...)` cross-origin), so
 * this is the guard standing between those sockets and a drive-by page on
 * the LAN. Uses a real `Bun.serve` + real `WebSocket` client (same style as
 * terminalManager.test.ts's real-daemon tests) rather than mocking the
 * upgrade, since the thing under test is Bun's actual upgrade behavior in
 * response to the Origin header.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { unlinkSync } from "node:fs";
import { ThreadManager } from "./engine.ts";
import { createApp } from "./http.ts";

let server: ReturnType<typeof Bun.serve> | null = null;
let dbPath: string | null = null;

afterEach(() => {
  server?.stop(true);
  server = null;
  if (dbPath) {
    try {
      unlinkSync(dbPath);
    } catch {}
    dbPath = null;
  }
});

function startServer(): { port: number } {
  dbPath = `/tmp/vozen-ws-origin-test-${crypto.randomUUID()}.db`;
  const engine = new ThreadManager(dbPath);
  const { app, websocket } = createApp(engine);
  server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: app.fetch, websocket });
  return { port: server.port! };
}

/** Attempts a WS upgrade with the given Origin (omit for no Origin header
 * at all) and resolves with whether it opened. */
function tryUpgrade(url: string, origin?: string): Promise<boolean> {
  return new Promise((resolve) => {
    const ws = new WebSocket(url, origin ? ({ headers: { Origin: origin } } as unknown as string[]) : undefined);
    ws.addEventListener("open", () => {
      resolve(true);
      ws.close();
    });
    ws.addEventListener("error", () => resolve(false));
  });
}

describe("wsOriginGuard on /ws", () => {
  test("no Origin header is rejected", async () => {
    const { port } = startServer();
    expect(await tryUpgrade(`ws://127.0.0.1:${port}/ws`)).toBe(false);
  });

  test("an unrelated Origin (e.g. a drive-by page) is rejected", async () => {
    const { port } = startServer();
    expect(await tryUpgrade(`ws://127.0.0.1:${port}/ws`, "https://evil.com")).toBe(false);
  });

  test("Origin matching this server's own host (direct local browsing) is allowed", async () => {
    const { port } = startServer();
    expect(await tryUpgrade(`ws://127.0.0.1:${port}/ws`, `http://127.0.0.1:${port}`)).toBe(true);
  });

  test("an *.vozen.io Origin (remote access tunnel) is allowed", async () => {
    const { port } = startServer();
    expect(await tryUpgrade(`ws://127.0.0.1:${port}/ws`, "https://sometesthandle.vozen.io")).toBe(true);
  });

  test("the bare vozen.io Origin is allowed", async () => {
    const { port } = startServer();
    expect(await tryUpgrade(`ws://127.0.0.1:${port}/ws`, "https://vozen.io")).toBe(true);
  });

  test("a lookalike domain (evil-vozen.io) is rejected", async () => {
    const { port } = startServer();
    expect(await tryUpgrade(`ws://127.0.0.1:${port}/ws`, "https://evil-vozen.io")).toBe(false);
  });
});

describe("wsOriginGuard on /ws/terminals/:terminalId", () => {
  test("an unrelated Origin is rejected before the terminal is even looked up", async () => {
    const { port } = startServer();
    expect(await tryUpgrade(`ws://127.0.0.1:${port}/ws/terminals/term_unknown`, "https://evil.com")).toBe(false);
  });

  test("a legitimate local Origin is allowed to upgrade (terminal lookup happens after)", async () => {
    const { port } = startServer();
    expect(await tryUpgrade(`ws://127.0.0.1:${port}/ws/terminals/term_unknown`, `http://127.0.0.1:${port}`)).toBe(true);
  });
});
