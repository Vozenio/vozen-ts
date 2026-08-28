import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@bb/shared-ui/button";
import { Icon } from "@bb/shared-ui/icon";
import { Input } from "@bb/shared-ui/input";
import { cn } from "@bb/shared-ui/lib/utils";
import { CopyableInlineLabel } from "@/components/ui/copy-button";
import {
  ConfirmDeleteDialog,
  ConfirmDeleteDialogContent,
} from "@/components/dialogs/ConfirmDeleteDialog";
import { SettingsSection } from "@/components/ui/settings-section";
import { appToast } from "@/components/ui/app-toast";
import { formatRelativeTime } from "@/lib/relative-time";

// Mirrors src/apps/server/connectManager.ts's ConnectStatus — kept local
// instead of a shared import for the same reason HerdrAgentsView.tsx does:
// the web app has no build-time dependency on server code.
type ConnectState = "disconnected" | "pairing" | "connected" | "reconnecting";

interface ConnectStatus {
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

const CONNECT_STATUS_QUERY_KEY = ["vozen-connect-status"];

const STATE_LABEL: Record<ConnectState, string> = {
  disconnected: "Disconnected",
  pairing: "Pairing…",
  connected: "Connected",
  reconnecting: "Reconnecting…",
};

const STATE_DOT_CLASS: Record<ConnectState, string> = {
  disconnected: "bg-muted-foreground",
  pairing: "bg-amber-500",
  connected: "bg-emerald-500",
  reconnecting: "bg-amber-500",
};

async function fetchConnectStatus(signal: AbortSignal): Promise<ConnectStatus> {
  const response = await fetch("/vozen/connect/status", { signal });
  if (!response.ok) throw new Error(`Remote access status request failed: ${response.status}`);
  return response.json();
}

function useConnectStatus() {
  return useQuery({
    queryKey: CONNECT_STATUS_QUERY_KEY,
    queryFn: ({ signal }) => fetchConnectStatus(signal),
    refetchInterval: 3000,
  });
}

function normalizePairingCode(raw: string): string {
  const alnum = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return alnum.length <= 4 ? alnum : `${alnum.slice(0, 4)}-${alnum.slice(4, 8)}`;
}

function isCompletePairingCode(value: string): boolean {
  return /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(value);
}

/** "retrying in 12s" from a scheduled retry timestamp; recomputed on every
 * render (the status query already polls every 3s, which is plenty of
 * resolution for a countdown — no separate ticking clock needed). */
function retryHint(nextRetryAt: number | null): string {
  if (nextRetryAt === null) return "retrying automatically";
  const seconds = Math.max(0, Math.round((nextRetryAt - Date.now()) / 1000));
  return seconds > 0 ? `retrying in ${seconds}s` : "retrying…";
}

function StepNumber({ value }: { value: number }) {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
      {value}
    </span>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function PairForm({ dashboardUrl }: { dashboardUrl: string }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const dashboardHost = hostOf(dashboardUrl);

  const pairMutation = useMutation({
    mutationFn: async (rawCode: string): Promise<ConnectStatus> => {
      const response = await fetch("/vozen/connect/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: rawCode }),
      });
      const body = (await response.json().catch(() => ({}))) as ConnectStatus & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not redeem this code.");
      return body;
    },
    onSuccess: (status) => {
      queryClient.setQueryData(CONNECT_STATUS_QUERY_KEY, status);
      setError(null);
      setCode("");
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-subtle-foreground">
        Pairing gives this vozen a private URL like{" "}
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
          &lt;handle&gt;.vozen.io
        </span>
        . Your code and data stay on this machine.
      </p>

      <div className="flex items-start gap-2.5">
        <StepNumber value={1} />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm text-subtle-foreground">Get a one-time connect code from your {dashboardHost} dashboard.</p>
          <Button type="button" asChild>
            <a href={dashboardUrl} target="_blank" rel="noopener noreferrer">
              Get a connect code
              <Icon name="ExternalLink" className="size-3.5" />
            </a>
          </Button>
        </div>
      </div>
      <div className="flex items-start gap-2.5">
        <StepNumber value={2} />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm text-subtle-foreground">Paste it here — it connects automatically.</p>
          <Input
            value={code}
            placeholder="XXXX-XXXX"
            maxLength={9}
            autoFocus
            disabled={pairMutation.isPending}
            className="text-center font-mono text-lg tracking-widest uppercase"
            onChange={(event) => {
              const next = normalizePairingCode(event.target.value);
              setCode(next);
              setError(null);
              if (isCompletePairingCode(next) && !pairMutation.isPending) {
                pairMutation.mutate(next);
              }
            }}
          />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
      </div>

      <p className="flex items-start gap-1.5 text-xs text-subtle-foreground">
        <Icon name="AlertTriangle" className="mt-px size-3.5 shrink-0 opacity-70" aria-hidden />
        Anyone signed in to your {dashboardHost} account gets full control of this vozen.
      </p>
    </div>
  );
}

function ConnectedView({ status }: { status: ConnectStatus }) {
  const queryClient = useQueryClient();
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const isUnreachable = status.state !== "connected";

  const disconnectMutation = useMutation({
    mutationFn: async (): Promise<ConnectStatus> => {
      const response = await fetch("/vozen/connect/disconnect", { method: "POST" });
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      return response.json();
    },
    onSuccess: (nextStatus) => {
      queryClient.setQueryData(CONNECT_STATUS_QUERY_KEY, nextStatus);
      setConfirmingDisconnect(false);
    },
    onError: () => appToast.error("Could not disconnect remote access."),
  });

  return (
    <div className="space-y-3">
      {isUnreachable ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
          <span className={cn("mt-1 size-2 shrink-0 rounded-full", STATE_DOT_CLASS[status.state])} />
          <span>
            <span className="font-medium text-amber-700 dark:text-amber-400">{STATE_LABEL[status.state]}</span>
            {status.state === "reconnecting" ? (
              <span className="text-subtle-foreground"> — {retryHint(status.nextRetryAt)}</span>
            ) : null}
            {status.lastError ? <span className="text-subtle-foreground"> — {status.lastError}</span> : null}
          </span>
        </div>
      ) : null}

      {status.url ? (
        <div className="space-y-1">
          <p className="text-xs text-subtle-foreground">Your vozen will be reachable at:</p>
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
            <CopyableInlineLabel text={status.url} label="Copy remote access URL" className="flex-1 font-mono text-sm">
              {status.url}
            </CopyableInlineLabel>
          </div>
        </div>
      ) : null}

      {status.state === "connected" ? (
        <p className="text-xs text-subtle-foreground">
          {status.remoteClients > 0
            ? `${status.remoteClients} device${status.remoteClients === 1 ? "" : "s"} connected`
            : "No devices connected right now"}
          {status.lastRemoteActivityAt !== null
            ? ` · last activity ${formatRelativeTime({ timestamp: status.lastRemoteActivityAt, now: Date.now() })}`
            : null}
        </p>
      ) : null}

      {isUnreachable ? (
        <p className="text-xs text-subtle-foreground">
          Remote devices can&apos;t reach this vozen right now. Local access is unaffected.
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button
          variant="destructive"
          size="sm"
          disabled={disconnectMutation.isPending}
          onClick={() => setConfirmingDisconnect(true)}
        >
          Disconnect
        </Button>
      </div>

      <ConfirmDeleteDialog open={confirmingDisconnect} onOpenChange={setConfirmingDisconnect}>
        <ConfirmDeleteDialogContent
          title="Disconnect remote access?"
          description={`${status.handle ? `${status.handle}.vozen.io` : "This vozen"} will stop working on all devices. Re-pairing needs a new code from your ${hostOf(status.dashboardUrl)} dashboard.`}
          confirmLabel="Disconnect"
          pending={disconnectMutation.isPending}
          onConfirm={() => disconnectMutation.mutate()}
          onCancel={() => setConfirmingDisconnect(false)}
        />
      </ConfirmDeleteDialog>
    </div>
  );
}

export function RemoteAccessSettingsSection() {
  const statusQuery = useConnectStatus();

  return (
    <SettingsSection
      title={
        <span className="flex items-center gap-1.5">
          <Icon name="Smartphone" className="size-4" aria-hidden />
          Remote access
        </span>
      }
      description="Remote access via vozen.io — this vozen becomes reachable at https://<handle>.vozen.io. Disable to cut off all remote access."
    >
      {statusQuery.isLoading || !statusQuery.data ? (
        <p className="text-sm text-subtle-foreground">Loading…</p>
      ) : statusQuery.data.paired ? (
        <ConnectedView status={statusQuery.data} />
      ) : (
        <PairForm dashboardUrl={statusQuery.data.dashboardUrl} />
      )}
    </SettingsSection>
  );
}
