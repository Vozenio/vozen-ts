import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { unlinkSync } from "node:fs";
import * as sqlite from "./sqlite.ts";

describe("sqlite", () => {
  let db: Database;

  beforeEach(() => {
    db = sqlite.connect(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  test("insertThread + getThread round trip", () => {
    sqlite.insertThread(db, "thr_1", "/tmp", "test", "starting", 100);
    const thread = sqlite.getThread(db, "thr_1");
    expect(thread?.status).toBe("starting");
    expect(thread?.title).toBe("test");
  });

  test("getThread returns null for unknown thread", () => {
    expect(sqlite.getThread(db, "thr_missing")).toBeNull();
  });

  test("appendEvent assigns increasing seq per thread", () => {
    sqlite.insertThread(db, "thr_1", "/tmp", "t", "starting", 100);
    const seq1 = sqlite.appendEvent(db, "thr_1", "turn/started", { a: 1 }, 100);
    const seq2 = sqlite.appendEvent(db, "thr_1", "turn/completed", { a: 2 }, 101);
    expect(seq1).toBe(1);
    expect(seq2).toBe(2);
    const events = sqlite.listEvents(db, "thr_1");
    expect(events.map((e) => e.method)).toEqual(["turn/started", "turn/completed"]);
    expect(events[1]?.params).toEqual({ a: 2 });
  });

  test("listEvents afterSeq filters to only newer events", () => {
    sqlite.insertThread(db, "thr_1", "/tmp", "t", "starting", 100);
    sqlite.appendEvent(db, "thr_1", "a", {}, 100);
    const cutoff = sqlite.appendEvent(db, "thr_1", "b", {}, 101);
    sqlite.appendEvent(db, "thr_1", "c", {}, 102);
    const events = sqlite.listEvents(db, "thr_1", cutoff);
    expect(events.map((e) => e.method)).toEqual(["c"]);
  });

  test("timeline row: start empty, append grows it, set replaces authoritatively", () => {
    sqlite.insertThread(db, "thr_1", "/tmp", "t", "running", 100);
    sqlite.startTimelineRow(db, "row_1", "thr_1", "assistant", "", "turn1", 1, 100);
    sqlite.appendTimelineRowText(db, "row_1", "thr_1", "assistant", "Hel", "turn1", 2, 101);
    sqlite.appendTimelineRowText(db, "row_1", "thr_1", "assistant", "lo", "turn1", 3, 102);
    let rows = sqlite.listTimelineRows(db, "thr_1");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.text).toBe("Hello");

    sqlite.setTimelineRowText(db, "row_1", "thr_1", "assistant", "Hello there", "turn1", 4, 103);
    rows = sqlite.listTimelineRows(db, "thr_1");
    expect(rows).toHaveLength(1); // still one row, not duplicated
    expect(rows[0]?.text).toBe("Hello there");
  });

  test("connect migrates an existing timeline_rows table without losing rows", () => {
    const path = `/tmp/vozen-legacy-${crypto.randomUUID()}.db`;
    const legacy = new Database(path, { create: true });
    legacy.exec(`CREATE TABLE timeline_rows (
      id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, role TEXT NOT NULL, text TEXT NOT NULL,
      turn_id TEXT, source_seq_start INTEGER NOT NULL, source_seq_end INTEGER NOT NULL,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    )`);
    legacy.run(
      "INSERT INTO timeline_rows VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ["row_old", "thr_old", "assistant", "kept", null, 1, 1, 100, 100],
    );
    legacy.close();

    const migrated = sqlite.connect(path);
    try {
      const columns = (migrated.query("PRAGMA table_info(timeline_rows)").all() as { name: string }[]).map((column) => column.name);
      expect(columns).toEqual(expect.arrayContaining(["kind", "work_kind", "payload"]));
      expect(sqlite.listTimelineRows(migrated, "thr_old")[0]).toMatchObject({ text: "kept", kind: "conversation" });
    } finally {
      migrated.close();
      unlinkSync(path);
    }
  });

  test("listTimelineRowsSince only returns rows touched after the cutoff", () => {
    sqlite.insertThread(db, "thr_1", "/tmp", "t", "running", 100);
    sqlite.startTimelineRow(db, "row_1", "thr_1", "user", "hi", null, 1, 100);
    sqlite.setTimelineRowText(db, "row_1", "thr_1", "user", "hi", null, 1, 100);
    const cutoff = 1; // row_1's own source_seq_end
    sqlite.startTimelineRow(db, "row_2", "thr_1", "assistant", "", "turn1", 2, 101);
    sqlite.setTimelineRowText(db, "row_2", "thr_1", "assistant", "hey", "turn1", 2, 101);
    const touched = sqlite.listTimelineRowsSince(db, "thr_1", cutoff);
    expect(touched.map((r) => r.id)).toEqual(["row_2"]);
  });

  test("deleteThread removes threads, events, and timeline_rows", () => {
    sqlite.insertThread(db, "thr_1", "/tmp", "t", "idle", 100);
    sqlite.appendEvent(db, "thr_1", "a", {}, 100);
    sqlite.startTimelineRow(db, "row_1", "thr_1", "user", "hi", null, 1, 100);
    sqlite.deleteThread(db, "thr_1");
    expect(sqlite.getThread(db, "thr_1")).toBeNull();
    expect(sqlite.listEvents(db, "thr_1")).toHaveLength(0);
    expect(sqlite.listTimelineRows(db, "thr_1")).toHaveLength(0);
  });

  test("archiveThread and setThreadTitle update the thread row", () => {
    sqlite.insertThread(db, "thr_1", "/tmp", "old title", "idle", 100);
    sqlite.setThreadTitle(db, "thr_1", "new title", 101);
    sqlite.archiveThread(db, "thr_1", 102);
    const thread = sqlite.getThread(db, "thr_1");
    expect(thread?.title).toBe("new title");
    expect(thread?.archived_at).toBe(102);
  });

  test("insertProject + getProject round trip", () => {
    sqlite.insertProject(db, "proj_1", "My Project", "/tmp/proj", 100);
    const project = sqlite.getProject(db, "proj_1");
    expect(project?.name).toBe("My Project");
    expect(project?.path).toBe("/tmp/proj");
  });

  test("listProjects returns projects oldest-first", () => {
    sqlite.insertProject(db, "proj_1", "First", "/tmp/a", 100);
    sqlite.insertProject(db, "proj_2", "Second", "/tmp/b", 200);
    expect(sqlite.listProjects(db).map((p) => p.id)).toEqual(["proj_1", "proj_2"]);
  });

  test("listThreadsByProject separates project threads from personal (project_id IS NULL)", () => {
    sqlite.insertThread(db, "thr_personal", "/tmp", "t", "idle", 100, null);
    sqlite.insertThread(db, "thr_project", "/tmp/proj", "t", "idle", 100, "proj_1");
    expect(sqlite.listThreadsByProject(db, null).map((t) => t.id)).toEqual(["thr_personal"]);
    expect(sqlite.listThreadsByProject(db, "proj_1").map((t) => t.id)).toEqual(["thr_project"]);
  });
});
