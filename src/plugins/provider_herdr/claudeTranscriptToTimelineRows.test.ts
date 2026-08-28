import { describe, expect, test } from "bun:test";
import type { JsonRecord, LoadedClaudeTranscript, TranscriptEntry } from "./claudeTranscriptToSdkMessages.ts";
import { buildClaudeHerdrTimelineRows } from "./claudeTranscriptToTimelineRows.ts";

function entry(at: number, record: JsonRecord): TranscriptEntry {
  return { record, at };
}

/**
 * Regression for the "one authentication_failed record permanently kills
 * every later assistant message" bug: the CLI synthesizes a fake `assistant`
 * record (`isApiErrorMessage: true`, `error: "authentication_failed"`,
 * `message.model: "<synthetic>"`) when an in-flight API call itself fails
 * outright (also seen for rate limits, invalid_request, model_not_found,
 * server_error — anything `claudeTranscriptToSdkMessages.ts`'s
 * isApiErrorAssistant flags). `convertClaudeTranscript` faithfully closes the
 * open turn as failed for this record (bb's own convert-claude-transcript.mjs
 * does the same) — but the vendored `createClaudeDeltaTranslator` arms its
 * #1623 late-drain suppression on any failed result, and only clears it via a
 * real `translator.acceptInput()` call. This replay pipeline never turned a
 * recovered human prompt into that call, so once a session hit one API-level
 * error, every assistant message for the rest of the transcript — no matter
 * how much later, or how many further real human turns followed — silently
 * vanished from the timeline. Fixed in claudeTranscriptToTimelineRows.ts.
 */
describe("buildClaudeHerdrTimelineRows: authentication_failed recovery", () => {
  test("assistant conversation continues normally after a synthesized authentication_failed record", () => {
    const main: TranscriptEntry[] = [
      // Turn 1: ordinary successful turn.
      entry(1000, { type: "user", message: { role: "user", content: "turn one" }, timestamp: "t1" }),
      entry(1100, {
        type: "assistant",
        uuid: "a1",
        message: {
          role: "assistant",
          model: "claude-sonnet-5",
          content: [{ type: "text", text: "turn one reply" }],
          stop_reason: "end_turn",
        },
      }),
      // Turn 2: real tool use, then the API call itself fails outright.
      entry(2000, { type: "user", message: { role: "user", content: "turn two" }, timestamp: "t2" }),
      entry(2100, {
        type: "assistant",
        uuid: "a2",
        message: {
          role: "assistant",
          model: "claude-sonnet-5",
          content: [{ type: "tool_use", id: "toolu_2", name: "Bash", input: { command: "echo hi" } }],
          stop_reason: "tool_use",
        },
      }),
      entry(2200, {
        type: "user",
        uuid: "u2",
        message: { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_2", content: "hi" }] },
        toolUseResult: { stdout: "hi" },
      }),
      entry(2300, {
        type: "assistant",
        uuid: "a3",
        isApiErrorMessage: true,
        error: "authentication_failed",
        message: {
          role: "assistant",
          model: "<synthetic>",
          content: [{ type: "text", text: "Login expired · Please run /login" }],
          stop_reason: "stop_sequence",
        },
      }),
      // Turn 3: the human retries after re-authenticating — ordinary content.
      entry(3000, { type: "user", message: { role: "user", content: "turn three" }, timestamp: "t3" }),
      entry(3100, {
        type: "assistant",
        uuid: "a4",
        message: {
          role: "assistant",
          model: "claude-sonnet-5",
          content: [{ type: "text", text: "turn three reply" }],
          stop_reason: "end_turn",
        },
      }),
    ];
    const loaded: LoadedClaudeTranscript = { sessionId: "sess-auth-failed", main, agents: [] };

    const rows = buildClaudeHerdrTimelineRows(loaded, "test-thread");
    const assistantConversation = rows.filter((row) => row.role === "assistant" && row.kind === "conversation");
    const texts = assistantConversation.map((row) => row.text);

    // Turn 1 and turn 3's real replies must both survive — the whole point of
    // the regression is that turn 3 (after the error) is not silently dropped.
    expect(texts).toContain("turn one reply");
    expect(texts).toContain("turn three reply");
    // Handling the error record itself must not crash and may surface as its
    // own row; either way it must not swallow anything that follows it.
    expect(rows.length).toBeGreaterThan(0);
  });

  test("rebuilding from the same transcript yields identical rows (deterministic ids)", () => {
    // The registry rebuilds the full timeline from the transcript on every
    // refresh and diffs by fingerprint; any nondeterministic id (the old
    // Math.random() prompt ids) makes every rebuild look changed, so the
    // client refetches and re-renders every poll tick forever.
    const main: TranscriptEntry[] = [
      entry(1000, { type: "user", message: { role: "user", content: "turn one" }, timestamp: "t1" }),
    ];
    const loaded: LoadedClaudeTranscript = { sessionId: "sess-deterministic", main, agents: [] };

    const first = buildClaudeHerdrTimelineRows(loaded, "test-thread");
    const second = buildClaudeHerdrTimelineRows(loaded, "test-thread");
    expect(second).toEqual(first);
    expect(first.length).toBeGreaterThan(0);
  });
});
