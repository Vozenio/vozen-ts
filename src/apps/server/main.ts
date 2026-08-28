import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ConnectManager } from "./connectManager.ts";
import { DaemonClient } from "./daemonClient.ts";
import { ThreadManager } from "./engine.ts";
import { HerdrThreadRegistry } from "./herdrThreadRegistry.ts";
import { createApp } from "./http.ts";
import { TerminalManager } from "./terminalManager.ts";

const DEFAULT_DB_PATH = path.join(os.homedir(), ".vozen", "vozen.db");
// Deliberately not bb's own BB_PROD_SERVER_PORT (38886, packages/config/src/
// runtime.ts) — that port collides with a real bb app running on the same
// machine, which binds it independently of vozen.
const DEFAULT_PORT = 38890;

export function main(argv: string[] = process.argv.slice(2)): void {
  const port = argv[0] ? Number(argv[0]) : DEFAULT_PORT;
  mkdirSync(path.dirname(DEFAULT_DB_PATH), { recursive: true });
  const engine = new ThreadManager(DEFAULT_DB_PATH);
  // Discovers Herdr's own agents (if `herdr` is installed and running) and
  // mirrors them into the sidebar/thread-detail surface as read/write
  // "threads" — no-op, silently, when Herdr isn't present on this machine.
  const herdrRegistry = new HerdrThreadRegistry();
  engine.attachHerdrRegistry(herdrRegistry);
  herdrRegistry.start();
  // Matches bb's own host daemon: the tunnel is carried by the same
  // long-running process as the server itself, not a separate command the
  // user has to remember to also run — `vozen connect register`/`save`
  // just needs to have happened once, ever, on this machine. Exposed to
  // http.ts so /vozen/connect can show live status and toggle it.
  const connectManager = new ConnectManager(`http://127.0.0.1:${port}`);
  // Terminals run in a standalone local daemon process, not this one, so a
  // server restart/redeploy doesn't kill terminals the user is using.
  const daemonClient = new DaemonClient();
  const terminalManager = new TerminalManager(engine, daemonClient);
  const { app, websocket } = createApp(engine, connectManager, terminalManager);
  Bun.serve({ port, hostname: "127.0.0.1", fetch: app.fetch, websocket });
  console.log(`vozen server listening on http://127.0.0.1:${port}`);
  console.log(`Remote access settings: http://127.0.0.1:${port}/vozen/connect`);
}

if (import.meta.main) main();
