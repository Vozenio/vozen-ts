import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { unlinkSync } from "node:fs";
import { ThreadManager } from "./engine.ts";
import type { ConnectManager, ConnectStatus } from "./connectManager.ts";
import { createApp } from "./http.ts";
import * as sqlite from "../../packages/db/sqlite.ts";

const tempDirs: string[] = [];
const dbPaths: string[] = [];

afterEach(async () => {
  while (tempDirs.length > 0) await rm(tempDirs.pop()!, { recursive: true, force: true });
  while (dbPaths.length > 0) {
    try {
      unlinkSync(dbPaths.pop()!);
    } catch {}
  }
});

async function makeApp(connectManager?: ConnectManager): Promise<{ app: ReturnType<typeof createApp>["app"]; cwd: string }> {
  const cwd = await mkdtemp(path.join(tmpdir(), "vozen-http-storage-"));
  tempDirs.push(cwd);
  const dbPath = `/tmp/vozen-http-test-${crypto.randomUUID()}.db`;
  dbPaths.push(dbPath);
  const engine = new ThreadManager(dbPath);
  sqlite.insertThread(engine.db, "thr_1", cwd, "t", "idle", Math.floor(Date.now() / 1000));
  const { app } = createApp(engine, connectManager);
  return { app, cwd };
}

describe("GET /api/v1/threads/:id/thread-storage/files", () => {
  test("fuzzy-matches files under the thread's cwd and reports storageRootPath", async () => {
    const { app, cwd } = await makeApp();
    await mkdir(path.join(cwd, "sub"), { recursive: true });
    await writeFile(path.join(cwd, "readme.md"), "hi");
    await writeFile(path.join(cwd, "sub", "notes.txt"), "hi");

    const response = await app.request("/api/v1/threads/thr_1/thread-storage/files?query=notes");
    expect(response.status).toBe(200);
    const body = await response.json() as { files: { path: string }[]; truncated: boolean; storageRootPath: string };
    expect(body.files.map((f) => f.path)).toEqual(["sub/notes.txt"]);
    expect(body.truncated).toBe(false);
    expect(body.storageRootPath).toBe(cwd);
  });

  test("with no query, lists files up to the default limit", async () => {
    const { app, cwd } = await makeApp();
    await writeFile(path.join(cwd, "a.txt"), "hi");
    await writeFile(path.join(cwd, "b.txt"), "hi");

    const response = await app.request("/api/v1/threads/thr_1/thread-storage/files");
    expect(response.status).toBe(200);
    const body = await response.json() as { files: { path: string }[] };
    expect(body.files.map((f) => f.path).sort()).toEqual(["a.txt", "b.txt"]);
  });

  test("404s for an unknown thread", async () => {
    const { app } = await makeApp();
    const response = await app.request("/api/v1/threads/thr_missing/thread-storage/files");
    expect(response.status).toBe(404);
  });

  test("400s on an invalid query param shape", async () => {
    const { app } = await makeApp();
    const response = await app.request("/api/v1/threads/thr_1/thread-storage/files?limit=not-a-number");
    expect(response.status).toBe(400);
  });
});

// Fake ConnectManager (no real credentials file / network touched) so these
// tests only exercise http.ts's own tunnel guard, matching the "spy version
// of connectManager" approach connectManager.test.ts's real-file tests don't
// need here.
function makeFakeConnectManager(): { manager: ConnectManager; pairCalls: number; disconnectCalls: number } {
  const status: ConnectStatus = {
    state: "disconnected", paired: false, handle: null, url: null,
    dashboardUrl: "https://register.vozen.io", lastError: null, since: null,
    nextRetryAt: null, remoteClients: 0, lastRemoteActivityAt: null,
  };
  const tracker = { pairCalls: 0, disconnectCalls: 0 };
  const manager = {
    getStatus: () => status,
    pair: async (_code: string) => {
      tracker.pairCalls += 1;
    },
    disconnect: () => {
      tracker.disconnectCalls += 1;
    },
  } as unknown as ConnectManager;
  return { manager, get pairCalls() { return tracker.pairCalls; }, get disconnectCalls() { return tracker.disconnectCalls; } };
}

describe("POST /vozen/connect/pair and /vozen/connect/disconnect", () => {
  test("pair without the tunnel header reaches connectManager.pair()", async () => {
    const fake = makeFakeConnectManager();
    const { app } = await makeApp(fake.manager);
    const response = await app.request("/vozen/connect/pair", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "abc123" }),
    });
    expect(response.status).toBe(200);
    expect(fake.pairCalls).toBe(1);
  });

  test("pair with x-vozen-via-tunnel header is rejected without calling connectManager.pair()", async () => {
    const fake = makeFakeConnectManager();
    const { app } = await makeApp(fake.manager);
    const response = await app.request("/vozen/connect/pair", {
      method: "POST",
      headers: { "content-type": "application/json", "x-vozen-via-tunnel": "1" },
      body: JSON.stringify({ code: "abc123" }),
    });
    expect(response.status).toBe(403);
    expect(fake.pairCalls).toBe(0);
  });

  test("disconnect without the tunnel header reaches connectManager.disconnect()", async () => {
    const fake = makeFakeConnectManager();
    const { app } = await makeApp(fake.manager);
    const response = await app.request("/vozen/connect/disconnect", { method: "POST" });
    expect(response.status).toBe(200);
    expect(fake.disconnectCalls).toBe(1);
  });

  test("disconnect with x-vozen-via-tunnel header is rejected without calling connectManager.disconnect()", async () => {
    const fake = makeFakeConnectManager();
    const { app } = await makeApp(fake.manager);
    const response = await app.request("/vozen/connect/disconnect", {
      method: "POST",
      headers: { "x-vozen-via-tunnel": "1" },
    });
    expect(response.status).toBe(403);
    expect(fake.disconnectCalls).toBe(0);
  });
});

describe("GET /api/v1/system/execution-options", () => {
  // QA-found bug: models from every provider were flattened into one array
  // regardless of providerId — bb's real contract scopes `models` to the
  // queried provider (systemExecutionOptionsQuerySchema's providerId).
  test("no providerId defaults to codex's own models", async () => {
    const { app } = await makeApp();
    const response = await app.request("/api/v1/system/execution-options");
    const body = await response.json() as { models: { id: string }[] };
    expect(body.models.map((m) => m.id)).toEqual(["gpt-5-codex"]);
  });

  test("providerId=codex returns only codex models", async () => {
    const { app } = await makeApp();
    const response = await app.request("/api/v1/system/execution-options?providerId=codex");
    const body = await response.json() as { models: { id: string }[] };
    expect(body.models.map((m) => m.id)).toEqual(["gpt-5-codex"]);
  });

  test("providerId=claude returns only claude models", async () => {
    const { app } = await makeApp();
    const response = await app.request("/api/v1/system/execution-options?providerId=claude");
    const body = await response.json() as { models: { id: string }[] };
    expect(body.models.map((m) => m.id)).toEqual(["sonnet", "opus", "fable"]);
  });

  test("an unrecognized providerId falls back to the codex default rather than erroring", async () => {
    const { app } = await makeApp();
    const response = await app.request("/api/v1/system/execution-options?providerId=totally-bogus-provider");
    expect(response.status).toBe(200);
    const body = await response.json() as { models: { id: string }[] };
    expect(body.models.map((m) => m.id)).toEqual(["gpt-5-codex"]);
  });

  test("providers array always lists both codex and claude with distinct icon glyphs", async () => {
    const { app } = await makeApp();
    const response = await app.request("/api/v1/system/execution-options");
    const body = await response.json() as { providers: { id: string; icon?: { glyph: string } }[] };
    const byId = Object.fromEntries(body.providers.map((p) => [p.id, p.icon?.glyph]));
    expect(byId.codex).toBeTruthy();
    expect(byId.claude).toBeTruthy();
    expect(byId.codex).not.toBe(byId.claude);
  });
});

describe("POST /api/v1/threads providerId validation", () => {
  // QA-found bug: an unrecognized providerId used to fall through silently
  // to codex (spawning a real process) while the thread's own providerId
  // field kept the bogus value — a thread claiming to run a provider that
  // was never actually started. Must 400 before anything spawns.
  test("rejects an unknown providerId with 400 and spawns nothing", async () => {
    const { app } = await makeApp();
    const response = await app.request("/api/v1/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: [{ type: "text", text: "hi" }], providerId: "totally-bogus-provider" }),
    });
    expect(response.status).toBe(400);
    const body = await response.json() as { error: string };
    expect(body.error).toContain("totally-bogus-provider");
  });
});

describe("GET /api/v1/system/providers/:id/logo", () => {
  test("serves the real vendored SVG for a known provider", async () => {
    const { app } = await makeApp();
    const response = await app.request("/api/v1/system/providers/codex/logo");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/svg+xml");
    expect(await response.text()).toContain("<svg");
  });

  test("404s for an unknown provider id", async () => {
    const { app } = await makeApp();
    const response = await app.request("/api/v1/system/providers/totally-bogus-provider/logo");
    expect(response.status).toBe(404);
  });
});

describe("GET /api/v1/threads/:id/timeline pagination", () => {
  function seedRows(engine: ThreadManager, threadId: string, count: number): void {
    const now = Math.floor(Date.now() / 1000);
    for (let seq = 1; seq <= count; seq += 1) {
      sqlite.startTimelineRow(engine.db, `row_${seq}`, threadId, "assistant", `t${seq}`, null, seq, now);
    }
  }

  async function makePagedApp(): Promise<{ app: ReturnType<typeof createApp>["app"] }> {
    const dbPath = `/tmp/vozen-http-test-${crypto.randomUUID()}.db`;
    dbPaths.push(dbPath);
    const engine = new ThreadManager(dbPath);
    sqlite.insertThread(engine.db, "thr_p", "/tmp", "t", "idle", Math.floor(Date.now() / 1000));
    seedRows(engine, "thr_p", 30);
    const { app } = createApp(engine);
    return { app };
  }

  test("first window is the newest 20 rows with an older cursor", async () => {
    const { app } = await makePagedApp();
    const response = await app.request("/api/v1/threads/thr_p/timeline");
    const body = await response.json() as {
      rows: { id: string }[];
      timelinePage: { kind: string; hasOlderRows: boolean; olderCursor: { anchorSeq: number; anchorId: string } | null };
    };
    expect(body.rows).toHaveLength(20);
    expect(body.rows[0]!.id).toBe("row_11");
    expect(body.rows[19]!.id).toBe("row_30");
    expect(body.timelinePage.hasOlderRows).toBe(true);
    expect(body.timelinePage.olderCursor).toEqual({ anchorSeq: 11, anchorId: "row_11" });
  });

  test("older page returns the rows before the anchor and terminates", async () => {
    const { app } = await makePagedApp();
    const response = await app.request("/api/v1/threads/thr_p/timeline?beforeAnchorSeq=11&beforeAnchorId=row_11");
    const body = await response.json() as {
      rows: { id: string }[];
      timelinePage: { kind: string; hasOlderRows: boolean; olderCursor: unknown };
    };
    expect(body.timelinePage.kind).toBe("older");
    expect(body.rows.map((row) => row.id)).toEqual(
      Array.from({ length: 10 }, (_, i) => `row_${i + 1}`),
    );
    expect(body.timelinePage.hasOlderRows).toBe(false);
  });

  test("afterSequence delta stays window-scoped", async () => {
    const { app } = await makePagedApp();
    const response = await app.request("/api/v1/threads/thr_p/timeline?afterSequence=28");
    const body = await response.json() as {
      rows: unknown[];
      delta: { upsertRows: { id: string }[]; rowOrder: string[] };
    };
    expect(body.rows).toEqual([]);
    expect(body.delta.upsertRows.map((row) => row.id)).toEqual(["row_29", "row_30"]);
    expect(body.delta.rowOrder).toHaveLength(20);
    expect(body.delta.rowOrder[0]).toBe("row_11");
  });

  test("summaryOnly skips row generation entirely", async () => {
    const { app } = await makePagedApp();
    const response = await app.request("/api/v1/threads/thr_p/timeline?summaryOnly=true");
    const body = await response.json() as { rows: unknown[]; timelinePage: { returnedSegmentCount: number } };
    expect(body.rows).toEqual([]);
    expect(body.timelinePage.returnedSegmentCount).toBe(0);
  });
});

describe("thread pin/unpin/pin-order", () => {
  test("pin persists, unpin clears, reorder assigns sort keys", async () => {
    const dbPath = `/tmp/vozen-http-test-${crypto.randomUUID()}.db`;
    dbPaths.push(dbPath);
    const engine = new ThreadManager(dbPath);
    const now = Math.floor(Date.now() / 1000);
    sqlite.insertThread(engine.db, "thr_a", "/tmp", "a", "idle", now);
    sqlite.insertThread(engine.db, "thr_b", "/tmp", "b", "idle", now);
    const { app } = createApp(engine);

    const pinned = await app.request("/api/v1/threads/thr_a/pin", { method: "POST" });
    expect(pinned.status).toBe(200);
    expect(((await pinned.json()) as { pinnedAt: number | null }).pinnedAt).not.toBeNull();
    await app.request("/api/v1/threads/thr_b/pin", { method: "POST" });

    const reordered = await app.request("/api/v1/threads/thr_a/pin-order", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ previousThreadId: "thr_b", nextThreadId: null }),
    });
    expect(reordered.status).toBe(200);
    const list = (await reordered.json()) as { id: string; pinSortKey: string | null }[];
    const keys = new Map(list.map((entry) => [entry.id, entry.pinSortKey]));
    expect(keys.get("thr_b")! < keys.get("thr_a")!).toBe(true);

    const unpinned = await app.request("/api/v1/threads/thr_a/unpin", { method: "POST" });
    expect(((await unpinned.json()) as { pinnedAt: number | null }).pinnedAt).toBeNull();

    const missing = await app.request("/api/v1/threads/thr_nope/pin", { method: "POST" });
    expect(missing.status).toBe(404);
  });
});

describe("settings persistence", () => {
  test("PUT general/keyboard merge-persist and surface in /system/config", async () => {
    const { app } = await makeApp();

    const put = await app.request("/api/v1/settings/general", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ streamerMode: true }),
    });
    expect(put.status).toBe(200);

    await app.request("/api/v1/settings/keyboard", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([{ commandId: "app.commandMenu", keys: ["mod+shift+p"] }]),
    });

    const config = await (await app.request("/api/v1/system/config")).json() as {
      generalSettings: { streamerMode: boolean; showKeyboardHints: boolean };
      keybindingOverrides: { commandId: string }[];
    };
    expect(config.generalSettings.streamerMode).toBe(true);
    expect(config.generalSettings.showKeyboardHints).toBe(true);
    expect(config.keybindingOverrides[0]?.commandId).toBe("app.commandMenu");
  });
});
