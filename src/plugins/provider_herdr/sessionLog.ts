/**
 * Reads the native session/transcript log a CLI coding agent (Claude Code,
 * Codex, Qoder) already writes to disk for its own resume/history feature —
 * the same technique herdr-mobile-relay's internal/conversation/reader.go
 * uses to turn a Herdr-managed agent into a clean chat log, reimplemented
 * here independently (this is "where does Claude/Codex write its own
 * session file", not herdr-mobile-relay's protocol — no AGPL code reused).
 *
 * Deliberately does not attempt the reverse of a project-path -> slug
 * mapping: a session id is already a UUID (canonically unique), so every
 * project subdirectory under a root just gets scanned for a matching
 * filename instead.
 */

import { readdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type SupportedHerdrAgentKind = "claude" | "codex" | "qoder";

/** One `tool_use`/`tool_result` pair from a Claude-like log, stitched
 * together the way herdr-mobile-relay's internal/conversation/reader.go
 * does (a pendingTools map keyed by tool_use id — the result always arrives
 * in a later line, never the same one). */
export interface ToolActivity {
  id: string;
  name: string;
  input: unknown;
  output: string | null;
  error: boolean;
  /** Claude Code's own `toolUseResult` field — sits beside `message` on the
   * JSONL record carrying the `tool_result`, not inside `message.content`.
   * Shape is entirely tool-specific (Bash's is `{stdout,stderr,...}`,
   * AskUserQuestion's is `{questions,answers,annotations}`); left untyped
   * here and interpreted by whichever work_kind builder cares about it. */
  resultMetadata?: unknown;
}

export interface ChatEntry {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string | null;
  tools?: ToolActivity[];
}

const DEFAULT_TAIL_BYTES = 512 * 1024;

function normalizedKind(agent: string): SupportedHerdrAgentKind | null {
  const value = agent.toLowerCase().replace(/[-_ ]/g, "");
  if (value === "claude" || value === "claudecode") return "claude";
  if (value === "codex" || value === "openaicodex") return "codex";
  if (value === "qoder" || value === "qodercli") return "qoder";
  return null;
}

function rootsFor(kind: SupportedHerdrAgentKind, home: string): string[] {
  if (kind === "claude") {
    return [path.join(process.env.CLAUDE_CONFIG_DIR?.trim() || path.join(home, ".claude"), "projects")];
  }
  if (kind === "qoder") {
    return [path.join(home, ".qoder", "projects")];
  }
  return [path.join(process.env.CODEX_HOME?.trim() || path.join(home, ".codex"), "sessions")];
}

async function findFileByExactName(root: string, filename: string): Promise<string | null> {
  let projectDirs: string[];
  try {
    projectDirs = (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return null;
  }
  for (const dir of projectDirs) {
    const candidate = path.join(root, dir, filename);
    try {
      const info = await stat(candidate);
      if (info.isFile()) return candidate;
    } catch {
      // not in this project directory — keep scanning
    }
  }
  return null;
}

async function descendingDirs(root: string): Promise<string[]> {
  try {
    return (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

/** Codex nests sessions under sessions/YYYY/MM/DD/rollout-<timestamp>-<id>.jsonl
 * with no index by id — newest-first date-directory descent keeps the common
 * case (an active or recent thread) cheap without scanning the whole tree. */
async function findCodexSession(root: string, sessionId: string): Promise<string | null> {
  const suffix = `-${sessionId.toLowerCase()}.jsonl`;
  for (const year of await descendingDirs(root)) {
    const yearPath = path.join(root, year);
    for (const month of await descendingDirs(yearPath)) {
      const monthPath = path.join(yearPath, month);
      for (const day of await descendingDirs(monthPath)) {
        const dayPath = path.join(monthPath, day);
        let files: string[];
        try {
          files = await readdir(dayPath);
        } catch {
          continue;
        }
        const match = files.find((name) => name.toLowerCase().startsWith("rollout-") && name.toLowerCase().endsWith(suffix));
        if (match) return path.join(dayPath, match);
      }
    }
  }
  return null;
}

const SAFE_SESSION_ID = /^[a-zA-Z0-9._-]{1,128}$/;

export async function resolveSessionLogPath(
  agent: string,
  sessionId: string,
  home: string = os.homedir(),
): Promise<string | null> {
  if (!SAFE_SESSION_ID.test(sessionId)) return null;
  const kind = normalizedKind(agent);
  if (!kind) return null;
  const [root] = rootsFor(kind, home);
  if (!root) return null;
  if (kind === "codex") return findCodexSession(root, sessionId);
  return findFileByExactName(root, `${sessionId}.jsonl`);
}

/** Reads only the trailing maxBytes of the file — these logs are append-only
 * and can grow large over a long session; the chat view only ever needs the
 * recent tail, not the whole history. */
export async function readLogTail(filePath: string, maxBytes: number = DEFAULT_TAIL_BYTES): Promise<string> {
  const file = Bun.file(filePath);
  const size = file.size;
  if (size <= maxBytes) return file.text();
  return file.slice(size - maxBytes).text();
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  const parts: string[] = [];
  for (const block of value) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;
    if ((b.type === "text" || b.type === "input_text" || b.type === "output_text") && typeof b.text === "string") {
      parts.push(b.text);
    }
  }
  return parts.join("\n");
}

function stableId(seed: string, index: number): string {
  return `herdr-log-${index}-${seed.length}`;
}

/** Extracts `tool_use` blocks (assistant-issued calls) from a message's
 * `content` array — Claude Code's built-in tools (Bash/Edit/...) and MCP
 * tools alike arrive this way, interleaved with plain `text` blocks. */
function toolUseBlocks(content: unknown): { id: string; name: string; input: unknown }[] {
  if (!Array.isArray(content)) return [];
  const blocks: { id: string; name: string; input: unknown }[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;
    if (b.type !== "tool_use" || typeof b.id !== "string" || typeof b.name !== "string") continue;
    blocks.push({ id: b.id, name: b.name, input: b.input });
  }
  return blocks;
}

/** A `tool_result` always shows up in a *later* user-role line, keyed by
 * `tool_use_id` — never the same line as the `tool_use` it answers. Folds
 * the result back into the still-open ToolActivity from `pendingTools`
 * instead of surfacing it as its own message. */
function backfillToolResults(content: unknown, resultMetadata: unknown, pendingTools: Map<string, ToolActivity>): void {
  if (!Array.isArray(content)) return;
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;
    if (b.type !== "tool_result" || typeof b.tool_use_id !== "string") continue;
    const activity = pendingTools.get(b.tool_use_id);
    if (!activity) continue;
    activity.output = textOf(b.content);
    activity.error = b.is_error === true;
    activity.resultMetadata = resultMetadata;
  }
}

/** Claude and Qoder write the same record shape. A user record's `content`
 * is a plain string for real typed input, or an array for everything the
 * CLI injected on the user's behalf — almost always `tool_result` blocks
 * answering a prior assistant `tool_use`, which get folded into that call's
 * ToolActivity (via `pendingTools`) rather than becoming their own entry. */
function parseClaudeLikeLog(text: string): ChatEntry[] {
  const entries: ChatEntry[] = [];
  const pendingTools = new Map<string, ToolActivity>();
  const lines = text.split("\n");
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!.trim();
    if (!line) continue;
    let record: Record<string, unknown>;
    try {
      record = JSON.parse(line);
    } catch {
      continue; // a truncated last line (mid-write) or stray output — skip, not fatal
    }
    if (record.isSidechain === true) continue;
    const type = record.type;
    if (type !== "user" && type !== "assistant") continue;
    const message = record.message as Record<string, unknown> | undefined;
    if (!message) continue;
    const content = message.content;
    const timestamp = typeof record.timestamp === "string" ? record.timestamp : null;

    if (type === "user") {
      if (typeof content !== "string") {
        backfillToolResults(content, record.toolUseResult, pendingTools);
        continue;
      }
      if (!content) continue;
      entries.push({ id: stableId(line, index), role: "user", text: content, timestamp });
      continue;
    }

    const body = textOf(content);
    const toolUses = toolUseBlocks(content);
    if (!body && toolUses.length === 0) continue;
    const tools: ToolActivity[] = toolUses.map((use) => {
      const activity: ToolActivity = { id: use.id, name: use.name, input: use.input, output: null, error: false };
      pendingTools.set(use.id, activity);
      return activity;
    });
    entries.push({
      id: stableId(line, index),
      role: "assistant",
      text: body,
      timestamp,
      ...(tools.length ? { tools } : {}),
    });
  }
  return entries;
}

function parseCodexLog(text: string): ChatEntry[] {
  const entries: ChatEntry[] = [];
  const lines = text.split("\n");
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!.trim();
    if (!line) continue;
    let record: Record<string, unknown>;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    if (record.type !== "response_item") continue;
    const payload = record.payload as Record<string, unknown> | undefined;
    if (!payload || payload.type !== "message") continue;
    const role = payload.role;
    if (role !== "user" && role !== "assistant") continue;
    const body = textOf(payload.content);
    if (!body || (role === "user" && body.trimStart().startsWith("<environment_context>"))) continue;
    entries.push({
      id: stableId(line, index),
      role,
      text: body,
      timestamp: typeof record.timestamp === "string" ? record.timestamp : null,
    });
  }
  return entries;
}

export function parseSessionLog(agent: string, text: string): ChatEntry[] {
  const kind = normalizedKind(agent);
  if (kind === "codex") return parseCodexLog(text);
  if (kind === "claude" || kind === "qoder") return parseClaudeLikeLog(text);
  return [];
}
