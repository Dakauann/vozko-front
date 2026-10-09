import { describe, expect, it } from "vitest";

import { canStart, MAX_PARALLEL_GENERATIONS, MAX_PARALLEL_PROCESSING } from "./limits";

describe("parallel job ceilings", () => {
  it("lets AI generations run side by side up to the ceiling", () => {
    expect(canStart("music", ["music"])).toBe(true);
    expect(canStart("voice", ["music", "image"])).toBe(true);
    expect(canStart("music", Array(MAX_PARALLEL_GENERATIONS).fill("image"))).toBe(false);
  });

  it("keeps processing on its own, smaller lane", () => {
    expect(canStart("captions", ["music", "voice", "image"])).toBe(true);
    expect(canStart("cutout", Array(MAX_PARALLEL_PROCESSING).fill("denoise"))).toBe(false);
    expect(canStart("music", ["captions", "cutout"])).toBe(true);
  });
});
