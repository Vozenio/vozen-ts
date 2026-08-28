/**
 * Real end-to-end coverage for terminalDaemon.ts's Origin gate: this daemon
 * listens on a TCP port (127.0.0.1) with no auth of its own, so the only
 * thing stopping a browser page from `new WebSocket("ws://127.0.0.1:<port>")`
 * and driving `handleCreate()` into spawning an arbitrary command is that a
 * browser can't forge its Origin header. Real `startDaemon()` + real
 * `WebSocket`, no mocks — same style as terminalManager.test.ts.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { DaemonClient } from "./daemonClient.ts";
import { startDaemon } from "./terminalDaemon.ts";
import { TERMINAL_DAEMON_INTERNAL_ORIGIN } from "./terminalDaemonProtocol.ts";

let daemon: ReturnType<typeof startDaemon> | null = null;
const daemonClients: DaemonClient[] = [];

afterEach(() => {
  for (const client of daemonClients.splice(0)) client.dispose();
  daemon?.stop();
  daemon = null;
});

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

describe("terminalDaemon.ts Origin gate", () => {
  test("no Origin header is rejected (403, never upgraded)", async () => {
    daemon = startDaemon(0);
    expect(await tryUpgrade(`ws://127.0.0.1:${daemon.port}/`)).toBe(false);
  });

  test("a browser-style Origin (e.g. a drive-by LAN page) is rejected", async () => {
    daemon = startDaemon(0);
    expect(await tryUpgrade(`ws://127.0.0.1:${daemon.port}/`, "https://evil.com")).toBe(false);
  });

  test("the internal daemon-client Origin is accepted", async () => {
    daemon = startDaemon(0);
    expect(await tryUpgrade(`ws://127.0.0.1:${daemon.port}/`, TERMINAL_DAEMON_INTERNAL_ORIGIN)).toBe(true);
  });

  test("a real DaemonClient (as used by TerminalManager) connects and round-trips a create/spawned message", async () => {
    daemon = startDaemon(0);
    const client = new DaemonClient(daemon.port);
    daemonClients.push(client);

    const spawned = new Promise<void>((resolve) => client.onSpawned("term_1", resolve));
    client.create("term_1", "/tmp", 80, 24, { mode: "command", command: "true" });
    await spawned;
  });
});
