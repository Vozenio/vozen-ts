/**
 * Primary Device Attributes (DA1, `ESC[c` / `ESC[0c`) interception.
 *
 * A shell (fish in particular) queries DA1 right at startup to detect
 * terminal capabilities. The PTY exists before a browser xterm has attached
 * over WS to answer it, so without this the shell blocks until it times
 * out. We answer at the PTY boundary instead, and strip the query out of
 * the output that reaches server history/replay — otherwise a browser
 * xterm replaying that history on reconnect would answer it a second time.
 *
 * Ported from bb's host-daemon (apps/host-daemon/src/terminals/
 * terminal-manager.ts), which has this exact logic against node-pty output.
 */

// Written as String.fromCharCode(27) rather than a literal escape in source
// to avoid any ambiguity about the raw control byte in the file.
const ESC = String.fromCharCode(27);
const PRIMARY_DEVICE_ATTRIBUTES_QUERY_PATTERN = new RegExp(`${ESC}\\[(?:0)?c`, "g");
export const PRIMARY_DEVICE_ATTRIBUTES_RESPONSE = `${ESC}[?1;2c`;
// One PTY read can contain many thousands of queries (malicious or buggy
// output). Bound the replies written back so we don't queue an unbounded
// amount of write data for one input chunk — one reply is enough to satisfy
// a real shell's single startup query.
export const MAX_PRIMARY_DEVICE_ATTRIBUTES_REPLIES_PER_CHUNK = 8;

export interface PrimaryDeviceAttributesResult {
  /** `data` with every complete DA1 query removed. */
  output: string;
  /** Suffix of `data` that might be the start of a query split across the
   * next PTY read — pass back in as `pendingQuery` on the next call. */
  pendingQuery: string;
  /** Number of complete queries found in this call. */
  queryCount: number;
}

export function consumePrimaryDeviceAttributesQueries(
  pendingQuery: string,
  data: string,
): PrimaryDeviceAttributesResult {
  const input = pendingQuery + data;
  const nextPendingQuery = input.endsWith(`${ESC}[0`)
    ? `${ESC}[0`
    : input.endsWith(`${ESC}[`)
      ? `${ESC}[`
      : input.endsWith(ESC)
        ? ESC
        : "";
  const completeInput = input.slice(0, input.length - nextPendingQuery.length);
  let queryCount = 0;
  const output = completeInput.replace(PRIMARY_DEVICE_ATTRIBUTES_QUERY_PATTERN, () => {
    queryCount += 1;
    return "";
  });
  return { output, pendingQuery: nextPendingQuery, queryCount };
}
