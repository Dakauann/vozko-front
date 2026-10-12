import { describe, expect, it } from "vitest";

import { colorStops, curvePoints, easeKeys, keyAtPoint, keyLaneTop, keyLanesHeight, keysEasing, keysInBox, keyTimeAt, keyX, propertyKeys, relatedKeys, removeKeys, shiftedKeys, toggledKeys } from "./focus-lanes";
import { VISUAL_KEYFRAME_PROPERTIES } from "./keyframes";

const lanes = [...VISUAL_KEYFRAME_PROPERTIES, "fill"] as const;

const keyframes = {
  x: [
    { atMs: 0, value: 0.2, easing: "linear" as const },
    { atMs: 2000, value: 0.8, easing: "linear" as const },
  ],
  opacity: [{ atMs: 1000, value: 0.5, easing: "linear" as const }],
  fill: [
    { atMs: 0, color: "#000000", easing: "linear" as const },
    { atMs: 2000, color: "#ffffff", easing: "linear" as const },
  ],
};

describe("focus lanes", () => {
  it("stacks one lane per property the clip can animate", () => {
    expect(keyLaneTop(lanes, "x", 20)).toBe(0);
    expect(keyLaneTop(lanes, "opacity", 20)).toBe(80);
    expect(keyLaneTop(lanes, "blur", 20)).toBe(100);
    expect(keyLaneTop(lanes, "fill", 20)).toBe(120);
    expect(keyLanesHeight(lanes.length, 20)).toBe(140);
  });

  it("paints a color lane with the colors the keys pass through", () => {
    expect(colorStops(keyframes.fill, 2000, 2)).toEqual([
      { offset: 0, color: "#000000" },
      { offset: 0.5, color: "#808080" },
      { offset: 1, color: "#ffffff" },
    ]);
  });

  it("maps key times to pixels and back", () => {
    expect(keyX(1000, 4000, 400)).toBe(100);
    expect(keyTimeAt(100, 4000, 400)).toBe(1000);
  });

  it("hits the closest key within reach", () => {
    expect(keyAtPoint(keyframes, "x", 198, 2000, 200)).toEqual({ property: "x", atMs: 2000 });
    expect(keyAtPoint(keyframes, "x", 100, 2000, 200)).toBeNull();
    expect(keyAtPoint(keyframes, "y", 0, 2000, 200)).toBeNull();
    expect(keyAtPoint(keyframes, "fill", 2, 2000, 200)).toEqual({ property: "fill", atMs: 0 });
  });

  it("selects keys inside a marquee", () => {
    expect(keysInBox(keyframes, lanes, { left: -5, right: 150, top: 0, bottom: 200 }, 2000, 200, 20)).toEqual([
      { property: "x", atMs: 0 },
      { property: "opacity", atMs: 1000 },
      { property: "fill", atMs: 0 },
    ]);
    expect(keysInBox(keyframes, lanes, { left: -5, right: 250, top: 0, bottom: 15 }, 2000, 200, 20)).toEqual([
      { property: "x", atMs: 0 },
      { property: "x", atMs: 2000 },
    ]);
  });

  it("toggles keys in the selection", () => {
    const a = { property: "x" as const, atMs: 0 };
    const b = { property: "x" as const, atMs: 2000 };
    expect(toggledKeys([a], b, false)).toEqual([b]);
    expect(toggledKeys([a], b, true)).toEqual([a, b]);
    expect(toggledKeys([a, b], a, true)).toEqual([b]);
  });

  it("draws the value curve within the lane", () => {
    const points = curvePoints(keyframes.x, "x", 2000, 200, 20, 4);
    expect(points).toHaveLength(5);
    expect(points[0]).toEqual([0, 17]);
    expect(points[4]).toEqual([200, 3]);
    expect(curvePoints(keyframes.opacity, "opacity", 2000, 200, 20, 2).every(([, y]) => y === 10)).toBe(true);
    expect(curvePoints([], "x", 2000, 200, 20)).toEqual([]);
  });
});

describe("key actions from the menu", () => {
  it("sets the curve of the selected keys, reads a shared curve and lists the keys of a property", () => {
    const eased = easeKeys(keyframes, [{ property: "x", atMs: 0 }, { property: "opacity", atMs: 1000 }], "spring");
    expect(eased?.x?.[0].easing).toBe("spring");
    expect(eased?.x?.[1].easing).toBe("linear");
    expect(keysEasing(eased, [{ property: "x", atMs: 0 }, { property: "opacity", atMs: 1000 }])).toBe("spring");
    expect(keysEasing(eased, [{ property: "x", atMs: 0 }, { property: "x", atMs: 2000 }])).toBeNull();
    expect(keysEasing(eased, [])).toBeNull();
    expect(propertyKeys(keyframes, "x")).toEqual([{ property: "x", atMs: 0 }, { property: "x", atMs: 2000 }]);
  });
});

describe("key removal and shifting", () => {
  it("removes selected keys and shifts references", () => {
    const left = removeKeys(keyframes, [
      { property: "x", atMs: 0 },
      { property: "opacity", atMs: 1000 },
    ]);
    expect(left?.x).toEqual([{ atMs: 2000, value: 0.8, easing: "linear" }]);
    expect(left?.opacity).toBeUndefined();
    expect(shiftedKeys([{ property: "x", atMs: 100 }], 50)).toEqual([{ property: "x", atMs: 150 }]);
  });
});

describe("selecting related keys", () => {
  const k = {
    x: [
      { atMs: 0, value: 0.2, easing: "linear" as const },
      { atMs: 500, value: 0.8, easing: "linear" as const },
      { atMs: 1000, value: 0.2, easing: "linear" as const },
      { atMs: 1500, value: 0.5, easing: "linear" as const },
    ],
    fill: [
      { atMs: 0, color: "#FF0000", easing: "linear" as const },
      { atMs: 700, color: "#00ff00", easing: "linear" as const },
      { atMs: 900, color: "#ff0000", easing: "linear" as const },
    ],
  };

  it("selects the keys before or after the selected key of each property", () => {
    expect(relatedKeys(k, [{ property: "x", atMs: 1000 }], "previous")).toEqual([
      { property: "x", atMs: 0 },
      { property: "x", atMs: 500 },
    ]);
    expect(relatedKeys(k, [{ property: "x", atMs: 500 }, { property: "fill", atMs: 700 }], "following")).toEqual([
      { property: "x", atMs: 1000 },
      { property: "x", atMs: 1500 },
      { property: "fill", atMs: 900 },
    ]);
  });

  it("selects every key of the property with the same value", () => {
    expect(relatedKeys(k, [{ property: "x", atMs: 0 }], "equal")).toEqual([
      { property: "x", atMs: 0 },
      { property: "x", atMs: 1000 },
    ]);
    expect(relatedKeys(k, [{ property: "fill", atMs: 900 }], "equal")).toEqual([
      { property: "fill", atMs: 0 },
      { property: "fill", atMs: 900 },
    ]);
  });
});
