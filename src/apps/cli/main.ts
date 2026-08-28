/**
 * vozen CLI. Ported from apps/cli/main.py — hand-rolled arg parsing (no
 * dependency; the surface here is small enough that a CLI framework would
 * be more code than it saves) instead of Python's argparse.
 */

import * as connectClient from "../../plugins/connect/client.ts";
import * as connectCredentials from "../../plugins/connect/credentials.ts";

const DEFAULT_SERVER_URL = process.env.VOZEN_SERVER_URL ?? "http://127.0.0.1:38890";

async function request(
  method: string, path: string, serverUrl: string, body?: unknown, query?: Record<string, string | undefined>,
): Promise<unknown> {
  let url = serverUrl.replace(/\/$/, "") + path;
  if (query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) params.set(key, value);
    }
    if ([...params].length > 0) url += `?${params}`;
  }
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    console.error(
      `Cannot reach vozen server at ${serverUrl}: ${error instanceof Error ? error.message : String(error)}. `
      + "Start it with: bun run vozen serve",
    );
    process.exit(1);
  }
  const text = await response.text();
  if (!response.ok) {
    console.error(`vozen API error ${response.status} ${method} ${path}: ${text}`);
    process.exit(1);
  }
  return text ? JSON.parse(text) : null;
}

interface Flags {
  positionals: string[];
  options: Record<string, string | boolean>;
}

function parseFlags(argv: string[], booleanFlags: Set<string> = new Set()): Flags {
  const positionals: string[] = [];
  const options: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg.startsWith("--")) {
      const name = arg.slice(2);
      if (booleanFlags.has(name)) {
        options[name] = true;
      } else {
        options[name] = argv[++i] ?? "";
      }
    } else {
      positionals.push(arg);
    }
  }
  return { positionals, options };
}

async function cmdSpawn(server: string, argv: string[]): Promise<void> {
  const { positionals, options } = parseFlags(argv, new Set(["json"]));
  const [prompt] = positionals;
  if (!prompt) throw new Error("spawn requires a prompt argument");
  const body: Record<string, unknown> = { prompt, approvalPolicy: options["approval-policy"] ?? "never" };
  if (options.title) body.title = options.title;
  if (options.cwd) body.cwd = options.cwd;
  const thread = (await request("POST", "/api/threads", server, body)) as { id: string; status: string };
  if (options.json) console.log(JSON.stringify(thread, null, 2));
  else console.log(`Spawned ${thread.id} (status=${thread.status})`);
}

async function cmdTell(server: string, argv: string[]): Promise<void> {
  const [threadId, message] = argv;
  if (!threadId || !message) throw new Error("tell requires <thread_id> <message>");
  await request("POST", `/api/threads/${threadId}/tell`, server, { message });
  console.log(`Told ${threadId}`);
}

async function cmdShow(server: string, argv: string[]): Promise<void> {
  const [threadId] = argv;
  if (!threadId) throw new Error("show requires <thread_id>");
  const thread = await request("GET", `/api/threads/${threadId}`, server);
  console.log(JSON.stringify(thread, null, 2));
}

async function cmdWait(server: string, argv: string[]): Promise<void> {
  const { positionals, options } = parseFlags(argv);
  const [threadId] = positionals;
  if (!threadId) throw new Error("wait requires <thread_id>");
  const timeout = options.timeout ?? "300";
  const thread = (await request("GET", `/api/threads/${threadId}/wait`, server, undefined, { timeout: String(timeout) })) as {
    status: string;
  };
  console.log(`${threadId} -> ${thread.status}`);
}

async function cmdList(server: string): Promise<void> {
  const threads = (await request("GET", "/api/threads", server)) as { id: string; status: string; title: string }[];
  for (const thread of threads) {
    console.log(`${thread.id}  ${thread.status.padEnd(10)}  ${thread.title}`);
  }
}

async function cmdStop(server: string, argv: string[]): Promise<void> {
  const [threadId] = argv;
  if (!threadId) throw new Error("stop requires <thread_id>");
  await request("POST", `/api/threads/${threadId}/stop`, server, {});
  console.log(`Stopped ${threadId}`);
}

async function cmdRespond(server: string, argv: string[]): Promise<void> {
  const [threadId, requestId, decision] = argv;
  if (!threadId || !requestId || !decision) throw new Error("respond requires <thread_id> <request_id> <decision>");
  if (!["accept", "acceptForSession", "decline", "cancel"].includes(decision)) {
    throw new Error(`invalid decision '${decision}'`);
  }
  await request("POST", `/api/threads/${threadId}/approvals/${requestId}`, server, { decision });
  console.log(`Responded ${decision} to ${requestId} on ${threadId}`);
}

async function cmdConnectRegister(argv: string[]): Promise<void> {
  const { positionals, options } = parseFlags(argv);
  const [handle] = positionals;
  const workerUrl = options["worker-url"];
  const setupToken = options["setup-token"];
  if (!handle) throw new Error("connect register requires <handle>");
  if (typeof workerUrl !== "string") throw new Error("--worker-url is required");
  if (typeof setupToken !== "string") throw new Error("--setup-token is required");
  const result = await connectClient.register(workerUrl, handle, setupToken);
  connectCredentials.save(workerUrl, result.handle, result.credential);
  console.log(`Registered handle '${result.handle}'. Remote URL: ${result.serverUrl}`);
  console.log("Restart `vozen serve` to pick it up (or run `vozen connect start` separately).");
}

/** Consumes a credential already claimed via the web login flow
 * (https://register.<apex>) instead of the CLI's own --setup-token path —
 * same local storage, no network call, since the handle is already
 * registered server-side by the time the web page shows this command. */
async function cmdConnectSave(argv: string[]): Promise<void> {
  const [handle, workerUrl, credential] = argv;
  if (!handle || !workerUrl || !credential) throw new Error("connect save requires <handle> <worker_url> <credential>");
  connectCredentials.save(workerUrl, handle, credential);
  console.log(`Saved credentials for '${handle}'. Restart 'vozen serve' to pick it up (or run 'vozen connect start' separately).`);
}

async function cmdConnectStart(server: string): Promise<void> {
  const creds = connectCredentials.load();
  if (!creds) throw new Error("No credentials found. Run `vozen connect register <handle>` first.");
  const tunnel = new connectClient.TunnelClient(creds.workerUrl, creds.handle, creds.credential, server);
  console.log(`Connecting to ${creds.workerUrl} as '${creds.handle}' (local server: ${server})`);
  await tunnel.runForever(() => console.log("Tunnel connected."));
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  let server = DEFAULT_SERVER_URL;
  const serverFlagIndex = argv.indexOf("--server");
  if (serverFlagIndex !== -1) {
    server = argv[serverFlagIndex + 1] ?? server;
    argv = [...argv.slice(0, serverFlagIndex), ...argv.slice(serverFlagIndex + 2)];
  }

  const [command, ...rest] = argv;
  switch (command) {
    case "spawn":
      return cmdSpawn(server, rest);
    case "tell":
      return cmdTell(server, rest);
    case "show":
      return cmdShow(server, rest);
    case "wait":
      return cmdWait(server, rest);
    case "list":
      return cmdList(server);
    case "stop":
      return cmdStop(server, rest);
    case "respond":
      return cmdRespond(server, rest);
    case "connect": {
      const [subcommand, ...subrest] = rest;
      if (subcommand === "register") return cmdConnectRegister(subrest);
      if (subcommand === "save") return cmdConnectSave(subrest);
      if (subcommand === "start") return cmdConnectStart(server);
      throw new Error(`unknown connect subcommand '${subcommand}'`);
    }
    default:
      throw new Error(`unknown command '${command}'. Expected one of: spawn, tell, show, wait, list, stop, respond, connect`);
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
