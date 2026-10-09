import { describe, expect, it } from "vitest";

import { isToneKey, toneCssColor, toneStyle } from "./tones";

describe("toneStyle", () => {
  it("paints chart-1 in the ink, because the brand green is kept for the selection", () => {
    expect(toneStyle("chart-1")).toEqual({ token: "--foreground", hollow: false });
  });

  it.each([
    ["chart-2", "--chart-2"],
    ["chart-3", "--chart-3"],
    ["chart-4", "--chart-4"],
    ["chart-5", "--chart-5"],
  ] as const)("fills %s with %s", (tone, token) => {
    expect(toneStyle(tone)).toEqual({ token, hollow: false });
  });

  it("draws neutral as a hollow ring in the muted ink", () => {
    expect(toneStyle("neutral")).toEqual({ token: "--muted-foreground", hollow: true });
  });
});

describe("toneCssColor", () => {
  it("references the token, so the legend follows the theme", () => {
    expect(toneCssColor("chart-3")).toBe("hsl(var(--chart-3))");
    expect(toneCssColor("neutral")).toBe("hsl(var(--muted-foreground))");
  });
});

describe("isToneKey", () => {
  it("accepts the six tone keys only", () => {
    expect(["chart-1", "chart-2", "chart-3", "chart-4", "chart-5", "neutral"].every(isToneKey)).toBe(true);
    expect(isToneKey("chart-6")).toBe(false);
    expect(isToneKey("primary")).toBe(false);
    expect(isToneKey(null)).toBe(false);
  });
});
