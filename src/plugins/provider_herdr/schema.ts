/**
 * Read-only mirror of one entry from `herdr agent list` / `herdr agent get`.
 * Deliberately not part of @bb/domain's Thread contract (shared with other
 * bb-family apps) — a Herdr agent is not a vozen thread, so it gets its own
 * shape and its own UI surface instead of being disguised as one.
 */

import { z } from "zod";

export const HERDR_AGENT_STATUSES = ["idle", "working", "blocked", "done", "unknown"] as const;
export type HerdrAgentStatus = (typeof HERDR_AGENT_STATUSES)[number];

export const herdrAgentSnapshotSchema = z.object({
  agent: z.string(),
  agentStatus: z.enum(HERDR_AGENT_STATUSES),
  paneId: z.string(),
  workspaceId: z.string(),
  tabId: z.string(),
  cwd: z.string(),
  foregroundCwd: z.string().nullable(),
  terminalTitle: z.string(),
  focused: z.boolean(),
  revision: z.number(),
  stateChangeSeq: z.number(),
  // The agent's own session/transcript id (Claude/Codex/Qoder's own log file
  // name) — null when Herdr hasn't reported one (kind !== "id") or the agent
  // kind doesn't have a resolvable session file. Only set for `kind: "id"`:
  // other kinds identify a session by non-file means this reader can't use.
  sessionId: z.string().nullable(),
});
export type HerdrAgentSnapshot = z.infer<typeof herdrAgentSnapshotSchema>;

// Wire shape of one entry in `herdr agent list`/`herdr agent get`'s JSON
// output (snake_case, straight from the Herdr CLI — see herdr-mobile-relay's
// internal/herdr/client.go for the same field set consumed from Go).
const rawHerdrAgentSchema = z.object({
  agent: z.string(),
  agent_status: z.string(),
  pane_id: z.string(),
  workspace_id: z.string(),
  tab_id: z.string(),
  cwd: z.string(),
  foreground_cwd: z.string().nullable().optional(),
  terminal_title: z.string().optional(),
  terminal_title_stripped: z.string().optional(),
  focused: z.boolean(),
  revision: z.number(),
  state_change_seq: z.number(),
  agent_session: z.object({
    kind: z.string().optional(),
    value: z.string().optional(),
  }).nullable().optional(),
});

function isKnownStatus(value: string): value is HerdrAgentStatus {
  return (HERDR_AGENT_STATUSES as readonly string[]).includes(value);
}

/** Throws (via rawHerdrAgentSchema.parse) on a shape Herdr's CLI never
 * documented — an unrecognized *status value* is different: Herdr's own
 * skill docs already call `unknown` a valid state, so a future status string
 * this list hasn't caught up with degrades to `unknown` instead of failing
 * the whole list. */
export function toHerdrAgentSnapshot(raw: unknown): HerdrAgentSnapshot {
  const parsed = rawHerdrAgentSchema.parse(raw);
  return {
    agent: parsed.agent,
    agentStatus: isKnownStatus(parsed.agent_status) ? parsed.agent_status : "unknown",
    paneId: parsed.pane_id,
    workspaceId: parsed.workspace_id,
    tabId: parsed.tab_id,
    cwd: parsed.cwd,
    foregroundCwd: parsed.foreground_cwd ?? null,
    terminalTitle: parsed.terminal_title_stripped ?? parsed.terminal_title ?? "",
    focused: parsed.focused,
    revision: parsed.revision,
    stateChangeSeq: parsed.state_change_seq,
    sessionId: parsed.agent_session?.kind === "id" ? parsed.agent_session.value ?? null : null,
  };
}
