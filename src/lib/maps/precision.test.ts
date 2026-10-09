import { describe, expect, it } from "vitest";

import { isPrecision, precisionCategory, precisionLabelKey, zoomForPrecision } from "./precision";

describe("precisionCategory", () => {
  it.each([
    ["exact", "house"],
    ["address", "house"],
    ["street", "house"],
    ["postal_code", "approximate"],
    ["district", "approximate"],
    ["city", "approximate"],
  ] as const)("shows %s as %s", (precision, category) => {
    expect(precisionCategory(precision)).toBe(category);
  });

  it("shows an unknown precision as unknown, never as a house", () => {
    expect(precisionCategory("rooftop")).toBe("unknown");
    expect(precisionCategory(undefined)).toBe("unknown");
  });
});

describe("precisionLabelKey", () => {
  it.each([
    ["exact", "precision.exact"],
    ["postal_code", "precision.postalCode"],
    ["city", "precision.city"],
    ["rooftop", "precision.unknown"],
  ])("labels %s with %s", (precision, key) => {
    expect(precisionLabelKey(precision)).toBe(key);
  });
});

describe("isPrecision", () => {
  it("knows the six precisions only", () => {
    expect(["exact", "address", "street", "postal_code", "district", "city"].every(isPrecision)).toBe(true);
    expect(isPrecision("rooftop")).toBe(false);
    expect(isPrecision(3)).toBe(false);
  });
});

describe("zoomForPrecision", () => {
  it.each([
    ["exact", 16],
    ["address", 16],
    ["street", 15],
    ["postal_code", 14],
    ["district", 13],
    ["city", 11],
    ["rooftop", 11],
  ])("frames %s at zoom %s", (precision, zoom) => {
    expect(zoomForPrecision(precision)).toBe(zoom);
  });
});
