/**
 * Minimal shim so bb's own compiled frontend (apps/web-bb, vendored from
 * bb's apps/app build) can boot and drive vozen's codex threads without any
 * frontend code changes. Not a general bb-server reimplementation — only
 * the requests bb's app actually makes are handled; anything else gets a
 * permissive best-effort default and is logged.
 *
 * Ported from apps/server/bb_shim.py, but the response shapes below are
 * typed against bb's own real schemas (@bb/domain, @bb/server-contract) —
 * reused directly, not hand-copied — so a field bb adds/renames is a
 * compile error here, not a runtime mystery a browser eventually surfaces.
 */

import type { Host, PendingInteractionUserAnswer, PendingInteractionUserQuestionQuestion } from "@bb/domain";
import type { JsonObject } from "@bb/domain";
import type { ThreadResponse, TimelineRow as BbTimelineRow, TimelineRowStatus } from "@bb/server-contract";
import type { EventRow, ProjectRow, ThreadRow, TimelineRow } from "../../packages/db/sqlite.ts";
import type { ThreadManager } from "./engine.ts";

export const PERSONAL_PROJECT_ID = "proj_personal";
export const VOZEN_HOST_ID = "host_vozen";

export const VOZEN_HOST: Host = {
  id: VOZEN_HOST_ID,
  name: "vozen",
  type: "persistent",
  status: "connected",
  maxPermissionMode: "full",
  lastSeenAt: null,
  lastRejectedProtocolVersion: null,
  createdAt: 0,
  updatedAt: 0,
};

export const CODEX_PROVIDER_INFO = {
  id: "codex",
  pluginId: "vozen-codex",
  displayName: "Codex",
  // Real bb brand asset (plugins/provider-codex/icons/codex.svg), served by
  // the same /system/providers/:id/logo route bb's own client expects
  // (bb-packages/server-contract/src/public-api.ts's providerLogo route).
  logoUrl: "/api/v1/system/providers/codex/logo",
  // icon.glyph is 3rd-priority fallback (behind logoUrl) — harmless to keep.
  icon: { glyph: "Terminal" },
  maintenance: { health: false, usage: false, installation: false },
  capabilities: {
    supportsThreadArchive: true, // engine.ts's archive() is implemented
    supportsThreadRename: true, // engine.ts's rename() is implemented
    supportsServiceTier: false,
    supportsNativeUserQuestion: false,
    supportsFork: false,
    supportsSessionRewind: false,
    permissionModes: ["full"],
    modelCatalogScope: "host",
  },
  composerActions: [],
  available: true,
};

export const CODEX_MODEL = {
  id: "gpt-5-codex",
  model: "gpt-5-codex",
  displayName: "GPT-5 Codex",
  description: "",
  supportedReasoningEfforts: [{ reasoningEffort: "medium", description: "Medium" }],
  defaultReasoningEffort: "medium",
  isDefault: true,
};

export const DEFAULT_EXECUTION_OPTIONS = {
  providerId: "codex",
  model: "gpt-5-codex",
  serviceTier: "default",
  reasoningLevel: "medium",
  permissionMode: "full",
};

export const CLAUDE_PROVIDER_INFO = {
  id: "claude",
  pluginId: "vozen-claude",
  displayName: "Claude",
  // Real bb brand asset (plugins/provider-claude-code/icons/claude-code.svg).
  logoUrl: "/api/v1/system/providers/claude/logo",
  icon: { glyph: "Star" },
  maintenance: { health: false, usage: false, installation: false },
  capabilities: {
    supportsThreadArchive: true, // real DB-backed thread — engine.ts's archive() works same as codex
    supportsThreadRename: true, // same
    supportsServiceTier: false,
    supportsNativeUserQuestion: false,
    supportsFork: false,
    supportsSessionRewind: false,
    permissionModes: ["full"],
    modelCatalogScope: "host",
  },
  composerActions: [],
  available: true,
};

// ponytail: the `claude` CLI has no "list models" flag/subcommand — these
// are the 3 stable aliases its own --help documents ('fable'/'opus'/
// 'sonnet' — see client.ts's doc comment), not a live query. Same
// approach CODEX_MODEL above already takes (also hardcoded, not queried).
// Upgrade path: if the CLI ever exposes a real listing, replace this.
export const CLAUDE_MODELS = [
  { id: "sonnet", model: "sonnet", displayName: "Sonnet", description: "", supportedReasoningEfforts: [], defaultReasoningEffort: null, isDefault: true },
  { id: "opus", model: "opus", displayName: "Opus", description: "", supportedReasoningEfforts: [], defaultReasoningEffort: null, isDefault: false },
  { id: "fable", model: "fable", displayName: "Fable", description: "", supportedReasoningEfforts: [], defaultReasoningEffort: null, isDefault: false },
];

export const CLAUDE_EXECUTION_OPTIONS = {
  providerId: "claude",
  model: "sonnet",
  serviceTier: "default",
  reasoningLevel: "medium",
  permissionMode: "full",
};

/** Provider info for a Herdr-only agent kind (qoder, or any future kind
 * Herdr can observe but vozen can never spawn itself) — a Herdr thread is
 * discovered, not spawned, so it has no rename (title tracks the
 * terminal) and no archive (lifecycle tracks the pane). Not used for
 * "codex"/"claude": those are real vozen-spawned providers even when the
 * specific thread in question happens to be one Herdr is also watching,
 * so they get the fuller capability set from providerInfoFor() below. */
// Known Herdr-observed agent kinds get a distinct icon glyph so they don't
// collide on the display name's first letter (e.g. "Claude" vs "Codex"
// both start with C). "claude" here matches CLAUDE_PROVIDER_INFO's own
// glyph for visual consistency — providerInfoFor() below never actually
// routes "claude" through this function, but keeps it in case that
// changes or this is ever called directly. An agentKind with no entry
// falls through to no icon at all — Icon.tsx's own first-letter fallback,
// which is the right behavior for a kind Herdr wasn't taught about yet.
const HERDR_AGENT_ICON_GLYPHS: Record<string, string> = {
  claude: "Star",
  qoder: "Zap",
};

function herdrProviderInfo(agentKind: string) {
  const glyph = HERDR_AGENT_ICON_GLYPHS[agentKind];
  return {
    id: agentKind,
    pluginId: "vozen-herdr",
    displayName: agentKind.charAt(0).toUpperCase() + agentKind.slice(1),
    logoUrl: null,
    ...(glyph ? { icon: { glyph } } : {}),
    maintenance: { health: false, usage: false, installation: false },
    capabilities: {
      supportsThreadArchive: false,
      supportsThreadRename: false,
      supportsServiceTier: false,
      supportsNativeUserQuestion: false,
      supportsFork: false,
      supportsSessionRewind: false,
      permissionModes: ["full"],
      modelCatalogScope: "host",
    },
    composerActions: [],
    available: true,
  };
}

/** Real bb brand SVGs, copied from plugins/provider-{codex,claude-code}/icons/
 * — served by http.ts's GET /system/providers/:id/logo (bb's own route
 * shape, bb-packages/server-contract/src/public-api.ts's providerLogo). */
export const PROVIDER_LOGO_FILENAMES: Record<string, string> = {
  codex: "codex.svg",
  claude: "claude.svg",
};

export function providerInfoFor(agentKind: string) {
  if (agentKind === "codex") return CODEX_PROVIDER_INFO;
  if (agentKind === "claude") return CLAUDE_PROVIDER_INFO;
  return herdrProviderInfo(agentKind);
}

export function executionOptionsFor(thread: Pick<ThreadRow, "agent_kind">) {
  if (!thread.agent_kind || thread.agent_kind === "codex") return DEFAULT_EXECUTION_OPTIONS;
  if (thread.agent_kind === "claude") return CLAUDE_EXECUTION_OPTIONS;
  return {
    providerId: thread.agent_kind,
    model: null,
    serviceTier: "default",
    reasoningLevel: "medium",
    permissionMode: "full",
  };
}

export function log(message: string): void {
  console.error(`[bb-shim] ${message}`);
}

/** vozen threads run in a plain directory, never a git worktree — so this
 * is always the same "personal, non-git, ready" shape regardless of which
 * thread's environmentId asked for it. */
export function toBbEnvironment(environmentId: string) {
  return {
    id: environmentId,
    name: null,
    projectId: PERSONAL_PROJECT_ID,
    hostId: VOZEN_HOST_ID,
    path: null,
    managed: false,
    isGitRepo: false,
    isWorktree: false,
    workspaceProvisionType: "personal",
    branchName: null,
    baseBranch: null,
    defaultBranch: null,
    mergeBaseBranch: null,
    status: "ready",
    createdAt: 0,
    updatedAt: 0,
  };
}

// vozen's own status vocabulary vs bb's real one
// (packages/domain/src/thread-status.ts: idle/starting/active/stopping/error).
// Passing vozen's raw strings through crashed bb's sidebar status switch
// (`assertNever`, "Unexpected value: running") — bb has no "running" status.
const BB_STATUS: Record<string, ThreadResponse["status"]> = {
  starting: "starting",
  running: "active",
  idle: "idle",
  failed: "error",
  interrupted: "idle",
};

export function toBbThread(thread: ThreadRow, _hasPendingInteraction: boolean): ThreadResponse {
  const createdMs = thread.created_at * 1000;
  const updatedMs = thread.updated_at * 1000;
  const bbStatus = BB_STATUS[thread.status]!;
  return {
    id: thread.id,
    projectId: thread.project_id ?? PERSONAL_PROJECT_ID,
    environmentId: "env_vozen",
    providerId: thread.agent_kind ?? "codex",
    title: thread.title,
    titleFallback: thread.title,
    sectionId: null,
    status: bbStatus,
    parentThreadId: null,
    sourceThreadId: null,
    originKind: null,
    originPluginId: null,
    visibility: "visible",
    archivedAt: thread.archived_at ? thread.archived_at * 1000 : null,
    pinnedAt: null,
    deletedAt: null,
    lastReadAt: updatedMs,
    latestAttentionAt: updatedMs,
    createdAt: createdMs,
    updatedAt: updatedMs,
    runtime: { displayStatus: bbStatus, hostReconnectGraceExpiresAt: null },
    activeBackgroundAgentCount: 0,
    canSpawnChild: true,
  };
}

export function toBbThreadListEntry(thread: ThreadRow, hasPendingInteraction: boolean) {
  return {
    ...toBbThread(thread, hasPendingInteraction),
    activity: {
      activeWorkflowCount: 0,
      activeBackgroundAgentCount: 0,
      activeBackgroundCommandCount: 0,
      activePlanModeCount: 0,
      activeGoalCount: 0,
    },
    pinSortKey: null,
    hasPendingInteraction,
    environmentHostId: null,
    environmentName: "vozen",
    environmentBranchName: null,
    environmentWorkspaceDisplayKind: "other",
  };
}

function workPayload(row: TimelineRow): Record<string, unknown> {
  return row.payload ? JSON.parse(row.payload) as Record<string, unknown> : {};
}

function workStatus(value: unknown): TimelineRowStatus {
  return value === "completed" || value === "error" || value === "interrupted" ? value : "pending";
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function outputString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function rowToBbRow(row: TimelineRow): BbTimelineRow {
  const tsMs = row.updated_at * 1000;
  const base = {
    id: row.id,
    threadId: row.thread_id,
    turnId: row.turn_id,
    sourceSeqStart: row.source_seq_start,
    sourceSeqEnd: row.source_seq_end,
    startedAt: tsMs,
    createdAt: tsMs,
  };

  if (row.kind === "work") {
    const payload = workPayload(row);
    const workBase = { ...base, kind: "work" as const, status: workStatus(payload.status) };
    if (row.work_kind === "command") {
      return {
        ...workBase,
        workKind: "command",
        callId: outputString(payload.callId),
        command: outputString(payload.command),
        cwd: nullableString(payload.cwd),
        source: null,
        output: outputString(payload.output ?? payload.aggregatedOutput),
        exitCode: nullableNumber(payload.exitCode),
        completedAt: nullableNumber(payload.completedAt),
        approvalStatus: null,
        activityIntents: [],
      };
    }
    if (row.work_kind === "question") {
      const lifecycle = ["pending", "resolving", "answered", "interrupted"].includes(String(payload.lifecycle))
        ? payload.lifecycle as "pending" | "resolving" | "answered" | "interrupted"
        : "pending";
      return {
        ...workBase,
        workKind: "question",
        interactionId: outputString(payload.interactionId),
        lifecycle,
        questions: (Array.isArray(payload.questions) ? payload.questions : []) as PendingInteractionUserQuestionQuestion[],
        answers: (payload.answers && typeof payload.answers === "object"
          ? payload.answers
          : null) as Record<string, PendingInteractionUserAnswer> | null,
        statusReason: nullableString(payload.statusReason),
      };
    }
    if (row.work_kind === "tool") {
      const server = nullableString(payload.server);
      const tool = outputString(payload.tool);
      const args = payload.arguments;
      return {
        ...workBase,
        workKind: "tool",
        callId: outputString(payload.callId),
        toolName: server ? `${server}:${tool}` : tool,
        toolArgs: args !== null && typeof args === "object" && !Array.isArray(args) ? args as JsonObject : null,
        output: outputString(payload.output),
        completedAt: nullableNumber(payload.completedAt),
        approvalStatus: null,
      };
    }
    if (row.work_kind === "delegation") {
      return {
        ...workBase,
        workKind: "delegation",
        callId: outputString(payload.callId),
        toolName: outputString(payload.toolName),
        childRef: outputString(payload.childRef),
        background: payload.background === true,
        subagentType: nullableString(payload.subagentType),
        description: nullableString(payload.description),
        output: outputString(payload.output),
        completedAt: nullableNumber(payload.completedAt),
        childRows: [],
      };
    }
    if (row.work_kind === "file-change") {
      const changes = Array.isArray(payload.changes) ? payload.changes : [];
      const change = (changes[0] ?? {}) as Record<string, unknown>;
      const diff = nullableString(change.diff);
      const lines = diff ? diff.replaceAll("\r\n", "\n").split("\n") : [];
      if (lines.at(-1) === "") lines.pop();
      const hasPrefixedLines = lines.some((line) => line.startsWith("+") || line.startsWith("-"));
      const kind = nullableString(change.kind);
      return {
        ...workBase,
        workKind: "file-change",
        callId: outputString(payload.callId),
        change: {
          path: outputString(change.path),
          kind,
          movePath: nullableString(change.movePath),
          diff,
          diffStats: {
            added: !hasPrefixedLines && kind === "add"
              ? lines.length
              : lines.filter((line) => line.startsWith("+")).length,
            removed: !hasPrefixedLines && kind === "delete"
              ? lines.length
              : lines.filter((line) => line.startsWith("-")).length,
          },
        },
        stdout: null,
        stderr: null,
        approvalStatus: null,
      };
    }
    throw new Error(`Unknown timeline work kind: ${row.work_kind}`);
  }

  const conversationBase = {
    ...base,
    kind: "conversation" as const,
    text: row.text,
    attachments: null,
  };
  if (row.role === "user") {
    return {
      ...conversationBase,
      role: "user",
      initiator: "user",
      senderThreadId: null,
      systemMessageKind: "unlabeled",
      systemMessageSubject: null,
      turnRequest: { isGrouped: false, kind: "message", status: "accepted" },
      mentions: [],
    };
  }
  return { ...conversationBase, role: "assistant", turnRequest: null };
}

/** A real, user-created project (packages/db/sqlite.ts's `projects` table) —
 * distinct from the synthetic "Personal" project every vozen install has,
 * which is not itself a stored row (threads with no project_id belong to it). */
export function toBbProject(project: ProjectRow) {
  return {
    id: project.id,
    kind: "standard",
    name: project.name,
    gitRemoteUrl: null,
    createdAt: project.created_at * 1000,
    updatedAt: project.updated_at * 1000,
    sources: [{
      id: `src_${project.id}`, projectId: project.id, isDefault: true,
      createdAt: project.created_at * 1000, updatedAt: project.updated_at * 1000,
      type: "local_path", hostId: VOZEN_HOST_ID, path: project.path,
    }],
  };
}

export function toBbProjectWithThreads(engine: ThreadManager, project: ProjectRow) {
  const threads = engine.listThreadsByProject(project.id).map((t) => toBbThreadListEntry(t, engine.hasPendingInteraction(t.id)));
  return { ...toBbProject(project), threads, defaultExecutionOptions: DEFAULT_EXECUTION_OPTIONS };
}

export function sidebarBootstrap(engine: ThreadManager) {
  const personalThreads = engine.listThreadsByProject(null).map((t) => toBbThreadListEntry(t, engine.hasPendingInteraction(t.id)));
  const personalProject = {
    id: PERSONAL_PROJECT_ID,
    kind: "personal",
    name: "Personal",
    gitRemoteUrl: null,
    createdAt: 0,
    updatedAt: 0,
    sources: [],
    threads: personalThreads,
    defaultExecutionOptions: DEFAULT_EXECUTION_OPTIONS,
  };
  const projects = engine.listProjects().map((p) => toBbProjectWithThreads(engine, p));
  return { sections: [], projects, personalProject };
}

export function promptText(inputItems: unknown): string {
  if (!Array.isArray(inputItems)) return "";
  for (const item of inputItems) {
    if (item && typeof item === "object" && (item as Record<string, unknown>).type === "text") {
      return ((item as Record<string, unknown>).text as string) ?? "";
    }
  }
  return "";
}

export interface EngineThreadWithEvents extends ThreadRow {
  events: EventRow[];
}
