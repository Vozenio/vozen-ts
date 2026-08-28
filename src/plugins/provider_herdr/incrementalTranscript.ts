/**
 * Incremental replacement for `loadClaudeTranscript`: caches the expensive
 * half of a refresh (file IO + per-line JSON.parse of a session log that can
 * be tens of MB) and re-reads only the bytes appended since the last call.
 *
 * What stays a full re-run downstream: `buildTranscriptEntries` and the
 * whole convert → translate → assemble → build pipeline. Both are pure
 * in-memory passes; a true incremental pipeline is blocked by
 * convertClaudeTranscript's EOF-synthesized `result` records (a fed-forward
 * pipeline could never retract them when more content arrives), so this
 * module deliberately stops at "never re-read, never re-JSON.parse".
 *
 * Truncation/rotation safety: a file smaller than the cached offset resets
 * the cache and re-reads from scratch.
 */

import { open, readdir, stat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import {
  buildTranscriptEntries,
  parseRawTranscriptRecords,
  readClaudeTranscriptFile,
  type JsonRecord,
  type LoadedClaudeTranscript,
  type SubagentTranscript,
} from "./claudeTranscriptToSdkMessages.ts";

interface CachedSidechain {
  size: number;
  mtimeMs: number;
  transcript: SubagentTranscript;
}

export interface TranscriptIngestCache {
  sessionPath: string;
  /** Byte offset of the first unconsumed byte (always at a line boundary). */
  offset: number;
  raw: JsonRecord[];
  sidechains: Map<string, CachedSidechain>;
}

export function createTranscriptIngestCache(sessionPath: string): TranscriptIngestCache {
  return { sessionPath, offset: 0, raw: [], sidechains: new Map() };
}

const NEWLINE = 0x0a;

/** Appends the session log's new complete lines to `cache.raw`. Bytes after
 * the last newline are parsed too but returned as PROVISIONAL records —
 * they're either a fully written file's unterminated final line (must not
 * be lost) or a line mid-write (harmless to retry) — and the offset does
 * not advance past them, so the next call re-reads that tail. */
async function ingestMainLog(cache: TranscriptIngestCache): Promise<JsonRecord[]> {
  const handle = await open(cache.sessionPath, "r");
  try {
    const { size } = await handle.stat();
    if (size < cache.offset) {
      // Truncated or rotated underneath us — start over.
      cache.offset = 0;
      cache.raw = [];
    }
    if (size === cache.offset) return [];
    const buffer = Buffer.alloc(size - cache.offset);
    let read = 0;
    while (read < buffer.length) {
      const { bytesRead } = await handle.read(buffer, read, buffer.length - read, cache.offset + read);
      if (bytesRead === 0) break;
      read += bytesRead;
    }
    const lastNewline = buffer.lastIndexOf(NEWLINE, read - 1);
    const consumedEnd = lastNewline === -1 ? 0 : lastNewline + 1;
    if (consumedEnd > 0) {
      // Decoding only whole lines keeps multi-byte UTF-8 sequences intact.
      cache.raw.push(...parseRawTranscriptRecords(buffer.subarray(0, consumedEnd).toString("utf8")));
      cache.offset += consumedEnd;
    }
    // A remainder split mid-UTF-8-sequence just fails JSON.parse and drops
    // out of this round's provisional set — retried next call.
    return consumedEnd < read
      ? parseRawTranscriptRecords(buffer.subarray(consumedEnd, read).toString("utf8"))
      : [];
  } finally {
    await handle.close();
  }
}

/** Sidechain files are small relative to the main log; an unchanged
 * (size, mtime) reuses the cached parse and a changed one re-reads whole. */
async function ingestSidechains(cache: TranscriptIngestCache): Promise<SubagentTranscript[]> {
  const sessionId = basename(cache.sessionPath, ".jsonl");
  const dir = join(dirname(cache.sessionPath), sessionId, "subagents");
  let names: string[];
  try {
    names = (await readdir(dir)).sort();
  } catch {
    return [];
  }
  const agents: SubagentTranscript[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const match = /^agent-([A-Za-z0-9]+)\.jsonl$/.exec(name);
    if (!match) continue;
    const agentId = match[1]!;
    seen.add(agentId);
    const filePath = join(dir, name);
    let size = -1;
    let mtimeMs = -1;
    try {
      const stats = await stat(filePath);
      size = stats.size;
      mtimeMs = stats.mtimeMs;
    } catch {
      continue;
    }
    const cached = cache.sidechains.get(agentId);
    if (cached && cached.size === size && cached.mtimeMs === mtimeMs) {
      agents.push(cached.transcript);
      continue;
    }
    const metaPath = join(dir, `agent-${agentId}.meta.json`);
    let meta: JsonRecord = {};
    try {
      meta = JSON.parse(await Bun.file(metaPath).text()) as JsonRecord;
    } catch {
      // no .meta.json (or unreadable) — fields fall back to defaults below
    }
    const transcript: SubagentTranscript = {
      agentId,
      toolUseId: typeof meta.toolUseId === "string" ? meta.toolUseId : null,
      agentType: typeof meta.agentType === "string" ? meta.agentType : null,
      description: typeof meta.description === "string" ? meta.description : null,
      records: await readClaudeTranscriptFile(filePath),
    };
    cache.sidechains.set(agentId, { size, mtimeMs, transcript });
    agents.push(transcript);
  }
  for (const agentId of [...cache.sidechains.keys()]) {
    if (!seen.has(agentId)) cache.sidechains.delete(agentId);
  }
  return agents;
}

/** Drop-in for `loadClaudeTranscript`, fed by the caller-held cache. */
export async function loadClaudeTranscriptIncremental(
  cache: TranscriptIngestCache,
): Promise<LoadedClaudeTranscript> {
  const provisional = await ingestMainLog(cache);
  const agents = await ingestSidechains(cache);
  return {
    sessionId: basename(cache.sessionPath, ".jsonl"),
    main: buildTranscriptEntries(provisional.length > 0 ? [...cache.raw, ...provisional] : cache.raw),
    agents,
  };
}
