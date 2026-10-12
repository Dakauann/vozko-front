import { describe, expect, it } from "vitest";

import { hueFault, hueImageData, hueIssue, hueOfColor, huePixel, hueUniforms, hueWeight, isNeutralHue, storedHue } from "./hue-secondary";

const luma = ([r, g, b]: readonly number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

describe("hue secondary", () => {
  it("keeps the picked color and turns the rest gray at full desaturation", () => {
    const u = hueUniforms({ hue: 0, width: 40, softness: 20, desaturate: 100 });
    expect(huePixel([0.9, 0.1, 0.1], u)).toEqual([0.9, 0.1, 0.1]);
    const [r, g, b] = huePixel([0.1, 0.8, 0.2], u);
    expect(r).toBeCloseTo(g, 12);
    expect(g).toBeCloseTo(b, 12);
    expect(r).toBeCloseTo(luma([0.1, 0.8, 0.2]), 12);
  });

  it("feathers the edge of the range with a smooth step and wraps around red", () => {
    const u = hueUniforms({ hue: 350, width: 40, softness: 20 });
    expect(hueWeight(355 / 360, u)).toBe(1);
    expect(hueWeight(5 / 360, u)).toBe(1);
    expect(hueWeight(10 / 360, u)).toBe(1);
    expect(hueWeight(20 / 360, u)).toBeCloseTo(0.5, 12);
    expect(hueWeight(40 / 360, u)).toBe(0);
  });

  it("rotates only the chosen hues and leaves grays alone", () => {
    const u = hueUniforms({ hue: 120, width: 30, softness: 0, shift: 120 });
    const turned = huePixel([0.1, 0.8, 0.1], u);
    expect(turned[2]).toBeCloseTo(0.8, 12);
    expect(turned[1]).toBeCloseTo(0.1, 12);
    expect(huePixel([0.8, 0.1, 0.1], u)).toEqual([0.8, 0.1, 0.1]);
    expect(huePixel([0.4, 0.4, 0.4], u)).toEqual([0.4, 0.4, 0.4]);
  });

  it("weighs nearly gray pixels less so noise does not flicker", () => {
    const u = hueUniforms({ hue: 0, width: 60, desaturate: 100 });
    const faint = huePixel([0.52, 0.5, 0.5], u);
    expect(faint[0]).toBeLessThan(0.52);
    expect(faint[0]).toBeGreaterThan(luma([0.52, 0.5, 0.5]));
  });

  it("matches the per pixel math on image data and skips transparent pixels", () => {
    const u = hueUniforms({ hue: 200, width: 50, softness: 30, desaturate: 70, saturation: 40 });
    const data = new Uint8ClampedArray([30, 120, 220, 255, 200, 40, 40, 255, 1, 2, 3, 0]);
    hueImageData(data, u);
    expect(Array.from(data.slice(0, 3))).toEqual(huePixel([30 / 255, 120 / 255, 220 / 255], u).map((v) => Math.round(v * 255)));
    expect(Array.from(data.slice(8))).toEqual([1, 2, 3, 0]);
  });

  it("checks ranges, stores only what changes the picture and reads the hue of a color", () => {
    expect(hueFault({ hue: 361, width: 10 })).toBe("hue");
    expect(hueIssue({ hue: 10, width: 10, shift: -181 })).toBe("out_of_range");
    expect(isNeutralHue({ hue: 10, width: 10, softness: 30 })).toBe(true);
    expect(storedHue({ hue: 10, width: 10, softness: 0, desaturate: 50, shift: 0 })).toEqual({ hue: 10, width: 10, desaturate: 50 });
    expect(storedHue({ hue: 10, width: 10 })).toBeUndefined();
    expect(hueOfColor([0, 0, 1])).toBe(240);
    expect(hueOfColor([0.5, 0.5, 0.5])).toBeNull();
  });
});
