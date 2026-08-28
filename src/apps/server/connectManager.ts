/**
 * In-process wrapper around TunnelClient that main.ts owns and http.ts
 * queries — backs a small settings page (own route, not bb's vendored
 * frontend, which we don't modify) mirroring bb's real "Remote access"
 * panel: state/paired/handle/url/dashboardUrl/lastError, pair-by-code, and
 * disconnect. Not the plugin-RPC protocol bb's actual panel uses (that
 * would mean serving a second plugin bundle and a whole new dispatch
 * layer) — a purpose-built page reaching the same goal (see spec/plan.md).
 *
 * Disconnect matches bb's real semantics exactly: it forgets the
 * credential, not just stops dialing. There is no reconnect() — bb's own
 * plugin has none either, since a forgotten credential can only come back
 * via pair() with a fresh code.
 */

import * as connectClient from "../../plugins/connect/client.ts";
import * as credentials from "../../plugins/connect/credentials.ts";
import { TunnelClient } from "../../plugins/connect/client.ts";

// vozen's fixed relay — there's only ever one, so unlike bb (which derives
// baseUrl from an arbitrary serverUrl) nothing needs to be passed in.
const DEFAULT_WORKER_URL = "https://vozen.io";
const DASHBOARD_URL = "https://register.vozen.io";

// Matches bb's own connect-status vocabulary (disconnected/pairing/
// connected/reconnecting) rather than vozen's earlier ad-hoc states, so
// "paired but not dialing" (disconnect()) and "never paired" both fall
// under "disconnected", distinguished by `paired`.
export type ConnectState = "disconnected" | "pairing" | "connected" | "reconnecting";

export interface ConnectStatus {
  state: ConnectState;
  paired: boolean;
  handle: string | null;
  url: string | null;
  dashboardUrl: string;
  lastError: string | null;
  since: number | null;
  /** Epoch ms of the next reconnect attempt — null when connected or not
   * paired (nothing scheduled). */
  nextRetryAt: number | null;
  /** Approximate count of remote devices currently viewing the app through
   * the tunnel (see TunnelClient.activeStreamCount's doc comment). */
  remoteClients: number;
  /** Epoch ms of the last frame the tunnel actually carried, or null before
   * any traffic has passed through it this run. */
  lastRemoteActivityAt: number | null;
}

export class ConnectManager {
  private client: TunnelClient | null = null;
  private disabled = false;
  private status: ConnectStatus;

  constructor(private readonly localBaseUrl: string) {
    const creds = credentials.load();
    this.status = creds
      ? { state: "reconnecting", paired: true, handle: creds.handle, url: this.remoteUrl(creds.workerUrl, creds.handle), dashboardUrl: DASHBOARD_URL, lastError: null, since: null, nextRetryAt: null, remoteClients: 0, lastRemoteActivityAt: null }
      : { state: "disconnected", paired: false, handle: null, url: null, dashboardUrl: DASHBOARD_URL, lastError: null, since: null, nextRetryAt: null, remoteClients: 0, lastRemoteActivityAt: null };
    if (creds) this.start();
  }

  private remoteUrl(workerUrl: string, handle: string): string {
    return `https://${handle}.${new URL(workerUrl).host}`;
  }

  private start(): void {
    const creds = credentials.load();
    if (!creds) return;
    // Set synchronously — runForever's onConnected/onDisconnected callbacks
    // only fire once a dial attempt actually resolves, which would
    // otherwise leave getStatus() reporting stale (or disconnected) data
    // for however long the first attempt takes.
    this.status = { state: "reconnecting", paired: true, handle: creds.handle, url: this.remoteUrl(creds.workerUrl, creds.handle), dashboardUrl: DASHBOARD_URL, lastError: null, since: null, nextRetryAt: null, remoteClients: 0, lastRemoteActivityAt: null };
    this.client = new TunnelClient(creds.workerUrl, creds.handle, creds.credential, this.localBaseUrl);
    void this.client.runForever(
      () => {
        this.status = { ...this.status, state: "connected", lastError: null, since: Date.now(), nextRetryAt: null };
      },
      (error, nextRetryAt) => {
        if (this.disabled) return;
        this.status = { ...this.status, state: "reconnecting", lastError: error?.message ?? null, nextRetryAt };
      },
    );
  }

  getStatus(): ConnectStatus {
    return {
      ...this.status,
      remoteClients: this.client?.activeStreamCount ?? 0,
      lastRemoteActivityAt: this.client?.lastActivityAt ?? null,
    };
  }

  /** Forgets the credential outright — matches bb's real "Disconnect"
   * ("Disconnecting forgets this bb's credential."). Reconnecting needs a
   * fresh pairing code via pair(), same as never having been paired. */
  disconnect(): void {
    this.disabled = true;
    this.client?.stop();
    this.client = null;
    credentials.clear();
    this.status = {
      state: "disconnected", paired: false, handle: null, url: null,
      dashboardUrl: DASHBOARD_URL, lastError: null, since: null,
      nextRetryAt: null, remoteClients: 0, lastRemoteActivityAt: null,
    };
  }

  /** Exchanges a short pairing code (minted by register.vozen.io's web
   * login flow) for the actual credential, then saves it and starts the
   * tunnel — matches bb's real pair()/redeemConnectCode() flow. The
   * credential is fetched here, server-side, and never touches the
   * browser or a URL. Throws RedeemError on an invalid/expired/used code
   * or a network failure. */
  async pair(code: string): Promise<void> {
    this.status = { ...this.status, state: "pairing", lastError: null };
    let result: connectClient.RegisterResult;
    try {
      result = await connectClient.redeem(DEFAULT_WORKER_URL, code);
    } catch (error) {
      this.status = { ...this.status, state: "disconnected", lastError: error instanceof Error ? error.message : String(error) };
      throw error;
    }
    credentials.save(DEFAULT_WORKER_URL, result.handle, result.credential);
    this.client?.stop();
    this.disabled = false;
    this.start();
  }
}
