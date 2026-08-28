import { describe, expect, test } from "bun:test";
import path from "node:path";
import { HerdrCliError, listHerdrAgents, readHerdrAgent, sendHerdrInput, sendHerdrPrompt } from "./client.ts";

const FIXTURE = path.join(import.meta.dir, "__fixtures__/fake-herdr.ts");
const BIN = ["bun", "run", FIXTURE];

// Fixture config rides the child process's env, passed explicitly per call
// (not via a shared process.env mutation) so concurrently-scheduled tests
// never race over the same global keys.
function opts(env: Record<string, string>) {
  return { bin: BIN, env: { ...process.env, ...env } };
}

describe("listHerdrAgents", () => {
  test("parses the CLI's snake_case JSON into camelCase snapshots", async () => {
    const listOutput = JSON.stringify({
      result: {
        agents: [{
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
          state_change_seq: 2,
          agent_session: { kind: "id", value: "sess-123" },
        }],
      },
    });

    const agents = await listHerdrAgents(opts({ FAKE_HERDR_LIST_OUTPUT: listOutput }));

    expect(agents).toEqual([{
      agent: "claude",
      agentStatus: "working",
      paneId: "w1:p1",
      workspaceId: "w1",
      tabId: "w1:t1",
      cwd: "/tmp/project",
      foregroundCwd: "/tmp/project",
      terminalTitle: "hi",
      focused: true,
      revision: 1,
      stateChangeSeq: 2,
      sessionId: "sess-123",
    }]);
  });

  test("sessionId is null when agent_session isn't a resolvable file id", async () => {
    const listOutput = JSON.stringify({
      result: {
        agents: [{
          agent: "claude", agent_status: "idle", pane_id: "w1:p1", workspace_id: "w1", tab_id: "w1:t1",
          cwd: "/tmp", focused: false, revision: 1, state_change_seq: 1,
        }],
      },
    });

    const [agent] = await listHerdrAgents(opts({ FAKE_HERDR_LIST_OUTPUT: listOutput }));
    expect(agent?.sessionId).toBeNull();
  });

  test("falls back to 'unknown' for a status Herdr hasn't documented yet", async () => {
    const listOutput = JSON.stringify({
      result: {
        agents: [{
          agent: "claude", agent_status: "starting_up", pane_id: "w1:p1", workspace_id: "w1", tab_id: "w1:t1",
          cwd: "/tmp", focused: false, revision: 1, state_change_seq: 1,
        }],
      },
    });

    const [agent] = await listHerdrAgents(opts({ FAKE_HERDR_LIST_OUTPUT: listOutput }));
    expect(agent?.agentStatus).toBe("unknown");
  });

  test("rejects with HerdrCliError on a nonzero exit", async () => {
    await expect(
      listHerdrAgents(opts({ FAKE_HERDR_EXIT_CODE: "1", FAKE_HERDR_STDERR: "herdr: no such command" })),
    ).rejects.toBeInstanceOf(HerdrCliError);
  });

  test("rejects with HerdrCliError on unparseable stdout", async () => {
    await expect(
      listHerdrAgents(opts({ FAKE_HERDR_LIST_OUTPUT: "not json" })),
    ).rejects.toBeInstanceOf(HerdrCliError);
  });
});

describe("readHerdrAgent", () => {
  test("returns the raw terminal text, unwrapped", async () => {
    const text = await readHerdrAgent("w1:p1", 10, opts({ FAKE_HERDR_READ_OUTPUT: "hello terminal" }));
    expect(text.trim()).toBe("hello terminal");
  });

  test("rejects with HerdrCliError on a nonzero exit", async () => {
    await expect(
      readHerdrAgent("w1:p1", 10, opts({ FAKE_HERDR_EXIT_CODE: "1", FAKE_HERDR_STDERR: "herdr: unknown agent" })),
    ).rejects.toBeInstanceOf(HerdrCliError);
  });
});

describe("sendHerdrPrompt", () => {
  test("resolves without waiting for a reply", async () => {
    await expect(sendHerdrPrompt("w1:p1", "hello agent", opts({}))).resolves.toBeUndefined();
  });

  test("rejects with HerdrCliError on a nonzero exit", async () => {
    await expect(
      sendHerdrPrompt("w1:p1", "hello agent", opts({ FAKE_HERDR_EXIT_CODE: "1", FAKE_HERDR_STDERR: "herdr: agent_blocked" })),
    ).rejects.toBeInstanceOf(HerdrCliError);
  });
});

describe("sendHerdrInput", () => {
  test("sends a logical key or text followed by Enter", async () => {
    await expect(sendHerdrInput("w1:p1", { key: "enter" }, opts({}))).resolves.toBeUndefined();
    await expect(sendHerdrInput("w1:p1", { text: "yes" }, opts({}))).resolves.toBeUndefined();
  });
});
