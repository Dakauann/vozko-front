import { describe, expect, it } from "vitest";

import { MAX_DASH_VALUES } from "./document";
import { dashPatternFits, dashPresetOf, dashPresetPatch, formatDashPattern, parseDashPattern } from "./stroke-presets";

describe("dash presets", () => {
  it("recognizes the pattern of a layer, the legacy dash flag included", () => {
    expect(dashPresetOf({})).toBe("solid");
    expect(dashPresetOf({ dash: true })).toBe("dashed");
    expect(dashPresetOf({ dashArray: [0, 2] })).toBe("dotted");
    expect(dashPresetOf({ dashArray: [5, 1] })).toBe("custom");
  });

  it("gives dots round caps and clears the legacy flag", () => {
    expect(dashPresetPatch("dotted")).toEqual({ dashArray: [0, 2], dash: undefined, lineCap: "round" });
    expect(dashPresetPatch("dashed")).toEqual({ dashArray: [3, 2], dash: undefined });
    expect(dashPresetPatch("solid")).toEqual({ dashArray: undefined, dash: undefined, dashOffset: undefined });
  });
});

describe("custom dash patterns", () => {
  it("reads dash and gap lengths separated by spaces, with either decimal mark", () => {
    expect(parseDashPattern("6 3 1 3")).toEqual([6, 3, 1, 3]);
    expect(parseDashPattern(" 2,5   0.5 ")).toEqual([2.5, 0.5]);
    expect(parseDashPattern("")).toEqual([]);
  });

  it("refuses text that is not a valid pattern", () => {
    expect(parseDashPattern("2 x")).toBeNull();
    expect(parseDashPattern("0 0")).toBeNull();
    expect(parseDashPattern("-1 2")).toBeNull();
    expect(parseDashPattern("101 2")).toBeNull();
    expect(parseDashPattern(Array.from({ length: MAX_DASH_VALUES + 1 }, () => "1").join(" "))).toBeNull();
  });

  it("checks a pattern by the same rule for people and Elo", () => {
    expect(dashPatternFits([])).toBe(true);
    expect(dashPatternFits([0, 2])).toBe(true);
    expect(dashPatternFits([0, 0])).toBe(false);
  });

  it("writes a pattern back as plain numbers", () => {
    expect(formatDashPattern({ dashArray: [6, 3, 1, 3] })).toBe("6 3 1 3");
    expect(formatDashPattern({ dash: true })).toBe("3 2");
    expect(formatDashPattern({})).toBe("");
  });
});
