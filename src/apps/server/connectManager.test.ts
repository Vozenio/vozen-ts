import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, renameSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import * as credentials from "../../plugins/connect/credentials.ts";
import { ConnectManager } from "./connectManager.ts";

// credentials.ts always reads/writes ~/.vozen/connect.json (single-user,
// single-machine convention — see its own docstring) — these tests touch
// that real path, so the real file (if any) is backed up first and always
// restored in afterEach, even on failure. Getting this wrong once already
// cost a real registered handle's local credential this session.
const CREDENTIALS_PATH = path.join(os.homedir(), ".vozen", "connect.json");
const BACKUP_PATH = `${CREDENTIALS_PATH}.test-backup`;

describe("ConnectManager", () => {
  let hadRealFile: boolean;

  beforeEach(() => {
    hadRealFile = existsSync(CREDENTIALS_PATH);
    if (hadRealFile) renameSync(CREDENTIALS_PATH, BACKUP_PATH);
  });

  afterEach(() => {
    rmSync(CREDENTIALS_PATH, { force: true });
    if (hadRealFile) renameSync(BACKUP_PATH, CREDENTIALS_PATH);
  });

  test("starts disconnected/unpaired when no credentials file exists", () => {
    const manager = new ConnectManager("http://127.0.0.1:38886");
    expect(manager.getStatus()).toMatchObject({ state: "disconnected", paired: false, handle: null });
  });

  // pair() itself does a real network redeem against the Worker — covered
  // by live end-to-end verification, not this unit test — so this exercises
  // only what ConnectManager derives from an already-saved credential file,
  // written directly the way pair() would after a successful redeem.
  test("starts reconnecting/paired when a credentials file already exists", () => {
    credentials.save("https://vozen.io", "felix", "test-credential");
    const manager = new ConnectManager("http://127.0.0.1:38886");

    const status = manager.getStatus();
    expect(status.state).toBe("reconnecting");
    expect(status.paired).toBe(true);
    expect(status.handle).toBe("felix");
    expect(status.url).toBe("https://felix.vozen.io");
  });

  test("disconnect() forgets the credential — matches bb's real semantics, not a resumable pause", () => {
    credentials.save("https://vozen.io", "felix", "test-credential");
    const manager = new ConnectManager("http://127.0.0.1:38886");
    manager.disconnect();

    const status = manager.getStatus();
    expect(status.state).toBe("disconnected");
    expect(status.paired).toBe(false);
    expect(status.handle).toBeNull();
    expect(status.url).toBeNull();
    expect(existsSync(CREDENTIALS_PATH)).toBe(false); // credential file is gone — re-pairing needs a fresh code
  });
});
