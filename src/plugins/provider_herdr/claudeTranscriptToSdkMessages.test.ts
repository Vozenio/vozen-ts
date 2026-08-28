import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  convertClaudeTranscript,
  loadClaudeTranscript,
  parseTranscriptRecords,
  readClaudeSubagentTranscripts,
  type JsonRecord,
  type SubagentTranscript,
  type TranscriptEntry,
} from "./claudeTranscriptToSdkMessages.ts";

function entry(at: number, record: JsonRecord): TranscriptEntry {
  return { record, at };
}

function findAll(messages: JsonRecord[], type: string, subtype?: string): JsonRecord[] {
  return messages.filter((m) => m.type === type && (subtype === undefined || m.subtype === subtype));
}

describe("parseTranscriptRecords", () => {
  test("keeps only user/assistant/system records and defaults missing timestamps forward", () => {
    const text = [
      JSON.stringify({ type: "attachment", timestamp: "2026-01-01T00:00:00Z" }),
      JSON.stringify({ type: "user", message: { role: "user", content: "hi" }, timestamp: "2026-01-01T00:00:01Z" }),
      JSON.stringify({ type: "assistant", message: { role: "assistant", content: [] } }), // no timestamp
      "", // blank line
      "not json",
    ].join("\n");

    const records = parseTranscriptRecords(text);

    expect(records).toHaveLength(2);
    expect(records[0]!.record.type).toBe("user");
    expect(records[1]!.record.type).toBe("assistant");
    expect(records[1]!.at).toBe(records[0]!.at); // carried forward, no own timestamp
  });

  test("recovers an orphaned <task-notification> that only ever landed as a queue-operation/remove record", () => {
    const notificationXml =
      "<task-notification>\n<task-id>orphan1</task-id>\n<tool-use-id>toolu_orphan</tool-use-id>\n<status>completed</status>\n<summary>done</summary>\n</task-notification>";
    const text = [
      JSON.stringify({ type: "user", message: { role: "user", content: "hi" }, timestamp: "2026-01-01T00:00:01Z" }),
      // Queued, then discarded (the CLI's queue-operation lifecycle) — never dequeued as a real user record.
      JSON.stringify({
        type: "queue-operation",
        operation: "enqueue",
        content: notificationXml,
        timestamp: "2026-01-01T00:00:02Z",
      }),
      JSON.stringify({
        type: "queue-operation",
        operation: "remove",
        content: notificationXml,
        timestamp: "2026-01-01T00:00:03Z",
      }),
      JSON.stringify({ type: "assistant", message: { role: "assistant", content: [] }, timestamp: "2026-01-01T00:00:04Z" }),
    ].join("\n");

    const records = parseTranscriptRecords(text);

    expect(records).toHaveLength(3);
    const synthesized = records[1]!;
    expect(synthesized.record).toMatchObject({
      type: "user",
      isSidechain: false,
      isMeta: false,
      origin: { kind: "task-notification" },
      message: { role: "user", content: notificationXml },
    });
    expect(synthesized.at).toBe(Date.parse("2026-01-01T00:00:03Z")); // the remove record's own timestamp, not EOF
  });

  test("does not duplicate a notification that also landed as a real user record", () => {
    const notificationXml =
      "<task-notification>\n<task-id>t1</task-id>\n<tool-use-id>toolu_1</tool-use-id>\n<status>completed</status>\n</task-notification>";
    const text = [
      JSON.stringify({
        type: "user",
        origin: { kind: "task-notification" },
        message: { role: "user", content: notificationXml },
        timestamp: "2026-01-01T00:00:01Z",
      }),
      JSON.stringify({
        type: "queue-operation",
        operation: "remove",
        content: notificationXml,
        timestamp: "2026-01-01T00:00:02Z",
      }),
    ].join("\n");

    const records = parseTranscriptRecords(text);

    expect(records).toHaveLength(1); // no synthesized duplicate
  });
});

describe("convertClaudeTranscript: simple session", () => {
  test("produces init, a paired assistant/user tool exchange, and a result", () => {
    const main: TranscriptEntry[] = [
      entry(1000, { type: "user", message: { role: "user", content: "run ls" }, timestamp: "t1", cwd: "/repo" }),
      entry(2000, {
        type: "assistant",
        uuid: "a1",
        message: {
          role: "assistant",
          model: "claude-sonnet-5",
          content: [{ type: "tool_use", id: "toolu_1", name: "Bash", input: { command: "ls" } }],
          stop_reason: "tool_use",
        },
      }),
      entry(2500, {
        type: "user",
        uuid: "u1",
        message: { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "file.txt" }] },
        toolUseResult: { stdout: "file.txt" },
      }),
      entry(3000, {
        type: "assistant",
        uuid: "a2",
        message: {
          role: "assistant",
          model: "claude-sonnet-5",
          content: [{ type: "text", text: "done" }],
          stop_reason: "end_turn",
        },
      }),
    ];

    const { messages, manifest } = convertClaudeTranscript("sess-1", main, []);

    expect(messages[0]).toMatchObject({ type: "system", subtype: "init", cwd: "/repo", session_id: "sess-1" });
    // the human's own prompt is never echoed
    expect(messages.some((m) => m.type === "user" && (m.message as JsonRecord)?.content === "run ls")).toBe(false);
    expect(findAll(messages, "assistant")).toHaveLength(2);
    const toolResultUser = findAll(messages, "user");
    expect(toolResultUser).toHaveLength(1);
    expect(toolResultUser[0]).toMatchObject({ uuid: "u1", tool_use_result: { stdout: "file.txt" } });
    const results = findAll(messages, "result");
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ subtype: "success", result: "done", is_error: false });
    expect(manifest.messages.assistant).toBe(2);
    expect(manifest.synthesized["system/init"]).toBe(1);
    expect(manifest.synthesized["result/success"]).toBe(1);
  });
});

describe("convertClaudeTranscript: task-notification synthesis", () => {
  test("a <task-notification> prompt synthesizes task_updated + task_notification instead of streaming as plain user/assistant", () => {
    const main: TranscriptEntry[] = [
      entry(1000, { type: "user", message: { role: "user", content: "spawn an agent" }, timestamp: "t1" }),
      entry(2000, {
        type: "assistant",
        message: {
          role: "assistant",
          model: "claude-sonnet-5",
          content: [
            {
              type: "tool_use",
              id: "toolu_agent1",
              name: "Agent",
              input: { subagent_type: "explorer", description: "look around", prompt: "go look" },
            },
          ],
          stop_reason: "tool_use",
        },
      }),
      entry(2500, {
        type: "user",
        message: {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: "toolu_agent1", content: "launched" }],
        },
        toolUseResult: { status: "async_launched", agentId: "task123" },
      }),
      entry(3000, {
        type: "user",
        origin: { kind: "task-notification" },
        message: {
          role: "user",
          content:
            "<task-notification>\n<task-id>task123</task-id>\n<tool-use-id>toolu_agent1</tool-use-id>\n<status>completed</status>\n<summary>Agent finished</summary>\n<result>all done</result>\n</task-notification>",
        },
      }),
    ];

    const { messages, manifest } = convertClaudeTranscript("sess-2", main, []);

    const started = findAll(messages, "system", "task_started");
    expect(started).toHaveLength(1);
    expect(started[0]).toMatchObject({
      task_id: "task123",
      tool_use_id: "toolu_agent1",
      is_backgrounded: true,
      subagent_type: "explorer",
      description: "look around",
    });

    const updated = findAll(messages, "system", "task_updated");
    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({ task_id: "task123", patch: { status: "completed" } });

    const notifications = findAll(messages, "system", "task_notification");
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      task_id: "task123",
      tool_use_id: "toolu_agent1",
      status: "completed",
      summary: "Agent finished",
    });

    // The task-notification prompt itself still streams as a user message
    // (the SDK surfaces it), it just isn't treated as an ordinary root prompt.
    const notificationPromptMessages = messages.filter(
      (m) => m.type === "user" && typeof (m.message as JsonRecord)?.content === "string",
    );
    expect(notificationPromptMessages).toHaveLength(1);
    expect((notificationPromptMessages[0]!.message as JsonRecord).content as string).toContain("task-notification");

    // task_updated/task_notification land before the resumed prompt streams.
    const order = messages.map((m) => `${m.type}/${m.subtype ?? ""}`);
    expect(order.indexOf("system/task_updated")).toBeLessThan(order.indexOf("system/task_notification"));
    expect(order.indexOf("system/task_notification")).toBeLessThan(order.lastIndexOf("user/"));

    expect(manifest.synthesized["system/task_started"]).toBe(1);
    expect(manifest.synthesized["system/task_updated"]).toBe(1);
    expect(manifest.synthesized["system/task_notification"]).toBe(1);
  });
});

describe("convertClaudeTranscript: orphaned task-notification recovery (full pipeline)", () => {
  test("a backgrounded task whose completion only ever appears as a queue-operation/remove record still settles, and later conversation still converts", () => {
    const notificationXml =
      "<task-notification>\n<task-id>bgtask1</task-id>\n<tool-use-id>toolu_agent1</tool-use-id>\n<status>completed</status>\n<summary>background work finished</summary>\n<result>placeholder result</result>\n</task-notification>";
    const lines = [
      { type: "user", message: { role: "user", content: "please look into something" }, timestamp: "2026-01-01T00:00:00Z" },
      {
        type: "assistant",
        uuid: "a1",
        message: {
          role: "assistant",
          model: "claude-sonnet-5",
          content: [
            {
              type: "tool_use",
              id: "toolu_agent1",
              name: "Agent",
              input: { subagent_type: "general-purpose", description: "background work", prompt: "go do it" },
            },
          ],
          stop_reason: "tool_use",
        },
        timestamp: "2026-01-01T00:00:01Z",
      },
      {
        type: "user",
        uuid: "u1",
        message: { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_agent1", content: "launched" }] },
        toolUseResult: { status: "async_launched", agentId: "bgtask1" },
        timestamp: "2026-01-01T00:00:02Z",
      },
      // The CLI queues the completion, then discards it (human typed a new
      // prompt at the same instant) — it never lands as a `type: "user"`
      // record. This is the orphan case the fix recovers.
      { type: "queue-operation", operation: "enqueue", content: notificationXml, timestamp: "2026-01-01T00:00:03Z" },
      { type: "queue-operation", operation: "remove", content: notificationXml, timestamp: "2026-01-01T00:00:04Z" },
      {
        type: "user",
        message: { role: "user", content: "here is my next unrelated question" },
        timestamp: "2026-01-01T00:00:05Z",
      },
      {
        type: "assistant",
        uuid: "a2",
        message: {
          role: "assistant",
          model: "claude-sonnet-5",
          content: [{ type: "text", text: "final answer to the next question" }],
          stop_reason: "end_turn",
        },
        timestamp: "2026-01-01T00:00:06Z",
      },
    ];
    const text = lines.map((line) => JSON.stringify(line)).join("\n");

    const main = parseTranscriptRecords(text);
    const { messages } = convertClaudeTranscript("sess-orphan", main, []);

    // The background task settles (never gets stuck open) even though its
    // completion only ever existed as a queue-operation/remove record.
    const updated = findAll(messages, "system", "task_updated");
    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({ task_id: "bgtask1", patch: { status: "completed" } });
    const notifications = findAll(messages, "system", "task_notification");
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ task_id: "bgtask1", status: "completed" });

    // The synthesized notification lands in its own chronological slot
    // (right after the human's launch turn, before the next real prompt) —
    // not appended at the end of the transcript.
    const notificationIndex = messages.findIndex((m) => m.type === "system" && m.subtype === "task_notification");
    const nextQuestionAssistantIndex = messages.findIndex(
      (m) =>
        m.type === "assistant" &&
        ((m.message as JsonRecord)?.content as JsonRecord[])?.[0]?.text === "final answer to the next question",
    );
    expect(notificationIndex).toBeGreaterThan(-1);
    expect(notificationIndex).toBeLessThan(nextQuestionAssistantIndex);

    // The later, unrelated conversation still converts normally.
    expect(messages.some((m) => m.type === "assistant" && ((m.message as JsonRecord)?.content as JsonRecord[])?.[0]?.text === "final answer to the next question")).toBe(true);
    const results = findAll(messages, "result");
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  test("force-releases a task that never settles anywhere in the transcript (no user record, no queue-operation)", () => {
    const main: TranscriptEntry[] = [
      entry(1000, { type: "user", message: { role: "user", content: "start something" }, timestamp: "t1" }),
      entry(2000, {
        type: "assistant",
        message: {
          role: "assistant",
          model: "claude-sonnet-5",
          content: [{ type: "tool_use", id: "toolu_stuck", name: "Agent", input: { description: "stuck task" } }],
          stop_reason: "tool_use",
        },
      }),
      entry(2500, {
        type: "user",
        message: { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_stuck", content: "launched" }] },
        toolUseResult: { status: "async_launched", agentId: "stuck1" },
      }),
      entry(3000, {
        type: "assistant",
        message: { role: "assistant", content: [{ type: "text", text: "meanwhile, here's something" }], stop_reason: "end_turn" },
      }),
    ];

    const { messages, manifest } = convertClaudeTranscript("sess-stuck", main, []);

    const updated = findAll(messages, "system", "task_updated");
    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({ task_id: "stuck1", patch: { status: "completed" } });
    expect(manifest.synthesized["system/task_updated"]).toBe(1);
  });
});

describe("convertClaudeTranscript: sidechain merge", () => {
  test("merges a foreground subagent's records by timestamp and tags them with parent_tool_use_id", () => {
    const main: TranscriptEntry[] = [
      entry(1000, { type: "user", message: { role: "user", content: "delegate this" }, timestamp: "t1" }),
      entry(2000, {
        type: "assistant",
        message: {
          role: "assistant",
          model: "claude-sonnet-5",
          content: [{ type: "tool_use", id: "toolu_fg1", name: "Agent", input: { description: "fg task" } }],
          stop_reason: "tool_use",
        },
      }),
      entry(3000, {
        type: "user",
        message: { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_fg1", content: "sub result" }] },
        toolUseResult: { status: "completed" },
      }),
      entry(4000, {
        type: "assistant",
        message: { role: "assistant", model: "claude-sonnet-5", content: [{ type: "text", text: "wrapped up" }], stop_reason: "end_turn" },
      }),
    ];
    const agents: SubagentTranscript[] = [
      {
        agentId: "agentXYZ",
        toolUseId: "toolu_fg1",
        agentType: "explorer",
        description: "fg task",
        records: [
          entry(2500, {
            type: "assistant",
            isSidechain: true,
            agentId: "agentXYZ",
            message: { role: "assistant", model: "claude-sonnet-5", content: [{ type: "text", text: "sub work" }] },
          }),
        ],
      },
    ];

    const { messages, manifest } = convertClaudeTranscript("sess-3", main, agents);

    expect(manifest.records.sidechain).toBe(1);
    expect(manifest.records.skippedSidechain).toBe(0);

    const contentOf = (m: JsonRecord): JsonRecord[] => (m.message as JsonRecord).content as JsonRecord[];
    const subMessageIndex = messages.findIndex(
      (m) => m.type === "assistant" && contentOf(m)?.[0]?.text === "sub work",
    );
    expect(subMessageIndex).toBeGreaterThan(-1);
    expect(messages[subMessageIndex]).toMatchObject({ parent_tool_use_id: "toolu_fg1" });

    // Sits between the Agent call (t=2000) and its tool_result (t=3000).
    const callIndex = messages.findIndex(
      (m) => m.type === "assistant" && contentOf(m)?.[0]?.type === "tool_use",
    );
    const resultIndex = messages.findIndex(
      (m) => m.type === "user" && contentOf(m)?.[0]?.type === "tool_result",
    );
    expect(callIndex).toBeLessThan(subMessageIndex);
    expect(subMessageIndex).toBeLessThan(resultIndex);

    // Foreground call settles at its tool_result, not at a task-notification.
    const started = findAll(messages, "system", "task_started");
    expect(started[0]).toMatchObject({ task_id: "agentXYZ", tool_use_id: "toolu_fg1", is_backgrounded: false });
    const updatedIndex = messages.findIndex((m) => m.type === "system" && m.subtype === "task_updated");
    expect(updatedIndex).toBeGreaterThan(callIndex);
    expect(updatedIndex).toBeLessThanOrEqual(resultIndex);
  });

  test("drops sidechains whose spawning call falls outside the selected turn window", () => {
    const main: TranscriptEntry[] = [
      entry(1000, { type: "user", message: { role: "user", content: "go" }, timestamp: "t1" }),
      entry(2000, {
        type: "assistant",
        message: { role: "assistant", content: [{ type: "text", text: "ok" }], stop_reason: "end_turn" },
      }),
    ];
    const agents: SubagentTranscript[] = [
      {
        agentId: "orphan",
        toolUseId: "toolu_never_called",
        agentType: null,
        description: null,
        records: [entry(1500, { type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "x" }] } })],
      },
    ];

    const { manifest } = convertClaudeTranscript("sess-4", main, agents);
    expect(manifest.records.sidechain).toBe(0);
    expect(manifest.records.skippedSidechain).toBe(1);
  });
});

describe("convertClaudeTranscript: guards", () => {
  test("throws on an empty record set", () => {
    expect(() => convertClaudeTranscript("empty", [], [])).toThrow(/no user\/assistant\/system records/);
  });
});

describe("readClaudeSubagentTranscripts / loadClaudeTranscript (IO)", () => {
  const tempDirs: string[] = [];

  async function tempDir(): Promise<string> {
    const dir = await mkdtemp(path.join(os.tmpdir(), "claude-transcript-io-"));
    tempDirs.push(dir);
    return dir;
  }

  test("discovers agent-*.jsonl sidechains and reads their .meta.json sidecar", async () => {
    const projectDir = await tempDir();
    const sessionId = "sess-io-1";
    const sessionPath = path.join(projectDir, `${sessionId}.jsonl`);
    await writeFile(
      sessionPath,
      `${JSON.stringify({ type: "user", message: { role: "user", content: "hi" }, timestamp: "t1" })}\n`,
    );
    const subagentsDir = path.join(projectDir, sessionId, "subagents");
    await mkdir(subagentsDir, { recursive: true });
    await writeFile(
      path.join(subagentsDir, "agent-abc123.jsonl"),
      `${JSON.stringify({ type: "assistant", isSidechain: true, message: { role: "assistant", content: [{ type: "text", text: "sub" }] } })}\n`,
    );
    await writeFile(
      path.join(subagentsDir, "agent-abc123.meta.json"),
      JSON.stringify({ agentType: "explorer", description: "look", toolUseId: "toolu_x" }),
    );
    // Non-matching file — must be ignored.
    await writeFile(path.join(subagentsDir, "notes.txt"), "ignore me");

    const agents = await readClaudeSubagentTranscripts(sessionPath);
    expect(agents).toHaveLength(1);
    expect(agents[0]).toMatchObject({
      agentId: "abc123",
      toolUseId: "toolu_x",
      agentType: "explorer",
      description: "look",
    });
    expect(agents[0]!.records).toHaveLength(1);

    const loaded = await loadClaudeTranscript(sessionPath);
    expect(loaded.sessionId).toBe(sessionId);
    expect(loaded.main).toHaveLength(1);
    expect(loaded.agents).toHaveLength(1);

    for (const dir of tempDirs) await rm(dir, { recursive: true, force: true });
    tempDirs.length = 0;
  });

  test("returns no agents when the session has no subagents directory", async () => {
    const projectDir = await tempDir();
    const agents = await readClaudeSubagentTranscripts(path.join(projectDir, "sess-io-2.jsonl"));
    expect(agents).toEqual([]);
    for (const dir of tempDirs) await rm(dir, { recursive: true, force: true });
    tempDirs.length = 0;
  });
});
