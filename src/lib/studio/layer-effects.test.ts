import { describe, expect, it } from "vitest";

import { CENTERED_RADIAL } from "./document";
import { DEFAULT_GRADIENT, gradientWithKind, gradientWithVia, startGradient } from "./layer-effects";

describe("layer effects", () => {
  it("starts a gradient from the current fill so the color does not jump", () => {
    expect(startGradient("#112233")).toEqual({ from: "#112233", to: DEFAULT_GRADIENT.to, angle: DEFAULT_GRADIENT.angle });
    expect(startGradient(undefined).from).toBe(DEFAULT_GRADIENT.from);
    expect(startGradient("").from).toBe(DEFAULT_GRADIENT.from);
  });

  it("switches a gradient to radial from the center and back to linear keeping its colors", () => {
    const linear = { from: "#ffffff", via: "#888888", to: "#000000", angle: 30 };
    const radial = gradientWithKind(linear, "radial");
    expect(radial).toEqual({ ...linear, ...CENTERED_RADIAL, kind: "radial" });
    expect(gradientWithKind(radial, "linear")).toMatchObject({ kind: "linear", from: "#ffffff", via: "#888888", to: "#000000", angle: 30 });
  });

  it("adds a middle color halfway between the ends and removes it again", () => {
    const gradient = { from: "#ffffff", to: "#000000", angle: 0 };
    const withVia = gradientWithVia(gradient, true);
    expect(withVia.via).toBe("#808080");
    expect(gradientWithVia(withVia, false)).toEqual({ ...gradient, via: undefined });
  });
});
