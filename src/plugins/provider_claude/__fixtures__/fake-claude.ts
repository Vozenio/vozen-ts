#!/usr/bin/env bun
/**
 * Stand-in for the real `claude` binary in tests — mirrors
 * provider_codex/__fixtures__/fake-codex.ts's approach (env-configured
 * canned output) for the same reason: deterministic, no real CLI/auth
 * required to run the suite.
 *
 * Emits FAKE_CLAUDE_SESSION_ID as a `system/init` event on startup, then
 * for each stream-json user line it receives on stdin, emits the next
 * entry of FAKE_CLAUDE_EVENTS_PER_TURN (an array of arrays of raw event
 * objects) — or the last entry, if more turns arrive than configured.
 */

export {};

const sessionId = process.env.FAKE_CLAUDE_SESSION_ID || "fake-session";
const eventsPerTurn: unknown[][] = JSON.parse(process.env.FAKE_CLAUDE_EVENTS_PER_TURN || "[]");

console.log(JSON.stringify({ type: "system", subtype: "init", session_id: sessionId }));

let turnIndex = 0;
const decoder = new TextDecoder();
let buffer = "";
for await (const chunk of Bun.stdin.stream()) {
  buffer += decoder.decode(chunk as Uint8Array, { stream: true });
  let newlineIndex: number;
  while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);
    if (!line) continue;
    const events = eventsPerTurn[Math.min(turnIndex, eventsPerTurn.length - 1)] ?? [];
    for (const event of events) console.log(JSON.stringify(event));
    turnIndex += 1;
  }
}
