import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

// Mirrors provider_herdr/schema.ts's HerdrAgentSnapshot on the server; kept
// as a local type instead of a shared import because the web app has no
// build-time dependency on src/plugins (server-only code).
interface HerdrAgentSnapshot {
  agent: string;
  agentStatus: "idle" | "working" | "blocked" | "done" | "unknown";
  paneId: string;
  workspaceId: string;
  tabId: string;
  cwd: string;
  foregroundCwd: string | null;
  terminalTitle: string;
  focused: boolean;
  revision: number;
  stateChangeSeq: number;
}

const STATUS_DOT: Record<HerdrAgentSnapshot["agentStatus"], string> = {
  idle: "bg-zinc-400",
  working: "bg-blue-500",
  blocked: "bg-amber-500",
  done: "bg-emerald-500",
  unknown: "bg-zinc-300",
};

async function fetchHerdrAgents(signal: AbortSignal): Promise<HerdrAgentSnapshot[]> {
  const response = await fetch("/api/herdr/agents", { signal });
  if (!response.ok) throw new Error(`herdr agents request failed: ${response.status}`);
  return response.json();
}

async function fetchHerdrAgentRead(paneId: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(`/api/herdr/agents/${encodeURIComponent(paneId)}/read?lines=200`, { signal });
  if (!response.ok) throw new Error(`herdr agent read failed: ${response.status}`);
  return response.text();
}

function HerdrAgentDetail({ paneId }: { paneId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["herdr-agent-read", paneId],
    queryFn: ({ signal }) => fetchHerdrAgentRead(paneId, signal),
    refetchInterval: 3000,
  });

  return (
    <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-zinc-950 p-3 text-xs text-zinc-200">
      {isLoading ? "loading…" : data}
    </pre>
  );
}

export function HerdrAgentsView() {
  const [expandedPaneId, setExpandedPaneId] = useState<string | null>(null);
  const { data: agents, isLoading, error } = useQuery({
    queryKey: ["herdr-agents"],
    queryFn: ({ signal }) => fetchHerdrAgents(signal),
    refetchInterval: 2000,
  });

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-lg font-semibold">Herdr Agents</h1>
      <p className="mb-4 text-sm text-zinc-500">
        Read-only mirror of the agents Herdr is currently managing on this machine.
      </p>
      {isLoading && <p className="text-sm text-zinc-500">Loading…</p>}
      {error && <p className="text-sm text-red-500">{(error as Error).message}</p>}
      {agents && agents.length === 0 && <p className="text-sm text-zinc-500">No agents detected.</p>}
      <ul className="flex flex-col gap-2">
        {agents?.map((snapshot) => (
          <li key={snapshot.paneId} className="rounded-lg border border-zinc-800 p-3">
            <button
              type="button"
              className="flex w-full items-center gap-2 text-left"
              onClick={() => setExpandedPaneId(expandedPaneId === snapshot.paneId ? null : snapshot.paneId)}
            >
              <span className={`h-2 w-2 flex-none rounded-full ${STATUS_DOT[snapshot.agentStatus]}`} />
              <span className="flex-1 truncate text-sm font-medium">
                {snapshot.terminalTitle || snapshot.agent}
              </span>
              <span className="flex-none text-xs text-zinc-500">{snapshot.agentStatus}</span>
            </button>
            <p className="mt-1 truncate text-xs text-zinc-500">{snapshot.foregroundCwd ?? snapshot.cwd}</p>
            {expandedPaneId === snapshot.paneId && <HerdrAgentDetail paneId={snapshot.paneId} />}
          </li>
        ))}
      </ul>
    </div>
  );
}
