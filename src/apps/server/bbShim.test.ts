import { describe, expect, test } from "bun:test";
import { timelineRowSchema } from "@bb/server-contract";
import type { ThreadRow, TimelineRow } from "../../packages/db/sqlite.ts";
import type { ProjectRow } from "../../packages/db/sqlite.ts";
import { promptText, providerInfoFor, rowToBbRow, toBbProject, toBbThread, toBbThreadListEntry } from "./bbShim.ts";

function makeThread(overrides: Partial<ThreadRow> = {}): ThreadRow {
  return {
    id: "thr_1", provider_thread_id: null, project_id: null, cwd: "/tmp", title: "hi",
    status: "running", created_at: 1000, updated_at: 2000, archived_at: null,
    ...overrides,
  };
}

describe("toBbThread", () => {
  test("maps vozen's running status to bb's active", () => {
    expect(toBbThread(makeThread({ status: "running" }), false).status).toBe("active");
  });

  test("maps interrupted to idle (bb has no interrupted status)", () => {
    expect(toBbThread(makeThread({ status: "interrupted" }), false).status).toBe("idle");
  });

  test("timestamps convert seconds to milliseconds", () => {
    const bb = toBbThread(makeThread({ created_at: 1000, updated_at: 2000 }), false);
    expect(bb.createdAt).toBe(1_000_000);
    expect(bb.updatedAt).toBe(2_000_000);
  });

  test("archivedAt is null when the thread isn't archived", () => {
    expect(toBbThread(makeThread({ archived_at: null }), false).archivedAt).toBeNull();
  });

  test("archivedAt converts to milliseconds when set", () => {
    expect(toBbThread(makeThread({ archived_at: 500 }), false).archivedAt).toBe(500_000);
  });
});

describe("toBbThreadListEntry", () => {
  test("carries hasPendingInteraction through", () => {
    expect(toBbThreadListEntry(makeThread(), true).hasPendingInteraction).toBe(true);
    expect(toBbThreadListEntry(makeThread(), false).hasPendingInteraction).toBe(false);
  });
});

describe("rowToBbRow", () => {
  function makeRow(overrides: Partial<TimelineRow> = {}): TimelineRow {
    return {
      id: "row_1", thread_id: "thr_1", role: "assistant", text: "hi",
      turn_id: "t1", source_seq_start: 1, source_seq_end: 1, created_at: 100, updated_at: 100,
      kind: "conversation", work_kind: null, payload: null,
      ...overrides,
    };
  }

  test("user row includes turnRequest.accepted shape", () => {
    const row = rowToBbRow(makeRow({ role: "user" }));
    expect((row as Record<string, unknown>).turnRequest).toEqual({ isGrouped: false, kind: "message", status: "accepted" });
  });

  test("assistant row has turnRequest: null", () => {
    const row = rowToBbRow(makeRow({ role: "assistant" }));
    expect((row as Record<string, unknown>).turnRequest).toBeNull();
  });

  test("command, tool, and file-change work rows satisfy bb's timeline schema", () => {
    const rows = [
      makeRow({
        kind: "work", work_kind: "command",
        payload: JSON.stringify({
          callId: "exec-1", status: "completed", command: "pwd", cwd: "/tmp",
          output: "/tmp\n", exitCode: 0, completedAt: 1234,
        }),
      }),
      makeRow({
        kind: "work", work_kind: "tool",
        payload: JSON.stringify({
          callId: "mcp-1", status: "pending", server: "docs", tool: "search",
          arguments: { query: "zod" }, output: "Searching", completedAt: null,
        }),
      }),
      makeRow({
        kind: "work", work_kind: "file-change",
        payload: JSON.stringify({
          callId: "edit-1", status: "completed",
          changes: [{ path: "src/a.ts", kind: "update", movePath: null, diff: "-old\n+new" }],
        }),
      }),
    ].map(rowToBbRow);

    for (const row of rows) expect(timelineRowSchema.safeParse(row).success).toBe(true);
    expect(rows[1]).toMatchObject({ workKind: "tool", toolName: "docs:search" });
    expect(rows[2]).toMatchObject({ workKind: "file-change", change: { diffStats: { added: 1, removed: 1 } } });
  });

  test("file-change diff stats handle raw add/delete content and unified update diffs", () => {
    function stats(kind: "add" | "delete" | "update", diff: string) {
      const row = rowToBbRow(makeRow({
        kind: "work",
        work_kind: "file-change",
        payload: JSON.stringify({
          callId: "edit-1",
          status: "completed",
          changes: [{ path: "file.txt", kind, movePath: null, diff }],
        }),
      }));
      if (row.kind !== "work" || row.workKind !== "file-change") throw new Error("expected file-change row");
      return row.change.diffStats;
    }

    expect(stats("add", "first\nsecond\n")).toEqual({ added: 2, removed: 0 });
    expect(stats("delete", "first\nsecond\n")).toEqual({ added: 0, removed: 2 });
    expect(stats("update", "-old\n+new\n unchanged")).toEqual({ added: 1, removed: 1 });
  });
});

describe("providerInfoFor (Herdr-observed agent kinds)", () => {
  test("qoder gets its own distinct icon glyph, not the first-letter fallback", () => {
    expect(providerInfoFor("qoder")).toMatchObject({ id: "qoder", icon: { glyph: "Zap" } });
  });

  test("an unmapped agent kind gets no icon field — falls through to the display name's initial", () => {
    const info = providerInfoFor("gemini") as { icon?: unknown };
    expect(info.icon).toBeUndefined();
  });
});

describe("promptText", () => {
  test("extracts text from a well-formed input array", () => {
    expect(promptText([{ type: "text", text: "hello" }])).toBe("hello");
  });

  test("returns empty string for a non-array input", () => {
    expect(promptText({ text: "hello" })).toBe("");
  });

  test("returns empty string for an array of non-objects", () => {
    expect(promptText(["not-a-dict"])).toBe("");
  });
});

describe("toBbProject", () => {
  function makeProject(overrides: Partial<ProjectRow> = {}): ProjectRow {
    return { id: "proj_1", name: "My Project", path: "/tmp/proj", created_at: 100, updated_at: 200, ...overrides };
  }

  test("carries name and path through as a local_path source", () => {
    const bb = toBbProject(makeProject());
    expect(bb.name).toBe("My Project");
    expect(bb.kind).toBe("standard");
    expect(bb.sources).toHaveLength(1);
    expect(bb.sources[0]).toMatchObject({ type: "local_path", path: "/tmp/proj" });
  });

  test("timestamps convert seconds to milliseconds", () => {
    const bb = toBbProject(makeProject({ created_at: 1000, updated_at: 2000 }));
    expect(bb.createdAt).toBe(1_000_000);
    expect(bb.updatedAt).toBe(2_000_000);
  });
});
