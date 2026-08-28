/** Where vozen connect stores the one credential it needs. Single-user,
 * single-machine tool — no CredentialStore abstraction, no multi-account
 * support, just a JSON file, matching vozen's ~/.vozen/ convention. */

import { chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const CREDENTIALS_PATH = path.join(os.homedir(), ".vozen", "connect.json");

export interface Credentials {
  workerUrl: string;
  handle: string;
  credential: string;
}

export function load(): Credentials | null {
  if (!existsSync(CREDENTIALS_PATH)) return null;
  return JSON.parse(readFileSync(CREDENTIALS_PATH, "utf-8")) as Credentials;
}

export function save(workerUrl: string, handle: string, credential: string): void {
  mkdirSync(path.dirname(CREDENTIALS_PATH), { recursive: true });
  writeFileSync(CREDENTIALS_PATH, JSON.stringify({ workerUrl, handle, credential } satisfies Credentials, null, 2));
  chmodSync(CREDENTIALS_PATH, 0o600);
}

/** Matches bb's real Disconnect semantics: it forgets the credential
 * outright, not just stops dialing — reconnecting needs a fresh pairing
 * code, same as if this vozen had never been paired. */
export function clear(): void {
  if (existsSync(CREDENTIALS_PATH)) unlinkSync(CREDENTIALS_PATH);
}
