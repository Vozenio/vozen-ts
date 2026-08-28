// Must match HERDR_THREAD_ID_PREFIX in apps/server/herdrThreadRegistry.ts.
// Can't share the constant directly: the web app has no build-time
// dependency on server code (bun:sqlite, node built-ins aren't browser-safe).
const HERDR_THREAD_ID_PREFIX = "herdr_";

export function isHerdrThread(threadId: string): boolean {
  return threadId.startsWith(HERDR_THREAD_ID_PREFIX);
}
