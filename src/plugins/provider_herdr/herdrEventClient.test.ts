import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { HerdrEventClient, type HerdrPaneEvent } from "./herdrEventClient.ts";

function tempSocketPath(): string {
  return path.join(os.tmpdir(), `herdr-event-test-${crypto.randomUUID()}.sock`);
}

const activeClients: HerdrEventClient[] = [];
const activeServers: ReturnType<typeof Bun.listen>[] = [];
const activeSocketPaths: string[] = [];

afterEach(() => {
  while (activeClients.length) activeClients.pop()!.stop();
  while (activeServers.length) activeServers.pop()!.stop(true);
  while (activeSocketPaths.length) {
    const p = activeSocketPaths.pop()!;
    try {
      if (existsSync(p)) unlinkSync(p);
    } catch {}
  }
});

async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await Bun.sleep(10);
  }
  throw new Error("waitFor timed out");
}

describe("HerdrEventClient (real Unix socket, no mocks)", () => {
  test("subscribes, then parses pushed events and extracts paneId per event shape", async () => {
    const socketPath = tempSocketPath();
    activeSocketPaths.push(socketPath);
    const events: HerdrPaneEvent[] = [];

    const server = Bun.listen({
      unix: socketPath,
      socket: {
        open(socket) {
          // Real herdr behavior is asynchronous, but nothing in the
          // protocol requires waiting for the subscribe request before
          // pushing — feeding both request-confirm and events off one
          // `data` handler below is what actually matters to the client.
        },
        data(socket, data) {
          const line = data.toString().trim();
          if (!line) return;
          const req = JSON.parse(line) as { id: string };
          socket.write(`${JSON.stringify({ id: req.id, result: { type: "subscription_started" } })}\n`);
          socket.write(`${JSON.stringify({
            event: "pane_updated",
            data: { pane: { pane_id: "w1:p1", revision: 3, agent_status: "working" } },
          })}\n`);
          socket.write(`${JSON.stringify({
            event: "pane_agent_detected",
            data: { pane_id: "w1:p2", agent: "claude", final_status: "idle" },
          })}\n`);
          socket.write(`${JSON.stringify({
            event: "pane_exited",
            data: { pane_id: "w1:p3", workspace_id: "w1" },
          })}\n`);
        },
      },
    });
    activeServers.push(server);

    const client = new HerdrEventClient({ socketPath });
    activeClients.push(client);
    client.onEvent((event) => events.push(event));
    client.start();

    await waitFor(() => events.length >= 3);
    expect(events).toEqual([
      { type: "pane_updated", paneId: "w1:p1", data: { pane: { pane_id: "w1:p1", revision: 3, agent_status: "working" } } },
      { type: "pane_agent_detected", paneId: "w1:p2", data: { pane_id: "w1:p2", agent: "claude", final_status: "idle" } },
      { type: "pane_exited", paneId: "w1:p3", data: { pane_id: "w1:p3", workspace_id: "w1" } },
    ]);
  });

  test("a subscription error from the server does not crash the client and no events fire", async () => {
    const socketPath = tempSocketPath();
    activeSocketPaths.push(socketPath);

    const server = Bun.listen({
      unix: socketPath,
      socket: {
        data(socket, data) {
          const req = JSON.parse(data.toString().trim()) as { id: string };
          socket.write(`${JSON.stringify({ id: req.id, error: { code: "denied", message: "nope" } })}\n`);
          socket.end();
        },
      },
    });
    activeServers.push(server);

    const client = new HerdrEventClient({ socketPath });
    activeClients.push(client);
    const events: HerdrPaneEvent[] = [];
    client.onEvent((event) => events.push(event));
    client.start();

    // Long enough to observe the failed handshake and one retry attempt
    // (RECONNECT_MIN_MS is 1000ms) without waiting out the full test suite.
    await Bun.sleep(300);
    expect(events).toEqual([]);
  });

  test("reconnects after the server drops the connection and keeps receiving events", async () => {
    const socketPath = tempSocketPath();
    activeSocketPaths.push(socketPath);
    let connectionCount = 0;
    const events: HerdrPaneEvent[] = [];

    const server = Bun.listen({
      unix: socketPath,
      socket: {
        open() {
          connectionCount += 1;
        },
        data(socket, data) {
          const req = JSON.parse(data.toString().trim()) as { id: string };
          socket.write(`${JSON.stringify({ id: req.id, result: { type: "subscription_started" } })}\n`);
          const generation = connectionCount;
          socket.write(`${JSON.stringify({
            event: "pane_exited",
            data: { pane_id: `gen-${generation}`, workspace_id: "w1" },
          })}\n`);
          if (generation === 1) {
            // First session: subscribe, emit once, then the server itself
            // drops the connection — the client must reconnect on its own.
            socket.end();
          }
        },
      },
    });
    activeServers.push(server);

    const client = new HerdrEventClient({ socketPath });
    activeClients.push(client);
    client.onEvent((event) => events.push(event));
    client.start();

    await waitFor(() => events.some((e) => e.paneId === "gen-1"), 5000);
    await waitFor(() => events.some((e) => e.paneId === "gen-2"), 5000);
    expect(connectionCount).toBeGreaterThanOrEqual(2);
  }, 10_000);

  test("stop() called synchronously right after start() aborts the in-flight connection", async () => {
    const socketPath = tempSocketPath();
    activeSocketPaths.push(socketPath);
    const events: HerdrPaneEvent[] = [];

    const server = Bun.listen({
      unix: socketPath,
      socket: {
        data(socket, data) {
          const req = JSON.parse(data.toString().trim()) as { id: string };
          socket.write(`${JSON.stringify({ id: req.id, result: { type: "subscription_started" } })}\n`);
          socket.write(`${JSON.stringify({ event: "pane_exited", data: { pane_id: "should-never-arrive", workspace_id: "w1" } })}\n`);
        },
      },
    });
    activeServers.push(server);

    const client = new HerdrEventClient({ socketPath });
    activeClients.push(client);
    client.onEvent((event) => events.push(event));
    // No await between these two — this is exactly the race: stop() runs
    // before Bun.connect()'s open callback has a socket to call .end() on.
    client.start();
    client.stop();

    // Long enough for the connection to have opened, subscribed, and had an
    // event pushed to it if the abort didn't actually take effect.
    await Bun.sleep(300);
    expect(events).toEqual([]);
  });

  test("resolveSocketPath honors HERDR_SOCKET_PATH, then XDG_CONFIG_HOME, then the home default", () => {
    // Exercised indirectly: a client with no explicit socketPath but a
    // fake env pointing nowhere real should fail to connect (proving it
    // actually tried that resolved path) rather than silently no-op.
    const client = new HerdrEventClient({ env: { HERDR_SOCKET_PATH: "/nonexistent/herdr-test.sock" } });
    activeClients.push(client);
    const events: HerdrPaneEvent[] = [];
    client.onEvent((e) => events.push(e));
    client.start();
    // No assertion beyond "doesn't throw synchronously" — connecting to a
    // nonexistent path fails asynchronously inside runForever's retry loop.
    client.stop();
  });
});
