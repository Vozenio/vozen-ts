import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { unlinkSync } from "node:fs";
import * as sqlite from "../../packages/db/sqlite.ts";
import { ThreadManager, ThreadSession } from "./engine.ts";

// Tests reach into private members the same way the Python test suite
// calls _on_notification / seeds engine.sessions directly — TS `private`
// is a compile-time-only annotation, not runtime enforcement.
interface EngineInternals {
  onNotification(threadId: string, method: string, params: Record<string, unknown>): void;
  sessions: Map<string, ThreadSession>;
}

describe("ThreadManager notifications", () => {
  let dbPath: string;
  let engine: ThreadManager;

  beforeEach(() => {
    dbPath = `/tmp/vozen-test-${crypto.randomUUID()}.db`;
    engine = new ThreadManager(dbPath);
  });

  afterEach(() => {
    engine.db.close();
    try {
      unlinkSync(dbPath);
    } catch {}
  });

  function seedThread(status = "starting"): string {
    const threadId = "thr_test";
    sqlite.insertThread(engine.db, threadId, "/tmp", "test", status, Math.floor(Date.now() / 1000));
    return threadId;
  }

  function notify(threadId: string, method: string, params: Record<string, unknown>): void {
    (engine as unknown as EngineInternals).onNotification(threadId, method, params);
  }

  function seedSession(threadId: string): ThreadSession {
    const session = new ThreadSession(threadId);
    (engine as unknown as EngineInternals).sessions.set(threadId, session);
    return session;
  }

  test("turn/started sets thread status to running", () => {
    const threadId = seedThread();
    notify(threadId, "turn/started", { threadId, turn: { id: "turn1", status: "inProgress" } });
    expect(sqlite.getThread(engine.db, threadId)?.status).toBe("running");
  });

  test("turn/completed maps codex status to thread status", () => {
    const threadId = seedThread("running");
    notify(threadId, "turn/completed", { threadId, turn: { id: "turn1", status: "failed" } });
    expect(sqlite.getThread(engine.db, threadId)?.status).toBe("failed");
  });

  test("item events are persisted with item type", () => {
    const threadId = seedThread();
    notify(threadId, "item/started", { threadId, turnId: "turn1", item: { id: "item1", type: "agentMessage" } });
    const events = sqlite.listEvents(engine.db, threadId);
    expect(events).toHaveLength(1);
    expect(events[0]?.item_type).toBe("agentMessage");
  });

  test("first delta for a stream persists immediately", () => {
    const threadId = seedThread("running");
    seedSession(threadId);
    notify(threadId, "item/agentMessage/delta", { threadId, itemId: "i1", delta: "Hel" });
    expect(sqlite.listEvents(engine.db, threadId)).toHaveLength(1);
  });

  test("second delta within the coalescing window is buffered, not persisted", () => {
    const threadId = seedThread("running");
    seedSession(threadId);
    notify(threadId, "item/agentMessage/delta", { threadId, itemId: "i1", delta: "Hel" });
    notify(threadId, "item/agentMessage/delta", { threadId, itemId: "i1", delta: "lo" });
    // Still just the one persisted event — the second delta is buffered.
    expect(sqlite.listEvents(engine.db, threadId)).toHaveLength(1);
  });

  test("delta after the window elapses merges buffered text into one event", async () => {
    const threadId = seedThread("running");
    seedSession(threadId);
    notify(threadId, "item/agentMessage/delta", { threadId, itemId: "i1", delta: "Hel" });
    notify(threadId, "item/agentMessage/delta", { threadId, itemId: "i1", delta: "lo" });
    await Bun.sleep(120); // past TEXT_DELTA_FLUSH_MS
    notify(threadId, "item/agentMessage/delta", { threadId, itemId: "i1", delta: "!" });
    const events = sqlite.listEvents(engine.db, threadId);
    expect(events).toHaveLength(2);
    // Window elapsed: the still-buffered "lo" merges with this delta's own
    // text into one emitted event, rather than flushing "lo" separately.
    expect((events[1]?.params as Record<string, unknown>).delta).toBe("lo!");
  });

  test("a non-delta event flushes any pending delta first, in order", () => {
    const threadId = seedThread("running");
    seedSession(threadId);
    notify(threadId, "item/agentMessage/delta", { threadId, itemId: "i1", delta: "Hel" });
    notify(threadId, "item/agentMessage/delta", { threadId, itemId: "i1", delta: "lo" });
    notify(threadId, "item/completed", { threadId, turnId: "t1", item: { id: "i1", type: "agentMessage", text: "Hello" } });
    const events = sqlite.listEvents(engine.db, threadId);
    // "Hel" emits immediately (first delta for the key); "lo" is buffered
    // until item/completed forces a flush as its own event, before
    // item/completed itself is persisted.
    expect(events.map((e) => e.method)).toEqual(["item/agentMessage/delta", "item/agentMessage/delta", "item/completed"]);
    expect((events[1]?.params as Record<string, unknown>).delta).toBe("lo");
  });

  test("item/started creates an empty assistant timeline row, delta grows it, completed replaces it", () => {
    const threadId = seedThread("running");
    notify(threadId, "item/started", { threadId, turnId: "t1", item: { id: "item1", type: "agentMessage" } });
    let rows = sqlite.listTimelineRows(engine.db, threadId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.text).toBe("");

    notify(threadId, "item/agentMessage/delta", { threadId, itemId: "item1", turnId: "t1", delta: "Hi there" });
    rows = sqlite.listTimelineRows(engine.db, threadId);
    expect(rows[0]?.text).toBe("Hi there");

    notify(threadId, "item/completed", { threadId, turnId: "t1", item: { id: "item1", type: "agentMessage", text: "Hi there!" } });
    rows = sqlite.listTimelineRows(engine.db, threadId);
    expect(rows).toHaveLength(1); // replaced in place, not duplicated
    expect(rows[0]?.text).toBe("Hi there!");
  });

  test("item/started creates a full user row immediately (no streaming)", () => {
    const threadId = seedThread("running");
    notify(threadId, "item/started", {
      threadId, turnId: "t1",
      item: { id: "item2", type: "userMessage", content: [{ text: "hello" }] },
    });
    const rows = sqlite.listTimelineRows(engine.db, threadId);
    expect(rows[0]?.text).toBe("hello");
    expect(rows[0]?.role).toBe("user");
  });

  test("commandExecution lifecycle creates and completes one work row", () => {
    const threadId = seedThread("running");
    seedSession(threadId);
    const startedItem = {
      type: "commandExecution", id: "exec-1", command: "printf hello", cwd: "/tmp",
      status: "inProgress", aggregatedOutput: null, exitCode: null, durationMs: null,
    };
    notify(threadId, "item/started", { threadId, turnId: "t1", item: startedItem });
    notify(threadId, "item/commandExecution/outputDelta", {
      threadId, turnId: "t1", itemId: "exec-1", delta: "hello",
    });
    notify(threadId, "item/completed", {
      threadId, turnId: "t1", completedAtMs: 1234,
      item: { ...startedItem, status: "completed", aggregatedOutput: "hello", exitCode: 0, durationMs: 12 },
    });

    const rows = sqlite.listTimelineRows(engine.db, threadId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "work", work_kind: "command", source_seq_end: 3 });
    expect(JSON.parse(rows[0]!.payload!)).toMatchObject({
      callId: "exec-1", status: "completed", output: "hello", exitCode: 0, durationMs: 12, completedAt: 1234,
    });
  });
});

describe("ThreadManager broadcast subscription filtering", () => {
  let dbPath: string;
  let engine: ThreadManager;

  beforeEach(() => {
    dbPath = `/tmp/vozen-test-${crypto.randomUUID()}.db`;
    engine = new ThreadManager(dbPath);
  });

  afterEach(() => {
    engine.db.close();
    try {
      unlinkSync(dbPath);
    } catch {}
  });

  function fakeSocket() {
    const sent: string[] = [];
    return { sent, send: (data: string) => sent.push(data) };
  }

  test("unsubscribed socket receives nothing", () => {
    const sock = fakeSocket();
    engine.registerWsClient(sock);
    engine.broadcastChanged("thread", "thr_1", ["events-appended"]);
    expect(sock.sent).toHaveLength(0);
  });

  test("thread-list subscriber receives a message with an id", () => {
    const sock = fakeSocket();
    engine.registerWsClient(sock);
    engine.subscribe(sock, "thread-list");
    engine.broadcastChanged("thread", "thr_1", ["events-appended"]);
    expect(sock.sent).toHaveLength(1);
  });

  test("detail subscriber only receives its own thread's messages", () => {
    const sock = fakeSocket();
    engine.registerWsClient(sock);
    engine.subscribe(sock, "thread-detail:thr_1");
    engine.broadcastChanged("thread", "thr_2", ["events-appended"]);
    expect(sock.sent).toHaveLength(0);
    engine.broadcastChanged("thread", "thr_1", ["events-appended"]);
    expect(sock.sent).toHaveLength(1);
  });

  test("unsubscribe stops delivery", () => {
    const sock = fakeSocket();
    engine.registerWsClient(sock);
    engine.subscribe(sock, "thread-list");
    engine.unsubscribe(sock, "thread-list");
    engine.broadcastChanged("thread", "thr_1", ["events-appended"]);
    expect(sock.sent).toHaveLength(0);
  });
});

describe("ThreadManager projects", () => {
  let dbPath: string;
  let engine: ThreadManager;

  beforeEach(() => {
    dbPath = `/tmp/vozen-test-${crypto.randomUUID()}.db`;
    engine = new ThreadManager(dbPath);
  });

  afterEach(() => {
    engine.db.close();
    try {
      unlinkSync(dbPath);
    } catch {}
  });

  test("createProject persists and lists it", () => {
    const project = engine.createProject("My Project", "/tmp");
    expect(engine.listProjects().map((p) => p.id)).toEqual([project.id]);
    expect(engine.getProject(project.id)?.name).toBe("My Project");
  });

  test("getProject returns null for an unknown id", () => {
    expect(engine.getProject("proj_missing")).toBeNull();
  });

  test("spawn with an unknown projectId throws instead of silently using the default workspace", () => {
    expect(() => engine.spawn("hi", null, null, "never", "proj_missing")).toThrow();
  });

  test("spawn into a project resolves cwd from the project's own path, not the default workspace", async () => {
    const project = engine.createProject("My Project", "/tmp");
    const thread = engine.spawn("hi", null, null, "never", project.id);
    expect(thread.cwd).toBe("/tmp");
    expect(thread.project_id).toBe(project.id);
    expect(engine.listThreadsByProject(project.id).map((t) => t.id)).toEqual([thread.id]);
    expect(engine.listThreadsByProject(null)).toHaveLength(0);
    // Real codex subprocess spawned in the background — await its actual
    // exit, or afterEach's db.close() races onProcessExit's async callback
    // and throws "Cannot use a closed database" into whichever test file
    // bun happens to run next (silently dropping that file's results).
    await engine.stop(thread.id);
  });

  test("spawn with no projectId lands in the personal bucket (project_id null)", async () => {
    const thread = engine.spawn("hi", null, "/tmp");
    expect(thread.project_id).toBeNull();
    expect(engine.listThreadsByProject(null).map((t) => t.id)).toEqual([thread.id]);
    await engine.stop(thread.id);
  });
});
