import { describe, expect, it } from "vitest";

import { builderStepLabel } from "./builder-progress";

describe("builderStepLabel", () => {
  it("shows only the step when the builder runs without a cap", () => {
    expect(builderStepLabel(3, 0)).toBe("Passo 3");
  });

  it("keeps the cap when a positive one arrives", () => {
    expect(builderStepLabel(3, 30)).toBe("Passo 3/30");
  });

  it("never shows a negative or missing cap", () => {
    expect(builderStepLabel(1, -5)).toBe("Passo 1");
    expect(builderStepLabel(1, Number.NaN)).toBe("Passo 1");
  });
});
