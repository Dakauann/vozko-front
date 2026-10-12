import { describe, expect, it } from "vitest";

import { newMediaClip, type Clip, type Transform } from "./document";
import { anchorAt, animatedTransform, pivotPoint, placedPivot, placementAt, turnedAbout } from "./clip-placement";
import { anchorPatch, editPlaced } from "./placement-edit";
import type { Keyframes } from "./keyframes";

const SQUARE = 1;
const WIDE = 16 / 9;

function clip(overrides: Partial<Clip> = {}): Clip {
  return { ...newMediaClip("image", "m-1", 0, 2000), id: "c", transform: { x: 0.5, y: 0.5, w: 0.4, h: 0.2, rotation: 0, opacity: 1 }, ...overrides };
}

function applied(target: Clip, patch: Partial<Clip>): Clip {
  return { ...target, ...patch };
}

function corners(t: Transform, aspect: number): { x: number; y: number }[] {
  const radians = (t.rotation * Math.PI) / 180;
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([sx, sy]) => {
    const lx = (sx * t.w * aspect) / 2;
    const ly = (sy * t.h) / 2;
    return { x: t.x + (lx * Math.cos(radians) - ly * Math.sin(radians)) / aspect, y: t.y + lx * Math.sin(radians) + ly * Math.cos(radians) };
  });
}

describe("the animated transform", () => {
  it("scales each axis on its own", () => {
    const keyframes: Keyframes = { scaleX: [{ atMs: 0, value: 1, easing: "linear" }, { atMs: 1000, value: 2, easing: "linear" }], scaleY: [{ atMs: 0, value: 0.5, easing: "linear" }] };
    const shown = animatedTransform(clip().transform, keyframes, 500, SQUARE);
    expect(shown.w).toBeCloseTo(0.6, 12);
    expect(shown.h).toBeCloseTo(0.1, 12);
  });

  it("reads the position from a curved path", () => {
    const keyframes: Keyframes = { position: [{ atMs: 0, x: 0.2, y: 0.3, easing: "linear" }, { atMs: 1000, x: 0.8, y: 0.3, easing: "linear" }] };
    const shown = animatedTransform(clip().transform, keyframes, 500, WIDE);
    expect(shown.x).toBeCloseTo(0.5, 9);
    expect(shown.y).toBeCloseTo(0.3, 9);
  });
});

describe("placement around the anchor", () => {
  it("leaves a still clip where it is whatever the anchor", () => {
    const placed = placementAt(clip({ anchor: { x: 0, y: 1 } }), 0, WIDE);
    expect(placed.x).toBeCloseTo(0.5, 12);
    expect(placed.y).toBeCloseTo(0.5, 12);
  });

  it("rotates around the anchor, which stays put", () => {
    const rotated = clip({ anchor: { x: 0, y: 0 }, transform: { x: 0.5, y: 0.5, w: 0.4, h: 0.2, rotation: 90, opacity: 1 } });
    const placed = placementAt(rotated, 0, WIDE);
    const pivot = pivotPoint(rotated, 0, WIDE);
    expect(pivot.x).toBeCloseTo(0.3, 12);
    expect(pivot.y).toBeCloseTo(0.4, 12);
    const nearest = corners(placed, WIDE).reduce((best, corner) => Math.min(best, Math.hypot((corner.x - pivot.x) * WIDE, corner.y - pivot.y)), Infinity);
    expect(nearest).toBeLessThan(1e-9);
  });

  it("scales toward the anchor", () => {
    const grown = clip({ anchor: { x: 1, y: 0.5 }, keyframes: { scale: [{ atMs: 0, value: 2, easing: "linear" }] } });
    const placed = placementAt(grown, 0, SQUARE);
    expect(placed.w).toBeCloseTo(0.8, 12);
    expect(placed.x + placed.w / 2).toBeCloseTo(0.7, 12);
  });

  it("adds the path heading when the clip orients along its path", () => {
    const orbit = clip({ autoOrient: true, keyframes: { position: [{ atMs: 0, x: 0.2, y: 0.2, easing: "linear", spatial: "linear" }, { atMs: 1000, x: 0.2, y: 0.8, easing: "linear", spatial: "linear" }] } });
    expect(placementAt(orbit, 500, SQUARE).rotation).toBeCloseTo(90, 9);
    expect(placementAt({ ...orbit, autoOrient: false }, 500, SQUARE).rotation).toBeCloseTo(0, 9);
  });

  it("ignores orientation without a curved path", () => {
    expect(placementAt(clip({ autoOrient: true }), 500, SQUARE).rotation).toBe(0);
  });
});

describe("moving the anchor", () => {
  it("keeps a rotated and scaled clip in place by default", () => {
    const tilted = clip({ transform: { x: 0.5, y: 0.5, w: 0.4, h: 0.2, rotation: 30, opacity: 1 }, keyframes: { scale: [{ atMs: 0, value: 1.5, easing: "linear" }] } });
    const before = placementAt(tilted, 0, WIDE);
    const result = anchorPatch(tilted, { x: 0, y: 1 }, true, 0, WIDE);
    const after = placementAt(applied(tilted, result.patch), 0, WIDE);
    expect(result.kept).toBe("all");
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
  });

  it("moves only the pivot when asked not to keep the picture", () => {
    const tilted = clip({ transform: { x: 0.5, y: 0.5, w: 0.4, h: 0.2, rotation: 30, opacity: 1 } });
    const result = anchorPatch(tilted, { x: 0, y: 0 }, false, 0, WIDE);
    expect(result.patch.transform).toBeUndefined();
    expect(result.patch.anchor).toEqual({ x: 0, y: 0 });
  });

  it("clears the field when the anchor goes back to the center", () => {
    expect(anchorPatch(clip({ anchor: { x: 0, y: 0 } }), { x: 0.5, y: 0.5 }, false, 0, WIDE).patch).toEqual({ anchor: undefined });
  });

  it("corrects every position key with the turn at that key", () => {
    const spinning = clip({
      keyframes: {
        rotation: [{ atMs: 0, value: 0, easing: "linear" }, { atMs: 1000, value: 90, easing: "linear" }],
        x: [{ atMs: 0, value: 0.3, easing: "linear" }, { atMs: 1000, value: 0.7, easing: "linear" }],
        y: [{ atMs: 0, value: 0.4, easing: "linear" }, { atMs: 1000, value: 0.6, easing: "linear" }],
      },
    });
    const result = anchorPatch(spinning, { x: 0, y: 0 }, true, 500, SQUARE);
    const moved = applied(spinning, result.patch);
    expect(result.kept).toBe("keys");
    for (const ms of [0, 1000]) {
      expect(placementAt(moved, ms, SQUARE).x).toBeCloseTo(placementAt(spinning, ms, SQUARE).x, 9);
      expect(placementAt(moved, ms, SQUARE).y).toBeCloseTo(placementAt(spinning, ms, SQUARE).y, 9);
    }
  });

  it("keeps a turning clip with a still position only at the playhead", () => {
    const spinning = clip({ keyframes: { rotation: [{ atMs: 0, value: 0, easing: "linear" }, { atMs: 1000, value: 90, easing: "linear" }] } });
    const result = anchorPatch(spinning, { x: 0, y: 0 }, true, 500, SQUARE);
    const moved = applied(spinning, result.patch);
    expect(result.kept).toBe("moment");
    expect(placementAt(moved, 500, SQUARE).x).toBeCloseTo(placementAt(spinning, 500, SQUARE).x, 9);
  });
});

describe("editing the placed box", () => {
  it("resizes from a handle with an anchor in the corner and lands the box where it was drawn", () => {
    const tilted = clip({ anchor: { x: 0, y: 0 }, transform: { x: 0.5, y: 0.5, w: 0.4, h: 0.2, rotation: 40, opacity: 1 } });
    const desired = { ...placementAt(tilted, 0, WIDE), w: 0.5, x: 0.52 };
    const edit = editPlaced(tilted, desired, 0, WIDE);
    const result = placementAt(applied(tilted, edit.patch), 0, WIDE);
    expect(result.w).toBeCloseTo(0.5, 9);
    expect(result.x).toBeCloseTo(0.52, 9);
    expect(result.y).toBeCloseTo(desired.y, 9);
  });

  it("writes scale keys when the size is animated", () => {
    const grown = clip({ anchor: { x: 1, y: 1 }, keyframes: { scaleX: [{ atMs: 0, value: 1, easing: "linear" }, { atMs: 1000, value: 2, easing: "linear" }] } });
    const desired = { ...placementAt(grown, 1000, SQUARE), w: 1 };
    const edit = editPlaced(grown, desired, 1000, SQUARE);
    expect(edit.patch.keyframes?.scaleX?.at(-1)?.value).toBeCloseTo(2.5, 9);
    expect(placementAt(applied(grown, edit.patch), 1000, SQUARE).x).toBeCloseTo(desired.x, 9);
  });

  it("turns a clip around its anchor without moving the position", () => {
    const anchored = clip({ anchor: { x: 0, y: 0.5 } });
    const pivot = pivotPoint(anchored, 0, SQUARE);
    const turned = { ...placementAt(anchored, 0, SQUARE), rotation: 90 };
    const radians = Math.PI / 2;
    const offset = { x: (0 - 0.5) * 0.4, y: 0 };
    turned.x = pivot.x - (offset.x * Math.cos(radians) - offset.y * Math.sin(radians));
    turned.y = pivot.y - (offset.x * Math.sin(radians) + offset.y * Math.cos(radians));
    const edit = editPlaced(anchored, turned, 0, SQUARE);
    expect(edit.patch.transform?.x).toBeCloseTo(0.5, 9);
    expect(edit.patch.transform?.rotation).toBeCloseTo(90, 9);
  });
});

describe("the anchor handle math", () => {
  it("finds the anchor under a point of a turned box and the pivot back", () => {
    const placed = { x: 0.5, y: 0.5, w: 0.4, h: 0.2, rotation: 35, opacity: 1 };
    const anchor = { x: 0.2, y: 0.9 };
    const pivot = placedPivot(placed, anchor, WIDE);
    const found = anchorAt(placed, pivot, WIDE);
    expect(found.x).toBeCloseTo(0.2, 9);
    expect(found.y).toBeCloseTo(0.9, 9);
  });

  it("turns a placed box around a fixed pivot", () => {
    const placed = { x: 0.5, y: 0.5, w: 0.4, h: 0.2, rotation: 0, opacity: 1 };
    const anchor = { x: 0, y: 0 };
    const pivot = placedPivot(placed, anchor, WIDE);
    const turned = turnedAbout(placed, pivot, anchor, 60, WIDE);
    const again = placedPivot(turned, anchor, WIDE);
    expect(again.x).toBeCloseTo(pivot.x, 9);
    expect(again.y).toBeCloseTo(pivot.y, 9);
  });
});
