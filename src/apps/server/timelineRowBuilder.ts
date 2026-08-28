/**
 * Pure, in-memory TimelineRow[] projector for herdr threads.
 *
 * herdr threads never touch sqlite (see herdrThreadRegistry.ts's own header
 * comment) — timelineRows() is recomputed from the full session log on every
 * call. This module is the in-memory counterpart of engine.ts's
 * updateTimelineRow()/persistNotification(): it applies the exact same
 * method+params notifications to a Map<rowId, TimelineRow> instead of
 * `sqlite.*` calls, reusing engine.ts's shared pure helpers
 * (workTimelineRow/itemText/ROW_ITEM_TYPES/ROW_ROLE_BY_ITEM_TYPE) so "what
 * method produces what row shape" has one source of truth for native and
 * herdr threads alike.
 *
 * A caller feeds it a whole notification stream in order (no seq/now from
 * outside needed — this is a display-only projection, never persisted, so an
 * internal counter and one fixed timestamp per build are enough) and reads
 * `rows()` once at the end.
 */
import type { TimelineRow } from "../../packages/db/sqlite.ts";
import {
  CODEX_ITEM_STATUS_TO_WORK_STATUS,
  ROW_ROLE_BY_ITEM_TYPE,
  itemText,
} from "../../packages/domain/models.ts";
import { workTimelineRow } from "./engine.ts";

export interface TimelineNotification {
  method: string;
  params: Record<string, unknown>;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function outputText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return null;
  return JSON.stringify(value);
}

/**
 * The extra item-shape knowledge engine.ts's workTimelineRow() does not
 * have: bb's unified ThreadEventItem vocabulary (toolCall/delegation/
 * backgroundTask) is richer than codex's own app-server vocabulary
 * (mcpToolCall) that workTimelineRow was written against. This is additive
 * local knowledge — not a duplicate of workTimelineRow's own three branches
 * — for item types only the herdr/claude pipeline ever produces.
 *
 * ponytail: fileRead/search/webSearch/webFetch/reasoning/plan/planSteps/
 * extension/contextCompaction items are dropped (same silent-drop behavior
 * workTimelineRow already has for anything outside its own ROW_ITEM_TYPES) —
 * add a row shape for one of these if a real herdr session needs it rendered.
 */
function fallbackWorkRow(item: Record<string, unknown>, completedAt: number | null): {
  workKind: NonNullable<TimelineRow["work_kind"]>;
  payload: Record<string, unknown>;
} | null {
  const status = CODEX_ITEM_STATUS_TO_WORK_STATUS[String(item.status)]
    ?? (completedAt === null ? "pending" : "completed");
  const callId = String(item.id);

  if (item.type === "toolCall") {
    const result = item.result ?? null;
    const error = item.error ?? null;
    const finalOutput = outputText(result) ?? outputText(record(error).message) ?? outputText(error);
    return {
      workKind: "tool",
      payload: {
        callId,
        status,
        server: typeof item.server === "string" ? item.server : null,
        tool: typeof item.tool === "string" ? item.tool : "",
        arguments: item.arguments ?? null,
        result,
        error,
        durationMs: typeof item.durationMs === "number" ? item.durationMs : null,
        completedAt,
        ...(finalOutput === null ? {} : { output: finalOutput }),
      },
    };
  }

  if (item.type === "delegation") {
    const summary = typeof item.summary === "string" ? item.summary : null;
    return {
      workKind: "delegation",
      payload: {
        callId,
        status,
        // The delegation shape (tool-classification.ts's classifyDelegation)
        // does not preserve the raw Claude tool name (Agent vs Task) — the
        // call's own description/label is the closest available stand-in.
        toolName: typeof item.label === "string" ? item.label : null,
        childRef: typeof item.childRef === "string" ? item.childRef : callId,
        background: item.background === true,
        subagentType: null,
        description: typeof item.label === "string" ? item.label : null,
        output: summary ?? "",
        completedAt,
        childRows: [],
      },
    };
  }

  if (item.type === "backgroundTask") {
    const summary = typeof item.summary === "string" ? item.summary : null;
    const error = typeof item.error === "string" ? item.error : null;
    return {
      workKind: "delegation",
      payload: {
        callId,
        status,
        toolName: typeof item.taskType === "string" ? item.taskType : null,
        childRef: typeof item.familyId === "string" ? item.familyId : callId,
        background: true,
        subagentType: null,
        description: typeof item.description === "string" ? item.description : null,
        output: summary ?? error ?? "",
        completedAt,
        childRows: [],
      },
    };
  }

  return null;
}

export interface TimelineRowBuilder {
  apply(notification: TimelineNotification): void;
  /** See overrideWorkRow's own doc comment below. */
  overrideWorkRow(rowId: string, workKind: NonNullable<TimelineRow["work_kind"]>, payload: Record<string, unknown>): void;
  rows(): TimelineRow[];
}

export function createTimelineRowBuilder(threadId: string): TimelineRowBuilder {
  const rowsById = new Map<string, TimelineRow>();
  const nowSeconds = Math.floor(Date.now() / 1000);
  let seq = 0;
  const nextSeq = (): number => {
    seq += 1;
    return seq;
  };

  function startRow(rowId: string, role: string, text: string, turnId: string | null): void {
    const existing = rowsById.get(rowId);
    if (existing) return; // mirrors sqlite's startTimelineRow ON CONFLICT DO NOTHING
    const s = nextSeq();
    rowsById.set(rowId, {
      id: rowId,
      thread_id: threadId,
      role,
      text,
      turn_id: turnId,
      source_seq_start: s,
      source_seq_end: s,
      created_at: nowSeconds,
      updated_at: nowSeconds,
      kind: "conversation",
      work_kind: null,
      payload: null,
    });
  }

  function appendRowText(rowId: string, role: string, deltaText: string, turnId: string | null): void {
    const existing = rowsById.get(rowId);
    const s = nextSeq();
    if (!existing) {
      rowsById.set(rowId, {
        id: rowId,
        thread_id: threadId,
        role,
        text: deltaText,
        turn_id: turnId,
        source_seq_start: s,
        source_seq_end: s,
        created_at: nowSeconds,
        updated_at: nowSeconds,
        kind: "conversation",
        work_kind: null,
        payload: null,
      });
      return;
    }
    existing.text += deltaText;
    existing.source_seq_end = s;
    existing.updated_at = nowSeconds;
  }

  function setRowText(rowId: string, role: string, text: string, turnId: string | null): void {
    const existing = rowsById.get(rowId);
    const s = nextSeq();
    if (!existing) {
      rowsById.set(rowId, {
        id: rowId,
        thread_id: threadId,
        role,
        text,
        turn_id: turnId,
        source_seq_start: s,
        source_seq_end: s,
        created_at: nowSeconds,
        updated_at: nowSeconds,
        kind: "conversation",
        work_kind: null,
        payload: null,
      });
      return;
    }
    existing.text = text;
    existing.turn_id = turnId;
    existing.source_seq_end = s;
    existing.updated_at = nowSeconds;
  }

  /** Mirrors sqlite's setWorkTimelineRow: a shallow merge-patch onto whatever
   * payload the row already carries, same as sqlite's json_patch. */
  function setWorkRow(
    rowId: string,
    workKind: NonNullable<TimelineRow["work_kind"]>,
    payload: Record<string, unknown>,
    turnId: string | null,
  ): void {
    const existing = rowsById.get(rowId);
    const s = nextSeq();
    if (!existing) {
      rowsById.set(rowId, {
        id: rowId,
        thread_id: threadId,
        role: "assistant",
        text: "",
        turn_id: turnId,
        source_seq_start: s,
        source_seq_end: s,
        created_at: nowSeconds,
        updated_at: nowSeconds,
        kind: "work",
        work_kind: workKind,
        payload: JSON.stringify(payload),
      });
      return;
    }
    const merged = { ...record(existing.payload === null ? {} : JSON.parse(existing.payload)), ...payload };
    existing.turn_id = turnId;
    existing.source_seq_end = s;
    existing.updated_at = nowSeconds;
    existing.kind = "work";
    existing.work_kind = workKind;
    existing.payload = JSON.stringify(merged);
  }

  /** A full payload/work_kind replacement for a row the caller already knows
   * exists — unlike setWorkRow's merge-patch. Used only by the
   * AskUserQuestion correction pass (claudeTranscriptToTimelineRows.ts):
   * that row was already created as a generic "tool" row by the normal
   * item lifecycle (bb's vendored tool-classification.ts does not know
   * AskUserQuestion is special), and needs its work_kind and payload
   * replaced wholesale, not merged (a stale `arguments`/`result` from the
   * generic-tool shape must not survive onto the question shape). No-op if
   * the row does not exist — the caller resolves rowId from the assembler's
   * own id map, which can miss (e.g. the call never got assembled, an old
   * settled id was reused) without that being an error worth surfacing here. */
  function overrideWorkRow(
    rowId: string,
    workKind: NonNullable<TimelineRow["work_kind"]>,
    payload: Record<string, unknown>,
  ): void {
    const existing = rowsById.get(rowId);
    if (!existing) return;
    existing.kind = "work";
    existing.work_kind = workKind;
    existing.payload = JSON.stringify(payload);
    existing.updated_at = nowSeconds;
  }

  function appendWorkRowOutput(rowId: string, deltaText: string): void {
    const existing = rowsById.get(rowId);
    if (!existing || existing.kind !== "work") return;
    const s = nextSeq();
    const payload = record(existing.payload === null ? {} : JSON.parse(existing.payload));
    payload.output = (typeof payload.output === "string" ? payload.output : "") + deltaText;
    existing.payload = JSON.stringify(payload);
    existing.source_seq_end = s;
    existing.updated_at = nowSeconds;
  }

  function applyItemLifecycle(params: Record<string, unknown>, completedAt: number | null): void {
    const item = record(params.item);
    const itemType = item.type as string;
    const rowId = `row_${item.id}`;
    const turnId = (params.turnId as string | null | undefined) ?? null;
    const role = ROW_ROLE_BY_ITEM_TYPE[itemType];
    if (role) {
      const text = itemType === "userMessage" || completedAt !== null ? itemText(item as never) : "";
      if (completedAt === null) startRow(rowId, role, text, turnId);
      else setRowText(rowId, role, text, turnId);
      return;
    }
    // workTimelineRow (engine.ts, shared with native codex/claude threads)
    // covers commandExecution/fileChange/mcpToolCall; fallbackWorkRow covers
    // the extra bb-unified item types (toolCall/delegation/backgroundTask)
    // that pipeline only this herdr/claude pipeline ever produces. Anything
    // neither recognizes (fileRead/search/reasoning/plan/…) is dropped.
    const workRow = workTimelineRow(item, completedAt) ?? fallbackWorkRow(item, completedAt);
    if (workRow) setWorkRow(rowId, workRow.workKind, workRow.payload, turnId);
  }

  function apply(notification: TimelineNotification): void {
    const { method, params } = notification;
    if (method === "item/started") {
      applyItemLifecycle(params, null);
      return;
    }
    if (method === "item/completed") {
      applyItemLifecycle(params, nowSeconds * 1000);
      return;
    }
    if (method === "item/agentMessage/delta") {
      const deltaText = (params.delta as string) || "";
      if (!deltaText) return;
      appendRowText(`row_${params.itemId}`, "assistant", deltaText, (params.turnId as string | null | undefined) ?? null);
      return;
    }
    if (method === "item/commandExecution/outputDelta" || method === "item/fileChange/outputDelta") {
      const deltaText = params.delta;
      if (typeof deltaText !== "string" || !deltaText) return;
      appendWorkRowOutput(`row_${params.itemId}`, deltaText);
      return;
    }
    if (method === "item/toolCall/progress") {
      const message = params.message;
      if (typeof message !== "string" || !message) return;
      appendWorkRowOutput(`row_${params.itemId}`, message);
      return;
    }
    if (
      method === "item/backgroundTask/progress"
      || method === "item/backgroundTask/completed"
      || method === "item/delegation/progress"
      || method === "item/delegation/completed"
    ) {
      // Thread-scoped: no turn to attach to, and the item is always the full
      // current snapshot (progress and completed alike), so an upsert by id
      // covers both without a separate open/close pairing.
      const item = record(params.item);
      const completedAt = method.endsWith("/completed") ? nowSeconds * 1000 : null;
      const workRow = fallbackWorkRow(item, completedAt);
      if (workRow) setWorkRow(`row_${item.id}`, workRow.workKind, workRow.payload, null);
      return;
    }
    // turn/started, turn/completed, and everything else (reasoning/plan
    // deltas, provider.*, thread.identity, contextWindow, usage, unhandled…)
    // carry no row of their own — same silent-drop engine.ts's own
    // updateTimelineRow already applies to any method it does not switch on.
  }

  function rows(): TimelineRow[] {
    return [...rowsById.values()].sort((a, b) => a.source_seq_start - b.source_seq_start);
  }

  return { apply, overrideWorkRow, rows };
}
