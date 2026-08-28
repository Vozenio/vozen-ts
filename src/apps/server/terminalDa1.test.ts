import { describe, expect, test } from "bun:test";
import {
  consumePrimaryDeviceAttributesQueries,
  MAX_PRIMARY_DEVICE_ATTRIBUTES_REPLIES_PER_CHUNK,
  PRIMARY_DEVICE_ATTRIBUTES_RESPONSE,
} from "./terminalDa1.ts";

const ESC = String.fromCharCode(27);

describe("consumePrimaryDeviceAttributesQueries", () => {
  test("strips DA1 queries (ESC[c and ESC[0c) from output and counts them", () => {
    const result = consumePrimaryDeviceAttributesQueries("", `before${ESC}[0cbetween${ESC}[cafter`);
    expect(result.output).toBe("beforebetweenafter");
    expect(result.queryCount).toBe(2);
    expect(result.pendingQuery).toBe("");
  });

  test("carries a query split across chunk boundaries via pendingQuery", () => {
    let pending = "";
    let output = "";
    let queryCount = 0;
    for (const chunk of [ESC, "[", "0", "c", `${ESC}[`, "c"]) {
      const result = consumePrimaryDeviceAttributesQueries(pending, chunk);
      pending = result.pendingQuery;
      output += result.output;
      queryCount += result.queryCount;
    }
    expect(output).toBe("");
    expect(queryCount).toBe(2);
    expect(pending).toBe("");
  });

  test("bounds reply count for a chunk flooded with queries, but still counts all of them", () => {
    const result = consumePrimaryDeviceAttributesQueries("", `${ESC}[c`.repeat(5_000));
    expect(result.output).toBe("");
    expect(result.queryCount).toBe(5_000);
    const replyCount = Math.min(result.queryCount, MAX_PRIMARY_DEVICE_ATTRIBUTES_REPLIES_PER_CHUNK);
    expect(PRIMARY_DEVICE_ATTRIBUTES_RESPONSE.repeat(replyCount).length).toBe(
      PRIMARY_DEVICE_ATTRIBUTES_RESPONSE.length * MAX_PRIMARY_DEVICE_ATTRIBUTES_REPLIES_PER_CHUNK,
    );
  });

  test("preserves near-matches and an incomplete trailing query instead of dropping them", () => {
    const result = consumePrimaryDeviceAttributesQueries("", `before${ESC}[1cafter${ESC}[0`);
    // ESC[1c isn't a DA1 query (only ESC[c / ESC[0c are) — left untouched.
    expect(result.output).toBe(`before${ESC}[1cafter`);
    expect(result.queryCount).toBe(0);
    // ESC[0 at the end could become ESC[0c on the next call — held back.
    expect(result.pendingQuery).toBe(`${ESC}[0`);
  });
});
