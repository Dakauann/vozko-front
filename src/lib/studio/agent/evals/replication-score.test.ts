import { describe, expect, it } from "vitest";

import type { ImageSurface, Layer } from "../../document";
import { imageScene } from "../scene";
import { assignment, ciede2000, diceSimilarity, grayOf, replicationScore, ssim } from "./replication-score";

function text(id: string, value: string, x: number, y: number, fill = "#111111", extra: Partial<Layer> = {}): Layer {
  return { id, type: "text", text: value, fontId: "inter", fontSize: 0.05, fontWeight: 700, align: "center", lineHeight: 1.2, fill, transform: { x, y, w: 0.6, h: 0.08, rotation: 0, opacity: 1 }, ...extra };
}

function rect(id: string, x: number, y: number, w: number, h: number, fill: string, rotation = 0): Layer {
  return { id, type: "shape", shape: "rect", fill, transform: { x, y, w, h, rotation, opacity: 1 } };
}

function surface(layers: Layer[], background = "#ffffff"): ImageSurface {
  return { canvas: { width: 1000, height: 1000, background }, layers };
}

const reference = surface([rect("band", 0.5, 0.2, 1, 0.3, "#c2410c"), text("title", "Cardápio do Dia", 0.5, 0.2, "#ffffff"), text("price", "R$ 29,90", 0.5, 0.7)]);

describe("character similarity", () => {
  it("is the Sørensen-Dice share of shared characters", () => {
    expect(diceSimilarity("abc", "abc")).toBe(1);
    expect(diceSimilarity("abcd", "abxy")).toBe(0.5);
    expect(diceSimilarity("", "")).toBe(1);
    expect(diceSimilarity("abc", "")).toBe(0);
  });
});

describe("color distance", () => {
  it("matches the published CIEDE2000 reference pairs", () => {
    const lab = (L: number, a: number, b: number) => ({ L, a, b });
    expect(ciede2000(lab(50, 2.6772, -79.7751), lab(50, 0, -82.7485))).toBeCloseTo(2.0425, 3);
    expect(ciede2000(lab(50, -1, 2), lab(50, 0, 0))).toBeCloseTo(2.3669, 3);
    expect(ciede2000(lab(2.0776, 0.0795, -1.135), lab(0.9033, -0.0636, -0.5514))).toBeCloseTo(0.9082, 3);
  });
});

describe("assignment", () => {
  it("finds the cheapest one to one pairing, also when the sides differ in size", () => {
    expect(assignment([[4, 1, 3], [2, 0, 5], [3, 2, 2]])).toEqual([1, 0, 2]);
    expect(assignment([[1, 9], [9, 1], [5, 5]])).toEqual([0, 1, -1]);
    expect(assignment([[3, 1, 2]])).toEqual([1]);
  });
});

describe("structural similarity", () => {
  it("is 1 for the same picture and drops when it changes", () => {
    const flat = { width: 16, height: 16, data: new Float32Array(256).map((_, i) => (i % 16) * 10) };
    const flipped = { width: 16, height: 16, data: new Float32Array(256).map((_, i) => 150 - (i % 16) * 10) };
    expect(ssim(flat, flat)).toBeCloseTo(1, 6);
    expect(ssim(flat, flipped)).toBeLessThan(0.5);
  });

  it("reads luma from RGBA pixels", () => {
    const gray = grayOf({ width: 1, height: 1, data: new Uint8ClampedArray([255, 0, 0, 255]) });
    expect(gray.data[0]).toBeCloseTo(76.245, 2);
  });
});

describe("replication score", () => {
  it("scores a perfect copy at the top of every measure", () => {
    const score = replicationScore(imageScene(reference), imageScene(reference));
    expect(score.blockMatch).toBeCloseTo(1, 6);
    expect(score.text).toMatchObject({ exact: 2, total: 2, similarity: 1 });
    expect(score.positionError).toBe(0);
    expect(score.sizeError).toBe(0);
    expect(score.colorError).toBe(0);
    expect(score.backgroundError).toBe(0);
    expect(score.matched).toBe(3);
  });

  it("matches texts by their characters, not their order, and measures how far they moved", () => {
    const copy = surface([text("p", "R$ 29,90", 0.5, 0.75), rect("b", 0.5, 0.2, 1, 0.3, "#c2410c"), text("t", "Cardapio do Dia", 0.5, 0.2, "#ffffff")]);
    const score = replicationScore(imageScene(reference), imageScene(copy));
    expect(score.matched).toBe(3);
    expect(score.text.exact).toBe(1);
    expect(score.text.similarity).toBeGreaterThan(0.9);
    expect(score.positionError).toBeCloseTo(0.05 / 3, 6);
  });

  it("charges missing and invented elements through the block match", () => {
    const partial = surface([text("t", "Cardápio do Dia", 0.5, 0.2, "#ffffff"), rect("extra", 0.2, 0.9, 0.2, 0.1, "#00ff00")]);
    const score = replicationScore(imageScene(reference), imageScene(partial));
    expect(score.matched).toBe(1);
    expect(score.missing).toEqual(["band", "price"]);
    expect(score.invented).toEqual(["extra"]);
    expect(score.blockMatch).toBeCloseTo(0.096 / 0.464, 6);
  });

  it("reports color, size, rotation and background differences of matched elements", () => {
    const tinted = surface([rect("band", 0.5, 0.2, 0.8, 0.3, "#1d4ed8", 10), text("title", "Cardápio do Dia", 0.5, 0.2, "#ffffff"), text("price", "R$ 29,90", 0.5, 0.7)], "#000000");
    const score = replicationScore(imageScene(reference), imageScene(tinted));
    expect(score.colorError).toBeGreaterThan(10);
    expect(score.sizeError).toBeCloseTo(0.2 / 2 / 3, 6);
    expect(score.rotationError).toBeCloseTo(10 / 3, 6);
    expect(score.backgroundError).toBeCloseTo(100, 0);
  });

  it("does not pair a text with a shape", () => {
    const swapped = surface([rect("t", 0.5, 0.7, 0.6, 0.08, "#111111")]);
    const score = replicationScore(imageScene(surface([text("price", "R$ 29,90", 0.5, 0.7)])), imageScene(swapped));
    expect(score.matched).toBe(0);
  });
});
