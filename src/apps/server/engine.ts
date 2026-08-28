import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Database } from "bun:sqlite";
import type { PendingInteraction, PendingInteractionResolution } from "@bb/domain";
import * as sqlite from "../../packages/db/sqlite.ts";
import type { EventRow, ThreadRow, TimelineRow } from "../../packages/db/sqlite.ts";
import {
  CODEX_ITEM_STATUS_TO_WORK_STATUS,
  ROW_ITEM_TYPES,
  ROW_ROLE_BY_ITEM_TYPE,
  TURN_STATUS_TO_THREAD_STATUS,
  itemText,
} from "../../packages/domain/models.ts";
import { CodexAppServerClient } from "../../plugins/provider_codex/client.ts";
import { ClaudeAppServerClient } from "../../plugins/provider_claude/client.ts";
import {
  HERDR_THREAD_ID_PREFIX,
  HERDR_VIRTUAL_PROJECT_ID_PREFIX,
  type HerdrThreadRegistry,
} from "./herdrThreadRegistry.ts";

export const DEFAULT_WORKSPACE = path.join(os.homedir(), "vozen-workspace");

// codex's own decision vocabulary (spec/protocol-codex.md); vozen supports the
// plain accept/decline path and skips the execpolicy/network-amendment variants.
const COMMAND_AND_FILE_DECISIONS = new Set(["accept", "acceptForSession", "decline", "cancel"]);

// bb's own assembler coalesces streamed text into a 100ms trailing-edge
// window before it ever becomes a persisted event (packages/provider-bridge-
// protocol/src/assembler/delta-assembler.ts, textDeltaFlushMs).
const TEXT_DELTA_FLUSH_MS = 100;

const TERMINAL_STATUSES = new Set(["idle", "failed", "interrupted"]);

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizedFileChanges(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.map((rawChange) => {
    const change = record(rawChange);
    const rawKind = change.kind;
    const kind = typeof rawKind === "string" ? rawKind : record(rawKind).type;
    return {
      path: typeof change.path === "string" ? change.path : "",
      kind: typeof kind === "string" ? kind : null,
      movePath: typeof change.movePath === "string"
        ? change.movePath
        : typeof record(rawKind).move_path === "string" ? record(rawKind).move_path : null,
      diff: typeof change.diff === "string" ? change.diff : null,
    };
  });
}

function outputText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return null;
  return JSON.stringify(value);
}

export function workTimelineRow(item: Record<string, unknown>, completedAt: number | null): {
  workKind: NonNullable<TimelineRow["work_kind"]>;
  payload: Record<string, unknown>;
} | null {
  const status = CODEX_ITEM_STATUS_TO_WORK_STATUS[String(item.status)]
    ?? (completedAt === null ? "pending" : "completed");
  const base = { callId: String(item.id), status };

  if (item.type === "commandExecution") {
    const aggregatedOutput = typeof item.aggregatedOutput === "string" ? item.aggregatedOutput : null;
    return {
      workKind: "command",
      payload: {
        ...base,
        command: typeof item.command === "string" ? item.command : "",
        cwd: typeof item.cwd === "string" ? item.cwd : null,
        aggregatedOutput,
        exitCode: typeof item.exitCode === "number" ? item.exitCode : null,
        durationMs: typeof item.durationMs === "number" ? item.durationMs : null,
        completedAt,
        ...(aggregatedOutput === null ? {} : { output: aggregatedOutput }),
      },
    };
  }

  if (item.type === "fileChange") {
    return {
      workKind: "file-change",
      payload: { ...base, changes: normalizedFileChanges(item.changes) },
    };
  }

  if (item.type === "mcpToolCall") {
    const result = item.result ?? null;
    const error = item.error ?? null;
    const finalOutput = outputText(result) ?? outputText(record(error).message) ?? outputText(error);
    return {
      workKind: "tool",
      payload: {
        ...base,
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

  return null;
}

function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function isDeltaMethod(method: string): boolean {
  return method.endsWith("Delta") || method.endsWith("/delta");
}

export interface WsSocket {
  send(data: string): void;
}

interface PendingApproval {
  method: string;
  params: Record<string, unknown>;
  id: number | string;
}

interface PendingDelta {
  params: Record<string, unknown>;
  text: string;
}

export class ThreadSession {
  client: CodexAppServerClient | ClaudeAppServerClient | null = null;
  providerThreadId: string | null = null;
  currentTurnId: string | null = null;
  pendingApprovals = new Map<string, PendingApproval>();
  pendingDeltas = new Map<string, PendingDelta>();
  deltaLastEmit = new Map<string, number>();

  constructor(public readonly threadId: string) {}
}

/** A single global notify-all wait point, standing in for Python's
 * threading.Condition — used by wait() to wake up as soon as any thread's
 * status changes, without polling faster than necessary. */
class AsyncCondition {
  private waiters: (() => void)[] = [];

  notifyAll(): void {
    const toNotify = this.waiters;
    this.waiters = [];
    for (const fn of toNotify) fn();
  }

  wait(timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, timeoutMs);
      this.waiters.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}

export class ThreadManager {
  readonly db: Database;
  private readonly sessions = new Map<string, ThreadSession>();
  private readonly condition = new AsyncCondition();
  private readonly wsSubscriptions = new Map<WsSocket, Set<string>>();
  private herdrRegistry: HerdrThreadRegistry | null = null;

  constructor(dbPath: string) {
    mkdirSync(DEFAULT_WORKSPACE, { recursive: true });
    this.db = sqlite.connect(dbPath);
  }

  /** Wires a HerdrThreadRegistry in after construction (main.ts builds it
   * separately so the registry's onChange listener can call back into this
   * instance's broadcastChanged). Herdr threads are then merged into
   * list/show/timeline/tell alongside real codex threads, with no changes
   * needed in bbShim.ts or http.ts. */
  attachHerdrRegistry(registry: HerdrThreadRegistry): void {
    this.herdrRegistry = registry;
    registry.onChange((threadId, changes) => this.broadcastChanged("thread", threadId, changes));
  }

  private isHerdrThread(threadId: string): boolean {
    return threadId.startsWith(HERDR_THREAD_ID_PREFIX);
  }

  private isHerdrVirtualProject(projectId: string): boolean {
    return projectId.startsWith(HERDR_VIRTUAL_PROJECT_ID_PREFIX);
  }

  private herdrThreadRows(): ThreadRow[] {
    const projectsByPath = new Map(
      sqlite.listProjects(this.db).map((project) => [path.resolve(project.path), project.id]),
    );
    return (this.herdrRegistry?.listThreadRows() ?? []).map((row) => {
      const projectId = projectsByPath.get(path.resolve(row.cwd));
      return projectId ? { ...row, project_id: projectId } : row;
    });
  }

  registerWsClient(sock: WsSocket): void {
    this.wsSubscriptions.set(sock, new Set());
  }

  unregisterWsClient(sock: WsSocket): void {
    this.wsSubscriptions.delete(sock);
  }

  subscribe(sock: WsSocket, key: string): void {
    this.wsSubscriptions.get(sock)?.add(key);
  }

  unsubscribe(sock: WsSocket, key: string): void {
    this.wsSubscriptions.get(sock)?.delete(key);
  }

  /** bb's frontend treats a `changed` message as a cache-invalidation
   * signal, not a data carrier — it just triggers a REST refetch. Only sent
   * to sockets subscribed to this entity's list or detail key (bb's
   * hub.ts `subscriptionKeysForMessage`), not broadcast to every connected
   * socket. */
  broadcastChanged(entity: string, entityId: string | null, changes: string[]): void {
    const listKey = `${entity}-list`;
    const keys = entityId ? new Set([listKey, `${entity}-detail:${entityId}`]) : new Set([listKey]);
    const message = JSON.stringify({ type: "changed", entity, id: entityId, changes });
    const dead: WsSocket[] = [];
    for (const [sock, subs] of this.wsSubscriptions) {
      if (![...subs].some((k) => keys.has(k))) continue;
      try {
        sock.send(message);
      } catch {
        dead.push(sock);
      }
    }
    for (const sock of dead) this.wsSubscriptions.delete(sock);
    if (entity === "thread" && entityId) {
      const waiters = this.threadChangeWaiters.get(entityId);
      if (waiters) {
        this.threadChangeWaiters.delete(entityId);
        for (const wake of waiters) wake();
      }
    }
  }

  private readonly threadChangeWaiters = new Map<string, Set<() => void>>();

  /** Resolves on the next broadcastChanged for this thread, or after
   * timeoutMs — lets long-poll consumers (the CLI's SSE events route) sleep
   * on the push signal instead of re-querying sqlite on a fixed tick. */
  waitForThreadChange(threadId: string, timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      const waiters = this.threadChangeWaiters.get(threadId) ?? new Set();
      this.threadChangeWaiters.set(threadId, waiters);
      const timer = setTimeout(() => {
        waiters.delete(wake);
        resolve();
      }, timeoutMs);
      const wake = () => {
        clearTimeout(timer);
        resolve();
      };
      waiters.add(wake);
    });
  }

  spawn(
    prompt: string, title?: string | null, cwd?: string | null, approvalPolicy = "never",
    projectId: string | null = null, providerId = "codex",
  ): ThreadRow {
    const threadId = newId("thr");
    // A project's own directory takes precedence over an explicit cwd —
    // spawning "in project X" means X's directory, not wherever the caller
    // happened to pass.
    const project = projectId ? sqlite.getProject(this.db, projectId) : null;
    if (projectId && !project) throw new Error(`Unknown project ${projectId}`);
    const resolvedCwd = project?.path || cwd || DEFAULT_WORKSPACE;
    const resolvedTitle = title || prompt.slice(0, 60);
    const now = Math.floor(Date.now() / 1000);
    sqlite.insertThread(
      this.db, threadId, resolvedCwd, resolvedTitle, "starting", now, projectId,
      providerId === "codex" ? null : providerId,
    );
    const thread = sqlite.getThread(this.db, threadId)!;

    const session = new ThreadSession(threadId);
    this.sessions.set(threadId, session);

    void this.runThreadStart(session, resolvedCwd, prompt, approvalPolicy, providerId);
    this.broadcastChanged("thread", threadId, ["thread-created"]);
    if (projectId) this.broadcastChanged("project", projectId, ["thread-created"]);
    return thread;
  }

  createProject(name: string, dirPath: string): sqlite.ProjectRow {
    const id = newId("proj");
    const now = Math.floor(Date.now() / 1000);
    sqlite.insertProject(this.db, id, name, dirPath, now);
    const project = sqlite.getProject(this.db, id)!;
    this.broadcastChanged("project", null, ["project-created"]);
    return project;
  }

  listProjects(): sqlite.ProjectRow[] {
    const projects = sqlite.listProjects(this.db);
    const projectPaths = new Set(projects.map((project) => path.resolve(project.path)));
    const virtualProjects = (this.herdrRegistry?.listVirtualProjects() ?? [])
      .filter((project) => !projectPaths.has(path.resolve(project.path)));
    return [...projects, ...virtualProjects];
  }

  getProject(id: string): sqlite.ProjectRow | null {
    if (this.isHerdrVirtualProject(id)) {
      return this.herdrRegistry?.listVirtualProjects().find((p) => p.id === id) ?? null;
    }
    return sqlite.getProject(this.db, id);
  }

  deleteProject(id: string): void {
    if (!sqlite.getProject(this.db, id)) throw new Error(`Unknown project ${id}`);
    sqlite.deleteProject(this.db, id);
    this.broadcastChanged("project", id, ["project-deleted"]);
  }

  listThreadsByProject(projectId: string | null): ThreadRow[] {
    return [
      ...sqlite.listThreadsByProject(this.db, projectId),
      ...this.herdrThreadRows().filter((row) => row.project_id === projectId),
    ];
  }

  private async runThreadStart(
    session: ThreadSession, cwd: string, prompt: string, approvalPolicy: string, providerId = "codex",
  ): Promise<void> {
    const threadId = session.threadId;
    try {
      const client = providerId === "claude"
        ? new ClaudeAppServerClient(
          (method, params) => this.onNotification(threadId, method, params as Record<string, unknown>),
          undefined,
          () => this.onProcessExit(threadId),
        )
        : new CodexAppServerClient(
          (method, params) => this.onNotification(threadId, method, params as Record<string, unknown>),
          (method, params, requestId) => this.onApprovalRequest(threadId, method, params as Record<string, unknown>, requestId),
          () => this.onProcessExit(threadId),
        );
      session.client = client;
      await client.initialize();
      const providerThreadId = await client.threadStart(cwd, approvalPolicy);
      session.providerThreadId = providerThreadId;
      sqlite.setProviderThreadId(this.db, threadId, providerThreadId, Math.floor(Date.now() / 1000));
      await client.turnStart(providerThreadId, prompt, approvalPolicy);
    } catch (error) {
      this.fail(threadId, error instanceof Error ? error.message : String(error));
    }
  }

  private fail(threadId: string, message: string): void {
    const session = this.sessions.get(threadId);
    if (session) this.flushPendingDeltas(session, threadId);
    const now = Math.floor(Date.now() / 1000);
    sqlite.appendEvent(this.db, threadId, "error", { threadId, error: { message } }, now);
    sqlite.setThreadStatus(this.db, threadId, "failed", now);
    this.condition.notifyAll();
    this.broadcastChanged("thread", threadId, ["status-changed", "events-appended"]);
  }

  private onProcessExit(threadId: string): void {
    const thread = sqlite.getThread(this.db, threadId);
    if (thread && !TERMINAL_STATUSES.has(thread.status)) {
      this.fail(threadId, "codex app-server exited unexpectedly");
    }
  }

  async tell(threadId: string, message: string): Promise<void> {
    if (this.isHerdrThread(threadId)) {
      if (!this.herdrRegistry) throw new Error(`Unknown thread ${threadId}`);
      await this.herdrRegistry.send(threadId, message);
      return;
    }
    const session = this.sessions.get(threadId);
    if (!session || !session.client || !session.providerThreadId) {
      throw new Error(`Thread ${threadId} has no active codex session (restart not supported yet)`);
    }
    const thread = sqlite.getThread(this.db, threadId)!;
    if (thread.status === "running") {
      await session.client.turnSteer(session.providerThreadId, message);
    } else {
      await session.client.turnStart(session.providerThreadId, message);
    }
    sqlite.setThreadStatus(this.db, threadId, "running", Math.floor(Date.now() / 1000));
    this.broadcastChanged("thread", threadId, ["status-changed"]);
  }

  /** Release a thread's codex app-server child. Idempotent: a thread with
   * no live session (never spawned, or already stopped) is a no-op, not an
   * error, so callers do not need to check state first. Resolves once the
   * OS process has actually exited — callers that don't care can leave the
   * promise unawaited (fire-and-forget), but anything about to tear down
   * shared state the exit callback still touches (e.g. a test closing its
   * db) must await it, or `onProcessExit` fires against torn-down state. */
  async stop(threadId: string): Promise<void> {
    if (this.isHerdrThread(threadId)) {
      if (!this.herdrRegistry) throw new Error(`Unknown thread ${threadId}`);
      await this.herdrRegistry.interrupt(threadId);
      return;
    }
    const session = this.sessions.get(threadId);
    this.sessions.delete(threadId);
    if (!session?.client) return;
    session.client.kill();
    await session.client.exited;
  }

  show(threadId: string): (ThreadRow & { events: EventRow[] }) | null {
    if (this.isHerdrThread(threadId)) {
      const row = this.herdrThreadRows().find((candidate) => candidate.id === threadId);
      return row ? { ...row, events: [] } : null;
    }
    const thread = sqlite.getThread(this.db, threadId);
    if (!thread) return null;
    return { ...thread, events: sqlite.listEvents(this.db, threadId) };
  }

  list(): ThreadRow[] {
    return [...sqlite.listThreads(this.db), ...this.herdrThreadRows()];
  }

  hasPendingInteraction(threadId: string): boolean {
    if (this.isHerdrThread(threadId)) {
      return this.herdrRegistry?.hasPendingInteraction(threadId) ?? false;
    }
    const session = this.sessions.get(threadId);
    return Boolean(session && session.pendingApprovals.size > 0);
  }

  async pendingInteractions(threadId: string): Promise<PendingInteraction[]> {
    return this.isHerdrThread(threadId)
      ? this.herdrRegistry?.pendingInteractions(threadId) ?? []
      : [];
  }

  async resolveInteraction(
    threadId: string,
    interactionId: string,
    resolution: PendingInteractionResolution,
  ): Promise<PendingInteraction> {
    if (!this.isHerdrThread(threadId) || !this.herdrRegistry) {
      throw new Error(`No pending interaction ${interactionId} on thread ${threadId}`);
    }
    return this.herdrRegistry.resolveInteraction(threadId, interactionId, resolution);
  }

  threadPin(threadId: string): sqlite.ThreadPinRow | null {
    return sqlite.getThreadPin(this.db, threadId);
  }

  pin(threadId: string): ThreadRow {
    const thread = this.show(threadId);
    if (!thread) throw new Error(`Unknown thread ${threadId}`);
    sqlite.setThreadPin(this.db, threadId, Date.now(), null);
    this.broadcastChanged("thread", threadId, ["pinned-changed"]);
    return thread;
  }

  unpin(threadId: string): ThreadRow {
    const thread = this.show(threadId);
    if (!thread) throw new Error(`Unknown thread ${threadId}`);
    sqlite.deleteThreadPin(this.db, threadId);
    this.broadcastChanged("thread", threadId, ["pinned-changed"]);
    return thread;
  }

  /** Moves one pinned thread between two neighbors (bb's pin-order PATCH).
   * Rewrites every pin's sort key as a zero-padded index — pins number in
   * the single digits, so recomputing all of them beats fractional-key
   * bookkeeping (ponytail: revisit if someone pins hundreds of threads). */
  reorderPinned(threadId: string, previousThreadId: string | null, nextThreadId: string | null): void {
    const pins = sqlite.listThreadPins(this.db);
    if (!pins.some((pin) => pin.thread_id === threadId)) throw new Error(`Thread ${threadId} is not pinned`);
    // Same effective order the frontend renders: sort_key (codepoint) first,
    // newest pinned first among unkeyed rows.
    const ordered = pins
      .sort((a, b) => {
        if (a.sort_key !== null && b.sort_key !== null && a.sort_key !== b.sort_key) {
          return a.sort_key < b.sort_key ? -1 : 1;
        }
        if (a.sort_key !== b.sort_key) return a.sort_key !== null ? -1 : 1;
        return b.pinned_at - a.pinned_at;
      })
      .map((pin) => pin.thread_id)
      .filter((id) => id !== threadId);
    const anchor = nextThreadId !== null ? ordered.indexOf(nextThreadId)
      : previousThreadId !== null ? ordered.indexOf(previousThreadId) + 1
      : ordered.length;
    ordered.splice(anchor === -1 ? ordered.length : anchor, 0, threadId);
    const byId = new Map(pins.map((pin) => [pin.thread_id, pin]));
    ordered.forEach((id, index) => {
      sqlite.setThreadPin(this.db, id, byId.get(id)!.pinned_at, String(index).padStart(6, "0"));
    });
    this.broadcastChanged("thread", threadId, ["pinned-changed"]);
  }

  rename(threadId: string, title: string): ThreadRow {
    if (this.isHerdrThread(threadId)) {
      throw new Error(`Herdr threads cannot be renamed — title tracks the terminal automatically`);
    }
    if (!sqlite.getThread(this.db, threadId)) throw new Error(`Unknown thread ${threadId}`);
    sqlite.setThreadTitle(this.db, threadId, title, Math.floor(Date.now() / 1000));
    const thread = sqlite.getThread(this.db, threadId)!;
    this.broadcastChanged("thread", threadId, ["title-changed"]);
    return thread;
  }

  archive(threadId: string): ThreadRow {
    if (!sqlite.getThread(this.db, threadId)) throw new Error(`Unknown thread ${threadId}`);
    sqlite.archiveThread(this.db, threadId, Math.floor(Date.now() / 1000));
    const thread = sqlite.getThread(this.db, threadId)!;
    this.broadcastChanged("thread", threadId, ["archived-changed"]);
    return thread;
  }

  delete(threadId: string): void {
    if (!sqlite.getThread(this.db, threadId)) throw new Error(`Unknown thread ${threadId}`);
    void this.stop(threadId);
    sqlite.deleteThread(this.db, threadId);
    this.broadcastChanged("thread", threadId, ["thread-deleted"]);
  }

  eventsSince(threadId: string, afterSeq: number): EventRow[] {
    return sqlite.listEvents(this.db, threadId, afterSeq);
  }

  /** Cheap existence-check + high-water mark: an indexed MAX(seq), not a
   * full event-history fetch (unlike show()). */
  threadMaxSeq(threadId: string): number | null {
    if (this.isHerdrThread(threadId)) return this.herdrRegistry?.threadMaxSeq(threadId) ?? null;
    if (!sqlite.getThread(this.db, threadId)) return null;
    return sqlite.threadMaxSeq(this.db, threadId);
  }

  timelineRows(threadId: string): TimelineRow[] {
    if (this.isHerdrThread(threadId)) return this.herdrRegistry?.timelineRows(threadId) ?? [];
    return sqlite.listTimelineRows(this.db, threadId);
  }

  timelineRowsSince(threadId: string, afterSeq: number): TimelineRow[] {
    if (this.isHerdrThread(threadId)) {
      return (this.herdrRegistry?.timelineRows(threadId) ?? []).filter((row) => row.source_seq_end > afterSeq);
    }
    return sqlite.listTimelineRowsSince(this.db, threadId, afterSeq);
  }

  async wait(threadId: string, timeoutMs: number): Promise<ThreadRow> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const thread = sqlite.getThread(this.db, threadId);
      if (!thread) throw new Error(`Unknown thread ${threadId}`);
      if (TERMINAL_STATUSES.has(thread.status)) return thread;
      await this.condition.wait(Math.min(1000, deadline - Date.now()));
    }
    const thread = sqlite.getThread(this.db, threadId);
    if (!thread) throw new Error(`Unknown thread ${threadId}`);
    return thread;
  }

  /** requestId is matched as a string (HTTP/CLI callers only ever have a
   * string); the original id type codex sent is preserved in the pending
   * entry and echoed back on the wire, since JSON-RPC ids are typed. */
  resolveApproval(threadId: string, requestId: string, decision: string): void {
    const session = this.sessions.get(threadId);
    if (!session) throw new Error(`Unknown thread ${threadId}`);
    const entry = session.pendingApprovals.get(requestId);
    session.pendingApprovals.delete(requestId);
    if (!entry) throw new Error(`No pending approval ${requestId} on thread ${threadId}`);

    let result: Record<string, unknown>;
    if (entry.method === "item/permissions/requestApproval") {
      result = decision === "accept"
        ? { permissions: entry.params.permissions, scope: "turn" }
        : { permissions: { fileSystem: null, network: null }, scope: "turn" };
    } else {
      if (!COMMAND_AND_FILE_DECISIONS.has(decision)) {
        throw new Error(`Unsupported decision '${decision}' for ${entry.method}`);
      }
      result = { decision };
    }

    session.client!.respond(entry.id, result);
    const now = Math.floor(Date.now() / 1000);
    sqlite.appendEvent(this.db, threadId, "approval/resolved", {
      requestId, approvalMethod: entry.method, decision,
    }, now);
    this.condition.notifyAll();
    this.broadcastChanged("thread", threadId, ["interactions-changed"]);
  }

  private onApprovalRequest(threadId: string, method: string, params: Record<string, unknown>, requestId: number | string): void {
    const session = this.sessions.get(threadId);
    session?.pendingApprovals.set(String(requestId), { method, params: params ?? {}, id: requestId });
    const now = Math.floor(Date.now() / 1000);
    sqlite.appendEvent(this.db, threadId, "approval/requested", {
      requestId: String(requestId), approvalMethod: method, ...(params ?? {}),
    }, now);
    this.condition.notifyAll();
    this.broadcastChanged("thread", threadId, ["interactions-changed"]);
  }

  private onNotification(threadId: string, method: string, params: Record<string, unknown>): void {
    const session = this.sessions.get(threadId);
    if (session && isDeltaMethod(method)) {
      this.bufferOrEmitDelta(session, threadId, method, params);
      return;
    }
    if (session) this.flushPendingDeltas(session, threadId);
    this.persistNotification(threadId, method, params);
  }

  private bufferOrEmitDelta(session: ThreadSession, threadId: string, method: string, params: Record<string, unknown>): void {
    const itemId = params.itemId as string | undefined;
    const key = `${method}:${itemId}`;
    const nowMs = performance.now();
    const lastEmit = session.deltaLastEmit.get(key);
    const deltaText = (params.delta as string) || "";

    if (lastEmit !== undefined && nowMs - lastEmit < TEXT_DELTA_FLUSH_MS) {
      const pending = session.pendingDeltas.get(key);
      if (!pending) {
        session.pendingDeltas.set(key, { params, text: deltaText });
      } else {
        pending.text += deltaText;
        pending.params = params;
      }
      return;
    }

    // Window elapsed (or this key's very first delta — lastEmit is
    // undefined, so it emits immediately and time-to-first-token is
    // unaffected).
    const pending = session.pendingDeltas.get(key);
    session.pendingDeltas.delete(key);
    const mergedText = (pending?.text ?? "") + deltaText;
    const emitParams = { ...params, delta: mergedText };
    session.deltaLastEmit.set(key, nowMs);
    this.persistNotification(threadId, method, emitParams);
  }

  /** Any non-delta event (turn/item lifecycle, errors, thread failure) is a
   * barrier: whatever text is still buffered must land before it, never
   * after — same ordering rule bb's assembler documents. */
  private flushPendingDeltas(session: ThreadSession, threadId: string): void {
    if (session.pendingDeltas.size === 0) return;
    const pendingItems = [...session.pendingDeltas.entries()];
    session.pendingDeltas.clear();
    for (const [key, pending] of pendingItems) {
      const method = key.slice(0, key.lastIndexOf(":"));
      const emitParams = { ...pending.params, delta: pending.text };
      session.deltaLastEmit.set(key, performance.now());
      this.persistNotification(threadId, method, emitParams);
    }
  }

  /** Keeps `timeline_rows` in sync as codex events arrive, so a client
   * watching a thread sees assistant text grow live instead of nothing
   * until the whole item finishes. */
  private updateTimelineRow(threadId: string, method: string, params: Record<string, unknown>, seq: number, now: number): void {
    if (method === "item/started") {
      const item = (params.item as Record<string, unknown>) ?? {};
      const itemType = item.type as string;
      if (!ROW_ITEM_TYPES.includes(itemType as (typeof ROW_ITEM_TYPES)[number])) return;
      const rowId = `row_${item.id}`;
      const turnId = (params.turnId as string) ?? null;
      const role = ROW_ROLE_BY_ITEM_TYPE[itemType];
      if (role) {
        // userMessage's full text is already known at item/started (no
        // streaming for it); agentMessage starts empty and grows via
        // item/agentMessage/delta.
        const initialText = itemType === "userMessage" ? itemText(item) : "";
        sqlite.startTimelineRow(this.db, rowId, threadId, role, initialText, turnId, seq, now);
      } else {
        const workRow = workTimelineRow(item, null);
        if (workRow) sqlite.setWorkTimelineRow(this.db, rowId, threadId, workRow.workKind, workRow.payload, turnId, seq, now);
      }
    } else if (method === "item/agentMessage/delta") {
      const deltaText = (params.delta as string) || "";
      if (!deltaText) return;
      const rowId = `row_${params.itemId}`;
      sqlite.appendTimelineRowText(this.db, rowId, threadId, "assistant", deltaText, (params.turnId as string) ?? null, seq, now);
    } else if (
      method === "item/commandExecution/outputDelta"
      || method === "item/fileChange/outputDelta"
      || method === "item/mcpToolCall/progress"
    ) {
      const deltaText = method === "item/mcpToolCall/progress" ? params.message : params.delta;
      if (typeof deltaText !== "string" || !deltaText) return;
      sqlite.appendWorkTimelineRowOutput(this.db, `row_${params.itemId}`, threadId, deltaText, seq, now);
    } else if (method === "item/completed") {
      const item = (params.item as Record<string, unknown>) ?? {};
      const itemType = item.type as string;
      if (!ROW_ITEM_TYPES.includes(itemType as (typeof ROW_ITEM_TYPES)[number])) return;
      const rowId = `row_${item.id}`;
      const turnId = (params.turnId as string) ?? null;
      const role = ROW_ROLE_BY_ITEM_TYPE[itemType];
      if (role) {
        sqlite.setTimelineRowText(this.db, rowId, threadId, role, itemText(item), turnId, seq, now);
      } else {
        const completedAt = typeof params.completedAtMs === "number" ? params.completedAtMs : now * 1000;
        const workRow = workTimelineRow(item, completedAt);
        if (workRow) sqlite.setWorkTimelineRow(this.db, rowId, threadId, workRow.workKind, workRow.payload, turnId, seq, now);
      }
    }
  }

  private persistNotification(threadId: string, method: string, params: Record<string, unknown>): void {
    const now = Math.floor(Date.now() / 1000);
    let turnId = (params.turnId as string) ?? null;
    let itemId = (params.itemId as string) ?? null;
    let itemType: string | null = null;
    let statusChanged = false;

    if (method === "turn/started" || method === "turn/completed") {
      const turn = (params.turn as Record<string, unknown>) ?? {};
      turnId = turn.id as string;
      statusChanged = true;
      if (method === "turn/started") {
        sqlite.setThreadStatus(this.db, threadId, "running", now);
      } else {
        const status = TURN_STATUS_TO_THREAD_STATUS[turn.status as string] ?? "idle";
        sqlite.setThreadStatus(this.db, threadId, status, now);
      }
    } else if (method === "item/started" || method === "item/completed") {
      const item = (params.item as Record<string, unknown>) ?? {};
      itemId = item.id as string;
      itemType = item.type as string;
    }

    const seq = sqlite.appendEvent(this.db, threadId, method, params, now, turnId, itemId, itemType);
    this.updateTimelineRow(threadId, method, params, seq, now);

    if (method === "turn/started" || method === "turn/completed") {
      const session = this.sessions.get(threadId);
      if (session) session.currentTurnId = method === "turn/started" ? turnId : null;
    }

    this.condition.notifyAll();
    const changes = ["events-appended", ...(statusChanged ? ["status-changed"] : [])];
    this.broadcastChanged("thread", threadId, changes);
  }
}
