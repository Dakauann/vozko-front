import { describe, expect, it } from "vitest";

import { dashPresetOf, dashPresetPatch } from "./stroke-presets";

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
