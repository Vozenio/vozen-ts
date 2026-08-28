/**
 * Runs a Claude Code session transcript through the vendored bb pipeline
 * (stage 1: `createClaudeDeltaTranslator`/`createDeltaAssembler`) and reshapes
 * the resulting `ThreadEvent[]` into the `{method,params}` notifications
 * `timelineRowBuilder.ts` (and engine.ts's own `updateTimelineRow`) already
 * know how to turn into `TimelineRow[]`.
 *
 * A fresh translator + assembler + builder is created on every call — herdr
 * threads are never persisted (see herdrThreadRegistry.ts), so there is no
 * incremental state to carry between calls, only a full history replay.
 *
 * One gap this file works around: `delta-translation.ts` never turns the
 * human's own prompt into a delta (the SDK never echoes it — see
 * claudeTranscriptToSdkMessages.ts's own header comment — and
 * `translateUserMessage` only handles tool RESULTS). In bb's real
 * production system the human's message reaches the timeline through a
 * separate, server-authored path (the turn-request event), which this
 * herdr replay does not have. Root human prompts are recovered directly
 * from the raw transcript records and re-injected as `input.provider`
 * deltas immediately after the `turn.open` delta that starts their turn
 * (tracked with the same open/close mirroring the assembler itself uses),
 * so they land as ordinary `userMessage` rows in the right position.
 *
 * A second gap: bb's vendored tool-classification.ts has no special case
 * for AskUserQuestion — it falls through to a generic (suppressed) tool
 * call, because bb's production UI surfaces a question via a
 * PendingInteraction, not a timeline row, and Claude's own
 * toolUseResult.answers metadata never reaches a ThreadEventItem either.
 * herdr has no such out-of-band channel and its UI expects a dedicated
 * "question" work row (same as the hand-written sessionLog.ts path still
 * used for non-claude agents) — recovered here as a correction pass over the
 * raw transcript after the main pipeline runs, resolving each
 * AskUserQuestion call's row via the assembler's own provider-id-to-bb-id
 * map (getBbItemId) rather than re-deriving ids.
 */
import type { ThreadDelta } from "@bb/provider-bridge-protocol";
import { createDeltaAssembler } from "@bb/provider-bridge-protocol/assembler";
import {
  createClaudeDeltaTranslator,
  type ClaudeDeltaTranslationContext,
} from "@bb/provider-claude-code";
import { encodeClientTurnRequestIdNumber, type ThreadEvent } from "@bb/domain";
import type { TimelineRow } from "../../packages/db/sqlite.ts";
import { createTimelineRowBuilder, type TimelineNotification } from "../../apps/server/timelineRowBuilder.ts";
import {
  convertClaudeTranscript,
  loadClaudeTranscript,
  type JsonRecord,
  type LoadedClaudeTranscript,
  type TranscriptEntry,
} from "./claudeTranscriptToSdkMessages.ts";
import { claudeAskUserQuestionAnswers, claudeAskUserQuestionToBbQuestions } from "./askUserQuestion.ts";

function asRecord(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function contentBlocks(record: JsonRecord): JsonRecord[] {
  const content = asRecord(record.message)?.content;
  return Array.isArray(content) ? (content as JsonRecord[]) : [];
}

function textOfPrompt(record: JsonRecord): string {
  const content = asRecord(record.message)?.content;
  if (typeof content === "string") return content;
  return contentBlocks(record)
    .filter((block) => block?.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("\n");
}

/** Mirrors claudeTranscriptToSdkMessages.ts's own (unexported) isRootPrompt/
 * isTaskNotificationPrompt: a root human prompt is a non-sidechain, non-meta
 * `user` record with no tool_result blocks, and the `<task-notification>`
 * resume prompt is excluded (that one is CLI-injected, not the human typing,
 * and already streams through translateClaudeTaskMessage's own path). */
function isRootHumanPrompt(record: JsonRecord): boolean {
  if (record.type !== "user" || record.isSidechain === true || record.isMeta === true) return false;
  const hasToolResult = contentBlocks(record).some((block) => block?.type === "tool_result");
  if (hasToolResult) return false;
  return asRecord(record.origin)?.kind !== "task-notification";
}

/** Ordered text of every root human prompt in the session — recovered
 * separately because `convertClaudeTranscript` deliberately drops them (a
 * live stream never echoes the human's own prompt back). */
function extractRootHumanPrompts(main: TranscriptEntry[]): string[] {
  return main
    .map(({ record }) => record)
    .filter(isRootHumanPrompt)
    .map(textOfPrompt)
    .filter((text) => text.length > 0);
}

function threadEventToNotification(event: ThreadEvent): TimelineNotification {
  const { type, threadId: _threadId, providerThreadId: _providerThreadId, scope, ...rest } = event as unknown as Record<string, unknown> & { type: string };
  const turnId = (scope as { kind: string; turnId?: string })?.kind === "turn" ? (scope as { turnId: string }).turnId : null;
  return { method: type, params: { ...rest, turnId } };
}

function textOfContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return (content as unknown[])
    .filter((block): block is JsonRecord => asRecord(block)?.type === "text" && typeof asRecord(block)?.text === "string")
    .map((block) => block.text as string)
    .join("\n");
}

interface AskUserQuestionCall {
  toolUseId: string;
  input: Record<string, unknown>;
  /** null: no tool_result seen yet (still pending). */
  output: string | null;
  error: boolean;
  /** The tool_result record's own `toolUseResult` sibling field — the only
   * place `{questions, answers, annotations}` survives; never reaches a
   * ThreadEventItem (see this file's header comment). */
  resultMetadata: unknown;
}

/** Root-level (non-sidechain) AskUserQuestion tool_use/tool_result pairs,
 * keyed by tool_use_id, matched the same way sessionLog.ts's own
 * backfillToolResults does (a later `user` record's tool_result answers an
 * earlier `assistant` record's tool_use by id, never on the same line). */
function findAskUserQuestionCalls(main: TranscriptEntry[]): AskUserQuestionCall[] {
  const calls = new Map<string, AskUserQuestionCall>();
  for (const { record } of main) {
    if (record.isSidechain === true) continue;
    if (record.type === "assistant") {
      for (const block of contentBlocks(record)) {
        if (block?.type === "tool_use" && block.name === "AskUserQuestion" && typeof block.id === "string") {
          calls.set(block.id, {
            toolUseId: block.id,
            input: asRecord(block.input) ?? {},
            output: null,
            error: false,
            resultMetadata: undefined,
          });
        }
      }
    } else if (record.type === "user") {
      for (const block of contentBlocks(record)) {
        if (block?.type !== "tool_result" || typeof block.tool_use_id !== "string") continue;
        const call = calls.get(block.tool_use_id);
        if (!call) continue;
        call.output = textOfContent(block.content);
        call.error = block.is_error === true;
        call.resultMetadata = record.toolUseResult;
      }
    }
  }
  return [...calls.values()];
}

function syntheticUserPromptNotification(text: string): TimelineNotification {
  return {
    method: "item/completed",
    params: {
      turnId: null,
      item: {
        type: "userMessage",
        id: `herdr-prompt-${Math.random().toString(36).slice(2)}`,
        content: [{ type: "text", text }],
      },
    },
  };
}

/**
 * Pure half: takes already-loaded transcript data (no filesystem access) and
 * returns the herdr thread's timeline rows. `threadId` only keys the
 * translator/assembler's own internal per-thread maps — any stable string
 * works since a fresh instance of both is built per call.
 */
export function buildClaudeHerdrTimelineRows(loaded: LoadedClaudeTranscript, threadId: string): TimelineRow[] {
  const converted = convertClaudeTranscript(loaded.sessionId, loaded.main, loaded.agents);
  const prompts = extractRootHumanPrompts(loaded.main);

  const cwd = typeof converted.messages[0]?.cwd === "string" ? (converted.messages[0]!.cwd as string) : undefined;
  const translator = createClaudeDeltaTranslator({ cwd });
  const context: ClaudeDeltaTranslationContext = { threadId };

  const deltas: ThreadDelta[] = [];
  let turnOpen = false;
  let promptIndex = 0;
  // A turn that ends in failure (e.g. the CLI's own synthesized
  // isApiErrorMessage assistant record — see claudeTranscriptToSdkMessages.ts's
  // isApiErrorAssistant) arms the translator's #1623 late-drain suppression,
  // which only a real translator.acceptInput() call (or an already-open turn)
  // clears. bb's live bridge calls acceptInput() when it hands the human's
  // turn-request to the provider; this replay never does, since the human's
  // own prompt is never turned into an SDK message (see this file's header
  // comment) — so once armed, every later assistant message would otherwise
  // be dropped by the translator for the rest of the session. Call it here,
  // once, right before the first message of the segment a recovered prompt
  // resumes (not before a task-notification resume — that isn't a human
  // "accepted input" and must not consume the prompt queue).
  let acceptedPendingPrompt = false;
  let awaitingTaskNotificationResume = false;

  for (const message of converted.messages) {
    if (!turnOpen && !awaitingTaskNotificationResume && !acceptedPendingPrompt && promptIndex < prompts.length) {
      deltas.push(...translator.acceptInput(threadId, encodeClientTurnRequestIdNumber({ value: promptIndex })));
      acceptedPendingPrompt = true;
    }
    if (message.type === "system" && message.subtype === "task_notification") {
      awaitingTaskNotificationResume = true;
    }
    const parentToolCallId = typeof message.parent_tool_use_id === "string" ? message.parent_tool_use_id : undefined;
    const msgDeltas = translator.translate(message, { ...context, ...(parentToolCallId ? { parentToolCallId } : {}) });
    for (const delta of msgDeltas) {
      deltas.push(delta);
      if (delta.kind === "turn.open" && !turnOpen) {
        turnOpen = true;
        acceptedPendingPrompt = false;
        awaitingTaskNotificationResume = false;
        if (promptIndex < prompts.length) {
          deltas.push({ kind: "input.provider", text: prompts[promptIndex]! });
          promptIndex += 1;
        }
      } else if (delta.kind === "turn.boundary") {
        turnOpen = false;
      }
    }
  }
  deltas.push(...translator.buildSessionSettlementDeltas(threadId));

  const assembler = createDeltaAssembler({ providerId: "claude-code" });
  const events = assembler.assemble({ threadId, deltas });

  const builder = createTimelineRowBuilder(threadId);
  for (const event of events) builder.apply(threadEventToNotification(event));

  // AskUserQuestion correction pass — see this file's header comment.
  for (const call of findAskUserQuestionCalls(loaded.main)) {
    const bbItemId = assembler.getBbItemId(threadId, call.toolUseId);
    if (!bbItemId) continue; // the call never got assembled (e.g. dropped by a late-drain suppression) — nothing to correct
    const lifecycle = call.output === null ? "pending" : call.error ? "interrupted" : "answered";
    const questions = claudeAskUserQuestionToBbQuestions(call.toolUseId, call.input);
    builder.overrideWorkRow(`row_${bbItemId}`, "question", {
      status: lifecycle === "pending" ? "pending" : lifecycle === "interrupted" ? "interrupted" : "completed",
      interactionId: call.toolUseId,
      lifecycle,
      questions,
      answers: claudeAskUserQuestionAnswers(call.resultMetadata, questions),
      statusReason: call.error ? call.output : null,
    });
  }

  // A session ending mid-turn with a still-open blocking background task
  // (see task-translation.ts's hasCompletionBlockingClaudeTasks) never
  // re-opens a turn for a trailing human prompt that arrived after it — a
  // rare edge case; append any leftover prompts at the end rather than
  // silently dropping them.
  for (; promptIndex < prompts.length; promptIndex += 1) {
    builder.apply(syntheticUserPromptNotification(prompts[promptIndex]!));
  }
  return builder.rows();
}

/** IO + pure conversion, for callers that only have a session log path
 * (herdrThreadRegistry.ts). */
export async function claudeTranscriptToTimelineRows(sessionPath: string, threadId: string): Promise<TimelineRow[]> {
  const loaded = await loadClaudeTranscript(sessionPath);
  return buildClaudeHerdrTimelineRows(loaded, threadId);
}
