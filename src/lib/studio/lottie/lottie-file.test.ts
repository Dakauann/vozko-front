import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { isLottieAnimation, isLottieName, readLottieFile } from "./lottie-file";

const FIXTURES = join(process.cwd(), "..", "vozko-back", "domain", "studio", "testdata", "lottie");

function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(FIXTURES, name)));
}

describe("reading a person's Lottie file", () => {
  it("accepts .json and .lottie names only", () => {
    expect(isLottieName("animação.json")).toBe(true);
    expect(isLottieName("Logo.LOTTIE")).toBe(true);
    expect(isLottieName("foto.png")).toBe(false);
    expect(isLottieName("lottie")).toBe(false);
  });

  it("reads a plain Lottie JSON file", async () => {
    const read = await readLottieFile(fixture("static-shapes.json"));
    if (!read.ok) throw new Error(read.fault);
    expect(read.animation.w).toBe(200);
    expect(read.animation.layers).toHaveLength(1);
  });

  it("opens the first animation of a dotLottie file", async () => {
    const read = await readLottieFile(fixture("static-shapes.lottie"));
    if (!read.ok) throw new Error(read.fault);
    expect(read.animation.nm).toBe("Formas");
  });

  it("refuses files that are not Lottie animations", async () => {
    expect(await readLottieFile(new TextEncoder().encode("not json"))).toEqual({ ok: false, fault: "notLottie" });
    expect(await readLottieFile(new TextEncoder().encode('{"fr":30,"ip":0,"op":0,"w":10,"h":10,"layers":[]}'))).toEqual({ ok: false, fault: "notLottie" });
    const cut = fixture("static-shapes.lottie");
    expect(await readLottieFile(cut.slice(0, cut.length - 30))).toEqual({ ok: false, fault: "brokenArchive" });
  });

  it("checks the frame rate, the in and out frames, the size and the layer list", () => {
    const base = { v: "5.7.4", fr: 30, ip: 0, op: 30, w: 100, h: 100, layers: [] };
    expect(isLottieAnimation(base)).toBe(true);
    expect(isLottieAnimation({ ...base, fr: 0 })).toBe(false);
    expect(isLottieAnimation({ ...base, op: -1 })).toBe(false);
    expect(isLottieAnimation({ ...base, w: 0 })).toBe(false);
    expect(isLottieAnimation({ ...base, layers: {} })).toBe(false);
    expect(isLottieAnimation({ ...base, h: Number.NaN })).toBe(false);
  });
});
