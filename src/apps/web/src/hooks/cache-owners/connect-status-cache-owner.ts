import type { QueryClient } from "@tanstack/react-query";

// Mirrors src/apps/server/connectManager.ts's ConnectStatus — kept local
// instead of a shared import for the same reason HerdrAgentsView.tsx does:
// the web app has no build-time dependency on server code.
export type ConnectState = "disconnected" | "pairing" | "connected" | "reconnecting";

export interface ConnectStatus {
  state: ConnectState;
  paired: boolean;
  handle: string | null;
  url: string | null;
  dashboardUrl: string;
  lastError: string | null;
  since: number | null;
  nextRetryAt: number | null;
  remoteClients: number;
  lastRemoteActivityAt: number | null;
}

export const connectStatusQueryKey = ["vozen-connect-status"] as const;

export function setConnectStatusCache(args: {
  queryClient: QueryClient;
  status: ConnectStatus;
}): void {
  args.queryClient.setQueryData(connectStatusQueryKey, args.status);
}
