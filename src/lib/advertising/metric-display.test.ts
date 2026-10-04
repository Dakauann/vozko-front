import { describe, expect, it } from "vitest";

import { shownCount, shownLinkRate } from "./metric-display";

describe("shownCount", () => {
  it("hides a zero count the way Meta shows a dash, and keeps real counts", () => {
    expect(shownCount(0)).toBeNull();
    expect(shownCount(null)).toBeNull();
    expect(shownCount(undefined)).toBeNull();
    expect(shownCount(212)).toBe(212);
  });
});

describe("shownLinkRate", () => {
  it("shows a link rate only once there is a link click, like Meta", () => {
    expect(shownLinkRate(0, 0)).toBeNull();
    expect(shownLinkRate(null, 3)).toBeNull();
    expect(shownLinkRate(1.42, 3)).toBe(1.42);
  });
});
