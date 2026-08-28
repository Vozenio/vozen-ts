// vozen-specific mapping helpers. Real bb domain/contract types come from
// @bb/domain and @bb/server-contract directly (reused, not hand-copied) —
// see package.json's workspace link into bb-packages/* (a vendored copy,
// no longer synced from bb's own repo).

export const THREAD_STATUSES = ["starting", "running", "idle", "failed", "interrupted"] as const;
export const TERMINAL_THREAD_STATUSES = ["idle", "failed", "interrupted"] as const;

// codex turn/completed.turn.status -> vozen thread status
export const TURN_STATUS_TO_THREAD_STATUS: Record<string, string> = {
  completed: "idle",
  failed: "failed",
  interrupted: "interrupted",
  inProgress: "running",
};

export const CODEX_ITEM_STATUS_TO_WORK_STATUS: Record<string, string> = {
  inProgress: "pending",
  completed: "completed",
  failed: "error",
  declined: "interrupted",
  interrupted: "interrupted",
};

export const ROW_ITEM_TYPES = [
  "agentMessage",
  "userMessage",
  "commandExecution",
  "fileChange",
  "mcpToolCall",
] as const;
export const ROW_ROLE_BY_ITEM_TYPE: Record<string, string> = {
  agentMessage: "assistant",
  userMessage: "user",
};

interface CodexItem {
  type?: string;
  text?: string;
  content?: { text?: string }[];
}

export function itemText(item: CodexItem): string {
  if (item.type === "agentMessage") {
    return item.text ?? "";
  }
  if (item.type === "userMessage") {
    return (item.content ?? []).map((c) => c.text ?? "").join("\n");
  }
  return "";
}

interface SubscriptionTarget {
  kind?: string;
  threadId?: string;
  projectId?: string;
  environmentId?: string;
  hostId?: string;
}

const ID_FIELD_BY_DETAIL_KIND: Record<string, keyof SubscriptionTarget> = {
  "thread-detail": "threadId",
  "project-detail": "projectId",
  "environment-detail": "environmentId",
  "host-detail": "hostId",
};

// Mirrors bb's realtimeSubscriptionTargetKey (packages/domain/src/change-kinds.ts).
export function subscriptionTargetKey(target: SubscriptionTarget): string | null {
  const kind = target.kind;
  if (!kind) return null;
  if (kind === "thread-list" || kind === "project-list" || kind === "environment-list" || kind === "host-list" || kind === "system") {
    return kind;
  }
  const idField = ID_FIELD_BY_DETAIL_KIND[kind];
  if (!idField) return null;
  return `${kind}:${target[idField]}`;
}
