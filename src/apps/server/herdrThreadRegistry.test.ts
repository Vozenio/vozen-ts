import { afterEach, describe, expect, test } from "bun:test";
import { appendFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { HerdrThreadRegistry, herdrVirtualProjectName, toHerdrThreadId, toHerdrVirtualProjectId } from "./herdrThreadRegistry.ts";
import { HerdrEventClient } from "../../plugins/provider_herdr/herdrEventClient.ts";

const FIXTURE = path.join(import.meta.dir, "../../plugins/provider_herdr/__fixtures__/fake-herdr.ts");
const BIN = ["bun", "run", FIXTURE];

const tempDirs: string[] = [];

async function tempHome(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "herdr-registry-"));
  tempDirs.push(dir);
  return dir;
}

function agentListOutput(agents: Record<string, unknown>[]): string {
  return JSON.stringify({ result: { agents } });
}

// Fixture config rides the child process's env, passed explicitly (via
// registry construction or setEnv) instead of a shared process.env mutation
// — multiple concurrently-scheduled tests can't race over the same keys.
function envWith(overrides: Record<string, string>): Record<string, string | undefined> {
  return { ...process.env, ...overrides };
}

const BASE_AGENT = {
  agent: "claude",
  agent_status: "working",
  pane_id: "w1:p1",
  workspace_id: "w1",
  tab_id: "w1:t1",
  cwd: "/tmp/project",
  foreground_cwd: "/tmp/project",
  terminal_title_stripped: "hi",
  focused: true,
  revision: 1,
  state_change_seq: 1,
};

afterEach(async () => {
  while (tempDirs.length > 0) {
    await rm(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("HerdrThreadRegistry discovery", () => {
  test("a newly seen agent becomes a listed thread and fires thread-created", async () => {
    const registry = new HerdrThreadRegistry({
      bin: BIN,
      env: envWith({
        FAKE_HERDR_LIST_OUTPUT: agentListOutput([BASE_AGENT]),
        FAKE_HERDR_READ_OUTPUT: "terminal snapshot",
      }),
    });
    const changes: Array<[string, string[]]> = [];
    registry.onChange((threadId, c) => changes.push([threadId, c]));

    await registry.pollOnce();

    const threadId = toHerdrThreadId("w1:p1");
    expect(registry.hasThread(threadId)).toBe(true);
    expect(registry.getThreadRow(threadId)).toMatchObject({
      id: threadId,
      provider_thread_id: "w1:p1",
      project_id: "herdr_proj_project",
      cwd: "/tmp/project",
      title: "hi",
      status: "running", // working -> running
      archived_at: null,
    });
    expect(changes).toEqual([[threadId, ["thread-created"]]]);
  });

  test("uses foregroundCwd over cwd — cwd is frozen at launch, foregroundCwd tracks an in-session cd", async () => {
    const registry = new HerdrThreadRegistry({
      bin: BIN,
      env: envWith({
        FAKE_HERDR_LIST_OUTPUT: agentListOutput([{ ...BASE_AGENT, cwd: "/tmp/launch-dir", foreground_cwd: "/tmp/current-dir" }]),
        FAKE_HERDR_READ_OUTPUT: "snapshot",
      }),
    });
    await registry.pollOnce();

    expect(registry.getThreadRow(toHerdrThreadId("w1:p1"))?.cwd).toBe("/tmp/current-dir");
  });

  test("an unchanged poll emits nothing again", async () => {
    const registry = new HerdrThreadRegistry({
      bin: BIN,
      env: envWith({
        FAKE_HERDR_LIST_OUTPUT: agentListOutput([BASE_AGENT]),
        FAKE_HERDR_READ_OUTPUT: "terminal snapshot",
      }),
    });
    const changes: string[][] = [];
    registry.onChange((_id, c) => changes.push(c));

    await registry.pollOnce();
    await registry.pollOnce();

    expect(changes).toEqual([["thread-created"]]);
  });

  test("a bumped state_change_seq fires status-changed", async () => {
    const registry = new HerdrThreadRegistry({ bin: BIN });
    const changes: string[][] = [];
    registry.onChange((_id, c) => changes.push(c));

    registry.setEnv(envWith({
      FAKE_HERDR_LIST_OUTPUT: agentListOutput([BASE_AGENT]),
      FAKE_HERDR_READ_OUTPUT: "snapshot 1",
    }));
    await registry.pollOnce();

    registry.setEnv(envWith({
      FAKE_HERDR_LIST_OUTPUT: agentListOutput([{ ...BASE_AGENT, state_change_seq: 2, agent_status: "blocked" }]),
      FAKE_HERDR_READ_OUTPUT: "snapshot 2",
    }));
    await registry.pollOnce();

    expect(changes).toEqual([
      ["thread-created"],
      ["status-changed", "events-appended", "interactions-changed"],
    ]);
    const threadId = toHerdrThreadId("w1:p1");
    expect(registry.hasPendingInteraction(threadId)).toBe(true);
  });

  test("an agent that disappears fires thread-deleted and is removed", async () => {
    const registry = new HerdrThreadRegistry({ bin: BIN });
    const changes: string[][] = [];
    registry.onChange((_id, c) => changes.push(c));

    registry.setEnv(envWith({
      FAKE_HERDR_LIST_OUTPUT: agentListOutput([BASE_AGENT]),
      FAKE_HERDR_READ_OUTPUT: "snapshot",
    }));
    await registry.pollOnce();

    registry.setEnv(envWith({ FAKE_HERDR_LIST_OUTPUT: agentListOutput([]) }));
    await registry.pollOnce();

    const threadId = toHerdrThreadId("w1:p1");
    expect(registry.hasThread(threadId)).toBe(false);
    expect(changes.at(-1)).toEqual(["thread-deleted"]);
  });

  test("a herdr CLI failure leaves prior state untouched", async () => {
    const registry = new HerdrThreadRegistry({ bin: BIN });
    registry.setEnv(envWith({
      FAKE_HERDR_LIST_OUTPUT: agentListOutput([BASE_AGENT]),
      FAKE_HERDR_READ_OUTPUT: "snapshot",
    }));
    await registry.pollOnce();

    registry.setEnv(envWith({ FAKE_HERDR_EXIT_CODE: "1" }));
    await registry.pollOnce();

    expect(registry.hasThread(toHerdrThreadId("w1:p1"))).toBe(true);
  });
});

describe("HerdrThreadRegistry.resolveInteraction", () => {
  test("emits interactions-changed so the WS-pushed UI sees the resolve — no polling to fall back on", async () => {
    const registry = new HerdrThreadRegistry({
      bin: BIN,
      env: envWith({
        FAKE_HERDR_LIST_OUTPUT: agentListOutput([{ ...BASE_AGENT, agent_status: "blocked" }]),
        FAKE_HERDR_READ_OUTPUT: "scrollback",
      }),
    });
    await registry.pollOnce();

    const changes: string[][] = [];
    registry.onChange((_id, c) => changes.push(c));

    const threadId = toHerdrThreadId("w1:p1");
    const interaction = (await registry.pendingInteractions(threadId))[0]!;
    const resolved = await registry.resolveInteraction(threadId, interaction.id, {
      kind: "user_answer",
      answers: { herdr_input: { selected: ["enter"] } },
    });

    expect(resolved.status).toBe("resolving");
    expect(changes).toEqual([["interactions-changed"]]);
  });
});

describe("HerdrThreadRegistry content", () => {
  test("falls back to a single terminal-snapshot entry when there is no session log", async () => {
    const registry = new HerdrThreadRegistry({
      bin: BIN,
      env: envWith({
        FAKE_HERDR_LIST_OUTPUT: agentListOutput([BASE_AGENT]),
        FAKE_HERDR_READ_OUTPUT: "scrollback text",
      }),
    });
    await registry.pollOnce();

    const threadId = toHerdrThreadId("w1:p1");
    const rows = registry.timelineRows(threadId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ thread_id: threadId, role: "assistant", text: "scrollback text", kind: "conversation" });
    expect(registry.threadMaxSeq(threadId)).toBe(1);
  });

  test("reads and parses a resolvable claude session log instead of the terminal", async () => {
    const home = await tempHome();
    const projectDir = path.join(home, ".claude", "projects", "-tmp-project");
    await mkdir(projectDir, { recursive: true });
    await writeFile(
      path.join(projectDir, "sess-1.jsonl"),
      [
        JSON.stringify({ type: "user", message: { role: "user", content: "hi" }, timestamp: "t1" }),
        JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "hello" }] }, timestamp: "t2" }),
      ].join("\n"),
    );

    const registry = new HerdrThreadRegistry({
      bin: BIN,
      home,
      env: envWith({
        FAKE_HERDR_LIST_OUTPUT: agentListOutput([{ ...BASE_AGENT, agent_session: { kind: "id", value: "sess-1" } }]),
      }),
    });
    await registry.pollOnce();

    const threadId = toHerdrThreadId("w1:p1");
    const rows = registry.timelineRows(threadId);
    expect(rows.map((r) => ({ role: r.role, text: r.text }))).toEqual([
      { role: "user", text: "hi" },
      { role: "assistant", text: "hello" },
    ]);
  });

  test("a tool_use/tool_result pair becomes a work row alongside the conversation row", async () => {
    const home = await tempHome();
    const projectDir = path.join(home, ".claude", "projects", "-tmp-project");
    await mkdir(projectDir, { recursive: true });
    await writeFile(
      path.join(projectDir, "sess-2.jsonl"),
      [
        JSON.stringify({
          type: "assistant",
          message: {
            role: "assistant",
            content: [
              { type: "text", text: "checking" },
              { type: "tool_use", id: "toolu_1", name: "Bash", input: { command: "ls" } },
            ],
          },
          timestamp: "t1",
        }),
        JSON.stringify({
          type: "user",
          message: { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "a.txt" }] },
        }),
      ].join("\n"),
    );

    const registry = new HerdrThreadRegistry({
      bin: BIN,
      home,
      env: envWith({
        FAKE_HERDR_LIST_OUTPUT: agentListOutput([{ ...BASE_AGENT, agent_session: { kind: "id", value: "sess-2" } }]),
      }),
    });
    await registry.pollOnce();

    const threadId = toHerdrThreadId("w1:p1");
    const rows = registry.timelineRows(threadId);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ kind: "conversation", role: "assistant", text: "checking" });
    expect(rows[1]).toMatchObject({ kind: "work", work_kind: "command" });
    expect(JSON.parse(rows[1]!.payload!)).toMatchObject({ command: "ls", output: "a.txt", status: "completed" });
    // Max source_seq_end, not row count: the tool row was touched by two
    // notifications (open + result), so the high-water mark is 3 across the
    // 2 rows — what a client must echo back as afterSequence to get an
    // empty delta.
    expect(registry.threadMaxSeq(threadId)).toBe(3);
    const maxSeq = registry.threadMaxSeq(threadId)!;
    expect(registry.timelineRows(threadId).filter((row) => row.source_seq_end > maxSeq)).toHaveLength(0);
  });

  test("AskUserQuestion becomes a question work row, not a generic tool card", async () => {
    const home = await tempHome();
    const projectDir = path.join(home, ".claude", "projects", "-tmp-project");
    await mkdir(projectDir, { recursive: true });
    await writeFile(
      path.join(projectDir, "sess-3.jsonl"),
      [
        JSON.stringify({
          type: "assistant",
          message: {
            role: "assistant",
            content: [{
              type: "tool_use",
              id: "toolu_q1",
              name: "AskUserQuestion",
              input: {
                questions: [{
                  question: "Which fix first?",
                  header: "Priority",
                  multiSelect: false,
                  options: [{ label: "Forks filter", description: "recommended" }, { label: "Prompt content" }],
                }],
              },
            }],
          },
        }),
        JSON.stringify({
          type: "user",
          message: { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_q1", content: "user rejected", is_error: true }] },
        }),
      ].join("\n"),
    );

    const registry = new HerdrThreadRegistry({
      bin: BIN,
      home,
      env: envWith({
        FAKE_HERDR_LIST_OUTPUT: agentListOutput([{ ...BASE_AGENT, agent_session: { kind: "id", value: "sess-3" } }]),
      }),
    });
    await registry.pollOnce();

    const threadId = toHerdrThreadId("w1:p1");
    const rows = registry.timelineRows(threadId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "work", work_kind: "question" });
    const payload = JSON.parse(rows[0]!.payload!);
    expect(payload.lifecycle).toBe("interrupted");
    expect(payload.statusReason).toBe("user rejected");
    expect(payload.answers).toBeNull();
    expect(payload.questions).toEqual([{
      id: "toolu_q1:question-1",
      prompt: "Which fix first?",
      shortLabel: "Priority",
      multiSelect: false,
      options: [
        { value: "toolu_q1:question-1:option-1", label: "Forks filter", description: "recommended" },
        { value: "toolu_q1:question-1:option-2", label: "Prompt content" },
      ],
      allowFreeText: true,
    }]);
  });

  test("Agent/Task tool_use becomes a pending delegation work row before its result arrives", async () => {
    const home = await tempHome();
    const projectDir = path.join(home, ".claude", "projects", "-tmp-project");
    await mkdir(projectDir, { recursive: true });
    await writeFile(
      path.join(projectDir, "sess-5.jsonl"),
      [
        JSON.stringify({
          type: "assistant",
          message: {
            role: "assistant",
            content: [{
              type: "tool_use",
              id: "toolu_delegate1",
              name: "Task",
              input: { description: "Investigate bug", prompt: "Investigate bug\nfull details here", subagent_type: "general-purpose" },
            }],
          },
        }),
      ].join("\n"),
    );

    const registry = new HerdrThreadRegistry({
      bin: BIN,
      home,
      env: envWith({
        FAKE_HERDR_LIST_OUTPUT: agentListOutput([{ ...BASE_AGENT, agent_session: { kind: "id", value: "sess-5" } }]),
      }),
    });
    await registry.pollOnce();

    const threadId = toHerdrThreadId("w1:p1");
    const rows = registry.timelineRows(threadId);
    const delegationRow = rows.find((r) => r.work_kind === "delegation");
    expect(delegationRow).toBeDefined();
    const payload = JSON.parse(delegationRow!.payload!);
    // toolName/subagentType: bb's own unified `delegation` item shape
    // (tool-classification.ts's classifyDelegation) does not carry the raw
    // Claude tool name or subagent_type at all, only `label` (the call's own
    // description) — so the new claude-delta pipeline echoes the label as
    // toolName and leaves subagentType null, rather than the raw "Task"/
    // "general-purpose" the old hand-written parser recovered.
    expect(payload).toMatchObject({
      status: "pending",
      toolName: "Investigate bug",
      childRef: "toolu_delegate1",
      background: false,
      subagentType: null,
      description: "Investigate bug",
      completedAt: null,
      childRows: [],
    });
  });

  test("a completed Agent delegation carries its final output and completedAt", async () => {
    const home = await tempHome();
    const projectDir = path.join(home, ".claude", "projects", "-tmp-project");
    await mkdir(projectDir, { recursive: true });
    await writeFile(
      path.join(projectDir, "sess-6.jsonl"),
      [
        JSON.stringify({
          type: "assistant",
          message: {
            role: "assistant",
            content: [{ type: "tool_use", id: "toolu_delegate2", name: "Agent", input: { subagent_type: "fork" } }],
          },
        }),
        JSON.stringify({
          type: "user",
          message: { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_delegate2", content: "sub-agent final report" }] },
        }),
      ].join("\n"),
    );

    const registry = new HerdrThreadRegistry({
      bin: BIN,
      home,
      env: envWith({
        FAKE_HERDR_LIST_OUTPUT: agentListOutput([{ ...BASE_AGENT, agent_session: { kind: "id", value: "sess-6" } }]),
      }),
    });
    await registry.pollOnce();

    const threadId = toHerdrThreadId("w1:p1");
    const rows = registry.timelineRows(threadId);
    const delegationRow = rows.find((r) => r.work_kind === "delegation");
    const payload = JSON.parse(delegationRow!.payload!);
    expect(payload.status).toBe("completed");
    expect(payload.output).toBe("sub-agent final report");
    expect(payload.completedAt).toEqual(expect.any(Number));
    // bb's classifyDelegation fallback order is description ?? prompt's
    // first line ?? subagent_type ?? toolName — subagent_type ("fork") wins
    // over the bare "Agent" tool name the old hand-written parser fell back
    // to when no description/prompt was given.
    expect(payload.description).toBe("fork");
  });

  test("an answered AskUserQuestion recovers structured answers from toolUseResult", async () => {
    const home = await tempHome();
    const projectDir = path.join(home, ".claude", "projects", "-tmp-project");
    await mkdir(projectDir, { recursive: true });
    await writeFile(
      path.join(projectDir, "sess-4.jsonl"),
      [
        JSON.stringify({
          type: "assistant",
          message: {
            role: "assistant",
            content: [{
              type: "tool_use",
              id: "toolu_q2",
              name: "AskUserQuestion",
              input: {
                questions: [{
                  question: "Which fix first?",
                  header: "Priority",
                  multiSelect: false,
                  options: [{ label: "Forks filter" }, { label: "Prompt content" }],
                }],
              },
            }],
          },
        }),
        // Real shape confirmed against this repo's own session transcript:
        // toolUseResult sits beside `message`, not inside message.content,
        // and answers are keyed by the question's own text.
        JSON.stringify({
          type: "user",
          message: { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_q2", content: "answered" }] },
          toolUseResult: {
            questions: [{ question: "Which fix first?", header: "Priority", options: [{ label: "Forks filter" }, { label: "Prompt content" }], multiSelect: false }],
            answers: { "Which fix first?": "Forks filter" },
            annotations: {},
          },
        }),
      ].join("\n"),
    );

    const registry = new HerdrThreadRegistry({
      bin: BIN,
      home,
      env: envWith({
        FAKE_HERDR_LIST_OUTPUT: agentListOutput([{ ...BASE_AGENT, agent_session: { kind: "id", value: "sess-4" } }]),
      }),
    });
    await registry.pollOnce();

    const threadId = toHerdrThreadId("w1:p1");
    const payload = JSON.parse(registry.timelineRows(threadId)[0]!.payload!);
    expect(payload.lifecycle).toBe("answered");
    expect(payload.answers).toEqual({
      "toolu_q2:question-1": { selected: ["toolu_q2:question-1:option-1"] },
    });
  });

  test("a free-text AskUserQuestion answer that matches no option falls back to freeText", async () => {
    const home = await tempHome();
    const projectDir = path.join(home, ".claude", "projects", "-tmp-project");
    await mkdir(projectDir, { recursive: true });
    await writeFile(
      path.join(projectDir, "sess-5.jsonl"),
      [
        JSON.stringify({
          type: "assistant",
          message: {
            role: "assistant",
            content: [{
              type: "tool_use",
              id: "toolu_q3",
              name: "AskUserQuestion",
              input: { questions: [{ question: "Which fix first?", options: [{ label: "Forks filter" }], multiSelect: false }] },
            }],
          },
        }),
        JSON.stringify({
          type: "user",
          message: { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_q3", content: "answered" }] },
          toolUseResult: {
            questions: [{ question: "Which fix first?", options: [{ label: "Forks filter" }], multiSelect: false }],
            answers: { "Which fix first?": "actually let's not, do something else" },
            annotations: {},
          },
        }),
      ].join("\n"),
    );

    const registry = new HerdrThreadRegistry({
      bin: BIN,
      home,
      env: envWith({
        FAKE_HERDR_LIST_OUTPUT: agentListOutput([{ ...BASE_AGENT, agent_session: { kind: "id", value: "sess-5" } }]),
      }),
    });
    await registry.pollOnce();

    const threadId = toHerdrThreadId("w1:p1");
    const payload = JSON.parse(registry.timelineRows(threadId)[0]!.payload!);
    expect(payload.answers).toEqual({
      "toolu_q3:question-1": { selected: [], freeText: "actually let's not, do something else" },
    });
  });

  test("a backgrounded Agent's <task-notification> resume prompt never renders as a garbled user row", async () => {
    const home = await tempHome();
    const projectDir = path.join(home, ".claude", "projects", "-tmp-project");
    await mkdir(projectDir, { recursive: true });
    await writeFile(
      path.join(projectDir, "sess-7.jsonl"),
      [
        JSON.stringify({ type: "user", message: { role: "user", content: "spawn an agent" }, timestamp: "t1" }),
        JSON.stringify({
          type: "assistant",
          message: {
            role: "assistant",
            content: [{
              type: "tool_use",
              id: "toolu_agent1",
              name: "Agent",
              input: { subagent_type: "explorer", description: "look around", prompt: "go look" },
            }],
            stop_reason: "tool_use",
          },
          timestamp: "t2",
        }),
        JSON.stringify({
          type: "user",
          message: { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_agent1", content: "launched" }] },
          toolUseResult: { status: "async_launched", agentId: "task123" },
          timestamp: "t3",
        }),
        JSON.stringify({
          type: "user",
          origin: { kind: "task-notification" },
          message: {
            role: "user",
            content:
              "<task-notification>\n<task-id>task123</task-id>\n<tool-use-id>toolu_agent1</tool-use-id>\n<status>completed</status>\n<summary>Agent finished</summary>\n<result>all done</result>\n</task-notification>",
          },
          timestamp: "t4",
        }),
        JSON.stringify({
          type: "assistant",
          message: { role: "assistant", content: [{ type: "text", text: "The agent finished." }], stop_reason: "end_turn" },
          timestamp: "t5",
        }),
      ].join("\n"),
    );

    const registry = new HerdrThreadRegistry({
      bin: BIN,
      home,
      env: envWith({
        FAKE_HERDR_LIST_OUTPUT: agentListOutput([{ ...BASE_AGENT, agent_session: { kind: "id", value: "sess-7" } }]),
      }),
    });
    await registry.pollOnce();

    const threadId = toHerdrThreadId("w1:p1");
    const rows = registry.timelineRows(threadId);
    // The old sessionLog.ts-based parser's known bug: the CLI-injected
    // <task-notification> resume prompt streamed as a plain user message and
    // rendered as garbled XML-ish text in the timeline. The new pipeline
    // recognizes it as a system/task_notification instead (via
    // convertClaudeTranscript), so no row's text should ever contain it.
    for (const row of rows) {
      expect(row.text).not.toContain("task-notification");
    }
    // The background task settles under its own id (familyId "task123"),
    // separate from the delegation call's own row (childRef "toolu_agent1")
    // — either one carries the "finished" summary.
    const settled = rows.find((r) => r.work_kind === "delegation" && r.payload?.includes("Agent finished"));
    expect(settled).toBeDefined();
    expect(rows.some((r) => r.role === "assistant" && r.text === "The agent finished.")).toBe(true);
  });

  test("a working agent keeps picking up new session log content even when stateChangeSeq/revision never change", async () => {
    const home = await tempHome();
    const projectDir = path.join(home, ".claude", "projects", "-tmp-project");
    await mkdir(projectDir, { recursive: true });
    const logPath = path.join(projectDir, "sess-stall.jsonl");
    await writeFile(
      logPath,
      JSON.stringify({ type: "user", message: { role: "user", content: "first" }, timestamp: "t1" }) + "\n",
    );

    const registry = new HerdrThreadRegistry({
      bin: BIN,
      home,
      env: envWith({
        FAKE_HERDR_LIST_OUTPUT: agentListOutput([{ ...BASE_AGENT, agent_session: { kind: "id", value: "sess-stall" } }]),
      }),
    });
    await registry.pollOnce();
    const threadId = toHerdrThreadId("w1:p1");
    expect(registry.timelineRows(threadId).map((r) => r.text)).toEqual(["first"]);

    // Same stateChangeSeq/revision as BASE_AGENT on the second poll — herdr
    // itself is stalled, but the log grew (Claude kept writing).
    await appendFile(
      logPath,
      JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "second" }] }, timestamp: "t2" }) + "\n",
    );
    const changes: string[][] = [];
    registry.onChange((_id, c) => changes.push(c));
    await registry.pollOnce();

    expect(registry.timelineRows(threadId).map((r) => r.text)).toEqual(["first", "second"]);
    expect(changes).toEqual([["events-appended"]]);
  });

  test("an idle agent does not re-read the session log when nothing herdr reports has changed", async () => {
    const home = await tempHome();
    const projectDir = path.join(home, ".claude", "projects", "-tmp-project");
    await mkdir(projectDir, { recursive: true });
    const logPath = path.join(projectDir, "sess-idle.jsonl");
    await writeFile(
      logPath,
      JSON.stringify({ type: "user", message: { role: "user", content: "first" }, timestamp: "t1" }) + "\n",
    );

    const registry = new HerdrThreadRegistry({
      bin: BIN,
      home,
      env: envWith({
        FAKE_HERDR_LIST_OUTPUT: agentListOutput([{ ...BASE_AGENT, agent_status: "idle", agent_session: { kind: "id", value: "sess-idle" } }]),
      }),
    });
    await registry.pollOnce();
    const threadId = toHerdrThreadId("w1:p1");
    expect(registry.timelineRows(threadId).map((r) => r.text)).toEqual(["first"]);

    // Log grows, but herdr reports the exact same idle snapshot — no reason
    // to re-read, an idle terminal's transcript doesn't rewrite itself.
    await appendFile(
      logPath,
      JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "second" }] }, timestamp: "t2" }) + "\n",
    );
    const changes: string[][] = [];
    registry.onChange((_id, c) => changes.push(c));
    await registry.pollOnce();

    expect(registry.timelineRows(threadId).map((r) => r.text)).toEqual(["first"]);
    expect(changes).toEqual([]);
  });
});

describe("HerdrThreadRegistry event-driven refresh (real Unix socket, no mocks)", () => {
  function tempSocketPath(): string {
    return path.join(os.tmpdir(), `herdr-registry-event-test-${crypto.randomUUID()}.sock`);
  }

  const activeRegistries: HerdrThreadRegistry[] = [];
  const activeServers: ReturnType<typeof Bun.listen>[] = [];

  afterEach(() => {
    while (activeRegistries.length) activeRegistries.pop()!.stop();
    while (activeServers.length) activeServers.pop()!.stop(true);
  });

  async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (predicate()) return;
      await Bun.sleep(10);
    }
    throw new Error("waitFor timed out");
  }

  test("a pane_updated push refreshes a known thread immediately, without waiting for the poll interval", async () => {
    const home = await tempHome();
    const projectDir = path.join(home, ".claude", "projects", "-tmp-project");
    await mkdir(projectDir, { recursive: true });
    const logPath = path.join(projectDir, "sess-event.jsonl");
    await writeFile(
      logPath,
      JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "first" }] }, timestamp: "t1" }) + "\n",
    );

    const socketPath = tempSocketPath();
    let connectedSocket: { write(data: string): void } | null = null;
    const server = Bun.listen({
      unix: socketPath,
      socket: {
        open(socket) {
          connectedSocket = socket;
        },
        data(socket, data) {
          const req = JSON.parse(data.toString().trim()) as { id: string };
          socket.write(`${JSON.stringify({ id: req.id, result: { type: "subscription_started" } })}\n`);
        },
      },
    });
    activeServers.push(server);
    const eventClient = new HerdrEventClient({ socketPath });

    // A long poll interval isolates the refresh under test to the event
    // path — the periodic CLI poll won't fire again inside this test's
    // window, so any observed refresh has to have come from the pushed event.
    const registry = new HerdrThreadRegistry({
      bin: BIN,
      home,
      pollIntervalMs: 60_000,
      eventClient,
      env: envWith({
        FAKE_HERDR_LIST_OUTPUT: agentListOutput([{ ...BASE_AGENT, agent_session: { kind: "id", value: "sess-event" } }]),
      }),
    });
    activeRegistries.push(registry);
    registry.start();

    const threadId = toHerdrThreadId("w1:p1");
    await waitFor(() => registry.hasThread(threadId));
    expect(registry.timelineRows(threadId).map((r) => r.text)).toEqual(["first"]);
    await waitFor(() => connectedSocket !== null);

    await appendFile(
      logPath,
      JSON.stringify({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "second" }] }, timestamp: "t2" }) + "\n",
    );

    connectedSocket!.write(`${JSON.stringify({
      event: "pane_updated",
      data: { pane: { pane_id: "w1:p1", revision: 2 } },
    })}\n`);

    await waitFor(() => registry.timelineRows(threadId).map((r) => r.text).includes("second"));
  });

  test("event client failing to connect doesn't break normal CLI-poll discovery/refresh", async () => {
    const registry = new HerdrThreadRegistry({
      bin: BIN,
      pollIntervalMs: 60_000,
      eventClient: new HerdrEventClient({ socketPath: path.join(os.tmpdir(), "herdr-registry-no-such-socket.sock") }),
      env: envWith({
        FAKE_HERDR_LIST_OUTPUT: agentListOutput([BASE_AGENT]),
        FAKE_HERDR_READ_OUTPUT: "terminal snapshot",
      }),
    });
    activeRegistries.push(registry);

    expect(() => registry.start()).not.toThrow();
    const threadId = toHerdrThreadId("w1:p1");
    await waitFor(() => registry.hasThread(threadId));
    expect(registry.getThreadRow(threadId)?.title).toBe("hi");
  });
});

describe("HerdrThreadRegistry.send", () => {
  test("submits the prompt for a known thread", async () => {
    const registry = new HerdrThreadRegistry({
      bin: BIN,
      env: envWith({
        FAKE_HERDR_LIST_OUTPUT: agentListOutput([BASE_AGENT]),
        FAKE_HERDR_READ_OUTPUT: "snapshot",
      }),
    });
    await registry.pollOnce();

    await expect(registry.send(toHerdrThreadId("w1:p1"), "do the thing")).resolves.toBeUndefined();
  });

  test("throws for an unknown thread id", async () => {
    const registry = new HerdrThreadRegistry({ bin: BIN });
    await expect(registry.send("herdr_nope", "hi")).rejects.toThrow("Unknown Herdr thread");
  });
});

describe("toHerdrVirtualProjectId / herdrVirtualProjectName", () => {
  test("slugifies the cwd's basename", () => {
    expect(toHerdrVirtualProjectId("/Users/me/My Project")).toBe("herdr_proj_my-project");
    expect(herdrVirtualProjectName("/Users/me/My Project")).toBe("My Project");
  });

  test("falls back to 'root' for a bare slash", () => {
    expect(toHerdrVirtualProjectId("/")).toBe("herdr_proj_root");
  });
});

describe("HerdrThreadRegistry.listVirtualProjects", () => {
  test("groups threads sharing a cwd basename under one virtual project", async () => {
    const registry = new HerdrThreadRegistry({
      bin: BIN,
      env: envWith({
        FAKE_HERDR_LIST_OUTPUT: agentListOutput([
          { ...BASE_AGENT, pane_id: "w1:p1", cwd: "/tmp/project", foreground_cwd: "/tmp/project" },
          { ...BASE_AGENT, pane_id: "w1:p2", cwd: "/tmp/other/project", foreground_cwd: "/tmp/other/project" },
        ]),
        FAKE_HERDR_READ_OUTPUT: "snapshot",
      }),
    });
    await registry.pollOnce();

    const projects = registry.listVirtualProjects();
    expect(projects.map((p) => p.id)).toEqual(["herdr_proj_project"]);

    expect(registry.getThreadRow(toHerdrThreadId("w1:p1"))?.project_id).toBe("herdr_proj_project");
    expect(registry.getThreadRow(toHerdrThreadId("w1:p2"))?.project_id).toBe("herdr_proj_project");
  });
});
