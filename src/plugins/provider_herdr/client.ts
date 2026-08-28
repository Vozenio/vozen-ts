/**
 * One-shot CLI wrapper around the `herdr` binary for read-only agent
 * discovery. No persistent JSON-RPC subprocess like provider_codex's
 * client — `herdr agent list`/`get`/`read` are already one-shot commands
 * (herdr-mobile-relay's own internal/herdr/client.go execs the CLI the same
 * way for every non-hot-path call; only pane content streaming there goes
 * over a persistent socket, which this read-only mirror doesn't need yet).
 */

import { toHerdrAgentSnapshot, type HerdrAgentSnapshot } from "./schema.ts";

export class HerdrCliError extends Error {}

const DEFAULT_BIN = ["herdr"];

export interface HerdrCliOptions {
  bin?: string[];
  /** Overrides the child process's environment — tests use this instead of
   * mutating global process.env, which multiple tests reading/writing the
   * same keys cannot safely share. */
  env?: Record<string, string | undefined>;
}

async function runHerdr(
  args: string[],
  options: HerdrCliOptions = {},
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const bin = options.bin ?? DEFAULT_BIN;
  const proc = Bun.spawn([...bin, ...args], { stdout: "pipe", stderr: "pipe", env: options.env ?? process.env });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

export async function listHerdrAgents(options?: HerdrCliOptions): Promise<HerdrAgentSnapshot[]> {
  const { stdout, stderr, exitCode } = await runHerdr(["agent", "list"], options);
  if (exitCode !== 0) {
    throw new HerdrCliError(`herdr agent list failed: ${stderr.trim() || `exit ${exitCode}`}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new HerdrCliError(`herdr agent list returned non-JSON output: ${stdout.slice(0, 200)}`);
  }
  const agents = (parsed as { result?: { agents?: unknown[] } })?.result?.agents;
  if (!Array.isArray(agents)) {
    throw new HerdrCliError("herdr agent list response is missing result.agents");
  }
  return agents.map(toHerdrAgentSnapshot);
}

/** `herdr agent read` prints the raw terminal snapshot as plain text — unlike
 * `list`/`get`, it is not wrapped in the {id,result} JSON envelope. */
export async function readHerdrAgent(paneId: string, lines = 120, options?: HerdrCliOptions): Promise<string> {
  const { stdout, stderr, exitCode } = await runHerdr(
    ["agent", "read", paneId, "--source", "recent-unwrapped", "--lines", String(lines)],
    options,
  );
  if (exitCode !== 0) {
    throw new HerdrCliError(`herdr agent read failed: ${stderr.trim() || `exit ${exitCode}`}`);
  }
  return stdout;
}

/** Submits without `--wait` (matches herdr-mobile-relay's internal/herdr/
 * client.go Prompt()): the reply is discovered by whoever is polling/
 * watching the agent's status and session log, not by this call blocking
 * for it. */
export async function sendHerdrPrompt(paneId: string, text: string, options?: HerdrCliOptions): Promise<void> {
  const { stderr, exitCode } = await runHerdr(["agent", "prompt", paneId, text], options);
  if (exitCode !== 0) {
    throw new HerdrCliError(`herdr agent prompt failed: ${stderr.trim() || `exit ${exitCode}`}`);
  }
}

export async function sendHerdrInput(
  paneId: string,
  input: { key: "enter" | "up" | "down" | "esc" } | { text: string },
  options?: HerdrCliOptions,
): Promise<void> {
  const commands = "text" in input
    ? [["pane", "send-text", paneId, input.text], ["pane", "send-keys", paneId, "enter"]]
    : [["pane", "send-keys", paneId, input.key]];
  for (const args of commands) {
    const { stderr, exitCode } = await runHerdr(args, options);
    if (exitCode !== 0) {
      throw new HerdrCliError(`herdr ${args.slice(0, 2).join(" ")} failed: ${stderr.trim() || `exit ${exitCode}`}`);
    }
  }
}
