import { describe, expect, it } from "vitest";

import { muxAnimatedWebp, readStillWebp } from "./webp-mux";

function ascii(text: string): number[] {
  return Array.from(text, (c) => c.charCodeAt(0));
}

function le32(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >>> 24) & 0xff];
}

function chunk(fourcc: string, data: number[]): number[] {
  return [...ascii(fourcc), ...le32(data.length), ...data, ...(data.length % 2 === 1 ? [0] : [])];
}

function riff(chunks: number[]): Uint8Array {
  return new Uint8Array([...ascii("RIFF"), ...le32(chunks.length + 4), ...ascii("WEBP"), ...chunks]);
}

function lossy(width: number, height: number): number[] {
  return chunk("VP8 ", [0x10, 0x02, 0x00, 0x9d, 0x01, 0x2a, width & 0xff, width >> 8, height & 0xff, height >> 8, 7, 7, 7]);
}

function lossless(width: number, height: number, alpha: boolean): number[] {
  const bits = (width - 1) | ((height - 1) << 14) | (alpha ? 1 << 28 : 0);
  return chunk("VP8L", [0x2f, ...le32(bits), 1, 2]);
}

function u24(bytes: Uint8Array, at: number): number {
  return bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16);
}

function text(bytes: Uint8Array, at: number, length = 4): string {
  return String.fromCharCode(...bytes.subarray(at, at + length));
}

describe("reading a still webp", () => {
  it("takes the frame data and size of a lossy or lossless image", () => {
    const simple = readStillWebp(riff(lossy(480, 270)));
    expect(simple).toMatchObject({ width: 480, height: 270, alpha: false });
    expect(text(simple!.payload, 0)).toBe("VP8 ");
    expect(readStillWebp(riff(lossless(64, 32, true)))).toMatchObject({ width: 64, height: 32, alpha: true });
  });

  it("keeps the alpha chunk of an extended image", () => {
    const vp8x = chunk("VP8X", [0x10, 0, 0, 0, ...le32(99).slice(0, 3), ...le32(49).slice(0, 3)]);
    const still = readStillWebp(riff([...vp8x, ...chunk("ALPH", [1, 2, 3]), ...lossy(100, 50)]));
    expect(still).toMatchObject({ width: 100, height: 50, alpha: true });
    expect(text(still!.payload, 0)).toBe("ALPH");
    expect(text(still!.payload, 12)).toBe("VP8 ");
  });

  it("refuses anything that is not a webp image", () => {
    expect(readStillWebp(new Uint8Array(ascii("\x89PNG\r\n\x1a\n0000000000")))).toBeNull();
    expect(readStillWebp(riff([]))).toBeNull();
    expect(readStillWebp(riff(chunk("VP8 ", [1, 2])))).toBeNull();
  });
});

describe("writing an animated webp", () => {
  it("wraps each frame with its duration in one looping file", () => {
    const frame = readStillWebp(riff(lossy(480, 270)))!.payload;
    const file = muxAnimatedWebp({ width: 480, height: 270 }, 0, false, [
      { payload: frame, durationMs: 67 },
      { payload: frame, durationMs: 133 },
    ]);
    expect(text(file, 0)).toBe("RIFF");
    expect(file[4] | (file[5] << 8) | (file[6] << 16) | (file[7] << 24)).toBe(file.length - 8);
    expect(text(file, 8, 8)).toBe("WEBPVP8X");
    expect(file[20]).toBe(0x02);
    expect(u24(file, 24) + 1).toBe(480);
    expect(u24(file, 27) + 1).toBe(270);
    expect(text(file, 30)).toBe("ANIM");
    expect(file[42] | (file[43] << 8)).toBe(0);
    expect(text(file, 44)).toBe("ANMF");
    expect(u24(file, 52 + 6) + 1).toBe(480);
    expect(u24(file, 52 + 12)).toBe(67);
    expect(file[52 + 15]).toBe(0x02);
    expect(text(file, 52 + 16)).toBe("VP8 ");
    const second = 52 + 16 + frame.length;
    expect(text(file, second)).toBe("ANMF");
    expect(u24(file, second + 8 + 12)).toBe(133);
  });

  it("marks alpha and writes the loop count", () => {
    const frame = readStillWebp(riff(lossless(10, 10, true)))!.payload;
    const file = muxAnimatedWebp({ width: 10, height: 10 }, 3, true, [{ payload: frame, durationMs: 100 }]);
    expect(file[20]).toBe(0x12);
    expect(file[42] | (file[43] << 8)).toBe(3);
  });
});
