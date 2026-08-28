#!/usr/bin/env bun
/**
 * Stand-in for the real `codex` binary in tests: reads JSON-RPC request
 * lines from stdin and, for any method configured in FAKE_CODEX_RESPONSES,
 * writes back the configured result/error keyed by the request's id.
 * FAKE_CODEX_OUTPUT additionally schedules canned lines (notifications, or
 * incoming server->client requests) to be written unconditionally after a
 * delay, independent of anything the test sends in — the async-push
 * equivalent of the Python test's FakeStdout.push().
 */

export {};

interface ScheduledOutput {
  delayMs?: number;
  line: unknown;
  raw?: boolean; // if true, `line` is written as-is (a string) instead of JSON.stringify'd
}

const responses: Record<string, { result?: unknown; error?: unknown }> = JSON.parse(
  process.env.FAKE_CODEX_RESPONSES || "{}",
);
const output: ScheduledOutput[] = JSON.parse(process.env.FAKE_CODEX_OUTPUT || "[]");

for (const { delayMs, line, raw } of output) {
  setTimeout(() => console.log(raw ? (line as string) : JSON.stringify(line)), delayMs ?? 0);
}

const decoder = new TextDecoder();
let buffer = "";
for await (const chunk of Bun.stdin.stream()) {
  buffer += decoder.decode(chunk as Uint8Array, { stream: true });
  let newlineIndex: number;
  while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);
    if (!line) continue;
    if (line === "__FAKE_CODEX_EXIT__") process.exit(0);
    const message = JSON.parse(line);
    const response = message.method ? responses[message.method] : undefined;
    if (response && message.id !== undefined) {
      console.log(JSON.stringify({ jsonrpc: "2.0", id: message.id, ...response }));
    }
  }
}
