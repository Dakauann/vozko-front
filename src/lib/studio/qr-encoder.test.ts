import jsQR from "jsqr";
import { describe, expect, it } from "vitest";

import { alignmentPositions, encodeQr, encodeQrVersion, isDark, QR_BYTE_CAPACITY, QR_ECC_LEVELS, qrByteCapacity, qrBytes, smallestVersion, type QrSymbol } from "./qr-encoder";

const PIXELS_PER_MODULE = 3;
const QUIET = 4;

function pixels(symbol: QrSymbol): { data: Uint8ClampedArray; side: number } {
  const side = (symbol.size + QUIET * 2) * PIXELS_PER_MODULE;
  const data = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let y = 0; y < symbol.size; y++) {
    for (let x = 0; x < symbol.size; x++) {
      if (!isDark(symbol, x, y)) continue;
      for (let dy = 0; dy < PIXELS_PER_MODULE; dy++) {
        for (let dx = 0; dx < PIXELS_PER_MODULE; dx++) {
          const at = (((y + QUIET) * PIXELS_PER_MODULE + dy) * side + (x + QUIET) * PIXELS_PER_MODULE + dx) * 4;
          data[at] = 0;
          data[at + 1] = 0;
          data[at + 2] = 0;
        }
      }
    }
  }
  return { data, side };
}

function decoded(symbol: QrSymbol): string | null {
  const { data, side } = pixels(symbol);
  return jsQR(data, side, side)?.data ?? null;
}

function filler(bytes: number): string {
  const words = "https://vozko.com/r/aZ9-oferta?text=Olá ";
  let text = "";
  while (qrBytes(text + words).length <= bytes) text += words;
  while (qrBytes(text).length < bytes) text += "x";
  return text;
}

describe("qr encoder", () => {
  it("reports the standard byte capacities of version 40", () => {
    expect(QR_BYTE_CAPACITY).toEqual({ L: 2953, M: 2331, Q: 1663, H: 1273 });
    expect(qrByteCapacity(1, "L")).toBe(17);
    expect(qrByteCapacity(1, "H")).toBe(7);
    expect(qrByteCapacity(10, "M")).toBe(213);
  });

  it("places the alignment patterns of the standard table", () => {
    expect(alignmentPositions(1)).toEqual([]);
    expect(alignmentPositions(2)).toEqual([6, 18]);
    expect(alignmentPositions(7)).toEqual([6, 22, 38]);
    expect(alignmentPositions(32)).toEqual([6, 34, 60, 86, 112, 138]);
    expect(alignmentPositions(40)).toEqual([6, 30, 58, 86, 114, 142, 170]);
  });

  it("picks the smallest version that holds the bytes", () => {
    expect(smallestVersion(17, "L")).toBe(1);
    expect(smallestVersion(18, "L")).toBe(2);
    expect(smallestVersion(QR_BYTE_CAPACITY.H + 1, "H")).toBeNull();
    expect(smallestVersion(10, "L", 5)).toBe(5);
    expect(encodeQr(filler(QR_BYTE_CAPACITY.M + 1), "M")).toBeNull();
  });

  it("encodes a symbol an independent decoder reads back, accents included", () => {
    const text = "https://wa.me/5511999998888?text=Ol%C3%A1%2C%20quero%20saber%20mais";
    const symbol = encodeQr(text, "M");
    expect(symbol?.size).toBe(symbol ? symbol.version * 4 + 17 : 0);
    expect(decoded(symbol!)).toBe(text);
    expect(decoded(encodeQr("Promoção de verão: 50% OFF ✓", "Q")!)).toBe("Promoção de verão: 50% OFF ✓");
  });

  it.each(QR_ECC_LEVELS.flatMap((ecc) => [1, 2, 6, 7, 10, 14, 22, 27, 33, 40].map((version) => [ecc, version] as const)))("decodes a full version %s %i", (ecc, version) => {
    const text = filler(qrByteCapacity(version, ecc));
    const symbol = encodeQrVersion(text, ecc, version);
    expect(symbol?.version).toBe(version);
    expect(decoded(symbol!)).toBe(text);
  });

  it("maps every data module to a codeword and every codeword to its block", () => {
    const symbol = encodeQr(filler(200), "H")!;
    const owners = new Set<number>();
    symbol.codewords.forEach((owner) => owner >= 0 && owners.add(owner));
    expect(owners.size).toBe(symbol.blockOf.length);
    expect(Math.max(...symbol.blockOf)).toBe(symbol.blocks - 1);
  });
});
