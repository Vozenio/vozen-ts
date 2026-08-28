import { describe, expect, test } from "bun:test";
import path from "node:path";
import { ClaudeAppServerClient, ClaudeAppServerError } from "./client.ts";

const FIXTURE = path.join(import.meta.dir, "__fixtures__/fake-claude.ts");

function makeClient(opts: {
  sessionId?: string;
  eventsPerTurn?: unknown[][];
  onNotification?: (method: string, params: unknown) => void;
  onExit?: () => void;
}) {
  return new ClaudeAppServerClient(
    opts.onNotification ?? (() => {}),
    undefined,
    opts.onExit,
    {
      command: ["bun", "run", FIXTURE],
      env: {
        FAKE_CLAUDE_SESSION_ID: opts.sessionId ?? "sess-1",
        FAKE_CLAUDE_EVENTS_PER_TURN: JSON.stringify(opts.eventsPerTurn ?? []),
      },
    },
  );
}

function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const check = () => {
      if (predicate()) return resolve();
      if (Date.now() > deadline) return reject(new Error("waitFor timed out"));
      setTimeout(check, 10);
    };
    check();
  });
}

describe("ClaudeAppServerClient", () => {
  test("threadStart resolves with a synthetic id right away, not the real session id", async () => {
    const client = makeClient({ sessionId: "abc-123" });
    const providerThreadId = await client.threadStart("/tmp");
    expect(providerThreadId).toMatch(/^claude-/);
    client.kill();
  });

  test("a plain text assistant reply becomes item/started + delta + completed, then turn/completed", async () => {
    const received: [string, unknown][] = [];
    const client = makeClient({
      onNotification: (m, p) => received.push([m, p]),
      eventsPerTurn: [[
        { type: "assistant", message: { content: [{ type: "text", text: "hello there" }] } },
        { type: "result", is_error: false },
      ]],
    });
    await client.threadStart("/tmp");
    await client.turnStart("abc-123", "hi");
    await waitFor(() => received.some(([m]) => m === "turn/completed"));

    const methods = received.map(([m]) => m);
    expect(methods).toEqual([
      "turn/started", "item/started", "item/completed", // synthesized user message
      "item/started", "item/agentMessage/delta", "item/completed", // assistant text
      "turn/completed",
    ]);
    const delta = received.find(([m]) => m === "item/agentMessage/delta")![1] as { delta: string };
    expect(delta.delta).toBe("hello there");
    const turnCompleted = received.find(([m]) => m === "turn/completed")![1] as { turn: { status: string } };
    expect(turnCompleted.turn.status).toBe("completed");
    client.kill();
  });

  test("a Bash tool_use/tool_result pair becomes a commandExecution item, started then completed", async () => {
    const received: [string, unknown][] = [];
    const client = makeClient({
      onNotification: (m, p) => received.push([m, p]),
      eventsPerTurn: [[
        { type: "assistant", message: { content: [{ type: "tool_use", id: "toolu_1", name: "Bash", input: { command: "echo hi" } }] } },
        { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "hi", is_error: false }] } },
        { type: "result", is_error: false },
      ]],
    });
    await client.threadStart("/tmp");
    await client.turnStart("abc-123", "run echo hi");
    await waitFor(() => received.some(([m]) => m === "turn/completed"));

    const started = received.find(([m, p]) => m === "item/started" && (p as { item: { type: string } }).item.type === "commandExecution");
    const completed = received.find(([m, p]) => m === "item/completed" && (p as { item: { type: string } }).item.type === "commandExecution");
    expect(started).toBeDefined();
    expect(completed).toBeDefined();
    const item = (completed![1] as { item: Record<string, unknown> }).item;
    expect(item.command).toBe("echo hi");
    expect(item.aggregatedOutput).toBe("hi");
    expect(item.status).toBe("completed");
    client.kill();
  });

  test("an errored tool_result marks the item failed", async () => {
    const received: [string, unknown][] = [];
    const client = makeClient({
      onNotification: (m, p) => received.push([m, p]),
      eventsPerTurn: [[
        { type: "assistant", message: { content: [{ type: "tool_use", id: "toolu_2", name: "Bash", input: { command: "false" } }] } },
        { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "toolu_2", content: "boom", is_error: true }] } },
        { type: "result", is_error: false },
      ]],
    });
    await client.threadStart("/tmp");
    await client.turnStart("abc-123", "run false");
    await waitFor(() => received.some(([m]) => m === "turn/completed"));

    const completed = received.find(([m, p]) => m === "item/completed" && (p as { item: { type: string } }).item.type === "commandExecution");
    const item = (completed![1] as { item: Record<string, unknown> }).item;
    expect(item.status).toBe("failed");
    expect(item.exitCode).toBe(1);
    client.kill();
  });

  test("an Edit tool_use becomes a fileChange item with a crude +/- diff", async () => {
    const received: [string, unknown][] = [];
    const client = makeClient({
      onNotification: (m, p) => received.push([m, p]),
      eventsPerTurn: [[
        {
          type: "assistant",
          message: { content: [{ type: "tool_use", id: "toolu_3", name: "Edit", input: { file_path: "/tmp/a.txt", old_string: "old", new_string: "new" } }] },
        },
        { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "toolu_3", content: "ok", is_error: false }] } },
        { type: "result", is_error: false },
      ]],
    });
    await client.threadStart("/tmp");
    await client.turnStart("abc-123", "edit the file");
    await waitFor(() => received.some(([m]) => m === "turn/completed"));

    const completed = received.find(([m, p]) => m === "item/completed" && (p as { item: { type: string } }).item.type === "fileChange");
    const item = (completed![1] as { item: { changes: { path: string; diff: string }[] } }).item;
    expect(item.changes[0]!.path).toBe("/tmp/a.txt");
    expect(item.changes[0]!.diff).toBe("-old\n+new");
    client.kill();
  });

  test("turnSteer behaves identically to turnStart — both just send the next line", async () => {
    const received: [string, unknown][] = [];
    const client = makeClient({
      onNotification: (m, p) => received.push([m, p]),
      eventsPerTurn: [
        [{ type: "assistant", message: { content: [{ type: "text", text: "first" }] } }, { type: "result", is_error: false }],
        [{ type: "assistant", message: { content: [{ type: "text", text: "second" }] } }, { type: "result", is_error: false }],
      ],
    });
    await client.threadStart("/tmp");
    await client.turnStart("abc-123", "one");
    await waitFor(() => received.filter(([m]) => m === "turn/completed").length === 1);
    await client.turnSteer("abc-123", "two");
    await waitFor(() => received.filter(([m]) => m === "turn/completed").length === 2);

    const deltas = received.filter(([m]) => m === "item/agentMessage/delta").map(([, p]) => (p as { delta: string }).delta);
    expect(deltas).toEqual(["first", "second"]);
    client.kill();
  });

  test("a tool_use item keeps Claude's own toolu_ id — not a synthesized counter, which would collide across threads", async () => {
    const received: [string, unknown][] = [];
    const client = makeClient({
      onNotification: (m, p) => received.push([m, p]),
      eventsPerTurn: [[
        { type: "assistant", message: { content: [{ type: "tool_use", id: "toolu_real_abc123", name: "Bash", input: { command: "echo hi" } }] } },
        { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "toolu_real_abc123", content: "hi", is_error: false }] } },
        { type: "result", is_error: false },
      ]],
    });
    await client.threadStart("/tmp");
    await client.turnStart("abc-123", "run echo hi");
    await waitFor(() => received.some(([m]) => m === "turn/completed"));

    const started = received.find(([m, p]) => m === "item/started" && (p as { item: { type: string } }).item.type === "commandExecution")!;
    const completed = received.find(([m, p]) => m === "item/completed" && (p as { item: { type: string } }).item.type === "commandExecution")!;
    expect((started[1] as { itemId: string }).itemId).toBe("toolu_real_abc123");
    expect((completed[1] as { item: { id: string } }).item.id).toBe("toolu_real_abc123");
    client.kill();
  });

  // Regression test for the P0 cross-thread timeline collision QA found:
  // itemId/turnId for anything without a native protocol id (text blocks,
  // turns, the synthesized user-message item) used to be built from a
  // per-instance counter starting at 0 — two ClaudeAppServerClient
  // instances (i.e. two threads) both produce "claude-item-1" for their
  // first text reply, and timeline_rows.id is a *global* primary key, so
  // the second thread's row silently overwrote the first's.
  test("two client instances never generate colliding item/turn ids for text replies", async () => {
    const receivedA: [string, unknown][] = [];
    const receivedB: [string, unknown][] = [];
    const clientA = makeClient({ onNotification: (m, p) => receivedA.push([m, p]), eventsPerTurn: [[
      { type: "assistant", message: { content: [{ type: "text", text: "from A" }] } },
      { type: "result", is_error: false },
    ]] });
    const clientB = makeClient({ onNotification: (m, p) => receivedB.push([m, p]), eventsPerTurn: [[
      { type: "assistant", message: { content: [{ type: "text", text: "from B" }] } },
      { type: "result", is_error: false },
    ]] });
    await Promise.all([clientA.threadStart("/tmp"), clientB.threadStart("/tmp")]);
    await Promise.all([clientA.turnStart("a", "hi"), clientB.turnStart("b", "hi")]);
    await Promise.all([
      waitFor(() => receivedA.some(([m]) => m === "turn/completed")),
      waitFor(() => receivedB.some(([m]) => m === "turn/completed")),
    ]);

    const itemIdsA = receivedA.filter(([m]) => m === "item/started").map(([, p]) => (p as { itemId: string }).itemId);
    const itemIdsB = receivedB.filter(([m]) => m === "item/started").map(([, p]) => (p as { itemId: string }).itemId);
    const turnIdA = (receivedA.find(([m]) => m === "turn/started")![1] as { turnId: string }).turnId;
    const turnIdB = (receivedB.find(([m]) => m === "turn/started")![1] as { turnId: string }).turnId;

    for (const idA of itemIdsA) expect(itemIdsB).not.toContain(idA);
    expect(turnIdA).not.toBe(turnIdB);
    clientA.kill();
    clientB.kill();
  });

  test("threadStart resolves immediately with a synthetic id — it never waits for the real system/init, which the CLI only emits after the first input line", async () => {
    const client = new ClaudeAppServerClient(() => {}, undefined, undefined, {
      command: ["bun", "run", FIXTURE],
      env: { FAKE_CLAUDE_SESSION_ID: "sess-2", FAKE_CLAUDE_EVENTS_PER_TURN: "[]" },
    });
    const providerThreadId = await client.threadStart("/tmp");
    expect(providerThreadId).toMatch(/^claude-/);
    client.kill();
  });
});
