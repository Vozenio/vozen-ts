import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { unlinkSync } from "node:fs";
import * as sqlite from "../../packages/db/sqlite.ts";
import { DaemonClient } from "./daemonClient.ts";
import { ThreadManager } from "./engine.ts";
import { startDaemon } from "./terminalDaemon.ts";
import { TerminalManager, type TerminalWsSocket } from "./terminalManager.ts";

// Real terminal daemon on a random free port, shared across this file's
// tests — this is "real PTY, no mocks" end-to-end: a real daemon process
// (in-process here, but the same startDaemon() a `bun terminalDaemon.ts`
// subprocess runs) behind a real DaemonClient WS connection.
let daemon: ReturnType<typeof startDaemon>;
const daemonClients: DaemonClient[] = [];

beforeAll(() => {
  daemon = startDaemon(0);
});

afterAll(() => {
  // Dispose every client's reconnect loop before stopping the daemon —
  // otherwise each one's auto-reconnect eventually decides the (now freed)
  // port has no daemon and spawns a real, un-torn-down subprocess.
  for (const client of daemonClients.splice(0)) client.dispose();
  daemon.stop();
});

function makeEngine(): { engine: ThreadManager; dbPath: string; terminals: TerminalManager } {
  const dbPath = `/tmp/vozen-terminal-test-${crypto.randomUUID()}.db`;
  const engine = new ThreadManager(dbPath);
  const daemonClient = new DaemonClient(daemon.port);
  daemonClients.push(daemonClient);
  const terminals = new TerminalManager(engine, daemonClient);
  return { engine, dbPath, terminals };
}

function fakeSocket(): TerminalWsSocket & { messages: unknown[] } {
  const messages: unknown[] = [];
  return { messages, send: (data: string) => messages.push(JSON.parse(data)) };
}

async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await Bun.sleep(10);
  }
  throw new Error("waitFor timed out");
}

describe("TerminalManager (real Bun.spawn PTY via a real terminal daemon, no mocks)", () => {
  test("host_path target runs a command and streams its output over an attached socket", async () => {
    const { engine, dbPath, terminals } = makeEngine();
    const session = await terminals.create({
      cols: 80, rows: 24,
      start: { mode: "command", command: "echo hello-from-pty" },
      target: { kind: "host_path", hostId: "host_vozen", cwd: null },
    });
    expect(session).not.toBeNull();
    // create() resolves only after the daemon's spawn ack: the HTTP client
    // renders from the POST response, so "starting" must be gone by now.
    // (A fast command may already have exited, hence the two statuses.)
    expect(["running", "exited"]).toContain(terminals.get(session!.id)?.status ?? "missing");

    const socket = fakeSocket();
    const attached = terminals.attach(session!.id, socket, 0);
    expect(attached).not.toBeNull();
    expect(socket.messages[0]).toMatchObject({ type: "attached" });

    await waitFor(() => terminals.get(session!.id)?.status === "exited");
    await waitFor(() => socket.messages.some((m) => (m as { type: string }).type === "exited"));

    const outputMessages = socket.messages.filter((m) => (m as { type: string }).type === "output");
    const decoded = outputMessages
      .map((m) => Buffer.from((m as { chunk: { dataBase64: string } }).chunk.dataBase64, "base64").toString())
      .join("");
    expect(decoded).toContain("hello-from-pty");

    engine.db.close();
    unlinkSync(dbPath);
  });

  test("thread target resolves cwd from the real thread", async () => {
    const { engine, dbPath, terminals } = makeEngine();
    sqlite.insertThread(engine.db, "thr_1", "/tmp", "t", "idle", Math.floor(Date.now() / 1000));
    const session = await terminals.create({
      cols: 80, rows: 24,
      target: { kind: "thread", threadId: "thr_1" },
    });
    expect(session?.initialCwd).toBe("/tmp");
    expect(session?.threadId).toBe("thr_1");

    terminals.close(session!.id, { mode: "force", reason: "user" });
    engine.db.close();
    unlinkSync(dbPath);
  });

  test("an unknown thread target fails to create a session", async () => {
    const { engine, dbPath, terminals } = makeEngine();
    const session = await terminals.create({
      cols: 80, rows: 24,
      target: { kind: "thread", threadId: "thr_missing" },
    });
    expect(session).toBeNull();
    engine.db.close();
    unlinkSync(dbPath);
  });

  test("resize and rename update the session and broadcast session-updated", async () => {
    const { engine, dbPath, terminals } = makeEngine();
    const session = await terminals.create({
      cols: 80, rows: 24,
      target: { kind: "host_path", hostId: "host_vozen", cwd: null },
    });
    const socket = fakeSocket();
    terminals.attach(session!.id, socket, 0);

    const resized = terminals.resize(session!.id, 120, 40);
    expect(resized).toMatchObject({ cols: 120, rows: 40 });

    const renamed = terminals.rename(session!.id, "My shell");
    expect(renamed?.title).toBe("My shell");

    const updates = socket.messages.filter((m) => (m as { type: string }).type === "session-updated");
    expect(updates.length).toBeGreaterThanOrEqual(2);

    terminals.close(session!.id, { mode: "force", reason: "user" });
    engine.db.close();
    unlinkSync(dbPath);
  });

  test("list filters sessions by scope", async () => {
    const { engine, dbPath, terminals } = makeEngine();
    sqlite.insertThread(engine.db, "thr_a", "/tmp", "a", "idle", Math.floor(Date.now() / 1000));
    sqlite.insertThread(engine.db, "thr_b", "/tmp", "b", "idle", Math.floor(Date.now() / 1000));
    const a = (await terminals.create({ cols: 80, rows: 24, target: { kind: "thread", threadId: "thr_a" } }))!;
    const b = (await terminals.create({ cols: 80, rows: 24, target: { kind: "thread", threadId: "thr_b" } }))!;

    expect(terminals.list({ threadId: "thr_a" }).map((s) => s.id)).toEqual([a.id]);
    expect(terminals.list({ threadId: "thr_b" }).map((s) => s.id)).toEqual([b.id]);

    terminals.close(a.id, { mode: "force", reason: "user" });
    terminals.close(b.id, { mode: "force", reason: "user" });
    engine.db.close();
    unlinkSync(dbPath);
  });

  test("output() replays buffered history since a given seq", async () => {
    const { engine, dbPath, terminals } = makeEngine();
    const session = await terminals.create({
      cols: 80, rows: 24,
      start: { mode: "command", command: "printf 'a\\nb\\nc\\n'" },
      target: { kind: "host_path", hostId: "host_vozen", cwd: null },
    });
    await waitFor(() => terminals.get(session!.id)?.status === "exited");

    const full = terminals.output(session!.id, {});
    expect(full).not.toBeNull();
    expect(full!.chunks.length).toBeGreaterThan(0);

    const sinceLast = terminals.output(session!.id, { sinceSeq: full!.nextSeq });
    expect(sinceLast!.chunks).toEqual([]);

    engine.db.close();
    unlinkSync(dbPath);
  });

  test("close(force) kills the process and marks the session exited", async () => {
    const { engine, dbPath, terminals } = makeEngine();
    const session = (await terminals.create({
      cols: 80, rows: 24,
      // An explicit command, not the default interactive login shell: `-l`
      // sources the user's real .zprofile/.bash_profile, whose startup time
      // varies (network checks, version managers, ...) — that variance was
      // this test's actual flake, not the daemon round trip itself.
      start: { mode: "command", command: "sleep 60" },
      target: { kind: "host_path", hostId: "host_vozen", cwd: null },
    }))!;
    // create() must not resolve before the spawn ack — the frontend renders
    // the terminal from this value and never polls past "starting".
    expect(terminals.get(session.id)?.status).toBe("running");

    terminals.close(session.id, { mode: "force", reason: "user" });
    await waitFor(() => terminals.get(session.id)?.status === "exited");
    expect(terminals.get(session.id)?.closeReason).toBe("user");

    engine.db.close();
    unlinkSync(dbPath);
  });
});
