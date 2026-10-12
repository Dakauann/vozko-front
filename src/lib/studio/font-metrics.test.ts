import { describe, expect, it } from "vitest";

import { FONT_METRIC_WEIGHTS, FONT_METRICS, textAdvance } from "./font-metrics";
import { FONT_IDS } from "./fonts";

describe("font metrics", () => {
  it("knows the measured advances of every family at both weights", () => {
    for (const id of FONT_IDS) {
      for (const weight of FONT_METRIC_WEIGHTS) {
        const advances = FONT_METRICS[id]?.[`${weight}`];
        expect(advances, `${id} ${weight}`).toHaveLength(5);
        for (const value of advances) expect(value, `${id} ${weight}`).toBeGreaterThan(0.1);
        for (const value of advances) expect(value, `${id} ${weight}`).toBeLessThan(1.2);
      }
    }
  });

  it("estimates wider text for capitals, heavier weights and letter spacing", () => {
    expect(textAdvance("OFERTA", "inter", 400)).toBeGreaterThan(textAdvance("oferta", "inter", 400));
    expect(textAdvance("oferta", "inter", 900)).toBeGreaterThan(textAdvance("oferta", "inter", 400));
    expect(textAdvance("oferta", "inter", 400, 0.1)).toBeCloseTo(textAdvance("oferta", "inter", 400) + 0.6);
    expect(textAdvance("Feliz aniversário", "pacifico", 400)).toBeGreaterThan(textAdvance("Feliz aniversario", "pacifico", 400) - 1e-9);
  });

  it("tells a condensed face from a wide one", () => {
    expect(textAdvance("BLACK FRIDAY", "anton", 400)).toBeLessThan(textAdvance("BLACK FRIDAY", "archivo-black", 400) * 0.75);
  });
});
