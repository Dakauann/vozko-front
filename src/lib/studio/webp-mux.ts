import type { CanvasSize } from "./document";

export interface WebpStill {
  width: number;
  height: number;
  alpha: boolean;
  payload: Uint8Array;
}

export interface WebpFrame {
  payload: Uint8Array;
  durationMs: number;
}

const HEADER_BYTES = 12;
const CHUNK_HEADER_BYTES = 8;
const VP8X_ALPHA = 0x10;
const VP8X_ANIMATION = 0x02;
const ANMF_NO_BLEND = 0x02;
const VP8_START_CODE = [0x9d, 0x01, 0x2a];
const VP8L_SIGNATURE = 0x2f;
const VP8L_ALPHA_BIT = 1 << 28;
const FOURTEEN_BITS = 0x3fff;

function fourcc(bytes: Uint8Array, at: number): string {
  return String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
}

function u32(bytes: Uint8Array, at: number): number {
  return (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0;
}

interface Chunk {
  id: string;
  data: Uint8Array;
  whole: Uint8Array;
}

function chunksOf(bytes: Uint8Array): Chunk[] | null {
  if (bytes.length < HEADER_BYTES || fourcc(bytes, 0) !== "RIFF" || fourcc(bytes, 8) !== "WEBP") return null;
  const chunks: Chunk[] = [];
  let at = HEADER_BYTES;
  while (at + CHUNK_HEADER_BYTES <= bytes.length) {
    const size = u32(bytes, at + 4);
    const end = at + CHUNK_HEADER_BYTES + size + (size % 2);
    if (at + CHUNK_HEADER_BYTES + size > bytes.length) return null;
    chunks.push({ id: fourcc(bytes, at), data: bytes.subarray(at + CHUNK_HEADER_BYTES, at + CHUNK_HEADER_BYTES + size), whole: bytes.subarray(at, Math.min(end, bytes.length)) });
    at = end;
  }
  return chunks;
}

function lossySize(data: Uint8Array): CanvasSize | null {
  if (data.length < 10 || VP8_START_CODE.some((byte, i) => data[3 + i] !== byte)) return null;
  return { width: (data[6] | (data[7] << 8)) & FOURTEEN_BITS, height: (data[8] | (data[9] << 8)) & FOURTEEN_BITS };
}

function losslessHeader(data: Uint8Array): (CanvasSize & { alpha: boolean }) | null {
  if (data.length < 5 || data[0] !== VP8L_SIGNATURE) return null;
  const bits = u32(data, 1);
  return { width: (bits & FOURTEEN_BITS) + 1, height: ((bits >>> 14) & FOURTEEN_BITS) + 1, alpha: (bits & VP8L_ALPHA_BIT) !== 0 };
}

function joined(parts: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

export function readStillWebp(bytes: Uint8Array): WebpStill | null {
  const chunks = chunksOf(bytes);
  if (!chunks) return null;
  const image = chunks.find((c) => c.id === "VP8 " || c.id === "VP8L");
  if (!image) return null;
  const alphaChunk = chunks.find((c) => c.id === "ALPH");
  const extended = chunks.find((c) => c.id === "VP8X");
  if (image.id === "VP8L") {
    const header = losslessHeader(image.data);
    return header ? { ...header, payload: joined([image.whole]) } : null;
  }
  const size = lossySize(image.data);
  if (!size) return null;
  const alpha = Boolean(alphaChunk) && Boolean(extended && extended.data[0] & VP8X_ALPHA);
  return { ...size, alpha, payload: joined(alpha && alphaChunk ? [alphaChunk.whole, image.whole] : [image.whole]) };
}

function le(value: number, bytes: number): number[] {
  return Array.from({ length: bytes }, (_, i) => Math.floor(value / 2 ** (8 * i)) & 0xff);
}

function chunk(id: string, data: readonly Uint8Array[]): Uint8Array {
  const size = data.reduce((sum, part) => sum + part.length, 0);
  return joined([new Uint8Array([...Array.from(id, (c) => c.charCodeAt(0)), ...le(size, 4)]), ...data, new Uint8Array(size % 2)]);
}

export function muxAnimatedWebp(size: CanvasSize, loop: number, alpha: boolean, frames: readonly WebpFrame[]): Uint8Array<ArrayBuffer> {
  const vp8x = chunk("VP8X", [new Uint8Array([VP8X_ANIMATION | (alpha ? VP8X_ALPHA : 0), 0, 0, 0, ...le(size.width - 1, 3), ...le(size.height - 1, 3)])]);
  const anim = chunk("ANIM", [new Uint8Array([0, 0, 0, 0, ...le(loop, 2)])]);
  const anmf = frames.map((frame) =>
    chunk("ANMF", [new Uint8Array([...le(0, 3), ...le(0, 3), ...le(size.width - 1, 3), ...le(size.height - 1, 3), ...le(frame.durationMs, 3), ANMF_NO_BLEND]), frame.payload]),
  );
  const body = joined([new Uint8Array(Array.from("WEBP", (c) => c.charCodeAt(0))), vp8x, anim, ...anmf]);
  return joined([new Uint8Array([...Array.from("RIFF", (c) => c.charCodeAt(0)), ...le(body.length, 4)]), body]);
}
