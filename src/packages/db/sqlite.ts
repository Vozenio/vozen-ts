import { Database } from "bun:sqlite";

// Ported from vozen's Python sqlite.py. One difference: no thread-local
// connection-per-thread trick there — that existed only because Python's
// ThreadingHTTPServer runs handlers on real OS threads sharing one
// sqlite3.Connection. Bun/Hono is single-threaded (async, not
// thread-per-connection), so a single shared Database instance is safe with
// no locking at all.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS threads (
    id TEXT PRIMARY KEY,
    provider_thread_id TEXT,
    project_id TEXT,
    cwd TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    archived_at INTEGER
);

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    method TEXT NOT NULL,
    params_json TEXT NOT NULL,
    turn_id TEXT,
    item_id TEXT,
    item_type TEXT,
    ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS events_thread_seq ON events (thread_id, seq);

CREATE TABLE IF NOT EXISTS timeline_rows (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL,
    role TEXT NOT NULL,
    text TEXT NOT NULL,
    turn_id TEXT,
    source_seq_start INTEGER NOT NULL,
    source_seq_end INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    kind TEXT NOT NULL DEFAULT 'conversation',
    work_kind TEXT,
    payload TEXT
);
CREATE INDEX IF NOT EXISTS timeline_rows_thread ON timeline_rows (thread_id, source_seq_start);

CREATE TABLE IF NOT EXISTS thread_pins (
    thread_id TEXT PRIMARY KEY,
    pinned_at INTEGER NOT NULL,
    sort_key TEXT
);

CREATE TABLE IF NOT EXISTS app_settings (
    section TEXT PRIMARY KEY,
    value_json TEXT NOT NULL
);
`;

export interface ThreadRow {
  id: string;
  provider_thread_id: string | null;
  project_id: string | null;
  cwd: string;
  title: string;
  status: string;
  created_at: number;
  updated_at: number;
  archived_at: number | null;
  /** Real agent kind for a Herdr-backed thread ("claude"/"codex"/"qoder"/...)
   * — absent for real vozen-spawned threads, which are always codex. */
  agent_kind?: string;
}

export interface ProjectRow {
  id: string;
  name: string;
  path: string;
  created_at: number;
  updated_at: number;
}

export interface EventRow {
  id: number;
  thread_id: string;
  seq: number;
  method: string;
  turn_id: string | null;
  item_id: string | null;
  item_type: string | null;
  ts: number;
  params: unknown;
}

export interface TimelineRow {
  id: string;
  thread_id: string;
  role: string;
  text: string;
  turn_id: string | null;
  source_seq_start: number;
  source_seq_end: number;
  created_at: number;
  updated_at: number;
  kind: "conversation" | "work";
  work_kind: "command" | "tool" | "file-change" | "question" | "delegation" | null;
  payload: string | null;
}

export function connect(path: string): Database {
  const db = new Database(path, { create: true });
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec(SCHEMA);
  const columns = new Set(
    (db.query("PRAGMA table_info(timeline_rows)").all() as { name: string }[]).map((column) => column.name),
  );
  if (!columns.has("kind")) db.exec("ALTER TABLE timeline_rows ADD COLUMN kind TEXT NOT NULL DEFAULT 'conversation'");
  if (!columns.has("work_kind")) db.exec("ALTER TABLE timeline_rows ADD COLUMN work_kind TEXT");
  if (!columns.has("payload")) db.exec("ALTER TABLE timeline_rows ADD COLUMN payload TEXT");
  const threadColumns = new Set(
    (db.query("PRAGMA table_info(threads)").all() as { name: string }[]).map((column) => column.name),
  );
  // NULL means codex (bbShim.ts's `thread.agent_kind ?? "codex"` fallback) —
  // only non-codex providers (e.g. "claude") get an explicit value, same
  // convention Herdr's synthetic rows already use.
  if (!threadColumns.has("agent_kind")) db.exec("ALTER TABLE threads ADD COLUMN agent_kind TEXT");
  return db;
}

export function insertThread(
  db: Database, threadId: string, cwd: string, title: string, status: string, now: number,
  projectId: string | null = null, agentKind: string | null = null,
): void {
  db.run(
    "INSERT INTO threads (id, provider_thread_id, project_id, cwd, title, status, created_at, updated_at, agent_kind) "
    + "VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)",
    [threadId, projectId, cwd, title, status, now, now, agentKind],
  );
}

export function insertProject(db: Database, id: string, name: string, path: string, now: number): void {
  db.run("INSERT INTO projects (id, name, path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", [id, name, path, now, now]);
}

export function getProject(db: Database, id: string): ProjectRow | null {
  return (db.query("SELECT * FROM projects WHERE id = ?").get(id) as ProjectRow | undefined) ?? null;
}

export function listProjects(db: Database): ProjectRow[] {
  return db.query("SELECT * FROM projects ORDER BY created_at ASC").all() as ProjectRow[];
}

/** Threads keep their history — only the project link goes away, same as
 * bb's own "delete project" (never silently destroys conversations). */
export function deleteProject(db: Database, projectId: string): void {
  db.run("UPDATE threads SET project_id = NULL WHERE project_id = ?", [projectId]);
  db.run("DELETE FROM projects WHERE id = ?", [projectId]);
}

export function listThreadsByProject(db: Database, projectId: string | null): ThreadRow[] {
  if (projectId === null) {
    return db.query("SELECT * FROM threads WHERE project_id IS NULL ORDER BY created_at DESC").all() as ThreadRow[];
  }
  return db.query("SELECT * FROM threads WHERE project_id = ? ORDER BY created_at DESC").all(projectId) as ThreadRow[];
}

export function setProviderThreadId(db: Database, threadId: string, providerThreadId: string, now: number): void {
  db.run("UPDATE threads SET provider_thread_id = ?, updated_at = ? WHERE id = ?", [providerThreadId, now, threadId]);
}

export function setThreadStatus(db: Database, threadId: string, status: string, now: number): void {
  db.run("UPDATE threads SET status = ?, updated_at = ? WHERE id = ?", [status, now, threadId]);
}

export function setThreadTitle(db: Database, threadId: string, title: string, now: number): void {
  db.run("UPDATE threads SET title = ?, updated_at = ? WHERE id = ?", [title, now, threadId]);
}

export function archiveThread(db: Database, threadId: string, now: number): void {
  db.run("UPDATE threads SET archived_at = ?, updated_at = ? WHERE id = ?", [now, now, threadId]);
}

export function deleteThread(db: Database, threadId: string): void {
  db.run("DELETE FROM events WHERE thread_id = ?", [threadId]);
  db.run("DELETE FROM timeline_rows WHERE thread_id = ?", [threadId]);
  db.run("DELETE FROM threads WHERE id = ?", [threadId]);
}

export function startTimelineRow(
  db: Database, rowId: string, threadId: string, role: string, text: string,
  turnId: string | null, seq: number, now: number,
): void {
  db.run(
    `INSERT INTO timeline_rows (id, thread_id, role, text, turn_id, source_seq_start, source_seq_end, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO NOTHING`,
    [rowId, threadId, role, text, turnId, seq, seq, now, now],
  );
}

export function appendTimelineRowText(
  db: Database, rowId: string, threadId: string, role: string, deltaText: string,
  turnId: string | null, seq: number, now: number,
): void {
  db.run(
    `INSERT INTO timeline_rows (id, thread_id, role, text, turn_id, source_seq_start, source_seq_end, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       text = text || excluded.text, source_seq_end = excluded.source_seq_end, updated_at = excluded.updated_at`,
    [rowId, threadId, role, deltaText, turnId, seq, seq, now, now],
  );
}

export function setTimelineRowText(
  db: Database, rowId: string, threadId: string, role: string, text: string,
  turnId: string | null, seq: number, now: number,
): void {
  db.run(
    `INSERT INTO timeline_rows (id, thread_id, role, text, turn_id, source_seq_start, source_seq_end, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       text = excluded.text, source_seq_end = excluded.source_seq_end, updated_at = excluded.updated_at`,
    [rowId, threadId, role, text, turnId, seq, seq, now, now],
  );
}

export function setWorkTimelineRow(
  db: Database, rowId: string, threadId: string, workKind: NonNullable<TimelineRow["work_kind"]>,
  payload: Record<string, unknown>, turnId: string | null, seq: number, now: number,
): void {
  db.run(
    `INSERT INTO timeline_rows
       (id, thread_id, role, text, turn_id, source_seq_start, source_seq_end, created_at, updated_at, kind, work_kind, payload)
     VALUES (?, ?, 'assistant', '', ?, ?, ?, ?, ?, 'work', ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       turn_id = excluded.turn_id,
       source_seq_end = excluded.source_seq_end,
       updated_at = excluded.updated_at,
       kind = 'work',
       work_kind = excluded.work_kind,
       payload = json_patch(COALESCE(timeline_rows.payload, '{}'), excluded.payload)`,
    [rowId, threadId, turnId, seq, seq, now, now, workKind, JSON.stringify(payload)],
  );
}

export function appendWorkTimelineRowOutput(
  db: Database, rowId: string, threadId: string, deltaText: string, seq: number, now: number,
): void {
  db.run(
    `UPDATE timeline_rows SET
       payload = json_set(COALESCE(payload, '{}'), '$.output', COALESCE(json_extract(payload, '$.output'), '') || ?),
       source_seq_end = ?,
       updated_at = ?
     WHERE id = ? AND thread_id = ? AND kind = 'work'`,
    [deltaText, seq, now, rowId, threadId],
  );
}

export function listTimelineRows(db: Database, threadId: string): TimelineRow[] {
  return db.query("SELECT * FROM timeline_rows WHERE thread_id = ? ORDER BY source_seq_start ASC").all(threadId) as TimelineRow[];
}

export function listTimelineRowsSince(db: Database, threadId: string, afterSeq: number): TimelineRow[] {
  return db
    .query("SELECT * FROM timeline_rows WHERE thread_id = ? AND source_seq_end > ? ORDER BY source_seq_start ASC")
    .all(threadId, afterSeq) as TimelineRow[];
}

export function getThread(db: Database, threadId: string): ThreadRow | null {
  return (db.query("SELECT * FROM threads WHERE id = ?").get(threadId) as ThreadRow | undefined) ?? null;
}

export function listThreads(db: Database): ThreadRow[] {
  return db.query("SELECT * FROM threads ORDER BY created_at DESC").all() as ThreadRow[];
}

// --- app settings (one JSON blob per settings section: general/keyboard/
// experiments — the bb frontend PUTs a section and refetches /system/config) ---

export function getAppSetting(db: Database, section: string): unknown {
  const row = db.query("SELECT value_json FROM app_settings WHERE section = ?").get(section) as { value_json: string } | null;
  if (!row) return null;
  try {
    return JSON.parse(row.value_json);
  } catch {
    return null;
  }
}

export function setAppSetting(db: Database, section: string, value: unknown): void {
  db.run(
    `INSERT INTO app_settings (section, value_json) VALUES (?, ?)
     ON CONFLICT(section) DO UPDATE SET value_json = excluded.value_json`,
    [section, JSON.stringify(value)],
  );
}

// --- thread pins (own table, not a threads column: herdr threads are
// virtual and have no threads row, but their pins must still persist) ---

export interface ThreadPinRow {
  thread_id: string;
  pinned_at: number; // epoch ms — bb's pinnedAt wire unit
  sort_key: string | null; // codepoint-compared; null = "sort by pinnedAt"
}

export function getThreadPin(db: Database, threadId: string): ThreadPinRow | null {
  return (db.query("SELECT * FROM thread_pins WHERE thread_id = ?").get(threadId) as ThreadPinRow | null) ?? null;
}

export function listThreadPins(db: Database): ThreadPinRow[] {
  return db.query("SELECT * FROM thread_pins").all() as ThreadPinRow[];
}

export function setThreadPin(db: Database, threadId: string, pinnedAt: number, sortKey: string | null): void {
  db.run(
    `INSERT INTO thread_pins (thread_id, pinned_at, sort_key) VALUES (?, ?, ?)
     ON CONFLICT(thread_id) DO UPDATE SET pinned_at = excluded.pinned_at, sort_key = excluded.sort_key`,
    [threadId, pinnedAt, sortKey],
  );
}

export function deleteThreadPin(db: Database, threadId: string): void {
  db.run("DELETE FROM thread_pins WHERE thread_id = ?", [threadId]);
}

export function threadMaxSeq(db: Database, threadId: string): number {
  const row = db.query("SELECT COALESCE(MAX(seq), 0) AS max_seq FROM events WHERE thread_id = ?").get(threadId) as { max_seq: number };
  return row.max_seq;
}

export function nextSeq(db: Database, threadId: string): number {
  return threadMaxSeq(db, threadId) + 1;
}

export function appendEvent(
  db: Database, threadId: string, method: string, params: unknown, now: number,
  turnId: string | null = null, itemId: string | null = null, itemType: string | null = null,
): number {
  const seq = nextSeq(db, threadId);
  db.run(
    "INSERT INTO events (thread_id, seq, method, params_json, turn_id, item_id, item_type, ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [threadId, seq, method, JSON.stringify(params), turnId, itemId, itemType, now],
  );
  return seq;
}

export function listEvents(db: Database, threadId: string, afterSeq = 0): EventRow[] {
  const rows = db
    .query("SELECT * FROM events WHERE thread_id = ? AND seq > ? ORDER BY seq ASC")
    .all(threadId, afterSeq) as (Omit<EventRow, "params"> & { params_json: string })[];
  return rows.map(({ params_json, ...rest }) => ({ ...rest, params: JSON.parse(params_json) }));
}
