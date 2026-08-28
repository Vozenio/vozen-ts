/**
 * Wire format for vozen's own remote-access relay (vozen's answer to bb
 * connect). One binary WebSocket connection between a vozen server and the
 * Cloudflare Worker relay carries many concurrent logical HTTP/WS request
 * streams, each tagged by a streamId the relay assigns.
 *
 * Mirrors apps/connect-worker/src/worker.ts's frame layout exactly (same 8
 * frame types, same header) — that file is the TypeScript relay side,
 * this is the TypeScript client side (ported from the Python vozen's
 * packages/tunnel_contract/frames.py, now unified into one language on
 * both ends of the tunnel).
 *
 * Frame layout: 1 byte type + 4 bytes streamId (big-endian uint32) + payload.
 */

export const OPEN_HTTP = 1;
export const BODY_CHUNK = 2;
export const BODY_END = 3;
export const RESP_HEAD = 4;
export const OPEN_WS = 5;
export const WS_OPEN_ACK = 6;
export const WS_DATA = 7;
export const CLOSE_STREAM = 8;

export const MAX_CHUNK_BYTES = 1024 * 1024;

export const HEARTBEAT_PING = "vzt:hb";
export const HEARTBEAT_PONG = "vzt:hb-ack";

const HEADER_SIZE = 5;

export function encodeFrame(type: number, streamId: number, payload: Uint8Array = new Uint8Array(0)): Uint8Array {
  const out = new Uint8Array(HEADER_SIZE + payload.length);
  out[0] = type;
  new DataView(out.buffer).setUint32(1, streamId, false);
  out.set(payload, HEADER_SIZE);
  return out;
}

export interface DecodedFrame {
  type: number;
  streamId: number;
  payload: Uint8Array;
}

export function decodeFrame(data: ArrayBuffer | Uint8Array): DecodedFrame {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    type: view.getUint8(0),
    streamId: view.getUint32(1, false),
    payload: bytes.subarray(HEADER_SIZE),
  };
}

export function encodeJsonFrame(type: number, streamId: number, obj: unknown): Uint8Array {
  return encodeFrame(type, streamId, new TextEncoder().encode(JSON.stringify(obj)));
}

export function decodeJsonPayload<T = unknown>(payload: Uint8Array): T {
  return JSON.parse(new TextDecoder().decode(payload)) as T;
}

export function encodeWsData(streamId: number, data: Uint8Array, isBinary: boolean): Uint8Array {
  const payload = new Uint8Array(1 + data.length);
  payload[0] = isBinary ? 1 : 0;
  payload.set(data, 1);
  return encodeFrame(WS_DATA, streamId, payload);
}

export function decodeWsData(payload: Uint8Array): { isBinary: boolean; data: Uint8Array } {
  return { isBinary: payload[0] === 1, data: payload.subarray(1) };
}

/** Splits a body into MAX_CHUNK_BYTES pieces for bodyChunk frames — a
 * single frame larger than that would blow past the relay's own
 * per-message limits. */
export function* iterChunks(data: Uint8Array): Generator<Uint8Array> {
  if (data.length === 0) return;
  for (let i = 0; i < data.length; i += MAX_CHUNK_BYTES) {
    yield data.subarray(i, i + MAX_CHUNK_BYTES);
  }
}
