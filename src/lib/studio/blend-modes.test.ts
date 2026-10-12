import { describe, expect, it } from "vitest";

import { BLEND_MODES } from "./document";
import { blendColor } from "./blend-modes";

const close = (got: readonly number[], want: readonly number[]) => got.forEach((value, i) => expect(value).toBeCloseTo(want[i], 5));

describe("blend modes", () => {
  it("follows the compositing formulas for the separable modes", () => {
    const b: [number, number, number] = [0.2, 0.5, 0.8];
    const s: [number, number, number] = [0.6, 0.5, 0.1];
    close(blendColor("normal", b, s), s);
    close(blendColor("multiply", b, s), [0.12, 0.25, 0.08]);
    close(blendColor("screen", b, s), [0.68, 0.75, 0.82]);
    close(blendColor("darken", b, s), [0.2, 0.5, 0.1]);
    close(blendColor("lighten", b, s), [0.6, 0.5, 0.8]);
    close(blendColor("difference", b, s), [0.4, 0, 0.7]);
    close(blendColor("exclusion", b, s), [0.56, 0.5, 0.74]);
    close(blendColor("hard-light", b, s), [0.36, 0.5, 0.16]);
    close(blendColor("overlay", b, s), [0.24, 0.5, 0.64]);
    close(blendColor("color-dodge", [0, 0.5, 0.5], [0.5, 1, 0.5]), [0, 1, 1]);
    close(blendColor("color-burn", [1, 0.5, 0.75], [0.5, 0, 0.5]), [1, 0, 0.5]);
    close(blendColor("soft-light", [0.5, 0.5, 0.16], [0.25, 0.75, 0.75]), [0.375, 0.5 + 0.5 * (Math.sqrt(0.5) - 0.5), 0.16 + 0.5 * (((16 * 0.16 - 12) * 0.16 + 4) * 0.16 - 0.16)]);
  });

  it("keeps hue, saturation and luminosity apart in the non-separable modes", () => {
    const gray: [number, number, number] = [0.5, 0.5, 0.5];
    const red: [number, number, number] = [1, 0, 0];
    close(blendColor("luminosity", red, gray), blendColor("color", gray, red));
    close(blendColor("saturation", red, gray), [0.3, 0.3, 0.3]);
    const tinted = blendColor("color", gray, red);
    expect(tinted[0]).toBeGreaterThan(tinted[1]);
    expect(0.3 * tinted[0] + 0.59 * tinted[1] + 0.11 * tinted[2]).toBeCloseTo(0.5, 5);
    const hue = blendColor("hue", [0.2, 0.6, 0.2], [0, 0, 1]);
    expect(hue[2]).toBeGreaterThan(hue[0]);
  });

  it("gives every mode a result inside the color range", () => {
    for (const mode of BLEND_MODES) {
      for (const value of blendColor(mode, [0.9, 0.1, 0.4], [0.3, 0.95, 0.05])) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });
});
