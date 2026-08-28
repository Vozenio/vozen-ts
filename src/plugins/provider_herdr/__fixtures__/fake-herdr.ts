#!/usr/bin/env bun
/**
 * Stand-in for the real `herdr` binary in tests: prints canned stdout for
 * `agent list`/`agent read` and exits with a configurable code, so
 * client.test.ts never depends on Herdr actually being installed.
 */

export {};

const args = process.argv.slice(2);
const exitCode = Number(process.env.FAKE_HERDR_EXIT_CODE ?? "0");
const stderr = process.env.FAKE_HERDR_STDERR ?? "";

if (stderr) console.error(stderr);

if (args[0] === "agent" && args[1] === "list") {
  console.log(process.env.FAKE_HERDR_LIST_OUTPUT ?? '{"result":{"agents":[]}}');
} else if (args[0] === "agent" && args[1] === "read") {
  console.log(process.env.FAKE_HERDR_READ_OUTPUT ?? "");
}

process.exit(exitCode);
