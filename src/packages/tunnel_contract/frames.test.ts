import { describe, expect, test } from "bun:test";
import * as frames from "./frames.ts";

describe("frames", () => {
  test("round-trips a binary payload", () => {
    const raw = frames.encodeFrame(frames.BODY_CHUNK, 42, new TextEncoder().encode("hello world"));
    const { type, streamId, payload } = frames.decodeFrame(raw);
    expect(type).toBe(frames.BODY_CHUNK);
    expect(streamId).toBe(42);
    expect(new TextDecoder().decode(payload)).toBe("hello world");
  });

  test("round-trips a JSON payload", () => {
    const raw = frames.encodeJsonFrame(frames.OPEN_HTTP, 7, { method: "GET", path: "/x" });
    const { type, streamId, payload } = frames.decodeFrame(raw);
    expect(type).toBe(frames.OPEN_HTTP);
    expect(streamId).toBe(7);
    expect(frames.decodeJsonPayload<Record<string, string>>(payload)).toEqual({ method: "GET", path: "/x" });
  });

  test("BODY_END has an empty payload", () => {
    const raw = frames.encodeFrame(frames.BODY_END, 1);
    const { type, payload } = frames.decodeFrame(raw);
    expect(type).toBe(frames.BODY_END);
    expect(payload.length).toBe(0);
  });

  test("round-trips WS_DATA for text", () => {
    const raw = frames.encodeWsData(3, new TextEncoder().encode("hi"), false);
    const { payload } = frames.decodeFrame(raw);
    const { isBinary, data } = frames.decodeWsData(payload);
    expect(isBinary).toBe(false);
    expect(new TextDecoder().decode(data)).toBe("hi");
  });

  test("round-trips WS_DATA for binary", () => {
    const raw = frames.encodeWsData(3, new Uint8Array([0, 1, 2]), true);
    const { payload } = frames.decodeFrame(raw);
    const { isBinary, data } = frames.decodeWsData(payload);
    expect(isBinary).toBe(true);
    expect([...data]).toEqual([0, 1, 2]);
  });

  test("stream id survives large values", () => {
    const raw = frames.encodeFrame(frames.CLOSE_STREAM, 0xffffffff);
    const { streamId } = frames.decodeFrame(raw);
    expect(streamId).toBe(0xffffffff);
  });

  test("iterChunks splits an oversized body", () => {
    const data = new Uint8Array(frames.MAX_CHUNK_BYTES + 10);
    const chunks = [...frames.iterChunks(data)];
    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.length).toBe(frames.MAX_CHUNK_BYTES);
    expect(chunks[1]?.length).toBe(10);
  });

  test("iterChunks yields nothing for an empty body", () => {
    expect([...frames.iterChunks(new Uint8Array(0))]).toHaveLength(0);
  });
});
