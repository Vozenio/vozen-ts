import assert from "node:assert/strict";
import { accessSync, constants as fsConstants } from "node:fs";
import { DaemonClient } from "../src/apps/server/daemonClient.ts";
import { TerminalManager } from "../src/apps/server/terminalManager.ts";
import { TERMINAL_DAEMON_PORT } from "../src/apps/server/terminalDaemonProtocol.ts";

const defaultDaemonBin = "/Users/defei.li/myspace/aihub/vozen-rs/target/debug/vozen-daemon";

async function main(): Promise<void> {
  const daemonBin = process.env.VOZEN_TERMINAL_DAEMON_BIN ?? defaultDaemonBin;
  try {
    accessSync(daemonBin, fsConstants.X_OK);
  } catch {
    throw new Error(`VOZEN_TERMINAL_DAEMON_BIN does not exist or is not executable: ${daemonBin}`);
  }
  process.env.VOZEN_TERMINAL_DAEMON_BIN = daemonBin;

  try {
    const reservation = Bun.serve({
      hostname: "127.0.0.1",
      port: TERMINAL_DAEMON_PORT,
      fetch: () => new Response(),
    });
    reservation.stop(true);
  } catch {
    throw new Error(`terminal daemon port ${TERMINAL_DAEMON_PORT} is already in use; stop the existing daemon first`);
  }

  const daemonClient = new DaemonClient();
  const terminals = new TerminalManager({} as never, daemonClient);
  const marker = `vozen-external-daemon-${crypto.randomUUID()}`;
  try {
    const session = await terminals.create({
      cols: 80,
      rows: 24,
      start: { mode: "command", command: `echo ${marker}` },
      target: { kind: "host_path", hostId: "host_vozen", cwd: null },
    });
    assert.ok(session, "TerminalManager did not create a terminal");
    assert.notEqual(session.status, "starting", "external daemon did not acknowledge the terminal spawn within 10s");

    const deadline = Date.now() + 5_000;
    let output = "";
    while (Date.now() < deadline) {
      output = terminals.output(session.id, {})?.chunks
        .map((chunk) => Buffer.from(chunk.dataBase64, "base64").toString("utf8"))
        .join("") ?? "";
      if (output.includes(marker)) break;
      await Bun.sleep(25);
    }
    assert.ok(output.includes(marker), `terminal output did not contain ${marker}: ${JSON.stringify(output)}`);
    console.log(`PASS external daemon ran a real terminal: ${marker}`);
  } finally {
    daemonClient.dispose();
  }
}

main().catch((error) => {
  console.error(`[verify-external-daemon] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
