/**
 * vozen connect relay: a Cloudflare Worker that lets a phone/laptop reach a
 * vozen server running on a machine with no public IP. One machine ==
 * one handle == one Durable Object holding the (at most one) live tunnel
 * WebSocket for that handle. Visitor HTTP/WS requests to
 * `https://<handle>.<apex>/*` are wrapped as frames (packages/tunnel_contract
 * on the Python side re-implements the same wire format) and sent down that
 * tunnel; responses come back the same way and are re-assembled here.
 *
 * Deliberately much smaller than bb connect's apps/connect: no accounts
 * table, no multi-tenant dashboard. Two ways to claim a handle: the CLI's
 * shared SETUP_TOKEN secret (see wrangler.toml), or the web login flow at
 * register.<apex> (GitHub OAuth -> short pairing code -> POST
 * /api/connect/redeem), mirroring bb's own redeemConnectCode()/pairing-code
 * design so a credential never transits a URL or a browser tab.
 */

const HEADER_SIZE = 5; // 1 byte type + 4 bytes big-endian streamId

const FRAME = {
  OPEN_HTTP: 1,
  BODY_CHUNK: 2,
  BODY_END: 3,
  RESP_HEAD: 4,
  OPEN_WS: 5,
  WS_OPEN_ACK: 6,
  WS_DATA: 7,
  CLOSE_STREAM: 8,
} as const;

const HEARTBEAT_PING = "vzt:hb";
const HEARTBEAT_PONG = "vzt:hb-ack";

const HOP_BY_HOP_HEADERS = new Set(["connection", "keep-alive", "transfer-encoding", "upgrade", "host"]);

interface Env {
  TUNNEL_DO: DurableObjectNamespace;
  DB: D1Database;
  APEX_DOMAIN: string;
  SETUP_TOKEN: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  SESSION_SECRET: string;
}

function encodeFrame(type: number, streamId: number, payload: Uint8Array = new Uint8Array(0)): Uint8Array {
  const out = new Uint8Array(HEADER_SIZE + payload.length);
  out[0] = type;
  new DataView(out.buffer).setUint32(1, streamId, false);
  out.set(payload, HEADER_SIZE);
  return out;
}

function decodeFrame(data: ArrayBuffer): { type: number; streamId: number; payload: Uint8Array } {
  const view = new DataView(data);
  return { type: view.getUint8(0), streamId: view.getUint32(1, false), payload: new Uint8Array(data, HEADER_SIZE) };
}

function encodeJsonFrame(type: number, streamId: number, obj: unknown): Uint8Array {
  return encodeFrame(type, streamId, new TextEncoder().encode(JSON.stringify(obj)));
}

function decodeJsonPayload(payload: Uint8Array): any {
  return JSON.parse(new TextDecoder().decode(payload));
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// --- registration (POST https://<apex>/api/connect/register) ---

function normalizeHandle(raw: string): string | null {
  const handle = raw.trim().toLowerCase();
  return /^[a-z0-9-]{3,63}$/.test(handle) ? handle : null;
}

type ClaimResult = { ok: true; credential: string } | { ok: false; status: number; error: string };

// Registration is open to any GitHub login now (no more single-owner
// allowlist) — this caps total handles ever claimed so an unbounded flood of
// signups can't run up D1/Durable Object usage unattended. Raise it (or
// replace it with a real quota system) once that's actually needed.
const MAX_DEVICES = 100;

/** Shared by both registration paths (CLI's shared setup-token, and the
 * web login flow's session-cookie gate) — the actual "claim this handle"
 * logic is identical either way, only the caller's auth check differs. */
async function claimHandle(env: Env, handle: string): Promise<ClaimResult> {
  const existing = await env.DB.prepare("SELECT handle FROM devices WHERE handle = ?").bind(handle).first();
  if (existing) {
    return { ok: false, status: 409, error: "handle already taken" };
  }
  const countRow = await env.DB.prepare("SELECT COUNT(*) AS count FROM devices").first<{ count: number }>();
  if ((countRow?.count ?? 0) >= MAX_DEVICES) {
    return { ok: false, status: 503, error: "registration is full — try again later" };
  }
  const credential = crypto.randomUUID() + crypto.randomUUID();
  const credentialHash = await sha256Hex(credential);
  await env.DB.prepare("INSERT INTO devices (handle, credential_hash, created_at) VALUES (?, ?, ?)")
    .bind(handle, credentialHash, Date.now())
    .run();
  return { ok: true, credential };
}

// --- pairing codes (register.<apex>'s web login flow mints one, a vozen
// server redeems it) — matches bb's real redeemConnectCode()/`/api/connect/
// redeem` design: a human logs into the dashboard, gets a short one-time
// code, and pastes it into the app running on the machine to be reached
// remotely. The credential itself is only ever minted at redeem time and
// handed directly to that machine — it never appears in a URL or a browser
// tab, unlike vozen's earlier claim-URL design.
const PAIRING_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const PAIRING_CODE_TTL_MS = 10 * 60 * 1000;

function generatePairingCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = Array.from(bytes, (b) => PAIRING_CODE_ALPHABET[b % PAIRING_CODE_ALPHABET.length]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
}

function normalizePairingCode(raw: string): string {
  return raw.trim().toUpperCase();
}

async function handleRegister(request: Request, env: Env): Promise<Response> {
  let body: { handle?: string; setupToken?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: "invalid JSON body" });
  }
  if (body.setupToken !== env.SETUP_TOKEN) {
    return jsonResponse(403, { error: "invalid setup token" });
  }
  const handle = normalizeHandle(body.handle || "");
  if (!handle) {
    return jsonResponse(400, { error: "handle must be 3-63 chars of [a-z0-9-]" });
  }
  const result = await claimHandle(env, handle);
  if (!result.ok) return jsonResponse(result.status, { error: result.error });
  return jsonResponse(200, { handle, credential: result.credential, serverUrl: `https://${handle}.${env.APEX_DOMAIN}` });
}

async function isValidCredential(env: Env, handle: string, credential: string | null): Promise<boolean> {
  if (!credential) return false;
  const row = await env.DB.prepare("SELECT credential_hash, revoked_at FROM devices WHERE handle = ?")
    .bind(handle)
    .first<{ credential_hash: string; revoked_at: number | null }>();
  if (!row || row.revoked_at) return false;
  return row.credential_hash === (await sha256Hex(credential));
}

// --- login page (GET/POST https://register.<apex>/*) — a real "log in with
// GitHub, click a button" alternative to `vozen connect register
// --setup-token`. Entirely separate from vozen's vendored bb frontend (which
// this Worker knows nothing about) — just a small hand-written page served
// directly by this Worker, so nothing about the frontend has to change.

const SESSION_COOKIE = "vozen_session";
const OAUTH_STATE_COOKIE = "vozen_oauth_state";
const RETURN_TO_COOKIE = "vozen_return_to";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function createSessionCookieValue(env: Env, login: string): Promise<string> {
  const encoded = btoa(JSON.stringify({ login, exp: Date.now() + SESSION_TTL_SECONDS * 1000 }));
  return `${encoded}.${await hmacSha256Hex(env.SESSION_SECRET, encoded)}`;
}

/** Returns the logged-in GitHub login, or null if there is no session / it's
 * expired / the signature doesn't match (tampered or signed with an old
 * secret). Self-contained (HMAC-signed, not a DB lookup) — any GitHub login
 * that completes OAuth is a valid session; there is no allowlist to check
 * against a table. */
async function verifySessionCookieValue(env: Env, value: string | null): Promise<string | null> {
  if (!value) return null;
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) return null;
  if (signature !== (await hmacSha256Hex(env.SESSION_SECRET, encoded))) return null;
  try {
    const payload = JSON.parse(atob(encoded)) as { login: string; exp: number };
    return Date.now() <= payload.exp ? payload.login : null;
  } catch {
    return null;
  }
}

function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie") || "";
  const match = header.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

function htmlResponse(body: string, status = 200, extraHeaders: HeadersInit = {}): Response {
  return new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", ...extraHeaders } });
}

function loginPage(loggedInAs: string | null): Response {
  const body = loggedInAs
    ? `<!doctype html><html><body style="font-family:system-ui;max-width:480px;margin:40px auto">
        <p>Logged in as <b>${loggedInAs}</b> · <a href="/auth/logout">Log out</a></p>
        <h2>Register a machine</h2>
        <form method="POST" action="/api/connect/register-web">
          <input name="handle" placeholder="handle (e.g. felix)" required pattern="[a-z0-9-]{3,63}"
                 style="padding:8px;width:100%;box-sizing:border-box;font-size:16px">
          <button type="submit" style="margin-top:8px;padding:8px 16px;font-size:16px">Register</button>
        </form>
      </body></html>`
    : `<!doctype html><html><body style="font-family:system-ui;max-width:480px;margin:40px auto">
        <h2>vozen connect</h2>
        <a href="/auth/github/start"
           style="display:inline-block;padding:10px 20px;background:#24292e;color:#fff;border-radius:6px;text-decoration:none">
          Log in with GitHub
        </a>
      </body></html>`;
  return htmlResponse(body);
}

// Only ever used to redirect back into this same relay (a visitor bounced
// here from an unauthenticated handle-subdomain request, see fetch() below)
// — rejecting anything else closes off an open-redirect via a crafted
// return_to param.
function isOwnUrl(candidate: string, apex: string): boolean {
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" && (parsed.hostname === apex || parsed.hostname.endsWith(`.${apex}`));
  } catch {
    return false;
  }
}

function handleGithubStart(request: Request, env: Env): Response {
  const url = new URL(request.url);
  const state = crypto.randomUUID();
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", `${url.origin}/auth/github/callback`);
  authorize.searchParams.set("scope", "read:user");
  authorize.searchParams.set("state", state);
  const headers = new Headers({ Location: authorize.toString() });
  headers.append("Set-Cookie", `${OAUTH_STATE_COOKIE}=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  const returnTo = url.searchParams.get("return_to");
  if (returnTo && isOwnUrl(returnTo, env.APEX_DOMAIN)) {
    headers.append(
      "Set-Cookie",
      `${RETURN_TO_COOKIE}=${encodeURIComponent(returnTo)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    );
  }
  return new Response(null, { status: 302, headers });
}

async function handleGithubCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || state !== getCookie(request, OAUTH_STATE_COOKIE)) {
    return htmlResponse("Invalid or expired OAuth state — try logging in again.", 400);
  }

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${url.origin}/auth/github/callback`,
    }),
  });
  const tokenJson = (await tokenResponse.json()) as { access_token?: string; error_description?: string };
  if (!tokenJson.access_token) {
    return htmlResponse(`GitHub OAuth failed: ${tokenJson.error_description ?? "unknown error"}`, 400);
  }

  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
      "User-Agent": "vozen-connect",
      Accept: "application/vnd.github+json",
    },
  });
  const userJson = (await userResponse.json()) as { login?: string };
  if (!userJson.login) {
    return htmlResponse("Could not read GitHub user profile.", 400);
  }

  const returnToRaw = getCookie(request, RETURN_TO_COOKIE);
  const returnTo = returnToRaw && isOwnUrl(decodeURIComponent(returnToRaw), env.APEX_DOMAIN)
    ? decodeURIComponent(returnToRaw)
    : "/";

  const sessionValue = await createSessionCookieValue(env, userJson.login);
  const headers = new Headers({ Location: returnTo });
  // Domain=.<apex> (not just register.<apex>) so any handle subdomain's own
  // auth check below can read this same cookie — the whole point is one
  // login covering every paired handle, not a separate login per handle.
  headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${sessionValue}; Domain=.${env.APEX_DOMAIN}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`,
  );
  headers.append("Set-Cookie", `${OAUTH_STATE_COOKIE}=; Path=/; Max-Age=0`);
  headers.append("Set-Cookie", `${RETURN_TO_COOKIE}=; Path=/; Max-Age=0`);
  return new Response(null, { status: 302, headers });
}

function handleLogout(env: Env): Response {
  const headers = new Headers({ Location: "/" });
  // Domain must match what createSessionCookieValue's cookie was set with —
  // a clearing Set-Cookie with a different Domain creates a second, useless
  // cookie instead of removing the real one.
  headers.append("Set-Cookie", `${SESSION_COOKIE}=; Domain=.${env.APEX_DOMAIN}; Path=/; Max-Age=0`);
  return new Response(null, { status: 302, headers });
}

async function handleRegisterWeb(request: Request, env: Env): Promise<Response> {
  const login = await verifySessionCookieValue(env, getCookie(request, SESSION_COOKIE));
  if (!login) return htmlResponse("Not logged in.", 401);

  const form = await request.formData();
  const handle = normalizeHandle(String(form.get("handle") || ""));
  if (!handle) return htmlResponse("Handle must be 3-63 chars of [a-z0-9-].", 400);

  const existing = await env.DB.prepare("SELECT handle FROM devices WHERE handle = ?").bind(handle).first();
  if (existing) return htmlResponse("handle already taken", 409);

  const code = generatePairingCode();
  await env.DB.prepare("INSERT INTO pairing_codes (code, handle, expires_at) VALUES (?, ?, ?)")
    .bind(code, handle, Date.now() + PAIRING_CODE_TTL_MS)
    .run();

  return htmlResponse(`<!doctype html><html><body style="font-family:system-ui;max-width:600px;margin:40px auto">
    <h2>Pairing code for '${handle}'</h2>
    <p style="font-size:32px;letter-spacing:2px;font-weight:bold;font-family:monospace">${code}</p>
    <p>On the machine you want to reach remotely, open
       <code>http://127.0.0.1:38890/vozen/connect</code> (or click below if
       <code>vozen serve</code> is already running on this machine) and paste
       this code in. It expires in 10 minutes and works once.</p>
    <a href="http://127.0.0.1:38890/vozen/connect?code=${code}"
       style="display:inline-block;padding:10px 20px;background:#24292e;color:#fff;border-radius:6px;text-decoration:none">
      Open on this machine
    </a>
    <p><a href="/">Back</a></p>
  </body></html>`);
}

async function handleRedeem(request: Request, env: Env): Promise<Response> {
  let body: { code?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: "invalid JSON body" });
  }
  const code = normalizePairingCode(body.code || "");
  if (!code) return jsonResponse(400, { error: "code is required" });

  const row = await env.DB.prepare("SELECT handle, expires_at, used_at FROM pairing_codes WHERE code = ?")
    .bind(code)
    .first<{ handle: string; expires_at: number; used_at: number | null }>();
  if (!row) return jsonResponse(400, { error: "invalid_code" });
  if (row.used_at) return jsonResponse(400, { error: "already_used" });
  if (Date.now() > row.expires_at) return jsonResponse(400, { error: "expired_code" });

  const result = await claimHandle(env, row.handle);
  if (!result.ok) return jsonResponse(result.status, { error: result.error });

  await env.DB.prepare("UPDATE pairing_codes SET used_at = ? WHERE code = ?").bind(Date.now(), code).run();
  return jsonResponse(200, { handle: row.handle, credential: result.credential, serverUrl: `https://${row.handle}.${env.APEX_DOMAIN}` });
}

// Same threshold bb's own apps/connect/src/cache.ts uses: only long-lived,
// non-private responses (vozen's hashed /assets/* files, Cache-Control:
// immutable) are worth caching at the edge. A hit here skips the tunnel
// entirely — no DO, no WebSocket frame, no round trip to the user's
// machine — which is the only optimization that changes the order of
// magnitude rather than shaving a constant factor off one hop.
function isCacheable(response: Response): boolean {
  if (response.status !== 200) return false;
  if (response.headers.has("Set-Cookie")) return false;
  const cacheControl = response.headers.get("Cache-Control") || "";
  if (/no-store|no-cache|private/i.test(cacheControl)) return false;
  const match = cacheControl.match(/max-age=(\d+)/i);
  return match !== null && parseInt(match[1], 10) >= 300;
}

// Bump this to invalidate every cached response at once — e.g. after a bug
// fix in how a response gets built (a bad DO round trip, a mid-reconnect
// race) can otherwise leave a wrong body cached under Cache-Control:
// immutable for a year with no other way to evict it. Folding it into the
// cache key (rather than calling cache.delete per URL) invalidates
// everything in one deploy, no enumeration of every asset path needed.
const CACHE_EPOCH = "2";

function cacheKeyFor(request: Request): Request {
  const url = new URL(request.url);
  url.searchParams.set("__cache_epoch", CACHE_EPOCH);
  return new Request(url.toString(), request);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const apex = env.APEX_DOMAIN;

    // Checked before the apex/subdomain branching below: the apex hostname
    // itself may already be claimed by an unrelated Worker/Custom Domain
    // (Cloudflare Custom Domains take priority over this Worker's wildcard
    // Route, so a request to the bare apex may never even reach this
    // function) — registration must work from any *.<apex> subdomain too,
    // not only the apex, so `vozen connect register` has a hostname that's
    // guaranteed to actually route here.
    if (url.pathname === "/api/connect/register" && request.method === "POST") {
      if (url.hostname === apex || url.hostname === `www.${apex}` || url.hostname.endsWith(`.${apex}`)) {
        return handleRegister(request, env);
      }
      return jsonResponse(404, { error: "not found" });
    }

    // Called by a vozen server (not a browser) once a human has pasted in a
    // code minted by register.<apex> — same subdomain reachability as
    // /api/connect/register above, for the same reason (apex may be claimed
    // by something else).
    if (url.pathname === "/api/connect/redeem" && request.method === "POST") {
      if (url.hostname === apex || url.hostname === `www.${apex}` || url.hostname.endsWith(`.${apex}`)) {
        return handleRedeem(request, env);
      }
      return jsonResponse(404, { error: "not found" });
    }

    // The human-facing login/register page and its GitHub OAuth flow live
    // only at register.<apex> — an actual device handle (felix.vozen.io)
    // must not also serve this, or a request there for "/" would show a
    // login page instead of proxying to (or 503ing for) that device.
    if (url.hostname === `register.${apex}`) {
      if (url.pathname === "/" && request.method === "GET") {
        const login = await verifySessionCookieValue(env, getCookie(request, SESSION_COOKIE));
        return loginPage(login);
      }
      if (url.pathname === "/auth/github/start" && request.method === "GET") {
        return handleGithubStart(request, env);
      }
      if (url.pathname === "/auth/github/callback" && request.method === "GET") {
        return handleGithubCallback(request, env);
      }
      if (url.pathname === "/auth/logout" && request.method === "GET") {
        return handleLogout(env);
      }
      if (url.pathname === "/api/connect/register-web" && request.method === "POST") {
        return handleRegisterWeb(request, env);
      }
    }

    if (url.hostname === apex || url.hostname === `www.${apex}`) {
      return jsonResponse(404, { error: "not found" });
    }

    if (!url.hostname.endsWith(`.${apex}`)) {
      return jsonResponse(404, { error: "not found" });
    }
    const handle = url.hostname.slice(0, -(apex.length + 1));

    if (url.pathname === "/__tunnel") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return jsonResponse(400, { error: "expected websocket upgrade" });
      }
      const auth = request.headers.get("Authorization") || "";
      const credential = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
      if (!(await isValidCredential(env, handle, credential))) {
        return jsonResponse(401, { error: "invalid credential" });
      }
      const id = env.TUNNEL_DO.idFromName(handle);
      return env.TUNNEL_DO.get(id).fetch(request);
    }

    // Everything past this point is a visitor's browser, not the vozen
    // server dialing in (that's /__tunnel above, gated by its own Bearer
    // credential) — knowing a handle's URL must not be enough to use
    // someone else's bb. Require the same GitHub session register.<apex>
    // issues, shared across subdomains via Domain=.<apex> on that cookie.
    const login = await verifySessionCookieValue(env, getCookie(request, SESSION_COOKIE));
    if (!login) {
      const returnTo = encodeURIComponent(request.url);
      return Response.redirect(`https://register.${apex}/auth/github/start?return_to=${returnTo}`, 302);
    }

    const id = env.TUNNEL_DO.idFromName(handle);

    if (request.method !== "GET" || request.headers.get("Upgrade") === "websocket") {
      return env.TUNNEL_DO.get(id).fetch(request);
    }

    const cache = caches.default;
    // A hard refresh (Cmd/Ctrl+Shift+R) sends Cache-Control: no-cache — honor
    // it as a bypass-and-heal signal: skip the read but still overwrite the
    // entry below, so a single hard refresh recovers from a bad cached
    // response (e.g. one cached before a bug fix shipped) without needing a
    // separate cache-purge API call.
    const bypassCache = /no-cache/i.test(request.headers.get("Cache-Control") || "");
    const cacheKey = cacheKeyFor(request);
    const cached = bypassCache ? null : await cache.match(cacheKey);
    if (cached) return cached;

    const response = await env.TUNNEL_DO.get(id).fetch(request);
    if (isCacheable(response)) {
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    }
    return response;
  },
};

// --- Durable Object: one per handle, holds the (at most one) live tunnel ---

interface PendingHttpStream {
  headResolve: (resp: { status: number; headers: Record<string, string> }) => void;
  controller: ReadableStreamDefaultController<Uint8Array>;
}

// Every hibernatable WebSocket this DO accepts carries a tag identifying
// what it is: the tunnel client's own socket is tagged TUNNEL_TAG, and each
// visitor socket is tagged `visitor:${streamId}` (with the same streamId
// also stashed in its attachment, so the mapping survives a hibernate/wake
// cycle without any in-memory table — see visitorSocket() below). Matches
// bb's own apps/connect/src/tunnel-do.ts.
const TUNNEL_TAG = "tunnel";

// Standard WebSocket readyState numbering (workerd's READY_STATE_OPEN; the
// constant itself is Cloudflare-only, so it's hardcoded here — same
// workaround bb's own tunnel-do.ts uses).
const WS_READY_STATE_OPEN = 1;

// ws.close() only accepts 1000 or 3000-4999; a code coming from a visitor's
// browser close event (e.g. 1005, 1006) throws if passed straight through.
// Same clamp bb's tunnel-do.ts uses.
function safeCloseCode(code: number): number {
  return code === 1000 || (code >= 3000 && code <= 4999) ? code : 1000;
}

export class TunnelDO {
  // Only http streams live here — a request in flight keeps the DO active
  // regardless, so this in-memory map cannot be lost to hibernation while it
  // matters. WS streams have no such map: state.getWebSockets(tag) is the
  // source of truth (see visitorSocket() below), same split as bb's
  // pendingHttp vs. tag-based visitor lookup.
  private pendingHttp = new Map<number, PendingHttpStream>();
  private nextStreamId: number;

  constructor(private readonly state: DurableObjectState) {
    // Resume stream-id allocation above any visitor sockets that survived
    // hibernation, so a freshly-woken instance never hands out an id that
    // collides with one a still-open visitor socket is tagged with.
    let maxSeen = 0;
    for (const ws of this.state.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as { streamId?: number } | null;
      if (attachment?.streamId && attachment.streamId > maxSeen) maxSeen = attachment.streamId;
    }
    this.nextStreamId = maxSeen + 1;
    // The edge answers a HEARTBEAT_PING text frame with HEARTBEAT_PONG on
    // its own, without waking this Durable Object — the tunnel client's
    // active heartbeat (src/plugins/connect/client.ts) is pure keep-alive
    // traffic against Cloudflare's idle policies, not DO compute.
    this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair(HEARTBEAT_PING, HEARTBEAT_PONG));
  }

  /** Looked up on demand rather than cached: state.getWebSockets(tag) is the
   * durable source of truth for a visitor socket, surviving a
   * hibernate/wake cycle the same way tunnelSocket() does below. */
  private visitorSocket(streamId: number): WebSocket | null {
    return this.state.getWebSockets(`visitor:${streamId}`)[0] ?? null;
  }

  /** Looked up on demand rather than cached in a field: auto-responded
   * heartbeats never wake this DO, so a quiet tunnel can go through a
   * hibernate/wake cycle (fresh instance, fields reset) while the socket
   * itself survives — state.getWebSockets() still finds it because it was
   * accepted via acceptWebSocket(), not server.accept(). */
  private tunnelSocket(): WebSocket | null {
    const sockets = this.state.getWebSockets(TUNNEL_TAG);
    for (let i = sockets.length - 1; i >= 0; i--) {
      if (sockets[i].readyState === WS_READY_STATE_OPEN) return sockets[i];
    }
    return null;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/__tunnel") {
      for (const existing of this.state.getWebSockets(TUNNEL_TAG)) {
        try {
          existing.close(1000, "replaced by new dial");
        } catch {
          // already dead — must not block the replacement from connecting
        }
      }
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.state.acceptWebSocket(server, [TUNNEL_TAG]);
      return new Response(null, { status: 101, webSocket: client });
    }

    if (request.headers.get("Upgrade") === "websocket") {
      return this.openVisitorWebSocket(request);
    }
    return this.proxyHttp(request);
  }

  /** Hibernatable WebSockets API lifecycle hook — now fires for both the
   * tunnel socket and every visitor socket (both are accepted via
   * state.acceptWebSocket()), so the first thing it must do is tell them
   * apart. Same dispatch bb uses: state.getTags(ws) rather than guessing
   * from the message shape. */
  webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): void {
    if (this.state.getTags(ws).includes(TUNNEL_TAG)) {
      // Heartbeat text is answered at the edge by setWebSocketAutoResponse
      // and never reaches here; anything else that's text is unexpected —
      // ignore it rather than throw.
      if (typeof message === "string") return;
      this.handleTunnelFrame(decodeFrame(message));
      return;
    }

    // A visitor socket sent us something — read its streamId back out of
    // the attachment (not an in-memory map: it must still be there after a
    // hibernate/wake cycle) and wrap it into a WS_DATA frame for the tunnel.
    const attachment = ws.deserializeAttachment() as { streamId: number } | null;
    if (!attachment) return;
    const tunnel = this.tunnelSocket();
    if (!tunnel) {
      ws.close(1011, "tunnel disconnected");
      return;
    }
    const isBinary = typeof message !== "string";
    const data = isBinary ? new Uint8Array(message as ArrayBuffer) : new TextEncoder().encode(message as string);
    const payload = new Uint8Array(1 + data.length);
    payload[0] = isBinary ? 1 : 0;
    payload.set(data, 1);
    try {
      tunnel.send(encodeFrame(FRAME.WS_DATA, attachment.streamId, payload));
    } catch {
      ws.close(1011, "tunnel disconnected");
    }
  }

  /** Frames arriving from the tunnel client, keyed by streamId. An id found
   * in pendingHttp is an HTTP stream; otherwise it must be a WS stream, and
   * the visitor socket itself (found via its hibernation tag) is the only
   * state needed — same split as bb's onTunnelFrame(). */
  private handleTunnelFrame({ type, streamId, payload }: { type: number; streamId: number; payload: Uint8Array }): void {
    const httpStream = this.pendingHttp.get(streamId);
    if (httpStream) {
      if (type === FRAME.RESP_HEAD) {
        httpStream.headResolve(decodeJsonPayload(payload));
      } else if (type === FRAME.BODY_CHUNK) {
        httpStream.controller.enqueue(payload);
      } else if (type === FRAME.BODY_END || type === FRAME.CLOSE_STREAM) {
        httpStream.controller.close();
        this.pendingHttp.delete(streamId);
      }
      return;
    }

    const visitor = this.visitorSocket(streamId);
    if (!visitor) return;
    if (type === FRAME.WS_DATA) {
      const isBinary = payload[0] === 1;
      const data = payload.subarray(1);
      try {
        visitor.send(isBinary ? data : new TextDecoder().decode(data));
      } catch {
        // visitor socket died; its own webSocketClose/Error hook (below)
        // will tell the tunnel.
      }
    } else if (type === FRAME.CLOSE_STREAM) {
      try {
        visitor.close(1000, "tunnel closed stream");
      } catch {
        // already closed
      }
    }
  }

  /** Fires for both socket kinds now. The tunnel socket closing needs no
   * action here: tunnelSocket() just re-scans state.getWebSockets() on its
   * next call and finds nothing live, same as before this fix. A visitor
   * socket closing must tell the tunnel to give up on that stream. */
  webSocketClose(ws: WebSocket, code: number, reason: string, _wasClean: boolean): void {
    if (this.state.getTags(ws).includes(TUNNEL_TAG)) return;
    const attachment = ws.deserializeAttachment() as { streamId: number } | null;
    if (attachment) {
      this.tunnelSocket()?.send(encodeFrame(FRAME.CLOSE_STREAM, attachment.streamId));
    }
    // Complete the close handshake: the hibernation API doesn't do this on
    // its own for a client-initiated close (matches bb's tunnel-do.ts).
    try {
      ws.close(safeCloseCode(code), reason);
    } catch {
      // already closed
    }
  }

  webSocketError(ws: WebSocket, _error: unknown): void {
    this.webSocketClose(ws, 1011, "socket error", false);
  }

  private async proxyHttp(request: Request): Promise<Response> {
    const tunnel = this.tunnelSocket();
    if (!tunnel) {
      return jsonResponse(503, { error: "offline", message: "no vozen server is currently connected" });
    }
    const url = new URL(request.url);
    const streamId = this.nextStreamId++;
    const headers: Record<string, string> = {};
    for (const [key, value] of request.headers) {
      if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) headers[key] = value;
    }
    const hasBody = request.body !== null && request.method !== "GET" && request.method !== "HEAD";

    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const bodyStream = new ReadableStream<Uint8Array>({
      start: (c) => {
        controller = c;
      },
    });
    const headPromise = new Promise<{ status: number; headers: Record<string, string> }>((resolve) => {
      this.pendingHttp.set(streamId, { headResolve: resolve, controller });
    });

    tunnel.send(
      encodeJsonFrame(FRAME.OPEN_HTTP, streamId, {
        method: request.method,
        path: url.pathname + url.search,
        headers,
        hasBody,
      })
    );
    if (hasBody && request.body) {
      const reader = request.body.getReader();
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        tunnel.send(encodeFrame(FRAME.BODY_CHUNK, streamId, value));
      }
    }
    tunnel.send(encodeFrame(FRAME.BODY_END, streamId));

    const head = await headPromise;
    // encodeBody: "manual" is required whenever a Content-Encoding header is
    // forwarded verbatim on an already-compressed body — without it,
    // workerd's default "automatic" encoding re-encodes a body it doesn't
    // know is already gzip'd, and the visitor's browser ends up rendering
    // raw compressed bytes as page content (confirmed live: bb hit the same
    // bug in apps/connect/src/response-encoding.ts, same fix).
    return new Response(bodyStream, { status: head.status, headers: head.headers, encodeBody: "manual" });
  }

  private openVisitorWebSocket(request: Request): Response {
    const tunnel = this.tunnelSocket();
    if (!tunnel) {
      return jsonResponse(503, { error: "offline", message: "no vozen server is currently connected" });
    }
    const url = new URL(request.url);
    const streamId = this.nextStreamId++;
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    // Hibernation API: tag + attachment carry the streamId instead of an
    // in-memory map, so this socket (and the mapping to it) survives a
    // hibernate/wake cycle. Message/close handling for it now happens in
    // the webSocketMessage/webSocketClose DO lifecycle hooks above, not via
    // addEventListener — those never fire on a hibernation-accepted socket.
    server.serializeAttachment({ streamId });
    this.state.acceptWebSocket(server, [`visitor:${streamId}`]);

    const headers: Record<string, string> = {};
    for (const [key, value] of request.headers) {
      if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) headers[key] = value;
    }
    tunnel.send(
      encodeJsonFrame(FRAME.OPEN_WS, streamId, { path: url.pathname + url.search, headers, protocols: null })
    );

    return new Response(null, { status: 101, webSocket: client });
  }
}
