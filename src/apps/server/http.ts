/**
 * Hono HTTP app + WebSocket wiring for vozen's server. Ported from
 * http_api.py, but leans on Hono/Bun built-ins instead of hand-rolling what
 * they already solve: gzip negotiation (hono/compress), request body size
 * cap (hono/body-limit), static file serving (Bun.file), WebSocket
 * upgrade (hono/bun).
 */

import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Hono, type Context, type Next } from "hono";
import { pendingInteractionResolutionSchema } from "@bb/domain";
import { fuzzyMatchPaths } from "@bb/fuzzy-match";
import { threadStorageFilesQuerySchema } from "@bb/server-contract";
import {
  closeTerminalRequestSchema,
  createTerminalRequestSchema,
  terminalClientMessageSchema,
  terminalInputRequestSchema,
  terminalListQuerySchema,
  terminalOutputQuerySchema,
  terminalResizeRequestSchema,
  updateTerminalRequestSchema,
} from "@bb/server-contract";
import { bodyLimit } from "hono/body-limit";
import { upgradeWebSocket, websocket } from "hono/bun";
import { compress } from "hono/compress";
import { streamSSE } from "hono/streaming";
import * as shim from "./bbShim.ts";
import { subscriptionTargetKey } from "../../packages/domain/models.ts";
import { listHerdrAgents, readHerdrAgent } from "../../plugins/provider_herdr/client.ts";
import type { ConnectManager } from "./connectManager.ts";
import type { ThreadManager, WsSocket } from "./engine.ts";
import { TerminalManager } from "./terminalManager.ts";

// bb's own compiled frontend (vendored build output, rebranded to vozen —
// see spec/plan.md's "use bb's real frontend" decision).
// `bun build --compile` embeds source under a virtual $bunfs path — real
// disk paths relative to *that* don't exist, so a compiled binary must
// instead look for web-vozen next to the actual executable (ship them
// together: `vozen` binary + `web-vozen/` in the same directory). Plain
// `bun run src/main.ts` in dev keeps resolving from the real source tree.
const IS_COMPILED = import.meta.url.includes("$bunfs");
export const WEB_ROOT = IS_COMPILED
  ? path.join(path.dirname(process.execPath), "web-vozen")
  : path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "web", "dist");

const THREAD_ID_RE = "[a-zA-Z0-9_]+";

const MAX_BODY_BYTES = 10 * 1024 * 1024;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const WORKSPACE_FILE_WALK_CAP = 5000;

/** Recursively lists files under `root` (skipping `.git`/`node_modules`/dotfiles,
 * same convention as the "Add project" directory picker), relative-pathed with
 * `/` separators for fuzzyMatchPaths to rank. Stops at `cap` files so a huge
 * repo can't hang the request — ponytail: no .gitignore awareness, add if a
 * real repo's node_modules-adjacent noise turns out to matter. */
// The @-mention search re-queries on every keystroke; a short-TTL memo per
// root turns that burst into one real walk (bb proper keeps a live index via
// @parcel/watcher — a TTL is the cheap stand-in until that's ever needed).
const workspaceFilesCache = new Map<string, { at: number; result: { files: { path: string; name: string }[]; truncated: boolean } }>();
const WORKSPACE_FILES_CACHE_TTL_MS = 5_000;

async function listWorkspaceFiles(root: string, cap: number): Promise<{ files: { path: string; name: string }[]; truncated: boolean }> {
  const cached = workspaceFilesCache.get(root);
  if (cached && Date.now() - cached.at < WORKSPACE_FILES_CACHE_TTL_MS) return cached.result;
  const result = await walkWorkspaceFiles(root, cap);
  workspaceFilesCache.set(root, { at: Date.now(), result });
  return result;
}

async function walkWorkspaceFiles(root: string, cap: number): Promise<{ files: { path: string; name: string }[]; truncated: boolean }> {
  const files: { path: string; name: string }[] = [];
  let truncated = false;
  async function walk(dir: string, rel: string): Promise<void> {
    if (truncated) return;
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (truncated) return;
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(path.join(dir, entry.name), entryRel);
      } else if (entry.isFile()) {
        if (files.length >= cap) {
          truncated = true;
          return;
        }
        files.push({ path: entryRel, name: entry.name });
      }
    }
  }
  await walk(root, "");
  return { files, truncated };
}

function expandHome(inputPath: string): string {
  return inputPath === "~" || inputPath.startsWith("~/") ? path.join(os.homedir(), inputPath.slice(1)) : inputPath;
}

async function readJsonBody(c: { req: { json: () => Promise<unknown> } }): Promise<Record<string, unknown> | null> {
  try {
    const body = await c.req.json();
    return (body ?? {}) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const REMOTE_ACCESS_TUNNEL_HOSTNAME = "vozen.io";
const REMOTE_ACCESS_TUNNEL_HOSTNAME_SUFFIX = `.${REMOTE_ACCESS_TUNNEL_HOSTNAME}`;

/** Same-origin check for the WS upgrade routes below — hand-rolled because
 * a browser's normal same-origin policy doesn't apply to WebSocket upgrades
 * (no preflight, and any page can `new WebSocket(...)` cross-origin), so
 * this is the only thing standing between the terminal/`/ws` sockets and a
 * drive-by page on the LAN. A browser can't forge its own Origin header, so
 * checking it is sufficient (unlike, say, a Referer check).
 *
 * Two shapes are legitimate here:
 *  - Direct local browsing: Origin's host equals this request's own Host
 *    (the page was loaded from this very server).
 *  - The "remote access" tunnel (connectManager.ts / plugins/connect/
 *    client.ts): a Cloudflare Worker forwards a browser request from
 *    `https://<handle>.vozen.io` to this local server, carrying the
 *    browser's real Origin through untouched (Origin isn't a hop-by-hop
 *    header). `<handle>` is only known at runtime, so this matches the
 *    `vozen.io` domain suffix rather than a fixed value. */
function isAllowedWsOrigin(origin: string | undefined, selfHost: string | undefined): boolean {
  if (!origin) return false;
  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }
  if (selfHost && originUrl.host === selfHost) return true;
  return originUrl.hostname === REMOTE_ACCESS_TUNNEL_HOSTNAME || originUrl.hostname.endsWith(REMOTE_ACCESS_TUNNEL_HOSTNAME_SUFFIX);
}

/** Route guard for the `/ws` and `/ws/terminals/:id` upgrade routes — runs
 * (and can reject with a plain 403) before `upgradeWebSocket`'s factory
 * ever calls `server.upgrade()`, so a disallowed Origin never gets a
 * socket. See `isAllowedWsOrigin` for the allowed-origin rules. */
function wsOriginGuard(c: Context, next: Next) {
  if (!isAllowedWsOrigin(c.req.header("origin"), c.req.header("host"))) {
    return c.text("forbidden", 403);
  }
  return next();
}

export function createApp(engine: ThreadManager, connectManager?: ConnectManager, terminalManager?: TerminalManager) {
  const app = new Hono();
  const terminals = terminalManager ?? new TerminalManager(engine);

  app.use(
    "*",
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (c) => c.json({ error: "request body too large" }, 413),
    }),
  );
  app.use("*", compress());

  // --- vozen's own settings page for remote access (spec/plan.md: a
  // purpose-built page instead of bb's plugin-RPC "Remote access" panel,
  // which is a separate compiled plugin bundle vozen doesn't serve). ---
  if (connectManager) {
    app.get("/vozen/connect", (c) => {
      const status = connectManager.getStatus();
      return c.html(connectSettingsPage(status, c.req.query("code")));
    });
    app.get("/vozen/connect/status", (c) => c.json(connectManager.getStatus()));
    // Called by the paste-a-code form's own JS (never a plain browser
    // navigation, and the code never rides in a query string past this
    // one convenience prefill) — matches bb's PairForm calling its pair
    // RPC, not a claim-URL the browser follows.
    app.post("/vozen/connect/pair", async (c) => {
      if (c.req.header("x-vozen-via-tunnel")) return c.json({ error: "not allowed via remote access tunnel" }, 403);
      const body = await readJsonBody(c);
      const code = body?.code as string | undefined;
      if (!code) return c.json({ error: "code is required" }, 400);
      try {
        await connectManager.pair(code);
      } catch (error) {
        return c.json({ error: errorMessage(error) }, 400);
      }
      return c.json(connectManager.getStatus());
    });
    app.post("/vozen/connect/disconnect", (c) => {
      if (c.req.header("x-vozen-via-tunnel")) return c.json({ error: "not allowed via remote access tunnel" }, 403);
      connectManager.disconnect();
      return c.json(connectManager.getStatus());
    });
  }

  // --- WebSocket ---
  app.get(
    "/ws",
    wsOriginGuard,
    upgradeWebSocket(() => ({
      onOpen(_event, ws) {
        engine.registerWsClient(ws.raw as unknown as WsSocket);
      },
      onMessage(event, ws) {
        let message: Record<string, unknown>;
        try {
          message = JSON.parse(String(event.data));
        } catch {
          return;
        }
        const msgType = message.type;
        if (msgType === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        } else if (msgType === "subscribe" || msgType === "unsubscribe") {
          const key = subscriptionTargetKey((message.target as Record<string, unknown>) ?? {});
          if (key === null) return;
          if (msgType === "subscribe") engine.subscribe(ws.raw as unknown as WsSocket, key);
          else engine.unsubscribe(ws.raw as unknown as WsSocket, key);
        }
      },
      onClose(_event, ws) {
        engine.unregisterWsClient(ws.raw as unknown as WsSocket);
      },
    })),
  );

  app.get(
    "/ws/terminals/:terminalId",
    wsOriginGuard,
    upgradeWebSocket((c) => {
      const terminalId = c.req.param("terminalId") ?? "";
      const sinceSeq = Number(c.req.query("sinceSeq") ?? "0") || 0;
      return {
        onOpen(_event, ws) {
          const session = terminals.attach(terminalId, ws.raw as unknown as WsSocket, sinceSeq);
          if (!session) {
            ws.send(JSON.stringify({ type: "error", code: "terminal_not_found", message: `Unknown terminal ${terminalId}` }));
            ws.close();
          }
        },
        onMessage(event, ws) {
          let raw: unknown;
          try {
            raw = JSON.parse(String(event.data));
          } catch {
            return;
          }
          const message = terminalClientMessageSchema.safeParse(raw);
          if (!message.success) return;
          terminals.handleClientMessage(terminalId, message.data, ws.raw as unknown as WsSocket);
        },
        onClose(_event, ws) {
          terminals.detach(terminalId, ws.raw as unknown as WsSocket);
        },
      };
    }),
  );

  // --- bb REST contract (apps/server/bbShim.ts) ---

  app.get("/api/v1/system/version", (c) =>
    c.json({
      currentVersion: "0.1.0", latestVersion: null, source: "npm",
      updateAvailable: false, isDevelopment: true, upgradeCommand: "",
    }));

  // Persisted sections (general/keyboard/experiments) overlay the defaults —
  // the bb frontend PUTs a section below and refetches this whole config.
  app.get("/api/v1/system/config", (c) =>
    c.json({
      generalSettings: {
        showKeyboardHints: true, steerActiveThreadOnEnter: true, showUnhandledProviderEvents: false,
        providerOrder: ["codex"], defaultProviderId: "codex", streamerMode: false,
        ...(engine.appSetting("general") as Record<string, unknown> | null ?? {}),
      },
      keybindings: [], defaultKeybindings: [],
      keybindingOverrides: (engine.appSetting("keyboard") as unknown[] | null) ?? [],
      experiments: {
        changelogPreview: false, editMessages: false, mobileApp: false,
        providerSessionReaping: false, timelineWindowing: false,
        ...(engine.appSetting("experiments") as Record<string, unknown> | null ?? {}),
      },
      appearance: { themeId: "default", customCss: null, faviconColor: "default" },
      customThemes: [], pluginThemes: [],
      featureFlags: { placeholder: false, timelineWindowEventBudget: 5000 },
      hostDaemonPort: null, localHelperPorts: [],
      serverUrl: "http://127.0.0.1:38890",
      primaryHostId: shim.VOZEN_HOST_ID, primaryHostPlatform: null,
      voiceTranscriptionEnabled: false,
      aiServices: { transcription: "unavailable", inference: "none", inferenceFallback: "none", services: [] },
      dataDir: "",
    }));

  // Settings PUTs the frontend actually issues. general/experiments merge a
  // partial patch into the stored section; keyboard replaces the whole
  // overrides array (that's its wire shape). Responses echo the stored
  // value — the frontend ignores the body and refetches /system/config.
  app.put("/api/v1/settings/general", async (c) => {
    const body = await readJsonBody(c);
    if (body === null) return c.json({ error: "invalid JSON body" }, 400);
    const merged = { ...(engine.appSetting("general") as Record<string, unknown> | null ?? {}), ...body };
    engine.saveAppSetting("general", merged);
    return c.json(merged);
  });

  app.put("/api/v1/settings/experiments", async (c) => {
    const body = await readJsonBody(c);
    if (body === null) return c.json({ error: "invalid JSON body" }, 400);
    const merged = { ...(engine.appSetting("experiments") as Record<string, unknown> | null ?? {}), ...body };
    engine.saveAppSetting("experiments", merged);
    return c.json(merged);
  });

  app.put("/api/v1/settings/keyboard", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid JSON body" }, 400);
    }
    if (!Array.isArray(body)) return c.json({ error: "keyboard settings must be an overrides array" }, 400);
    engine.saveAppSetting("keyboard", body);
    return c.json(body);
  });

  app.get("/api/v1/hosts", (c) => c.json([shim.VOZEN_HOST]));
  app.get("/api/v1/hosts/:id", (c) => c.json(shim.VOZEN_HOST));
  app.get("/api/v1/hosts/:id/provider-clis/status", (c) => c.json({})); // record type: empty = "no CLI status known"

  // vozen has no CLI-skill-injection system (that's bb's own mechanism for
  // keeping a provider CLI's installed skills in sync) — "unknown" is
  // honest, not a guess, since vozen genuinely doesn't track this per host.
  app.get("/api/v1/system/cli-skills", (c) =>
    c.json({ machines: [{ hostId: shim.VOZEN_HOST_ID, hostName: shim.VOZEN_HOST.name, status: "unknown" }] }));

  // The "Add project" folder picker's interactive, single-level directory read.
  app.get("/api/v1/hosts/:id/directory", async (c) => {
    const requested = c.req.query("path");
    const target = requested ? expandHome(requested) : os.homedir();
    let resolved: string;
    try {
      resolved = await fs.realpath(target);
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 400);
    }
    let dirents: import("node:fs").Dirent<string>[];
    try {
      dirents = await fs.readdir(resolved, { withFileTypes: true, encoding: "utf-8" });
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 400);
    }
    const entries = dirents
      .filter((d) => !d.name.startsWith("."))
      .map((d) => ({
        kind: d.isDirectory() ? "directory" : "file",
        name: d.name,
        path: path.join(resolved, d.name),
      }))
      .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "directory" ? -1 : 1));
    const parent = path.dirname(resolved);
    return c.json({ directory: resolved, parent: parent === resolved ? null : parent, entries });
  });

  // Backs the "Add project" dialog's manual path input (inline existence
  // check as you type) — was falling through to the generic 404 catch-all,
  // silently failing that validation.
  app.post("/api/v1/hosts/:id/paths/exist", async (c) => {
    const body = await readJsonBody(c);
    const paths = Array.isArray(body?.paths)
      ? (body.paths as unknown[]).filter((p): p is string => typeof p === "string")
      : [];
    const existence: Record<string, boolean> = {};
    for (const raw of paths) {
      try {
        await fs.access(expandHome(raw));
        existence[raw] = true;
      } catch {
        existence[raw] = false;
      }
    }
    return c.json({ existence });
  });

  app.get("/api/v1/system/providers", (c) => {
    const herdrKinds = new Set(
      engine.list().map((t) => t.agent_kind).filter((k): k is string => Boolean(k) && k !== "codex" && k !== "claude"),
    );
    return c.json([shim.CODEX_PROVIDER_INFO, shim.CLAUDE_PROVIDER_INFO, ...[...herdrKinds].map(shim.providerInfoFor)]);
  });
  // bb's own route shape (server-contract's providerLogo: GET
  // /system/providers/:id/logo) — real vendored brand SVGs, not a generated
  // asset, so a 404 for an unknown id is the honest answer, not a fallback.
  app.get("/api/v1/system/providers/:id/logo", async (c) => {
    const filename = shim.PROVIDER_LOGO_FILENAMES[c.req.param("id")];
    if (!filename) return c.json({ error: "not found" }, 404);
    const file = Bun.file(path.join(import.meta.dir, "assets", "provider-logos", filename));
    if (!(await file.exists())) return c.json({ error: "not found" }, 404);
    return new Response(file, { headers: { "Content-Type": "image/svg+xml" } });
  });
  app.get("/api/v1/sidebar-bootstrap", (c) => c.json(shim.sidebarBootstrap(engine)));

  // Providers/models offered when composing a brand-new thread — codex and
  // claude are both real vozen-spawnable providers (see engine.ts's
  // spawn()), so both list unconditionally here regardless of whether any
  // thread of that kind currently exists.
  //
  // `models` is scoped to one provider at a time (bb's real contract:
  // systemExecutionOptionsQuerySchema's `providerId` — a picker re-queries
  // this per selected provider tab, it doesn't render every provider's
  // models in one flat list). No spec covers the omitted case for this
  // endpoint specifically (unlike its `systemUsageLimitsQuerySchema`
  // sibling, which is documented to aggregate) — codex is vozen's
  // longstanding default provider, so that's the reasonable fallback.
  app.get("/api/v1/system/execution-options", (c) => {
    const providerId = c.req.query("providerId");
    const models = providerId === "claude" ? shim.CLAUDE_MODELS : [shim.CODEX_MODEL];
    return c.json({
      providers: [shim.CODEX_PROVIDER_INFO, shim.CLAUDE_PROVIDER_INFO],
      permissionCeiling: "full",
      models,
      selectedOnlyModels: [],
      modelLoadError: null,
    });
  });

  app.get("/api/v1/plugins/contributions", (c) => c.json({ cliCommands: [], slashCommands: [], sidebarItems: [] }));
  app.get("/api/v1/plugins", (c) => c.json([]));
  app.get("/api/v1/projects", (c) =>
    c.json(engine.listProjects().map((p) => shim.toBbProjectWithThreads(engine, p))));
  app.get("/api/v1/projects/:id/prompt-history", (c) => c.json([]));
  app.get("/api/v1/projects/:id/default-execution-options", (c) => c.json(shim.DEFAULT_EXECUTION_OPTIONS));
  // bb's real ProjectBranchesResponse requires `checkout` (a discriminated
  // union, not optional) — falling through to the generic 200 {} catch-all
  // below left it undefined, and the project-compose branch picker crashed
  // reading `checkout.kind` on it. vozen threads run in plain directories,
  // never git worktrees, so "unknown" (with a reason) is the honest answer,
  // matching packages/domain/src/git-checkout.ts's own vocabulary.
  app.get("/api/v1/projects/:id/branches", (c) =>
    c.json({
      branches: [], branchesTruncated: false,
      checkout: { kind: "unknown", reason: "vozen workspaces are plain directories, not git-managed." },
      defaultBranch: null, defaultBranchRelation: null, hasUncommittedChanges: false,
      operation: { kind: "none" }, originDefaultBranch: null,
      remoteBranches: [], remoteBranchesTruncated: false, selectedBranch: null,
      defaultWorktreeBaseBranch: null,
    }));
  app.get("/api/v1/projects/:id", (c) => {
    const project = engine.getProject(c.req.param("id"));
    if (!project) return c.json({ error: "not found" }, 404);
    return c.json(shim.toBbProjectWithThreads(engine, project));
  });

  const bbThreadList = () =>
    engine.list().map((t) => shim.toBbThreadListEntry(t, engine.hasPendingInteraction(t.id), engine.threadPin(t.id)));

  app.get("/api/v1/threads", (c) => c.json(bbThreadList()));

  app.post("/api/v1/threads/:id/pin", (c) => {
    const threadId = c.req.param("id");
    let thread;
    try {
      thread = engine.pin(threadId);
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 404);
    }
    return c.json(shim.toBbThread(thread, engine.hasPendingInteraction(threadId), engine.threadPin(threadId)));
  });

  app.post("/api/v1/threads/:id/unpin", (c) => {
    const threadId = c.req.param("id");
    let thread;
    try {
      thread = engine.unpin(threadId);
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 404);
    }
    return c.json(shim.toBbThread(thread, engine.hasPendingInteraction(threadId), null));
  });

  app.patch("/api/v1/threads/:id/pin-order", async (c) => {
    const threadId = c.req.param("id");
    const body = await readJsonBody(c);
    if (body === null) return c.json({ error: "invalid JSON body" }, 400);
    const previousThreadId = typeof body.previousThreadId === "string" ? body.previousThreadId : null;
    const nextThreadId = typeof body.nextThreadId === "string" ? body.nextThreadId : null;
    try {
      engine.reorderPinned(threadId, previousThreadId, nextThreadId);
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 400);
    }
    return c.json(bbThreadList());
  });

  app.get("/api/v1/threads/:id/interactions", async (c) =>
    c.json(await engine.pendingInteractions(c.req.param("id"))));
  app.get("/api/v1/threads/:id/prompt-history", (c) => c.json([]));
  app.get("/api/v1/threads/:id/queued-messages", (c) => c.json([]));
  app.get("/api/v1/threads/:id/tabs", (c) => c.json({ revision: 0, tabs: [] }));
  app.get("/api/v1/threads/:id/default-execution-options", (c) => {
    const thread = engine.show(c.req.param("id"));
    return c.json(thread ? shim.executionOptionsFor(thread) : shim.DEFAULT_EXECUTION_OPTIONS);
  });

  // bb's own server default: the first window ships the newest 20 segments,
  // older pages load on demand via the (beforeAnchorSeq, beforeAnchorId)
  // cursor — a long-lived thread's multi-MB history stops riding along on
  // every open, which is the difference between orders of magnitude on a
  // phone behind the tunnel. One flat row = one segment here (vozen rows
  // carry no nested turn structure to collapse).
  const DEFAULT_TIMELINE_SEGMENT_LIMIT = 20;

  app.get("/api/v1/threads/:id/timeline", (c) => {
    const threadId = c.req.param("id");
    const maxSeq = engine.threadMaxSeq(threadId);
    if (maxSeq === null) return c.json({ error: "not found" }, 404);
    const tailState = {
      activePromptMode: null, activeThinking: null, activeWorkflows: [], activeBackgroundCommands: [],
      pendingTodos: null, goal: null, modelFallback: null, maxSeq,
    };
    const segmentLimitParam = c.req.query("segmentLimit");
    const segmentLimit = segmentLimitParam !== undefined && /^\d+$/.test(segmentLimitParam) && Number(segmentLimitParam) > 0
      ? Number(segmentLimitParam)
      : DEFAULT_TIMELINE_SEGMENT_LIMIT;

    // Tail state without row generation — bb's CLI-status fast path.
    if (c.req.query("summaryOnly") === "true") {
      return c.json({
        ...tailState,
        rows: [],
        timelinePage: {
          kind: "latest", segmentLimit,
          returnedSegmentCount: 0, hasOlderRows: false, olderCursor: null,
        },
      });
    }

    const allRows = engine.timelineRows(threadId);
    const cursorFor = (row: { source_seq_start: number; id: string } | undefined) =>
      row ? { anchorSeq: Math.max(1, row.source_seq_start), anchorId: row.id } : null;

    // Older page: the segmentLimit rows strictly before the anchor row.
    const beforeAnchorSeq = c.req.query("beforeAnchorSeq");
    const beforeAnchorId = c.req.query("beforeAnchorId");
    if (beforeAnchorSeq !== undefined && /^[1-9]\d*$/.test(beforeAnchorSeq) && beforeAnchorId) {
      const anchorIndex = allRows.findIndex((row) => row.id === beforeAnchorId);
      // Anchor gone (rows rebuilt/renamed): fall back to the seq position so
      // the client still gets the right neighborhood instead of a 4xx.
      const endIndex = anchorIndex !== -1
        ? anchorIndex
        : allRows.findIndex((row) => row.source_seq_start >= Number(beforeAnchorSeq));
      const end = endIndex === -1 ? allRows.length : endIndex;
      const start = Math.max(0, end - segmentLimit);
      const page = allRows.slice(start, end);
      return c.json({
        ...tailState,
        rows: page.map(shim.rowToBbRow),
        timelinePage: {
          kind: "older", segmentLimit,
          returnedSegmentCount: page.length,
          hasOlderRows: start > 0,
          olderCursor: page.length > 0 ? cursorFor(page[0]) : null,
        },
      });
    }

    // Latest window: the newest segmentLimit rows.
    const windowStart = Math.max(0, allRows.length - segmentLimit);
    const window = allRows.slice(windowStart);
    const timelinePage = {
      kind: "latest", segmentLimit,
      returnedSegmentCount: window.length,
      hasOlderRows: windowStart > 0,
      olderCursor: cursorFor(window[0]),
    };

    // bb's own contract supports incremental refetch precisely so a client
    // re-fetching after every WS `changed` ping doesn't re-walk and re-send
    // the whole history every time.
    const afterSequence = c.req.query("afterSequence");
    if (afterSequence !== undefined && /^\d+$/.test(afterSequence)) {
      const after = Number(afterSequence);
      const upsertRows = window.filter((row) => row.source_seq_end > after).map(shim.rowToBbRow);
      // rowOrder must be the window's full, current order (not just the
      // touched rows) — bb's own applyTimelineDelta falls back to the
      // client's *previous* order when rowOrder is omitted, so any row id
      // absent from that stale order is silently dropped from what renders.
      // Older pages the client fetched live in its own controller state and
      // are unaffected by this window-scoped order.
      const rowOrder = window.map((row) => row.id);
      return c.json({
        ...tailState,
        rows: [],
        delta: { upsertRows, rowOrder },
        timelinePage,
      });
    }

    const rows = window.map(shim.rowToBbRow);
    return c.json({
      ...tailState,
      rows,
      timelinePage,
    });
  });

  app.get("/api/v1/threads/:id/conversation-outline", (c) => {
    const threadId = c.req.param("id");
    const maxSeq = engine.threadMaxSeq(threadId);
    if (maxSeq === null) return c.json({ error: "not found" }, 404);
    const items = engine.timelineRows(threadId).map((row) => ({
      id: row.id, role: row.role, preview: row.text.slice(0, 200), attachmentSummary: null,
    }));
    return c.json({ items, maxSeq });
  });

  app.get("/api/v1/threads/:id", (c) => {
    const thread = engine.show(c.req.param("id"));
    if (!thread) return c.json({ error: "not found" }, 404);
    return c.json(shim.toBbThread(thread, engine.hasPendingInteraction(thread.id), engine.threadPin(thread.id)));
  });

  // Backs the @-mention / "New tab" file search — fuzzy-matches files under
  // the thread's own cwd, same package (@bb/fuzzy-match) bb's own file
  // mentions use.
  app.get("/api/v1/threads/:id/thread-storage/files", async (c) => {
    const thread = engine.show(c.req.param("id"));
    if (!thread) return c.json({ error: "not found" }, 404);
    const query = threadStorageFilesQuerySchema.safeParse(c.req.query());
    if (!query.success) return c.json({ error: query.error.message }, 400);
    const limit = query.data.limit ? Number(query.data.limit) : 200;
    const walked = await listWorkspaceFiles(thread.cwd, WORKSPACE_FILE_WALK_CAP);
    const matched = fuzzyMatchPaths({
      items: walked.files, getPath: (file) => file.path, query: query.data.query ?? "", limit,
    });
    return c.json({
      files: matched.map((match) => match.item),
      truncated: walked.truncated || matched.length >= limit,
      storageRootPath: thread.cwd,
    });
  });

  // Serves the raw bytes behind a thread-storage file preview (the frontend
  // sniffs the content-type header, so Bun.file's extension-based type is
  // exactly what it needs).
  app.get("/api/v1/threads/:id/thread-storage/content", async (c) => {
    const thread = engine.show(c.req.param("id"));
    if (!thread) return c.json({ error: "not found" }, 404);
    const relPath = c.req.query("path");
    if (!relPath) return c.json({ error: "path is required" }, 400);
    const root = path.resolve(thread.cwd);
    const absPath = path.resolve(root, relPath);
    // Security: `path` is client-controlled; refuse anything that resolves
    // outside the thread's own cwd (the same root the files route walks).
    if (absPath !== root && !absPath.startsWith(root + path.sep)) {
      return c.json({ error: "path escapes thread storage" }, 400);
    }
    const file = Bun.file(absPath);
    if (!(await file.exists())) return c.json({ error: "not found" }, 404);
    return new Response(file);
  });

  app.post("/api/v1/threads/:id/interactions/:interactionId/resolve", async (c) => {
    const body = await readJsonBody(c);
    const resolution = pendingInteractionResolutionSchema.safeParse(body);
    if (!resolution.success) return c.json({ error: "invalid interaction resolution" }, 400);
    try {
      return c.json(await engine.resolveInteraction(
        c.req.param("id"),
        c.req.param("interactionId"),
        resolution.data,
      ));
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 400);
    }
  });

  app.get("/api/v1/environments/:id/status", (c) =>
    c.json({
      outcome: "not_applicable", reason: "non_git_environment",
      message: "vozen workspaces are plain directories, not git-managed.",
    }));
  app.get("/api/v1/environments/:id", (c) => c.json(shim.toBbEnvironment(c.req.param("id"))));

  app.get("/api/v1/terminals", (c) => {
    const query = terminalListQuerySchema.safeParse(c.req.query());
    if (!query.success) return c.json({ error: query.error.message }, 400);
    return c.json({ sessions: terminals.list(query.data) });
  });

  app.get("/api/v1/terminals/:terminalId", (c) => {
    const session = terminals.get(c.req.param("terminalId"));
    if (!session) return c.json({ error: "not found" }, 404);
    return c.json(session);
  });

  app.get("/api/v1/terminals/:terminalId/output", (c) => {
    const query = terminalOutputQuerySchema.safeParse(c.req.query());
    if (!query.success) return c.json({ error: query.error.message }, 400);
    const response = terminals.output(c.req.param("terminalId"), query.data);
    if (!response) return c.json({ error: "not found" }, 404);
    return c.json(response);
  });

  app.get("/api/v1/*", (c) => {
    shim.log(`unhandled GET ${c.req.path} -> default {}`);
    return c.json({});
  });

  app.post("/api/v1/projects", async (c) => {
    const body = await readJsonBody(c);
    if (body === null) return c.json({ error: "invalid JSON body" }, 400);
    const name = body.name as string | undefined;
    const source = body.source as { type?: string; path?: string } | undefined;
    if (!name) return c.json({ error: "name is required" }, 400);
    if (!source || source.type !== "local_path" || !source.path) {
      return c.json({ error: "source must be {type: 'local_path', path}" }, 400);
    }
    const project = engine.createProject(name, expandHome(source.path));
    return c.json(shim.toBbProject(project), 201);
  });

  app.post("/api/v1/threads", async (c) => {
    const body = await readJsonBody(c);
    if (body === null) return c.json({ error: "invalid JSON body" }, 400);
    const prompt = shim.promptText(body.input);
    if (!prompt) return c.json({ error: "input text is required" }, 400);
    // bb sends PERSONAL_PROJECT_ID for the synthetic default project, which
    // has no row of its own — that's vozen's "no project" case (null).
    const rawProjectId = body.projectId as string | undefined;
    const projectId = rawProjectId && rawProjectId !== shim.PERSONAL_PROJECT_ID ? rawProjectId : null;
    const providerId = typeof body.providerId === "string" && body.providerId ? body.providerId : "codex";
    if (providerId !== "codex" && providerId !== "claude") {
      return c.json({ error: `Unknown providerId ${providerId}` }, 400);
    }
    try {
      const thread = engine.spawn(prompt, body.title as string | undefined, undefined, "never", projectId, providerId);
      return c.json(shim.toBbThread(thread, false));
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 400);
    }
  });

  app.post("/api/v1/threads/:id/send", async (c) => {
    const body = await readJsonBody(c);
    if (body === null) return c.json({ error: "invalid JSON body" }, 400);
    const prompt = shim.promptText(body.input);
    if (!prompt) return c.json({ error: "input text is required" }, 400);
    try {
      await engine.tell(c.req.param("id"), prompt);
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 400);
    }
    return c.json({ ok: true });
  });

  app.post("/api/v1/threads/:id/stop", (c) => {
    void engine.stop(c.req.param("id"));
    return c.json({ ok: true });
  });

  app.post("/api/v1/threads/:id/archive-all", (c) => {
    const threadId = c.req.param("id");
    try {
      engine.archive(threadId);
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 404);
    }
    // vozen has no thread hierarchy (no forks/children), so archiving one
    // thread never cascades to others — archivedThreadIds is always just it.
    return c.json({ ok: true, archivedThreadIds: [threadId] });
  });

  app.post("/api/v1/terminals", async (c) => {
    const body = await readJsonBody(c);
    const request = createTerminalRequestSchema.safeParse(body);
    if (!request.success) return c.json({ error: request.error.message }, 400);
    const session = await terminals.create(request.data);
    if (!session) return c.json({ error: "unknown terminal target" }, 400);
    return c.json(session, 201);
  });

  app.post("/api/v1/terminals/:terminalId/close", async (c) => {
    const body = await readJsonBody(c);
    const request = closeTerminalRequestSchema.safeParse(body);
    if (!request.success) return c.json({ error: request.error.message }, 400);
    const session = terminals.close(c.req.param("terminalId"), request.data);
    if (!session) return c.json({ error: "not found" }, 404);
    return c.json(session);
  });

  app.post("/api/v1/terminals/:terminalId/restart", (c) => {
    const session = terminals.restart(c.req.param("terminalId"));
    if (!session) return c.json({ error: "not found" }, 404);
    return c.json(session);
  });

  app.post("/api/v1/terminals/:terminalId/resize", async (c) => {
    const body = await readJsonBody(c);
    const request = terminalResizeRequestSchema.safeParse(body);
    if (!request.success) return c.json({ error: request.error.message }, 400);
    const session = terminals.resize(c.req.param("terminalId"), request.data.cols, request.data.rows);
    if (!session) return c.json({ error: "not found" }, 404);
    return c.json(session);
  });

  app.post("/api/v1/terminals/:terminalId/input", async (c) => {
    const body = await readJsonBody(c);
    const request = terminalInputRequestSchema.safeParse(body);
    if (!request.success) return c.json({ error: request.error.message }, 400);
    const session = terminals.input(c.req.param("terminalId"), request.data.dataBase64);
    if (!session) return c.json({ error: "not found" }, 404);
    return c.json(session);
  });

  app.post("/api/v1/*", (c) => {
    shim.log(`unimplemented POST ${c.req.path} -> 404`);
    return c.json({ error: `vozen does not implement POST ${c.req.path}` }, 404);
  });

  app.delete("/api/v1/threads/:id", (c) => {
    try {
      engine.delete(c.req.param("id"));
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 404);
    }
    return c.json({ ok: true });
  });

  app.delete("/api/v1/projects/:id", (c) => {
    try {
      engine.deleteProject(c.req.param("id"));
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 404);
    }
    return c.json({ ok: true });
  });

  app.delete("/api/v1/*", (c) => {
    shim.log(`unimplemented DELETE ${c.req.path} -> 404`);
    return c.json({ error: `vozen does not implement DELETE ${c.req.path}` }, 404);
  });

  app.patch("/api/v1/threads/:id", async (c) => {
    const threadId = c.req.param("id");
    const thread = engine.show(threadId);
    if (!thread) return c.json({ error: `Unknown thread ${threadId}` }, 404);
    const body = await readJsonBody(c);
    if (body === null) return c.json({ error: "invalid JSON body" }, 400);
    const title = body.title as string | undefined;
    if (!title) return c.json(shim.toBbThread(thread, engine.hasPendingInteraction(threadId), engine.threadPin(threadId)));
    try {
      const updated = engine.rename(threadId, title);
      return c.json(shim.toBbThread(updated, engine.hasPendingInteraction(threadId), engine.threadPin(threadId)));
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 404);
    }
  });

  app.patch("/api/v1/terminals/:terminalId", async (c) => {
    const body = await readJsonBody(c);
    const request = updateTerminalRequestSchema.safeParse(body);
    if (!request.success) return c.json({ error: request.error.message }, 400);
    const session = terminals.rename(c.req.param("terminalId"), request.data.title);
    if (!session) return c.json({ error: "not found" }, 404);
    return c.json(session);
  });

  app.patch("/api/v1/*", (c) => {
    shim.log(`unimplemented PATCH ${c.req.path} -> 404`);
    return c.json({ error: `vozen does not implement PATCH ${c.req.path}` }, 404);
  });

  // vozen does not persist tab layout; echo the write back with a bumped
  // revision so the frontend's optimistic update settles.
  app.put("/api/v1/threads/:id/tabs", async (c) => {
    const body = await readJsonBody(c);
    if (body === null) return c.json({ error: "invalid JSON body" }, 400);
    return c.json({
      revision: ((body.expectedRevision as number) ?? 0) + 1,
      tabs: body.tabs ?? [],
    });
  });

  app.put("/api/v1/*", (c) => {
    shim.log(`unimplemented PUT ${c.req.path} -> 404`);
    return c.json({ error: `vozen does not implement PUT ${c.req.path}` }, 404);
  });

  // --- vozen's own plain REST API (used by the CLI, not bb's frontend) ---

  app.get("/api/threads", (c) => c.json(engine.list()));

  app.get(`/api/threads/:id{${THREAD_ID_RE}}/wait`, async (c) => {
    const timeoutParam = c.req.query("timeout") ?? "300";
    const timeoutSeconds = Number(timeoutParam);
    if (Number.isNaN(timeoutSeconds)) return c.json({ error: "timeout must be a number" }, 400);
    try {
      const thread = await engine.wait(c.req.param("id"), timeoutSeconds * 1000);
      return c.json(thread);
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 404);
    }
  });

  app.get(`/api/threads/:id{${THREAD_ID_RE}}/events`, (c) => {
    const threadId = c.req.param("id");
    const startAfter = Number(c.req.query("after") ?? "0");
    return streamSSE(c, async (stream) => {
      let afterSeq = startAfter;
      stream.onAbort(() => {});
      // biome-ignore lint: intentional infinite loop, torn down by client abort
      while (true) {
        const events = engine.eventsSince(threadId, afterSeq);
        for (const event of events) {
          afterSeq = event.seq;
          await stream.writeSSE({ data: JSON.stringify(event) });
        }
        // Push-driven: wakes on the thread's next broadcastChanged instead
        // of re-querying sqlite every second; the timeout is only a liveness
        // backstop (and keeps the connection exercised for proxies).
        await engine.waitForThreadChange(threadId, 15_000);
      }
    });
  });

  app.get(`/api/threads/:id{${THREAD_ID_RE}}`, (c) => {
    const thread = engine.show(c.req.param("id"));
    if (!thread) return c.json({ error: "not found" }, 404);
    return c.json(thread);
  });

  app.post("/api/threads", async (c) => {
    const body = await readJsonBody(c);
    if (body === null) return c.json({ error: "invalid JSON body" }, 400);
    const prompt = body.prompt as string | undefined;
    if (!prompt) return c.json({ error: "prompt is required" }, 400);
    const thread = engine.spawn(
      prompt, body.title as string | undefined, body.cwd as string | undefined,
      (body.approvalPolicy as string) ?? "never",
    );
    return c.json(thread);
  });

  app.post(`/api/threads/:id{${THREAD_ID_RE}}/tell`, async (c) => {
    const body = await readJsonBody(c);
    if (body === null) return c.json({ error: "invalid JSON body" }, 400);
    if (!body.message) return c.json({ error: "message is required" }, 400);
    try {
      await engine.tell(c.req.param("id"), body.message as string);
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 400);
    }
    return c.json({ ok: true });
  });

  app.post(`/api/threads/:id{${THREAD_ID_RE}}/stop`, (c) => {
    void engine.stop(c.req.param("id"));
    return c.json({ ok: true });
  });

  app.post(`/api/threads/:id{${THREAD_ID_RE}}/approvals/:requestId`, async (c) => {
    const body = await readJsonBody(c);
    if (body === null) return c.json({ error: "invalid JSON body" }, 400);
    const decision = body.decision as string | undefined;
    if (!decision) return c.json({ error: "decision is required" }, 400);
    try {
      engine.resolveApproval(c.req.param("id"), c.req.param("requestId"), decision);
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 400);
    }
    return c.json({ ok: true });
  });

  // --- Herdr agent mirror (read-only; provider_herdr) ---
  app.get("/api/herdr/agents", async (c) => {
    try {
      return c.json(await listHerdrAgents());
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 502);
    }
  });

  app.get("/api/herdr/agents/:paneId/read", async (c) => {
    const linesParam = Number(c.req.query("lines") ?? "120");
    const lines = Number.isFinite(linesParam) && linesParam > 0 ? linesParam : 120;
    try {
      return c.text(await readHerdrAgent(c.req.param("paneId"), lines));
    } catch (error) {
      return c.json({ error: errorMessage(error) }, 502);
    }
  });

  // --- static frontend (bb's real compiled build, vendored) ---
  app.get("*", async (c) => {
    const response = await serveStatic(c.req.path, c.req.header("If-None-Match"));
    return response;
  });

  return { app, websocket };
}

// Mirrors bb's real PairForm UX (plugins/connect/app.tsx): a single input
// that auto-formats and auto-submits once it looks like a complete
// XXXX-XXXX code, no manual submit button, errors shown inline under the
// form rather than as a toast or a separate page.
function pairForm(prefillCode: string | undefined, dashboardUrl: string): string {
  return `<p>Paste the code shown at <a href="${dashboardUrl}" target="_blank" rel="noopener">${dashboardUrl}</a>
     after logging in there.</p>
   <input id="code" placeholder="XXXX-XXXX" maxlength="9" autofocus
          value="${prefillCode ?? ""}"
          style="padding:8px;width:100%;box-sizing:border-box;font-size:20px;letter-spacing:2px;text-align:center;font-family:monospace;text-transform:uppercase">
   <p id="error" style="display:none;color:#b00"></p>
   <script>
     const input = document.getElementById("code");
     const errorEl = document.getElementById("error");
     function normalize(raw) {
       const alnum = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
       return alnum.length <= 4 ? alnum : alnum.slice(0, 4) + "-" + alnum.slice(4, 8);
     }
     function isComplete(code) { return /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code); }
     let submitting = false;
     async function trySubmit() {
       const code = input.value;
       if (!isComplete(code) || submitting) return;
       submitting = true;
       errorEl.style.display = "none";
       const res = await fetch("/vozen/connect/pair", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ code }),
       });
       if (res.ok) { location.href = "/vozen/connect"; return; }
       const body = await res.json().catch(() => ({}));
       errorEl.textContent = body.error || "Could not redeem this code.";
       errorEl.style.display = "block";
       submitting = false;
       input.value = "";
       input.focus();
     }
     input.addEventListener("input", () => {
       input.value = normalize(input.value);
       trySubmit();
     });
     if (input.value) trySubmit();
   </script>`;
}

function connectSettingsPage(status: import("./connectManager.ts").ConnectStatus, prefillCode?: string): string {
  const stateLabel: Record<string, string> = {
    disconnected: status.paired ? "Disconnected" : "Not paired",
    pairing: "Pairing…",
    connected: "Connected",
    reconnecting: "Reconnecting…",
  };
  const body = !status.paired
    ? pairForm(prefillCode, status.dashboardUrl)
    : `<p>Status: <b id="state">${stateLabel[status.state] ?? status.state}</b></p>
       <p id="url-line" style="${status.url ? "" : "display:none"}">
         Reachable at: <a id="url" href="${status.url ?? ""}">${status.url ?? ""}</a>
       </p>
       <p id="error-line" style="${status.lastError ? "" : "display:none"}color:#b00">
         Last error: <span id="error">${status.lastError ?? ""}</span>
       </p>
       <button id="toggle">Disconnect</button>
       <script>
         const btn = document.getElementById("toggle");
         btn.addEventListener("click", async () => {
           await fetch("/vozen/connect/disconnect", { method: "POST" });
           location.reload();
         });
       </script>`;
  return `<!doctype html><html><body style="font-family:system-ui;max-width:480px;margin:40px auto">
    <h2>Remote access</h2>
    ${body}
  </body></html>`;
}

async function serveStatic(requestPath: string, ifNoneMatch: string | undefined): Promise<Response> {
  const relative = requestPath === "/" ? "/index.html" : requestPath;
  let filePath = path.normalize(path.join(WEB_ROOT, relative));
  let file = Bun.file(filePath);

  if (!filePath.startsWith(WEB_ROOT) || !(await file.exists())) {
    // SPA fallback: a client-side route like /threads/:id has no matching
    // file on disk. Serve index.html so the router (not this server)
    // decides what it means, same as bb's own server.
    if (!path.basename(requestPath).includes(".")) {
      filePath = path.join(WEB_ROOT, "index.html");
      file = Bun.file(filePath);
    } else {
      return new Response("Not Found", { status: 404 });
    }
  }

  // Vite fingerprints /assets/* filenames with a content hash, so those are
  // safe to cache forever; index.html (and the SPA fallback, which serves
  // it) references those hashed names and must always be revalidated or a
  // stale page could reference assets that no longer exist after a rebuild.
  const cacheControl = filePath.includes(`${path.sep}assets${path.sep}`)
    ? "public, max-age=31536000, immutable"
    : "no-cache";

  const stat = await file.stat();
  const etag = `"${Math.floor(stat.mtimeMs)}-${stat.size}"`;
  if (ifNoneMatch === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": cacheControl } });
  }

  return new Response(file, {
    headers: { ETag: etag, "Cache-Control": cacheControl },
  });
}
