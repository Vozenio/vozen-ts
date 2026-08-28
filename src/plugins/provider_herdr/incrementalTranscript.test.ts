import { describe, expect, test } from "bun:test";
import { appendFile, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadClaudeTranscript } from "./claudeTranscriptToSdkMessages.ts";
import { createTranscriptIngestCache, loadClaudeTranscriptIncremental } from "./incrementalTranscript.ts";

function line(text: string, timestamp: string): string {
  return JSON.stringify({ type: "user", message: { role: "user", content: text }, timestamp });
}

async function tempLog(content: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "vozen-inc-"));
  const file = path.join(dir, "sess-inc.jsonl");
  await writeFile(file, content);
  return file;
}

describe("loadClaudeTranscriptIncremental", () => {
  test("matches the full loader across appends and only consumes new bytes", async () => {
    const file = await tempLog(`${line("one", "t1")}\n${line("two", "t2")}\n`);
    const cache = createTranscriptIngestCache(file);

    const first = await loadClaudeTranscriptIncremental(cache);
    expect(first.main.map((entry) => entry.record.message)).toEqual(
      (await loadClaudeTranscript(file)).main.map((entry) => entry.record.message),
    );
    const offsetAfterFirst = cache.offset;

    await appendFile(file, `${line("three", "t3")}\n`);
    const second = await loadClaudeTranscriptIncremental(cache);
    expect(second.main).toHaveLength(3);
    expect(second.main.map((entry) => entry.record.message)).toEqual(
      (await loadClaudeTranscript(file)).main.map((entry) => entry.record.message),
    );
    expect(cache.offset).toBeGreaterThan(offsetAfterFirst);
  });

  test("an unterminated final line is included provisionally without advancing the offset", async () => {
    // No trailing newline — a fully written file's last line, or one mid-write.
    const file = await tempLog(`${line("one", "t1")}\n${line("two", "t2")}`);
    const cache = createTranscriptIngestCache(file);

    const loaded = await loadClaudeTranscriptIncremental(cache);
    expect(loaded.main).toHaveLength(2);
    // Only "one\n" was consumed; "two" stays re-readable.
    expect(cache.raw).toHaveLength(1);

    await appendFile(file, `\n${line("three", "t3")}\n`);
    const next = await loadClaudeTranscriptIncremental(cache);
    expect(next.main.map((entry) => (entry.record.message as { content: string }).content)).toEqual([
      "one", "two", "three",
    ]);
    expect(cache.raw).toHaveLength(3);
  });

  test("a truncated file resets the cache instead of serving stale records", async () => {
    const file = await tempLog(`${line("one", "t1")}\n${line("two", "t2")}\n`);
    const cache = createTranscriptIngestCache(file);
    await loadClaudeTranscriptIncremental(cache);

    await writeFile(file, `${line("fresh", "t9")}\n`);
    const reloaded = await loadClaudeTranscriptIncremental(cache);
    expect(reloaded.main.map((entry) => (entry.record.message as { content: string }).content)).toEqual(["fresh"]);
  });
});
