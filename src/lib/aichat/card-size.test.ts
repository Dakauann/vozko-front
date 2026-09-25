import { describe, expect, it } from "vitest";

import { DEFAULT_CARD_SIZE, MIN_CARD_SIZE, VIEWPORT_MARGIN, clampCardSize, parseStoredSize } from "./card-size";

const laptop = { width: 1440, height: 900 };

describe("clampCardSize", () => {
  it("keeps a size that fits", () => {
    expect(clampCardSize({ width: 600, height: 700 }, laptop)).toEqual({ width: 600, height: 700 });
  });

  it("never shrinks below a usable card", () => {
    expect(clampCardSize({ width: 100, height: 50 }, laptop)).toEqual(MIN_CARD_SIZE);
  });

  it("never grows past the viewport, leaving the page visible around it", () => {
    expect(clampCardSize({ width: 5000, height: 5000 }, laptop)).toEqual({
      width: laptop.width - VIEWPORT_MARGIN,
      height: laptop.height - VIEWPORT_MARGIN,
    });
  });

  it("gives the minimum when the viewport is smaller than the minimum", () => {
    expect(clampCardSize({ width: 900, height: 900 }, { width: 300, height: 300 })).toEqual(MIN_CARD_SIZE);
  });
});

describe("parseStoredSize", () => {
  it("reads what the card saved", () => {
    expect(parseStoredSize(JSON.stringify({ width: 640, height: 800 }))).toEqual({ width: 640, height: 800 });
  });

  it("ignores anything it did not write", () => {
    for (const raw of [null, "", "not json", "{}", JSON.stringify({ width: "640", height: 800 }), JSON.stringify({ width: -1, height: 800 })]) {
      expect(parseStoredSize(raw)).toBeNull();
    }
  });

  it("defaults to the floating card size", () => {
    expect(DEFAULT_CARD_SIZE.width).toBeGreaterThanOrEqual(MIN_CARD_SIZE.width);
  });
});
