import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseSessionLog, readLogTail, resolveSessionLogPath } from "./sessionLog.ts";

const tempDirs: string[] = [];

async function tempHome(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "herdr-sessionlog-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    await rm(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("resolveSessionLogPath", () => {
  test("finds a claude session by scanning every project directory for the file name", async () => {
    const home = await tempHome();
    const projectDir = path.join(home, ".claude", "projects", "-Users-me-some-project");
    await mkdir(projectDir, { recursive: true });
    const sessionPath = path.join(projectDir, "abc-123.jsonl");
    await writeFile(sessionPath, "");

    const resolved = await resolveSessionLogPath("claude", "abc-123", home);
    expect(resolved).toBe(sessionPath);
  });

  test("finds a codex session under its date-nested rollout file", async () => {
    const home = await tempHome();
    const dayDir = path.join(home, ".codex", "sessions", "2026", "08", "26");
    await mkdir(dayDir, { recursive: true });
    const sessionPath = path.join(dayDir, "rollout-2026-08-26T00-00-00-deadbeef.jsonl");
    await writeFile(sessionPath, "");

    const resolved = await resolveSessionLogPath("codex", "deadbeef", home);
    expect(resolved).toBe(sessionPath);
  });

  test("returns null for an unresolvable session id", async () => {
    const home = await tempHome();
    expect(await resolveSessionLogPath("claude", "does-not-exist", home)).toBeNull();
  });

  test("rejects a session id that isn't a safe filename", async () => {
    const home = await tempHome();
    expect(await resolveSessionLogPath("claude", "../../etc/passwd", home)).toBeNull();
  });

  test("returns null for an unsupported agent kind", async () => {
    const home = await tempHome();
    expect(await resolveSessionLogPath("gemini", "abc-123", home)).toBeNull();
  });
});

describe("readLogTail", () => {
  test("returns the whole file when under the byte cap", async () => {
    const home = await tempHome();
    const file = path.join(home, "log.jsonl");
    await writeFile(file, "hello");
    expect(await readLogTail(file, 100)).toBe("hello");
  });

  test("returns only the trailing bytes when over the cap", async () => {
    const home = await tempHome();
    const file = path.join(home, "log.jsonl");
    await writeFile(file, "0123456789");
    expect(await readLogTail(file, 4)).toBe("6789");
  });
});

describe("parseSessionLog (claude)", () => {
  test("extracts plain-text user and assistant turns", () => {
    const lines = [
      JSON.stringify({ type: "user", message: { role: "user", content: "hi there" }, timestamp: "t1" }),
      JSON.stringify({
        type: "assistant",
        message: { role: "assistant", content: [{ type: "text", text: "hello back" }] },
        timestamp: "t2",
      }),
    ].join("\n");

    const entries = parseSessionLog("claude", lines);

    expect(entries).toEqual([
      { id: expect.any(String), role: "user", text: "hi there", timestamp: "t1" },
      { id: expect.any(String), role: "assistant", text: "hello back", timestamp: "t2" },
    ]);
  });

  test("skips sidechain rows and array-content user rows (tool results)", () => {
    const lines = [
      JSON.stringify({ type: "user", isSidechain: true, message: { role: "user", content: "hidden" } }),
      JSON.stringify({ type: "user", message: { role: "user", content: [{ type: "tool_result", content: "x" }] } }),
    ].join("\n");

    expect(parseSessionLog("claude", lines)).toEqual([]);
  });

  test("stitches a tool_use with its later tool_result into one ToolActivity", () => {
    const lines = [
      JSON.stringify({
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "running it" },
            { type: "tool_use", id: "toolu_1", name: "Bash", input: { command: "ls" } },
          ],
        },
        timestamp: "t1",
      }),
      JSON.stringify({
        type: "user",
        message: {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "file1\nfile2" }],
        },
      }),
    ].join("\n");

    const entries = parseSessionLog("claude", lines);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.text).toBe("running it");
    expect(entries[0]?.tools).toEqual([
      { id: "toolu_1", name: "Bash", input: { command: "ls" }, output: "file1\nfile2", error: false },
    ]);
  });

  test("marks a tool_result with is_error as a failed ToolActivity", () => {
    const lines = [
      JSON.stringify({
        type: "assistant",
        message: { role: "assistant", content: [{ type: "tool_use", id: "toolu_2", name: "Bash", input: { command: "false" } }] },
      }),
      JSON.stringify({
        type: "user",
        message: { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_2", content: "boom", is_error: true }] },
      }),
    ].join("\n");

    const entries = parseSessionLog("claude", lines);

    expect(entries[0]?.tools?.[0]?.error).toBe(true);
    expect(entries[0]?.tools?.[0]?.output).toBe("boom");
  });

  test("tolerates a truncated final line instead of failing the whole parse", () => {
    const lines = [
      JSON.stringify({ type: "user", message: { role: "user", content: "first" }, timestamp: "t1" }),
      '{"type":"assistant","message":{"conte', // mid-write truncation
    ].join("\n");

    const entries = parseSessionLog("claude", lines);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.text).toBe("first");
  });
});

describe("parseSessionLog (codex)", () => {
  test("extracts message response_items and drops the environment_context preamble", () => {
    const lines = [
      JSON.stringify({
        type: "response_item",
        payload: { type: "message", role: "user", content: "<environment_context>cwd=/tmp</environment_context>" },
      }),
      JSON.stringify({
        type: "response_item",
        payload: { type: "message", role: "user", content: [{ type: "input_text", text: "real question" }] },
      }),
      JSON.stringify({
        type: "response_item",
        payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "the answer" }] },
      }),
      JSON.stringify({ type: "response_item", payload: { type: "function_call", name: "shell" } }),
    ].join("\n");

    const entries = parseSessionLog("codex", lines);

    expect(entries.map((e) => ({ role: e.role, text: e.text }))).toEqual([
      { role: "user", text: "real question" },
      { role: "assistant", text: "the answer" },
    ]);
  });
});

describe("parseSessionLog (unsupported kind)", () => {
  test("returns an empty list instead of guessing a format", () => {
    expect(parseSessionLog("gemini", '{"type":"user"}')).toEqual([]);
  });
});
