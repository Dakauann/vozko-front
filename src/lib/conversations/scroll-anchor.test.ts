import { describe, expect, it } from "vitest";

import { firstVisibleIndex, isPinnedToBottom } from "./scroll-anchor";

describe("isPinnedToBottom", () => {
  it("treats the last few pixels as the bottom", () => {
    expect(isPinnedToBottom({ scrollTop: 930, scrollHeight: 1500, clientHeight: 500 })).toBe(true);
    expect(isPinnedToBottom({ scrollTop: 900, scrollHeight: 1500, clientHeight: 500 })).toBe(false);
  });
});

describe("firstVisibleIndex", () => {
  const bottoms = [100, 220, 400, 410, 900];

  it("finds the first message still showing below the top edge", () => {
    expect(firstVisibleIndex(bottoms.length, (i) => bottoms[i], 0)).toBe(0);
    expect(firstVisibleIndex(bottoms.length, (i) => bottoms[i], 220)).toBe(2);
    expect(firstVisibleIndex(bottoms.length, (i) => bottoms[i], 405)).toBe(3);
  });

  it("reports nothing when every message is above the view", () => {
    expect(firstVisibleIndex(bottoms.length, (i) => bottoms[i], 900)).toBe(-1);
    expect(firstVisibleIndex(0, () => 0, 0)).toBe(-1);
  });

  it("reads only a logarithmic number of positions in a long thread", () => {
    let reads = 0;
    firstVisibleIndex(10_000, (i) => {
      reads += 1;
      return i * 50;
    }, 250_000);
    expect(reads).toBeLessThanOrEqual(15);
  });
});
