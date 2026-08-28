#!/usr/bin/env bun
import { main as serveMain } from "./apps/server/main.ts";
import { main as cliMain } from "./apps/cli/main.ts";

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv[0] === "serve") {
    serveMain(argv.slice(1));
    return;
  }
  await cliMain(argv);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
