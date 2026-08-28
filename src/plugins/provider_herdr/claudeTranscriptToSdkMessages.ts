/**
 * Converts a Claude Code session transcript (`~/.claude/projects/<project>/
 * <session>.jsonl` plus its `<session>/subagents/agent-*.jsonl` sidechains)
 * into the Claude Agent SDK message stream the vendored delta translator
 * (`bb-packages/provider-claude-code/src/delta-translation.ts`) consumes.
 *
 * Ported from bb's `scripts/provider-recordings/convert-claude-transcript.mjs`
 * (`convert()` and its helpers) — same algorithm, TypeScript syntax only. See
 * that file's header comment for the full rationale; short version: a
 * transcript's `user`/`assistant`/`system` records are the *persisted*
 * conversation and have no `result`, `system/init`, or `system/task_*`
 * messages — turn boundaries and background-task lifecycle are implicit.
 * This module makes them explicit:
 *
 *   - every record becomes the SDK envelope of its type (`parent_tool_use_id`
 *     from the subagent's `toolUseId`, `tool_use_result` from the record's
 *     `toolUseResult`), interleaved with the sidechains by timestamp — except
 *     the human's own prompts, which a live stream never echoes (they only
 *     delimit turns here);
 *   - a `result` is synthesized when a root assistant message stops with a
 *     non-tool-use stop reason, before the next root prompt, and at EOF;
 *   - `system/task_started`, `task_updated` and `task_notification` are
 *     synthesized for Agent calls from the call, its result
 *     (`toolUseResult.status === "async_launched"` => backgrounded) and the
 *     `<task-notification>` prompt that resumes the parent;
 *   - `system/init` is synthesized from the first record (cwd, version,
 *     model, the tool names the session used).
 *
 * This file keeps the conversion a pure function of already-parsed record
 * arrays (`convertClaudeTranscript`) separate from the filesystem reads that
 * gather them (`loadClaudeTranscript` and friends) — the pure half is what
 * gets unit-tested, the IO half is what a future wiring step calls.
 *
 * Not wired into `sessionLog.ts` / `herdrThreadRegistry.ts` yet — that is a
 * later phase.
 */

import { readdir, stat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

export type JsonRecord = Record<string, unknown>;

/** One parsed transcript line: the raw JSONL record plus the timestamp used
 * for merge ordering (parsed once, defaulted to the previous record's
 * timestamp when the line's own `timestamp` is missing/unparseable — mirrors
 * the original script's `lastTimestamp` carry-forward). */
export interface TranscriptEntry {
  record: JsonRecord;
  at: number;
}

/** A `<session>/subagents/agent-<id>.jsonl` sidechain plus its `.meta.json`
 * sidecar (agent type / description / the parent's Agent-tool-use id it
 * answers), already parsed into records. */
export interface SubagentTranscript {
  agentId: string;
  toolUseId: string | null;
  agentType: string | null;
  description: string | null;
  records: TranscriptEntry[];
}

export interface ConvertClaudeTranscriptOptions {
  /** 1-based, inclusive human-prompt turn window. Defaults to the whole session. */
  turns?: { from: number; to: number } | null;
}

export interface ConvertClaudeTranscriptManifest {
  sessionId: string;
  turns: { from: number; to: number; of: number };
  records: { main: number; sidechain: number; skippedSidechain: number };
  tools: string[];
  messages: Record<string, number>;
  synthesized: Record<string, number>;
}

export interface ConvertClaudeTranscriptResult {
  messages: JsonRecord[];
  manifest: ConvertClaudeTranscriptManifest;
}

// ---------------------------------------------------------------------------
// Record helpers
// ---------------------------------------------------------------------------

function asRecord(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function contentBlocks(record: JsonRecord): JsonRecord[] {
  const content = asRecord(record.message)?.content;
  return Array.isArray(content) ? (content as JsonRecord[]) : [];
}

function toolUseBlocks(record: JsonRecord): JsonRecord[] {
  return contentBlocks(record).filter((block) => block?.type === "tool_use");
}

function toolResultBlocks(record: JsonRecord): JsonRecord[] {
  return contentBlocks(record).filter((block) => block?.type === "tool_result");
}

/**
 * A root prompt opens a turn. `isMeta` user records are context a tool
 * injected mid-turn (a Skill's instructions, a local-command caveat) and
 * stream as plain user messages without turn semantics.
 */
function isRootPrompt(record: JsonRecord): boolean {
  return (
    record.type === "user" &&
    record.isSidechain !== true &&
    record.isMeta !== true &&
    toolResultBlocks(record).length === 0
  );
}

function isTaskNotificationPrompt(record: JsonRecord): boolean {
  return isRootPrompt(record) && asRecord(record.origin)?.kind === "task-notification";
}

function assistantText(record: JsonRecord): string {
  return contentBlocks(record)
    .filter((block) => block?.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("\n");
}

function isApiErrorAssistant(record: JsonRecord): boolean {
  return (
    record.isApiErrorMessage === true ||
    record.error !== undefined ||
    record.apiErrorStatus !== undefined
  );
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return (value as unknown[])
      .filter(
        (block): block is JsonRecord =>
          asRecord(block)?.type === "text" && typeof asRecord(block)?.text === "string",
      )
      .map((block) => block.text as string)
      .join("\n");
  }
  return "";
}

interface ParsedTaskNotification {
  taskId: string;
  toolUseId: string;
  outputFile: string;
  status: "completed" | "failed" | "stopped";
  summary: string;
  result: string;
}

/** `<task-notification>` prompt fields (the parent's resume after a background agent settles). */
function parseTaskNotification(text: string): ParsedTaskNotification | null {
  const field = (name: string): string => {
    const match = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(text);
    return match ? match[1]!.trim() : "";
  };
  const taskId = field("task-id");
  if (taskId.length === 0) return null;
  const status = field("status");
  return {
    taskId,
    toolUseId: field("tool-use-id"),
    outputFile: field("output-file"),
    status:
      status === "completed" || status === "failed" || status === "stopped"
        ? status
        : "completed",
    summary: field("summary"),
    result: field("result"),
  };
}

function apiErrorCode(status: unknown): string {
  if (status === 401 || status === 403) return "authentication_failed";
  if (status === 429) return "rate_limit";
  if (status === 400) return "invalid_request";
  if (status === 404) return "model_not_found";
  if (typeof status === "number" && status >= 500) return "server_error";
  return "unknown";
}

// ---------------------------------------------------------------------------
// Turn slicing
// ---------------------------------------------------------------------------

/**
 * Human-prompt turn index per root record (1-based). A task-notification
 * prompt continues the turn it interrupts. Records before the first prompt
 * belong to turn 1.
 */
function assignTurns(records: TranscriptEntry[]): { turnByIndex: number[]; turnCount: number } {
  let turn = 0;
  const turnByIndex: number[] = [];
  for (const { record } of records) {
    if (isRootPrompt(record) && !isTaskNotificationPrompt(record)) {
      turn += 1;
    }
    turnByIndex.push(Math.max(turn, 1));
  }
  return { turnByIndex, turnCount: Math.max(turn, 1) };
}

// ---------------------------------------------------------------------------
// Pure conversion
// ---------------------------------------------------------------------------

interface MergedEntry {
  record: JsonRecord;
  at: number;
  order: number;
  lane: 0 | 1;
  agent: SubagentTranscript | null;
  continuesInNextRootAssistant?: boolean;
}

interface UsageTotals {
  input_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  output_tokens: number;
}

const USAGE_KEYS: (keyof UsageTotals)[] = [
  "input_tokens",
  "cache_creation_input_tokens",
  "cache_read_input_tokens",
  "output_tokens",
];

/**
 * Pure transform: `main` is the session's own `{record, at}` array (already
 * read + JSON-parsed, e.g. via `readClaudeTranscriptFile`/`parseTranscriptRecords`
 * below); `agents` are its sidechains (already read via
 * `readClaudeSubagentTranscripts`). No filesystem access here — this is the
 * half that gets unit-tested directly against fixtures.
 */
export function convertClaudeTranscript(
  sessionId: string,
  main: TranscriptEntry[],
  agents: SubagentTranscript[],
  options: ConvertClaudeTranscriptOptions = {},
): ConvertClaudeTranscriptResult {
  if (main.length === 0) {
    throw new Error(`${sessionId}: no user/assistant/system records`);
  }

  // Agent call id <-> agent id, from the subagent metadata and the Agent tool
  // results (`toolUseResult.agentId`), so synthesized task messages name the
  // same task id the sidechain carries.
  const agentIdByToolUseId = new Map<string, string>();
  const agentByToolUseId = new Map<string, SubagentTranscript>();
  for (const agent of agents) {
    if (agent.toolUseId !== null) {
      agentIdByToolUseId.set(agent.toolUseId, agent.agentId);
      agentByToolUseId.set(agent.toolUseId, agent);
    }
  }
  const backgroundedToolUseIds = new Set<string>();
  for (const { record } of main) {
    if (record.type !== "user") continue;
    const result = asRecord(record.toolUseResult);
    if (result === undefined) continue;
    for (const block of toolResultBlocks(record)) {
      const toolUseId = block.tool_use_id as string;
      if (typeof result.agentId === "string") {
        agentIdByToolUseId.set(toolUseId, result.agentId);
      }
      if (result.status === "async_launched" || result.isAsync === true) {
        backgroundedToolUseIds.add(toolUseId);
      }
    }
  }

  // Agent call metadata (subagent type, description) by call id.
  const agentCallByToolUseId = new Map<string, JsonRecord>();
  for (const { record } of main) {
    if (record.type !== "assistant") continue;
    for (const block of toolUseBlocks(record)) {
      if (block.name === "Agent" || block.name === "Task") {
        agentCallByToolUseId.set(block.id as string, asRecord(block.input) ?? {});
      }
    }
  }

  // Slice by human-prompt turn.
  const { turnByIndex, turnCount } = assignTurns(main);
  const from = options.turns?.from ?? 1;
  const to = options.turns?.to ?? turnCount;
  if (from < 1 || to < from || from > turnCount) {
    throw new Error(`--turns ${from}-${to} is outside the session's ${turnCount} turn(s)`);
  }
  const selected = main.filter((_, index) => turnByIndex[index]! >= from && turnByIndex[index]! <= to);
  const selectedToolUseIds = new Set<string>();
  for (const { record } of selected) {
    for (const block of toolUseBlocks(record)) selectedToolUseIds.add(block.id as string);
  }

  // Merge the sidechains whose spawning call is in the window, by timestamp
  // (stable: main before sidechain at equal instants, file order otherwise).
  const merged: MergedEntry[] = selected.map((entry, order) => ({
    ...entry,
    order,
    lane: 0,
    agent: null,
  }));
  let skippedSidechainRecords = 0;
  for (const agent of agents) {
    if (agent.toolUseId === null || !selectedToolUseIds.has(agent.toolUseId)) {
      skippedSidechainRecords += agent.records.length;
      continue;
    }
    agent.records.forEach((entry, order) => {
      merged.push({ ...entry, order, lane: 1, agent });
    });
  }
  merged.sort((a, b) => a.at - b.at || a.lane - b.lane || a.order - b.order);
  // Per-block records of one root assistant message: only the last closes.
  let previousRoot: MergedEntry | null = null;
  for (const entry of merged) {
    if (entry.lane !== 0 || entry.record.type !== "assistant") continue;
    entry.continuesInNextRootAssistant = false;
    const message = asRecord(entry.record.message);
    const previousMessage = previousRoot === null ? undefined : asRecord(previousRoot.record.message);
    if (
      previousRoot !== null &&
      typeof message?.id === "string" &&
      previousMessage?.id === message.id
    ) {
      previousRoot.continuesInNextRootAssistant = true;
    }
    previousRoot = entry;
  }

  const first = main[0]!.record;
  const out: JsonRecord[] = [];
  const counts = new Map<string, number>();
  const synthesized = new Map<string, number>();
  let syntheticIds = 0;
  const syntheticUuid = (): string => {
    syntheticIds += 1;
    return `00000000-0000-4000-8000-${String(syntheticIds).padStart(12, "0")}`;
  };
  const emit = (message: JsonRecord, options: { synthetic?: boolean } = {}): void => {
    const key =
      message.type === "system" || message.type === "result"
        ? `${message.type}/${message.subtype}`
        : (message.type as string);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (options.synthetic) synthesized.set(key, (synthesized.get(key) ?? 0) + 1);
    out.push(message);
  };

  const toolNames = new Set<string>();
  let model: string | null = null;
  for (const { record } of merged) {
    if (record.type !== "assistant") continue;
    const message = asRecord(record.message);
    if (model === null && typeof message?.model === "string") {
      model = message.model;
    }
    for (const block of toolUseBlocks(record)) toolNames.add(block.name as string);
  }

  emit(
    {
      type: "system",
      subtype: "init",
      cwd: first.cwd ?? "",
      session_id: sessionId,
      tools: [...toolNames].sort(),
      mcp_servers: [],
      model: model ?? "unknown",
      permissionMode: first.permissionMode ?? "default",
      slash_commands: [],
      apiKeySource: "none",
      claude_code_version: first.version ?? "unknown",
      output_style: "default",
      agents: [],
      skills: [],
      plugins: [],
      uuid: syntheticUuid(),
    },
    { synthetic: true },
  );

  // Per-turn state for result synthesis.
  let turnOpen = false;
  let turnStartedAt = 0;
  let turnOrigin: JsonRecord | null = null;
  let turnAssistantCount = 0;
  let lastRootAssistant: JsonRecord | null = null;
  let lastAt = main[0]!.at;
  const usage: UsageTotals = {
    input_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    output_tokens: 0,
  };
  const resetUsage = (): void => {
    for (const key of USAGE_KEYS) usage[key] = 0;
  };
  const openTurn = (at: number, origin: JsonRecord | null): void => {
    if (turnOpen) return;
    turnOpen = true;
    turnStartedAt = at;
    turnOrigin = origin;
    turnAssistantCount = 0;
    lastRootAssistant = null;
    resetUsage();
  };
  const closeTurn = (at: number): void => {
    if (!turnOpen) return;
    const failed = lastRootAssistant !== null && isApiErrorAssistant(lastRootAssistant);
    const text = lastRootAssistant === null ? "" : assistantText(lastRootAssistant);
    emit(
      {
        type: "result",
        subtype: failed ? "error_during_execution" : "success",
        is_error: failed,
        duration_ms: Math.max(0, at - turnStartedAt),
        duration_api_ms: Math.max(0, at - turnStartedAt),
        num_turns: turnAssistantCount,
        result: text,
        ...(failed ? { errors: [text] } : {}),
        session_id: sessionId,
        total_cost_usd: 0,
        usage: { ...usage },
        permission_denials: [],
        ...(turnOrigin === null ? {} : { origin: turnOrigin }),
        uuid: syntheticUuid(),
      },
      { synthetic: true },
    );
    turnOpen = false;
  };
  const addUsage = (messageUsage: unknown): void => {
    const usageRecord = asRecord(messageUsage);
    if (usageRecord === undefined) return;
    for (const key of USAGE_KEYS) {
      if (typeof usageRecord[key] === "number") usage[key] += usageRecord[key] as number;
    }
  };

  const settledTaskIds = new Set<string>();
  // taskId -> toolUseId, for the end-of-transcript fallback below: a task
  // that started but whose settlement (real user record or the
  // queue-operation/remove recovery above) never showed up anywhere in the
  // transcript — killed process, whatever. Never observed in real data; this
  // just forces the task closed so it can't wedge every later turn.
  const startedTaskIds = new Map<string, string>();
  const emitTaskStarted = (toolUseId: string, backgrounded: boolean): string | null => {
    const taskId = agentIdByToolUseId.get(toolUseId);
    if (taskId === undefined) return null;
    startedTaskIds.set(taskId, toolUseId);
    const call = agentCallByToolUseId.get(toolUseId) ?? {};
    const agent = agentByToolUseId.get(toolUseId);
    emit(
      {
        type: "system",
        subtype: "task_started",
        task_id: taskId,
        tool_use_id: toolUseId,
        description:
          typeof call.description === "string" ? call.description : agent?.description ?? "",
        subagent_type:
          typeof call.subagent_type === "string"
            ? call.subagent_type
            : agent?.agentType ?? "general-purpose",
        is_backgrounded: backgrounded,
        spawn_depth: 1,
        task_type: "local_agent",
        ...(typeof call.prompt === "string" ? { prompt: call.prompt } : {}),
        uuid: syntheticUuid(),
        session_id: sessionId,
      },
      { synthetic: true },
    );
    return taskId;
  };
  const emitTaskSettled = (
    taskId: string,
    toolUseId: string,
    status: string,
    summary: string,
    outputFile: string,
  ): void => {
    if (settledTaskIds.has(taskId)) return;
    settledTaskIds.add(taskId);
    emit(
      {
        type: "system",
        subtype: "task_updated",
        task_id: taskId,
        patch: { status: status === "completed" ? "completed" : "failed" },
        uuid: syntheticUuid(),
        session_id: sessionId,
      },
      { synthetic: true },
    );
    emit(
      {
        type: "system",
        subtype: "task_notification",
        task_id: taskId,
        tool_use_id: toolUseId,
        status,
        output_file: outputFile,
        summary,
        uuid: syntheticUuid(),
        session_id: sessionId,
      },
      { synthetic: true },
    );
  };

  for (const entry of merged) {
    const { record, at, agent } = entry;
    lastAt = at;
    const parentToolUseId = agent === null ? null : agent.toolUseId;
    const uuid = typeof record.uuid === "string" ? record.uuid : syntheticUuid();
    const timestamp = typeof record.timestamp === "string" ? record.timestamp : undefined;

    if (record.type === "system") {
      if (record.subtype === "api_error" && record.source === "request_retry") {
        openTurn(at, null);
        const error = asRecord(record.error);
        emit({
          type: "system",
          subtype: "api_retry",
          attempt: record.retryAttempt ?? 1,
          max_retries: record.maxRetries ?? 1,
          retry_delay_ms: record.retryInMs ?? 0,
          error_status: error?.status ?? null,
          error: apiErrorCode(error?.status),
          uuid,
          session_id: sessionId,
        });
      } else if (record.subtype === "model_refusal_fallback" || record.subtype === "model_fallback") {
        emit({
          type: "system",
          subtype: record.subtype,
          original_model: record.originalModel,
          fallback_model: record.fallbackModel,
          ...(typeof record.content === "string" ? { content: record.content } : {}),
          uuid,
          session_id: sessionId,
        });
      } else if (record.subtype === "compact_boundary") {
        const compactMetadata = asRecord(record.compactMetadata);
        emit({
          type: "system",
          subtype: "compact_boundary",
          compact_metadata: {
            trigger: compactMetadata?.trigger ?? "auto",
            pre_tokens: compactMetadata?.preTokens ?? 0,
          },
          uuid,
          session_id: sessionId,
        });
      }
      continue;
    }

    if (record.type === "assistant") {
      if (agent === null) {
        openTurn(at, null);
        turnAssistantCount += 1;
        lastRootAssistant = record;
        addUsage(asRecord(record.message)?.usage);
      }
      emit({
        type: "assistant",
        message: record.message,
        parent_tool_use_id: parentToolUseId,
        ...(typeof record.requestId === "string" ? { request_id: record.requestId } : {}),
        session_id: sessionId,
        uuid,
        ...(timestamp === undefined ? {} : { timestamp }),
      });
      if (agent === null) {
        for (const block of toolUseBlocks(record)) {
          if (block.name === "Agent" || block.name === "Task") {
            emitTaskStarted(block.id as string, backgroundedToolUseIds.has(block.id as string));
          }
        }
        // The transcript writes one record per content block and stamps the
        // message's final stop reason on each of them; the turn ends once,
        // after the message's last block.
        const stopReason = asRecord(record.message)?.stop_reason;
        if (
          (stopReason === "end_turn" || stopReason === "stop_sequence" || stopReason === "max_tokens") &&
          !entry.continuesInNextRootAssistant
        ) {
          closeTurn(at);
        }
      }
      continue;
    }

    // user
    const results = toolResultBlocks(record);
    if (results.length === 0) {
      if (agent !== null) {
        // The subagent's prompt, as the SDK surfaces it under the call.
        emit({
          type: "user",
          message: record.message,
          parent_tool_use_id: parentToolUseId,
          session_id: sessionId,
          uuid,
          ...(timestamp === undefined ? {} : { timestamp }),
          ...(agent.agentType === null ? {} : { subagent_type: agent.agentType }),
          ...(agent.description === null ? {} : { task_description: agent.description }),
        });
        continue;
      }
      const notification = isTaskNotificationPrompt(record)
        ? parseTaskNotification(textOf(asRecord(record.message)?.content))
        : null;
      if (!isRootPrompt(record)) {
        // Injected context (isMeta): no turn transition.
      } else if (notification !== null) {
        // The background agent settled: its task lifecycle closes before the
        // parent is resumed, and the resuming segment's result says so.
        closeTurn(at);
        emitTaskSettled(
          notification.taskId,
          notification.toolUseId,
          notification.status,
          notification.summary,
          notification.outputFile,
        );
        openTurn(at, { kind: "task-notification" });
      } else {
        // The human's prompt is the SDK's INPUT: a live stream never echoes
        // it. It only moves the turn; the CLI-injected user messages
        // (task notifications, isMeta context) do stream and are emitted.
        closeTurn(at);
        openTurn(at, null);
        continue;
      }
      emit({
        type: "user",
        message: record.message,
        parent_tool_use_id: null,
        session_id: sessionId,
        uuid,
        ...(timestamp === undefined ? {} : { timestamp }),
      });
      continue;
    }

    if (agent === null) {
      for (const block of results) {
        const toolUseId = block.tool_use_id as string;
        if (agentCallByToolUseId.has(toolUseId) && !backgroundedToolUseIds.has(toolUseId)) {
          // A foreground agent settles before its call's result lands; a
          // backgrounded one settles at the <task-notification> prompt.
          const taskId = agentIdByToolUseId.get(toolUseId);
          if (taskId !== undefined) {
            emitTaskSettled(
              taskId,
              toolUseId,
              block.is_error === true ? "failed" : "completed",
              textOf(block.content).split("\n")[0] ?? "",
              "",
            );
          }
        }
      }
    }
    emit({
      type: "user",
      message: record.message,
      parent_tool_use_id: parentToolUseId,
      session_id: sessionId,
      uuid,
      ...(timestamp === undefined ? {} : { timestamp }),
      ...(record.toolUseResult === undefined ? {} : { tool_use_result: record.toolUseResult }),
    });
  }
  closeTurn(lastAt);

  // Fallback: force-close any task that never settled anywhere (see
  // `startedTaskIds` above). `emitTaskSettled` is a no-op if it already did.
  for (const [taskId, toolUseId] of startedTaskIds) {
    emitTaskSettled(
      taskId,
      toolUseId,
      "completed",
      "(forced release: no settlement found in transcript)",
      "",
    );
  }

  return {
    messages: out,
    manifest: {
      sessionId,
      turns: { from, to, of: turnCount },
      records: {
        main: selected.length,
        sidechain: merged.length - selected.length,
        skippedSidechain: skippedSidechainRecords,
      },
      tools: [...toolNames].sort(),
      messages: Object.fromEntries([...counts.entries()].sort()),
      synthesized: Object.fromEntries([...synthesized.entries()].sort()),
    },
  };
}

// ---------------------------------------------------------------------------
// Parsing (pure: JSONL text -> records; no filesystem access)
// ---------------------------------------------------------------------------

const STREAMED_RECORD_TYPES = new Set(["user", "assistant", "system"]);

/**
 * A `<task-notification>` completion that the CLI queued (`queue-operation`
 * `enqueue`) and later discarded (`operation: "remove"`) because the human
 * typed a new prompt at the same instant, instead of ever dequeuing it onto
 * the wire as a `type: "user"` record. The `remove` record's `content` is
 * the same `<task-notification>…</task-notification>` text a landed record
 * would carry — `parseTranscriptRecords` below re-synthesizes it as one so
 * the background task it resumes still gets marked settled (see this
 * module's header and `emitTaskSettled`/`isTaskNotificationPrompt`).
 */
function synthesizeTaskNotificationUserRecord(queueOperationRecord: JsonRecord): JsonRecord {
  return {
    type: "user",
    isSidechain: false,
    isMeta: false,
    origin: { kind: "task-notification" },
    message: { role: "user", content: queueOperationRecord.content },
    timestamp: queueOperationRecord.timestamp,
  };
}

/** Parses one transcript file's raw JSONL text into the `{record, at}` array
 * `convertClaudeTranscript` expects, dropping record types the SDK never
 * streams (attachment, queue-operation, ai-title, …) and defaulting each
 * record's timestamp to the previous one's when its own is missing.
 *
 * Exception: a `queue-operation`/`remove` record whose `content` is an
 * orphaned `<task-notification>` (queued, then discarded without ever
 * dequeuing as a real `type: "user"` record — see
 * `synthesizeTaskNotificationUserRecord`) is re-synthesized as one, at its
 * own timestamp, so its task still settles. Skipped when a real `user`
 * record with the identical content already landed (belt-and-suspenders;
 * both are not expected to occur for the same notification). */
export function parseTranscriptRecords(text: string): TranscriptEntry[] {
  return buildTranscriptEntries(parseRawTranscriptRecords(text));
}

/** The per-line half of `parseTranscriptRecords`: JSONL text → records.
 * Chunk-safe (each line stands alone), so the incremental loader can parse
 * only a file's new tail and append to a cached record array. */
export function parseRawTranscriptRecords(text: string): JsonRecord[] {
  const rawRecords: JsonRecord[] = [];
  for (const line of text.split("\n")) {
    if (line.length === 0) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    const record = asRecord(parsed);
    if (record !== undefined) rawRecords.push(record);
  }
  return rawRecords;
}

/** The whole-history half: NOT chunk-safe (the orphaned-task-notification
 * check needs every `user` record that ever landed, and timestamps carry
 * forward), so it always runs over the full record array — it's plain
 * in-memory work, cheap next to re-reading and re-JSON.parsing the file. */
export function buildTranscriptEntries(rawRecords: JsonRecord[]): TranscriptEntry[] {
  const landedTaskNotificationContent = new Set<string>();
  for (const record of rawRecords) {
    if (record.type !== "user") continue;
    const content = asRecord(record.message)?.content;
    if (typeof content === "string" && content.includes("<task-notification>")) {
      landedTaskNotificationContent.add(content);
    }
  }

  const records: TranscriptEntry[] = [];
  let lastTimestamp = 0;
  const push = (record: JsonRecord): void => {
    const at = Date.parse(typeof record.timestamp === "string" ? record.timestamp : "");
    const resolvedAt = Number.isNaN(at) ? lastTimestamp : at;
    lastTimestamp = resolvedAt;
    records.push({ record, at: resolvedAt });
  };

  for (const record of rawRecords) {
    if (STREAMED_RECORD_TYPES.has(record.type as string)) {
      push(record);
      continue;
    }
    if (record.type === "queue-operation" && record.operation === "remove") {
      const content = record.content;
      if (
        typeof content === "string" &&
        content.includes("<task-notification>") &&
        !landedTaskNotificationContent.has(content)
      ) {
        push(synthesizeTaskNotificationUserRecord(record));
      }
    }
  }
  return records;
}

// ---------------------------------------------------------------------------
// IO (thin wrappers: filesystem reads + JSONL parsing, no conversion logic)
// ---------------------------------------------------------------------------

/** Reads and parses one transcript file (a main session `.jsonl` or a
 * sidechain `agent-<id>.jsonl`). */
export async function readClaudeTranscriptFile(path: string): Promise<TranscriptEntry[]> {
  const text = await Bun.file(path).text();
  return parseTranscriptRecords(text);
}

/** Cheap change fingerprint over a session's subagent sidechains: sorted
 * `name:size:mtime` of every file in the subagents dir, "" when there is
 * none. A sidechain can grow while the main session log stays untouched, so
 * refresh gates that stat only the main log would miss live subagent
 * progress — this closes that hole at readdir+stat cost, not parse cost. */
export async function subagentTranscriptsFingerprint(sessionPath: string): Promise<string> {
  const sessionId = basename(sessionPath, ".jsonl");
  const dir = join(dirname(sessionPath), sessionId, "subagents");
  let names: string[];
  try {
    names = (await readdir(dir)).sort();
  } catch {
    return "";
  }
  const parts = await Promise.all(
    names.map(async (name) => {
      try {
        const stats = await stat(join(dir, name));
        return `${name}:${stats.size}:${stats.mtimeMs}`;
      } catch {
        return name;
      }
    }),
  );
  return parts.join(",");
}

/** Reads a session's `<session>/subagents/agent-*.jsonl` sidechains plus
 * their `.meta.json` sidecars. Returns `[]` when the session has no
 * subagents directory (the common case). */
export async function readClaudeSubagentTranscripts(sessionPath: string): Promise<SubagentTranscript[]> {
  const sessionId = basename(sessionPath, ".jsonl");
  const dir = join(dirname(sessionPath), sessionId, "subagents");
  let names: string[];
  try {
    names = (await readdir(dir)).sort();
  } catch {
    return [];
  }
  const agents: SubagentTranscript[] = [];
  for (const name of names) {
    const match = /^agent-([A-Za-z0-9]+)\.jsonl$/.exec(name);
    if (!match) continue;
    const agentId = match[1]!;
    const metaPath = join(dir, `agent-${agentId}.meta.json`);
    let meta: JsonRecord = {};
    try {
      meta = JSON.parse(await Bun.file(metaPath).text()) as JsonRecord;
    } catch {
      // no .meta.json (or unreadable) — agent fields fall back to defaults below
    }
    agents.push({
      agentId,
      toolUseId: typeof meta.toolUseId === "string" ? meta.toolUseId : null,
      agentType: typeof meta.agentType === "string" ? meta.agentType : null,
      description: typeof meta.description === "string" ? meta.description : null,
      records: await readClaudeTranscriptFile(join(dir, name)),
    });
  }
  return agents;
}

export interface LoadedClaudeTranscript {
  sessionId: string;
  main: TranscriptEntry[];
  agents: SubagentTranscript[];
}

/** Reads everything `convertClaudeTranscript` needs for one session: the
 * main `.jsonl` file and its sidechains. */
export async function loadClaudeTranscript(sessionPath: string): Promise<LoadedClaudeTranscript> {
  const sessionId = basename(sessionPath, ".jsonl");
  const [main, agents] = await Promise.all([
    readClaudeTranscriptFile(sessionPath),
    readClaudeSubagentTranscripts(sessionPath),
  ]);
  return { sessionId, main, agents };
}
