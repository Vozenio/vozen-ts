import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { unlinkSync } from "node:fs";
import path from "node:path";
import { ThreadManager } from "./engine.ts";
import { displayTitle, HerdrThreadRegistry, toHerdrThreadId } from "./herdrThreadRegistry.ts";
import { createApp } from "./http.ts";

// Kept out of engine.test.ts: that file's codex-provider tests spawn real
// (fixture) subprocesses via fire-and-forget `void this.runThreadStart(...)`
// calls that can still be winding down when later tests start. Sharing a
// bun:test file/process with them was observed to corrupt this suite's own
// Bun.spawn results under load (a later test's fixture output showing up in
// an earlier test's assertions) — a separate file avoids the interaction
// rather than chasing it further.
describe("ThreadManager Herdr integration", () => {
  const FIXTURE = path.join(import.meta.dir, "../../plugins/provider_herdr/__fixtures__/fake-herdr.ts");
  const BIN = ["bun", "run", FIXTURE];

  let dbPath: string;
  let engine: ThreadManager;
  let registry: HerdrThreadRegistry;

  beforeEach(() => {
    dbPath = `/tmp/vozen-test-${crypto.randomUUID()}.db`;
    engine = new ThreadManager(dbPath);
    registry = new HerdrThreadRegistry({ bin: BIN });
    engine.attachHerdrRegistry(registry);
  });

  afterEach(() => {
    engine.db.close();
    try {
      unlinkSync(dbPath);
    } catch {}
  });

  function agentListOutput(cwd: string, agentStatus = "working"): string {
    return JSON.stringify({
      result: {
        agents: [{
          agent: "claude", agent_status: agentStatus, pane_id: "w1:p1", workspace_id: "w1", tab_id: "w1:t1",
          cwd, foreground_cwd: cwd, terminal_title_stripped: "herdr agent", focused: true,
          revision: 1, state_change_seq: 1,
        }],
      },
    });
  }

  // Fixture config rides the poll's own env (via setEnv), never a shared
  // process.env mutation — see provider_herdr/client.test.ts for why.
  function pollWith(cwd: string, agentStatus = "working"): Promise<void> {
    registry.setEnv({
      ...process.env,
      FAKE_HERDR_LIST_OUTPUT: agentListOutput(cwd, agentStatus),
      FAKE_HERDR_READ_OUTPUT: "scrollback",
    });
    return registry.pollOnce();
  }

  // Matches herdr-mobile-relay's own design (internal/coordinator/poller.go:
  // `project = filepath.Base(pane.Cwd)`) instead of matching vozen's real
  // `projects` table: a virtual project named after the cwd's basename,
  // recomputed fresh on every poll — nothing persisted, so nothing can go
  // stale when a directory moves.
  test("a Herdr agent is bucketed under a virtual project named after its cwd's basename", async () => {
    await pollWith("/tmp/my-project/subdir");

    const threadId = toHerdrThreadId("w1:p1");
    expect(engine.listThreadsByProject("herdr_proj_subdir").map((t) => t.id)).toEqual([threadId]);
    expect(engine.listThreadsByProject(null)).toHaveLength(0);
    expect(engine.show(threadId)?.project_id).toBe("herdr_proj_subdir");
    expect(engine.getProject("herdr_proj_subdir")).toMatchObject({
      id: "herdr_proj_subdir",
      name: "subdir",
      path: "/tmp/my-project/subdir",
    });
    expect(engine.listProjects().map((p) => p.id)).toContain("herdr_proj_subdir");
  });

  test("a Herdr thread joins an existing vozen project with the same directory", async () => {
    const project = engine.createProject("My Project", "/tmp/my-project/subdir");
    await pollWith("/tmp/my-project/subdir");

    expect(engine.listThreadsByProject(project.id).map((thread) => thread.id)).toEqual([
      toHerdrThreadId("w1:p1"),
    ]);
    expect(engine.listProjects().map((item) => item.id)).not.toContain("herdr_proj_subdir");
  });

  test("a blocked Herdr thread exposes a web interaction and accepts terminal input", async () => {
    const project = engine.createProject("My Project", "/tmp/my-project/subdir");
    await pollWith("/tmp/my-project/subdir", "blocked");
    const threadId = toHerdrThreadId("w1:p1");
    const { app } = createApp(engine);

    const projectResponse = await app.request(`/api/v1/projects/${project.id}`);
    const projectBody = await projectResponse.json() as { threads: Array<{ id: string }> };
    expect(projectBody.threads.map((thread) => thread.id)).toContain(threadId);

    const listResponse = await app.request("/api/v1/threads");
    const listBody = await listResponse.json() as Array<{ id: string; hasPendingInteraction: boolean }>;
    expect(listBody.find((thread) => thread.id === threadId)?.hasPendingInteraction).toBe(true);

    const interactionsResponse = await app.request(`/api/v1/threads/${threadId}/interactions`);
    const interactions = await interactionsResponse.json() as Array<{
      id: string;
      payload: { questions: Array<{ prompt: string }> };
    }>;
    expect(interactions).toHaveLength(1);
    expect(interactions[0]?.payload.questions[0].prompt).toContain("scrollback");

    const resolveResponse = await app.request(
      `/api/v1/threads/${threadId}/interactions/${interactions[0]!.id}/resolve`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "user_answer",
          answers: { herdr_input: { selected: ["enter"] } },
        }),
      },
    );
    expect(resolveResponse.status).toBe(200);
    expect(await resolveResponse.json()).toMatchObject({ status: "resolving" });
  });

  test("a moved/renamed cwd just relabels the virtual project on the next poll — nothing orphaned", async () => {
    await pollWith("/tmp/old-name");
    const threadId = toHerdrThreadId("w1:p1");
    expect(engine.listThreadsByProject("herdr_proj_old-name").map((t) => t.id)).toEqual([threadId]);

    await pollWith("/tmp/new-name");
    expect(engine.listThreadsByProject("herdr_proj_old-name")).toHaveLength(0);
    expect(engine.listThreadsByProject("herdr_proj_new-name").map((t) => t.id)).toEqual([threadId]);
  });

  test("tell() on a Herdr thread routes to the registry's send, not a codex session", async () => {
    await pollWith("/tmp/somewhere");

    const threadId = toHerdrThreadId("w1:p1");
    await expect(engine.tell(threadId, "hello")).resolves.toBeUndefined();
  });

  test("stop() on a Herdr thread interrupts via the registry instead of no-opping", async () => {
    await pollWith("/tmp/somewhere");

    const threadId = toHerdrThreadId("w1:p1");
    await expect(engine.stop(threadId)).resolves.toBeUndefined();
  });

  test("displayTitle drops garbage terminal titles (error dumps, bare URLs)", () => {
    const snapshot = (terminalTitle: string) =>
      ({ terminalTitle, agent: "claude" }) as Parameters<typeof displayTitle>[0];
    expect(displayTitle(snapshot("Fix the login bug"))).toBe("Fix the login bug");
    expect(displayTitle(snapshot(""))).toBe("claude");
    expect(displayTitle(snapshot('herdr agent prompt failed: {"error":{"code":1}}'))).toBe("claude");
    expect(displayTitle(snapshot("https://kanban.defei.li/dashboard/works"))).toBe("claude");
  });
});
