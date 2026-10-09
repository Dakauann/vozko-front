import { describe, expect, it } from "vitest";

import { applyMatrix, filterMatrix } from "./color-matrix";

function konva(rgb: [number, number, number], filters: { brightness: number; contrast: number; saturation: number }): [number, number, number] {
  const clamp = (v: number) => Math.min(255, Math.max(0, v));
  let [r, g, b] = rgb.map((v) => v * 255);
  if (filters.brightness !== 0) [r, g, b] = [r, g, b].map((v) => clamp(v + filters.brightness * 255));
  if (filters.contrast !== 0) {
    const adjust = ((filters.contrast + 100) / 100) ** 2;
    [r, g, b] = [r, g, b].map((v) => clamp(((v / 255 - 0.5) * adjust + 0.5) * 255));
  }
  if (filters.saturation !== 0) {
    const s = 2 ** filters.saturation;
    const nr = (0.299 + 0.701 * s) * r + (0.587 - 0.587 * s) * g + (0.114 - 0.114 * s) * b;
    const ng = (0.299 - 0.299 * s) * r + (0.587 + 0.413 * s) * g + (0.114 - 0.114 * s) * b;
    const nb = (0.299 - 0.3 * s) * r + (0.587 - 0.588 * s) * g + (0.114 + 0.886 * s) * b;
    [r, g, b] = [nr, ng, nb].map(clamp);
  }
  return [r / 255, g / 255, b / 255];
}

describe("filter color matrix", () => {
  it("is absent when no color filter is set", () => {
    expect(filterMatrix(undefined)).toBeNull();
    expect(filterMatrix({ brightness: 0, contrast: 0, saturation: 0, blur: 4 })).toBeNull();
  });

  it.each([
    { brightness: 0.1, contrast: 0, saturation: 0 },
    { brightness: 0, contrast: 25, saturation: 0 },
    { brightness: 0, contrast: 0, saturation: 0.6 },
    { brightness: 0.05, contrast: 12, saturation: -0.4 },
  ])("matches the editor filters on mid tones for %o", (filters) => {
    const matrix = filterMatrix({ ...filters, blur: 0 })!;
    for (const rgb of [[0.4, 0.5, 0.6], [0.3, 0.45, 0.35], [0.55, 0.4, 0.5]] as [number, number, number][]) {
      const [r, g, b] = applyMatrix(matrix, rgb);
      const [er, eg, eb] = konva(rgb, filters);
      expect(r).toBeCloseTo(er, 2);
      expect(g).toBeCloseTo(eg, 2);
      expect(b).toBeCloseTo(eb, 2);
    }
  });
});
