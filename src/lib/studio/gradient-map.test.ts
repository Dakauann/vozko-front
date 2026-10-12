import { describe, expect, it } from "vitest";

import { addedStop, GRADIENT_MAP_PRESETS, gradientMapIssue, gradientMapLut, gradientMapOfPreset, lumaIndex, mapGradientPixels, movedStop, presetOfStops, removedStop, type GradientMap } from "./gradient-map";

function duotone(patch: Partial<GradientMap> = {}): GradientMap {
  return { stops: [{ at: 0, color: "#000000" }, { at: 1, color: "#ffffff" }], intensity: 1, ...patch };
}

function lutAt(lut: Uint8ClampedArray, index: number): number[] {
  return Array.from(lut.slice(index * 4, index * 4 + 4));
}

describe("gradient map", () => {
  it("accepts two or more ordered stops and refuses anything else", () => {
    expect(gradientMapIssue(duotone())).toBeNull();
    expect(gradientMapIssue(duotone({ stops: [{ at: 0, color: "#000000" }, { at: 0.5, color: "#ff0000" }, { at: 0.5, color: "#00ff00" }, { at: 1, color: "#ffffff" }], interpolation: "srgb", reverse: true }))).toBeNull();
    expect(gradientMapIssue(duotone({ stops: [{ at: 0, color: "#000000" }] }))).toBe("invalid");
    expect(gradientMapIssue(duotone({ stops: [{ at: 0.6, color: "#000000" }, { at: 0.4, color: "#ffffff" }] }))).toBe("invalid");
    expect(gradientMapIssue(duotone({ stops: [{ at: 0, color: "#000000" }, { at: 1.2, color: "#ffffff" }] }))).toBe("out_of_range");
    expect(gradientMapIssue(duotone({ stops: [{ at: 0, color: "black" }, { at: 1, color: "#ffffff" }] }))).toBe("invalid");
    expect(gradientMapIssue(duotone({ intensity: 1.5 }))).toBe("out_of_range");
    expect(gradientMapIssue(duotone({ interpolation: "lab" as GradientMap["interpolation"] }))).toBe("unknown");
  });

  it("maps shadows to the first stop and highlights to the last", () => {
    const lut = gradientMapLut(duotone({ stops: [{ at: 0, color: "#1b1464" }, { at: 1, color: "#ffd166" }] }));
    expect(lutAt(lut, 0)).toEqual([0x1b, 0x14, 0x64, 255]);
    expect(lutAt(lut, 255)).toEqual([0xff, 0xd1, 0x66, 255]);
    const reversed = gradientMapLut(duotone({ stops: [{ at: 0, color: "#1b1464" }, { at: 1, color: "#ffd166" }], reverse: true }));
    expect(lutAt(reversed, 0)).toEqual([0xff, 0xd1, 0x66, 255]);
  });

  it("blends straight in sRGB or perceptually through OKLab", () => {
    expect(lutAt(gradientMapLut(duotone({ interpolation: "srgb" })), 128)[0]).toBe(128);
    const perceptual = lutAt(gradientMapLut(duotone()), 128)[0];
    expect(perceptual).toBeGreaterThan(90);
    expect(perceptual).toBeLessThan(110);
  });

  it("makes a hard edge where two stops share a position", () => {
    const lut = gradientMapLut(duotone({ stops: [{ at: 0, color: "#ff0000" }, { at: 0.5, color: "#ff0000" }, { at: 0.5, color: "#0000ff" }, { at: 1, color: "#0000ff" }] }));
    expect(lutAt(lut, 120)).toEqual([255, 0, 0, 255]);
    expect(lutAt(lut, 135)).toEqual([0, 0, 255, 255]);
  });

  it("reads tone with the Rec. 709 weights", () => {
    expect(lumaIndex(255, 0, 0)).toBe(54);
    expect(lumaIndex(0, 255, 0)).toBe(182);
    expect(lumaIndex(255, 255, 255)).toBe(255);
  });

  it("recolors pixels by tone, keeps alpha and mixes by intensity and stop alpha", () => {
    const lut = gradientMapLut(duotone({ stops: [{ at: 0, color: "#ff0000" }, { at: 1, color: "#0000ff" }] }));
    const data = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 128, 10, 20, 30, 0]);
    mapGradientPixels(data, lut, 1);
    expect(Array.from(data)).toEqual([255, 0, 0, 255, 0, 0, 255, 128, 10, 20, 30, 0]);
    const half = new Uint8ClampedArray([0, 0, 0, 255]);
    mapGradientPixels(half, lut, 0.5);
    expect(Array.from(half)).toEqual([128, 0, 0, 255]);
    const tinted = gradientMapLut(duotone({ stops: [{ at: 0, color: "#ff000080" }, { at: 1, color: "#ff000080" }] }));
    const pixel = new Uint8ClampedArray([0, 0, 0, 255]);
    mapGradientPixels(pixel, tinted, 1);
    expect(pixel[0]).toBe(128);
  });

  it("edits stops in order and never below two", () => {
    const map = duotone({ stops: [{ at: 0, color: "#000000" }, { at: 0.5, color: "#ff0000" }, { at: 1, color: "#ffffff" }] });
    expect(movedStop(map, 1, 1.4).stops[1].at).toBe(1);
    expect(movedStop(map, 1, -0.2).stops[1].at).toBe(0);
    expect(movedStop(map, 1, 0.3).stops.map((s) => s.at)).toEqual([0, 0.3, 1]);
    const added = addedStop(map);
    expect(added.stops).toHaveLength(4);
    expect(added.stops[2]).toEqual({ at: 0.75, color: "#ff8080" });
    expect(gradientMapIssue(added)).toBeNull();
    expect(removedStop(map, 1).stops).toHaveLength(2);
    expect(removedStop(duotone(), 0).stops).toHaveLength(2);
    expect(presetOfStops(gradientMapOfPreset("menta"))).toBe("menta");
    expect(presetOfStops(map.stops)).toBeNull();
  });

  it("expands every preset into evenly spaced valid stops", () => {
    for (const id of Object.keys(GRADIENT_MAP_PRESETS) as (keyof typeof GRADIENT_MAP_PRESETS)[]) {
      const stops = gradientMapOfPreset(id);
      expect(stops[0].at).toBe(0);
      expect(stops[stops.length - 1].at).toBe(1);
      expect(gradientMapIssue({ stops, intensity: 1 })).toBeNull();
    }
  });
});
