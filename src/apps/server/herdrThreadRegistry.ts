/**
 * In-memory mirror of Herdr's own agent list, shaped as vozen ThreadRow/
 * TimelineRow objects so engine.ts can merge it into the same list/show/
 * timeline/tell methods bbShim.ts and http.ts already call for real
 * (SQLite-backed) codex threads — no new API surface needed downstream.
 *
 * Nothing here is persisted: Herdr's own `agent list` is the source of
 * truth for which agents exist, so vozen never needs to reconcile a stale
 * database row against it. A vozen restart just re-polls current reality.
 */

import * as fs from "node:fs/promises";
import path from "node:path";
import {
  isUserQuestionPendingInteraction,
  type PendingInteraction,
  type PendingInteractionResolution,
} from "@bb/domain";
import type { ProjectRow, TimelineRow, ThreadRow } from "../../packages/db/sqlite.ts";
import { listHerdrAgents, readHerdrAgent, sendHerdrInput, sendHerdrPrompt } from "../../plugins/provider_herdr/client.ts";
import { HerdrEventClient, type HerdrPaneEvent } from "../../plugins/provider_herdr/herdrEventClient.ts";
import type { HerdrAgentSnapshot, HerdrAgentStatus } from "../../plugins/provider_herdr/schema.ts";
import {
  type ChatEntry,
  parseSessionLog,
  readLogTail,
  resolveSessionLogPath,
  type ToolActivity,
} from "../../plugins/provider_herdr/sessionLog.ts";
import { claudeTranscriptToTimelineRows } from "../../plugins/provider_herdr/claudeTranscriptToTimelineRows.ts";
import { claudeAskUserQuestionAnswers, claudeAskUserQuestionToBbQuestions } from "../../plugins/provider_herdr/askUserQuestion.ts";

const DEFAULT_POLL_INTERVAL_MS = 2000;
const TERMINAL_FALLBACK_LINES = 200;

// vozen's own thread.status vocabulary (packages/domain/models.ts's
// TURN_STATUS_TO_THREAD_STATUS neighbors this) — bbShim.ts's BB_STATUS map
// only recognizes these five keys, so anything else throws at render time.
const STATUS_TO_THREAD_STATUS: Record<HerdrAgentStatus, string> = {
  idle: "idle",
  working: "running",
  blocked: "running", // hasPendingInteraction() carries the "needs you" signal
  done: "idle",
  unknown: "idle",
};

export const HERDR_THREAD_ID_PREFIX = "herdr_";
export const HERDR_VIRTUAL_PROJECT_ID_PREFIX = "herdr_proj_";

export function toHerdrThreadId(paneId: string): string {
  return `${HERDR_THREAD_ID_PREFIX}${paneId.replaceAll(":", "_")}`;
}

/** Sidebar title from the pane's terminal title. The title channel is
 * whatever the pane's process last wrote, so it can carry garbage that makes
 * a useless label — error dumps with JSON payloads, bare URLs — which fall
 * back to the agent name instead. */
export function displayTitle(snapshot: HerdrAgentSnapshot): string {
  const raw = snapshot.terminalTitle.trim();
  if (!raw || raw.includes('{"') || /^https?:\/\/\S*$/.test(raw)) return snapshot.agent;
  return raw;
}

/** Groups Herdr threads the same way herdr-mobile-relay's own
 * internal/coordinator/poller.go does: `project = filepath.Base(pane.Cwd)`,
 * recomputed fresh every poll — no registry to match against, so there is
 * nothing that can go stale when a directory moves (unlike matching against
 * vozen's own persisted `projects` table, which this replaced). */
export function toHerdrVirtualProjectId(cwd: string): string {
  const base = path.basename(cwd);
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${HERDR_VIRTUAL_PROJECT_ID_PREFIX}${slug || "root"}`;
}

export function herdrVirtualProjectName(cwd: string): string {
  return path.basename(cwd) || cwd;
}

type ClaudeToolWorkKind = "command" | "file-change" | "tool" | "question" | "delegation";

/** Claude Code's own built-in tool names — MCP tools (named
 * `mcp__server__tool`) and anything else fall through to the generic "tool"
 * card, matching bbShim.ts's rowToBbRow() work_kind vocabulary.
 * AskUserQuestion gets its own bucket: bb never treats "ask the user to pick
 * an option" as a generic tool call — it's the same question/answer shape
 * the blocked-state PendingInteraction banner already uses (see
 * pendingInteractions() below), just also surfaced in the timeline. */
function classifyClaudeTool(name: string): ClaudeToolWorkKind {
  if (name === "AskUserQuestion") return "question";
  if (name === "Bash" || name === "BashOutput" || name === "KillShell") return "command";
  if (name === "Write" || name === "Edit" || name === "MultiEdit" || name === "NotebookEdit") return "file-change";
  // Claude Code's real bridge (plugins/provider-claude-code/src/tool-
  // classification.ts) treats both names as sub-agent delegation.
  if (name === "Agent" || name === "Task") return "delegation";
  return "tool";
}

// claudeAskUserQuestionToBbQuestions/claudeAskUserQuestionAnswers moved to
// askUserQuestion.ts, shared with claudeTranscriptToTimelineRows.ts's own
// AskUserQuestion correction pass (see that file's header comment for why
// it needs a copy of this logic too: bb's vendored tool-classification.ts
// has no equivalent).

/** A crude but honest diff: all of old_string removed, all of new_string
 * added — no line-alignment, but rowToBbRow()'s diffStats just counts
 * +/- prefixed lines, so this renders correctly either way. */
function claudeEditDiff(input: Record<string, unknown>): string | null {
  if (typeof input.old_string !== "string" || typeof input.new_string !== "string") return null;
  const removed = input.old_string.split("\n").map((line) => `-${line}`);
  const added = input.new_string.split("\n").map((line) => `+${line}`);
  return [...removed, ...added].join("\n");
}

/** Shapes one ToolActivity into the JSON payload bbShim.ts's rowToBbRow()
 * expects for the given work_kind — see its command/tool/file-change
 * branches for the exact field contract. */
function toolActivityPayload(tool: ToolActivity, workKind: ClaudeToolWorkKind): Record<string, unknown> {
  const status = tool.error ? "error" : "completed";
  const input = (tool.input && typeof tool.input === "object" ? tool.input : {}) as Record<string, unknown>;
  if (workKind === "question") {
    const lifecycle = tool.output === null ? "pending" : tool.error ? "interrupted" : "answered";
    const questions = claudeAskUserQuestionToBbQuestions(tool.id, input);
    return {
      status: lifecycle === "pending" ? "pending" : lifecycle === "interrupted" ? "interrupted" : "completed",
      interactionId: tool.id,
      lifecycle,
      questions,
      answers: claudeAskUserQuestionAnswers(tool.resultMetadata, questions),
      statusReason: tool.error ? tool.output : null,
    };
  }
  if (workKind === "delegation") {
    // ponytail: bb's real bridge nests the sub-agent's own messages as
    // `childRows` (matched by `parent_tool_use_id` in the session log — see
    // plugins/provider-claude-code/src/tool-classification.ts). Every local
    // session log on this machine only ever uses this harness's own async
    // Agent/fork dispatcher, never Claude Code's native synchronous Task
    // tool, so no real `parent_tool_use_id`-tagged record has ever been
    // observed here to verify that grouping against — shipping it unverified
    // risked silently misattributing messages, worse than shipping none.
    // childRows stays empty until this can be checked against a real
    // native-Task-tool transcript; status/description/output below are real.
    return {
      callId: tool.id,
      status: tool.output === null ? "pending" : status,
      toolName: tool.name,
      childRef: tool.id,
      background: input.run_in_background === true,
      subagentType: typeof input.subagent_type === "string" ? input.subagent_type : null,
      description: typeof input.description === "string"
        ? input.description
        : typeof input.prompt === "string" ? input.prompt.split("\n")[0] : tool.name,
      output: tool.output ?? "",
      completedAt: tool.output === null ? null : Date.now(),
      childRows: [],
    };
  }
  if (workKind === "command") {
    return {
      callId: tool.id,
      status,
      command: typeof input.command === "string" ? input.command : tool.name,
      cwd: null,
      output: tool.output ?? "",
    };
  }
  if (workKind === "file-change") {
    return {
      callId: tool.id,
      status,
      changes: [{
        path: typeof input.file_path === "string" ? input.file_path : "",
        kind: "edit",
        diff: claudeEditDiff(input),
      }],
    };
  }
  return {
    callId: tool.id,
    status,
    tool: tool.name,
    arguments: input,
    output: tool.output ?? "",
  };
}

interface HerdrThreadState {
  paneId: string;
  snapshot: HerdrAgentSnapshot;
  createdAt: number; // epoch seconds, first time this pane was observed
  lastActivityAt: number; // epoch seconds, last time status/revision actually changed
  entries: ChatEntry[];
  /**
   * The claude-agent pipeline's own output (delta-translation.ts +
   * delta-assembler.ts + timelineRowBuilder.ts — see
   * claudeTranscriptToTimelineRows.ts), recomputed from the full session log
   * on every refresh. `null` means "use `entries` instead": either this
   * thread's agent kind isn't claude, or the claude pipeline had nothing to
   * work with yet (no session log resolved) — `entries`' terminal-snapshot
   * fallback covers both.
   */
  claudeTimelineRows: TimelineRow[] | null;
  /** `mtimeMs:size` of the session log the last refresh parsed — a stat()
   * match means the log hasn't changed and the (potentially tens-of-MB)
   * re-read + full re-parse can be skipped outright. Null before the first
   * successful parse or when content came from the terminal fallback. */
  parsedLogStat: string | null;
}

/** Mirrors sessionLog.ts's own (unexported) normalizedKind's claude spelling
 * check — only Claude Code sessions get the new delta-translation pipeline;
 * codex/qoder keep the existing hand-written sessionLog.ts parsing. */
function isClaudeAgentKind(agent: string): boolean {
  const value = agent.toLowerCase().replace(/[-_ ]/g, "");
  return value === "claude" || value === "claudecode";
}

type ChangeListener = (threadId: string, changes: string[]) => void;

export interface HerdrThreadRegistryOptions {
  pollIntervalMs?: number;
  bin?: string[];
  /** Passed to every herdr CLI invocation's child process — tests only
   * (production always inherits process.env by omitting this). */
  env?: Record<string, string | undefined>;
  /** Override for resolveSessionLogPath's home-directory root — tests only. */
  home?: string;
  /** Test-only: a pre-configured HerdrEventClient (e.g. pointed at a fake
   * socket) instead of the default one resolved from HERDR_SOCKET_PATH. */
  eventClient?: HerdrEventClient;
}

export class HerdrThreadRegistry {
  private readonly threads = new Map<string, HerdrThreadState>();
  private readonly listeners: ChangeListener[] = [];
  private readonly pollIntervalMs: number;
  private readonly bin?: string[];
  private env?: Record<string, string | undefined>;
  private readonly home?: string;
  private readonly eventClient: HerdrEventClient;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(options: HerdrThreadRegistryOptions = {}) {
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.bin = options.bin;
    this.env = options.env;
    this.home = options.home;
    // The event client only accelerates refreshing panes pollOnce() already
    // knows about — it never does topology discovery itself, and it fails
    // (and keeps retrying with its own backoff) silently if herdr's socket
    // doesn't exist or doesn't support subscriptions, so plain CLI polling
    // keeps working unmodified either way.
    this.eventClient = options.eventClient ?? new HerdrEventClient({ env: options.env });
    this.eventClient.onEvent((event) => this.handlePaneEvent(event));
  }

  /** Updates the env passed to future CLI calls — tests only, for driving
   * successive pollOnce() calls through different fixture configs without
   * touching the shared global process.env. */
  setEnv(env: Record<string, string | undefined>): void {
    this.env = env;
  }

  private cliOptions() {
    return { bin: this.bin, env: this.env };
  }

  onChange(listener: ChangeListener): void {
    this.listeners.push(listener);
  }

  private emit(threadId: string, changes: string[]): void {
    for (const listener of this.listeners) listener(threadId, changes);
  }

  start(): void {
    if (this.timer) return;
    void this.pollOnce();
    this.timer = setInterval(() => void this.pollOnce(), this.pollIntervalMs);
    this.eventClient.start();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.eventClient.stop();
  }

  /** herdr's own push channel (see herdrEventClient.ts) — a pane_updated/
   * pane_agent_detected for a pane pollOnce() already tracks refreshes it
   * immediately instead of waiting up to pollIntervalMs. A pane we haven't
   * discovered yet is left alone: topology discovery is CLI-poll-only, by
   * design (this channel has no "list everything" query, only per-event
   * pushes). pane_exited removes it right away; if the next CLI poll still
   * lists the same paneId (the two channels aren't guaranteed consistent),
   * pollOnce() will just see it as a fresh thread-created — an acceptable
   * one-tick flicker, not worth a dedup/debounce mechanism. */
  private handlePaneEvent(event: HerdrPaneEvent): void {
    const threadId = toHerdrThreadId(event.paneId);
    if (event.type === "pane_exited") {
      if (this.threads.delete(threadId)) this.emit(threadId, ["thread-deleted"]);
      return;
    }
    if (!this.threads.has(threadId)) return;
    void this.refreshIfChanged(threadId);
  }

  /** Cheap change fingerprint standing in for a full deep-compare: row ids
   * are deterministic (transcript-position-keyed) and a transcript only ever
   * appends, so (count, last id, last seq/text) moves whenever content does —
   * without JSON.stringify-ing tens of MB of rows on every poll tick. */
  private contentFingerprint(state: HerdrThreadState): string {
    const rows = state.claudeTimelineRows;
    if (rows) {
      const last = rows[rows.length - 1];
      return `rows:${rows.length}:${last?.id ?? ""}:${last?.source_seq_end ?? ""}`;
    }
    const last = state.entries[state.entries.length - 1];
    return `entries:${state.entries.length}:${last?.id ?? ""}:${last?.text ?? ""}`;
  }

  /** Re-reads a known thread's content and emits "events-appended" only if
   * something actually changed — shared by pollOnce()'s active-state branch
   * and handlePaneEvent()'s event-driven fast path. */
  private async refreshIfChanged(threadId: string): Promise<void> {
    const state = this.threads.get(threadId);
    if (!state) return;
    const before = this.contentFingerprint(state);
    await this.refreshEntries(threadId);
    if (this.contentFingerprint(state) !== before) {
      this.emit(threadId, ["events-appended"]);
    }
  }

  /** One discovery pass: exposed directly (not just via the interval) so
   * tests can drive it deterministically instead of waiting on real time. */
  async pollOnce(): Promise<void> {
    let agents: HerdrAgentSnapshot[];
    try {
      agents = await listHerdrAgents(this.cliOptions());
    } catch {
      return; // herdr not installed, not running, or transient CLI failure — keep prior state, try again next tick
    }

    const seen = new Set<string>();
    for (const agent of agents) {
      const threadId = toHerdrThreadId(agent.paneId);
      seen.add(threadId);
      const prior = this.threads.get(threadId);
      const isNew = !prior;
      const statusChanged = !prior
        || prior.snapshot.stateChangeSeq !== agent.stateChangeSeq
        || prior.snapshot.revision !== agent.revision;
      const now = Math.floor(Date.now() / 1000);
      const state: HerdrThreadState = {
        paneId: agent.paneId,
        snapshot: agent,
        createdAt: prior?.createdAt ?? now,
        lastActivityAt: isNew || statusChanged ? now : prior!.lastActivityAt,
        entries: prior?.entries ?? [],
        claudeTimelineRows: prior?.claudeTimelineRows ?? null,
        parsedLogStat: prior?.parsedLogStat ?? null,
      };
      this.threads.set(threadId, state);
      if (isNew || statusChanged) {
        await this.refreshEntries(threadId);
        const changes = isNew ? ["thread-created"] : ["status-changed", "events-appended"];
        if (!isNew && (agent.agentStatus === "blocked" || prior.snapshot.agentStatus === "blocked")) {
          changes.push("interactions-changed");
        }
        this.emit(threadId, changes);
      } else if (agent.agentStatus === "working" || agent.agentStatus === "blocked") {
        // Herdr's own stateChangeSeq/revision can stall for seconds during
        // continuous activity (observed empirically) — herdr-mobile-relay
        // never gates content reads on that signal either, it re-reads the
        // session log on every request regardless. Same fix here: while the
        // agent is active, re-read every poll instead of waiting for a
        // signal that may not come. The event client (handlePaneEvent) also
        // triggers this same refresh as soon as herdr pushes a pane_updated,
        // so in practice this poll-driven path is the fallback for whenever
        // that channel is down/unsupported, not the only path.
        // ponytail: unthrottled — a tail-read + parse (or, for a kind with
        // no session log, one more `herdr agent read`) every 2s for the
        // duration of "working". Add a skip-every-other-poll throttle if
        // this shows up in practice, not preemptively.
        await this.refreshIfChanged(threadId);
      }
    }

    for (const threadId of [...this.threads.keys()]) {
      if (!seen.has(threadId)) {
        this.threads.delete(threadId);
        this.emit(threadId, ["thread-deleted"]);
      }
    }
  }

  private async refreshEntries(threadId: string): Promise<void> {
    const state = this.threads.get(threadId);
    if (!state) return;
    const { snapshot } = state;

    if (snapshot.sessionId) {
      const logPath = await resolveSessionLogPath(snapshot.agent, snapshot.sessionId, this.home);
      if (logPath) {
        // Session logs are tens of MB and this runs every poll tick while
        // the agent is active — an unchanged mtime+size means the previous
        // parse is still exact, so skip the whole re-read + re-parse.
        let logStat: string | null = null;
        try {
          const stats = await fs.stat(logPath);
          logStat = `${stats.mtimeMs}:${stats.size}`;
        } catch {
          // stat failing is fine — fall through to the read paths below,
          // which have their own fallbacks.
        }
        if (logStat !== null && logStat === state.parsedLogStat) return;
        if (isClaudeAgentKind(snapshot.agent)) {
          try {
            // Full re-run every refresh (translator + assembler + builder are
            // all fresh instances) — no incremental state, matching herdr
            // threads' own "never persisted, recompute on demand" design.
            state.claudeTimelineRows = await claudeTranscriptToTimelineRows(logPath, threadId);
            state.parsedLogStat = logStat;
            return;
          } catch {
            // Falls through to the hand-written sessionLog.ts parse below as
            // a safety net (e.g. a transcript convertClaudeTranscript can't
            // make sense of) rather than losing the thread's content outright.
            state.claudeTimelineRows = null;
          }
        }
        try {
          const tail = await readLogTail(logPath);
          state.entries = parseSessionLog(snapshot.agent, tail);
          state.claudeTimelineRows = null;
          state.parsedLogStat = logStat;
          return;
        } catch {
          // fall through to the terminal fallback below
        }
      }
    }

    // Unsupported agent kind, or no resolvable session log yet: fall back to
    // a single scrolling snapshot of the raw terminal (accepted tradeoff —
    // no message-boundary parsing for kinds Claude/Codex/Qoder didn't cover).
    state.claudeTimelineRows = null;
    state.parsedLogStat = null;
    try {
      const text = await readHerdrAgent(state.paneId, TERMINAL_FALLBACK_LINES, this.cliOptions());
      state.entries = [{ id: `${threadId}-terminal`, role: "assistant", text: text.trimEnd(), timestamp: null }];
    } catch {
      // leave whatever entries we already had
    }
  }

  hasThread(threadId: string): boolean {
    return this.threads.has(threadId);
  }

  listThreadRows(): ThreadRow[] {
    return [...this.threads.keys()].map((id) => this.getThreadRow(id)).filter((row): row is ThreadRow => row !== null);
  }

  getThreadRow(threadId: string): ThreadRow | null {
    const state = this.threads.get(threadId);
    if (!state) return null;
    // foregroundCwd tracks where the pane actually is right now; cwd is
    // frozen at whatever directory the pane launched in and does not follow
    // an in-session `cd` (confirmed empirically: this thread's own cwd stayed
    // put after /cd while foregroundCwd updated) — the virtual project below
    // needs the live value to follow a cd.
    const cwd = state.snapshot.foregroundCwd ?? state.snapshot.cwd;
    return {
      id: threadId,
      provider_thread_id: state.paneId,
      project_id: toHerdrVirtualProjectId(cwd),
      cwd,
      title: displayTitle(state.snapshot),
      status: STATUS_TO_THREAD_STATUS[state.snapshot.agentStatus],
      created_at: state.createdAt,
      updated_at: state.lastActivityAt,
      archived_at: null,
      agent_kind: state.snapshot.agent,
    };
  }

  /** Virtual "projects" for the sidebar — one per distinct directory
   * basename currently in play, recomputed from live state every call (see
   * toHerdrVirtualProjectId's doc comment). Never persisted, so a moved
   * directory just produces a differently-named group next poll instead of
   * an orphaned stale one. */
  listVirtualProjects(): ProjectRow[] {
    const byId = new Map<string, ProjectRow>();
    for (const state of this.threads.values()) {
      const cwd = state.snapshot.foregroundCwd ?? state.snapshot.cwd;
      const id = toHerdrVirtualProjectId(cwd);
      if (!byId.has(id)) {
        byId.set(id, { id, name: herdrVirtualProjectName(cwd), path: cwd, created_at: 0, updated_at: 0 });
      }
    }
    return [...byId.values()];
  }

  hasPendingInteraction(threadId: string): boolean {
    return this.threads.get(threadId)?.snapshot.agentStatus === "blocked";
  }

  async pendingInteractions(threadId: string): Promise<PendingInteraction[]> {
    const state = this.threads.get(threadId);
    if (!state || state.snapshot.agentStatus !== "blocked") return [];

    let prompt = `Herdr agent in pane ${state.paneId} is waiting for input.`;
    try {
      const screen = (await readHerdrAgent(state.paneId, 40, this.cliOptions())).trim();
      if (screen) prompt = screen.split(/\r?\n/).slice(-30).join("\n");
    } catch {}

    const requestId = String(state.snapshot.stateChangeSeq);
    return [{
      id: `pi_${threadId}_${requestId}`,
      threadId,
      turnId: `turn_${threadId}_${requestId}`,
      providerId: state.snapshot.agent,
      providerThreadId: state.snapshot.sessionId ?? state.paneId,
      providerRequestId: requestId,
      status: "pending",
      statusReason: null,
      createdAt: state.lastActivityAt * 1000,
      resolvedAt: null,
      payload: {
        kind: "user_question",
        questions: [{
          id: "herdr_input",
          shortLabel: "Herdr input",
          prompt,
          multiSelect: false,
          options: [
            { value: "enter", label: "Enter", description: "Confirm the selected choice." },
            { value: "up", label: "Up", description: "Move to the previous choice." },
            { value: "down", label: "Down", description: "Move to the next choice." },
            { value: "esc", label: "Esc", description: "Cancel or go back." },
          ],
          allowFreeText: true,
        }],
      },
      resolution: null,
    }];
  }

  async resolveInteraction(
    threadId: string,
    interactionId: string,
    resolution: PendingInteractionResolution,
  ): Promise<PendingInteraction> {
    const state = this.threads.get(threadId);
    const interaction = (await this.pendingInteractions(threadId))[0];
    if (
      !state ||
      !interaction ||
      interaction.id !== interactionId ||
      !isUserQuestionPendingInteraction(interaction)
    ) {
      throw new Error(`No pending interaction ${interactionId} on thread ${threadId}`);
    }
    if (!("kind" in resolution) || resolution.kind !== "user_answer") {
      throw new Error("Herdr interactions require a user answer");
    }

    const answer = resolution.answers.herdr_input;
    if (answer?.freeText) {
      await sendHerdrInput(state.paneId, { text: answer.freeText }, this.cliOptions());
    } else {
      const key = answer?.selected[0];
      if (key !== "enter" && key !== "up" && key !== "down" && key !== "esc") {
        throw new Error("Herdr input must be text or Enter/Up/Down/Esc");
      }
      await sendHerdrInput(state.paneId, { key }, this.cliOptions());
    }
    this.emit(threadId, ["interactions-changed"]);
    return { ...interaction, status: "resolving", resolution };
  }

  timelineRows(threadId: string): TimelineRow[] {
    const state = this.threads.get(threadId);
    if (!state) return [];
    if (state.claudeTimelineRows !== null) return state.claudeTimelineRows;
    const rows: TimelineRow[] = [];
    let seq = 0;
    for (const entry of state.entries) {
      const ts = entry.timestamp ? Math.floor(new Date(entry.timestamp).getTime() / 1000) : state.createdAt;
      const createdAt = Number.isFinite(ts) ? ts : state.createdAt;
      if (entry.text) {
        seq += 1;
        rows.push({
          id: entry.id,
          thread_id: threadId,
          role: entry.role,
          text: entry.text,
          turn_id: null,
          source_seq_start: seq,
          source_seq_end: seq,
          created_at: createdAt,
          updated_at: createdAt,
          kind: "conversation",
          work_kind: null,
          payload: null,
        });
      }
      for (const tool of entry.tools ?? []) {
        seq += 1;
        const workKind = classifyClaudeTool(tool.name);
        rows.push({
          id: `${entry.id}-tool-${tool.id}`,
          thread_id: threadId,
          role: entry.role,
          text: "",
          turn_id: null,
          source_seq_start: seq,
          source_seq_end: seq,
          created_at: createdAt,
          updated_at: createdAt,
          kind: "work",
          work_kind: workKind,
          payload: JSON.stringify(toolActivityPayload(tool, workKind)),
        });
      }
    }
    return rows;
  }

  threadMaxSeq(threadId: string): number | null {
    return this.threads.has(threadId) ? this.timelineRows(threadId).length : null;
  }

  async send(threadId: string, text: string): Promise<void> {
    const state = this.threads.get(threadId);
    if (!state) throw new Error(`Unknown Herdr thread ${threadId}`);
    await sendHerdrPrompt(state.paneId, text, this.cliOptions());
  }

  /** Interrupt the agent's current turn by synthesizing an Escape keypress
   * in its pane — the only interrupt channel a TUI agent exposes. Leaves
   * the pane and session alive, unlike closing the pane. */
  async interrupt(threadId: string): Promise<void> {
    const state = this.threads.get(threadId);
    if (!state) throw new Error(`Unknown Herdr thread ${threadId}`);
    await sendHerdrInput(state.paneId, { key: "esc" }, this.cliOptions());
  }
}
