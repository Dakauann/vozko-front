import { describe, expect, it } from "vitest";

import { contrastRatio, luminance, mixColors, parseColor, swatchOf, typedColor, withSwatch } from "./color";

describe("studio colors", () => {
  it("reads six and eight digit hex colors", () => {
    expect(parseColor("#ff8800")).toEqual({ r: 255, g: 136, b: 0, a: 1 });
    expect(parseColor("#00000080")?.a).toBeCloseTo(0.5, 2);
    expect(parseColor("teal")).toBeNull();
  });

  it("measures contrast like WCAG", () => {
    expect(contrastRatio(parseColor("#000000")!, parseColor("#ffffff")!)).toBeCloseTo(21, 0);
    expect(contrastRatio(parseColor("#12b5a5")!, parseColor("#ffffff")!)).toBeLessThan(3);
    expect(luminance(parseColor("#0b0f12")!)).toBeLessThan(0.01);
  });

  it("lays a translucent color over another", () => {
    expect(mixColors(parseColor("#000000")!, parseColor("#ffffff")!, 0.5)).toMatchObject({ r: 128, g: 128, b: 128 });
  });

  it("reads a typed color with or without the hash, keeping alpha only where it is allowed", () => {
    expect(typedColor(" FF8800 ", true)).toBe("#ff8800");
    expect(typedColor("#FF880080", true)).toBe("#ff880080");
    expect(typedColor("#ff880080", false)).toBeNull();
    expect(typedColor("#ff88", true)).toBeNull();
    expect(typedColor("teal", true)).toBeNull();
  });

  it("shows the opaque part of a color in the swatch and keeps the alpha when a swatch is picked", () => {
    expect(swatchOf("#FF880080")).toBe("#ff8800");
    expect(swatchOf("#ff8800")).toBe("#ff8800");
    expect(swatchOf("")).toBeNull();
    expect(swatchOf(null)).toBeNull();
    expect(withSwatch("#ff880080", "#00FF00")).toBe("#00ff0080");
    expect(withSwatch("#ff8800", "#00ff00")).toBe("#00ff00");
    expect(withSwatch(null, "#00ff00")).toBe("#00ff00");
  });
});
