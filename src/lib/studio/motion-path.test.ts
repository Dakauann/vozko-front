import { describe, expect, it } from "vitest";

import type { Keyframes } from "./keyframes";
import { keyButtonPosition, motionPath, movePathKeyPatch } from "./motion-path";

const box = { x: 0.5, y: 0.5, w: 0.4, h: 0.2, rotation: 0, opacity: 1 };
const still = { transform: box, durationMs: 4000 };
const travel: Keyframes = {
  x: [
    { atMs: 0, value: 0.1, easing: "linear" },
    { atMs: 2000, value: 0.9, easing: "linear" },
  ],
  y: [
    { atMs: 1000, value: 0.2, easing: "linear" },
    { atMs: 2000, value: 0.8, easing: "linear" },
  ],
};

describe("motion path", () => {
  it("has no path without position keys", () => {
    expect(motionPath(still)).toBeNull();
    expect(motionPath({ ...still, keyframes: { opacity: [{ atMs: 0, value: 1, easing: "linear" }] } })).toBeNull();
  });

  it("puts a pad at every position key time with the position there", () => {
    const path = motionPath({ ...still, keyframes: travel })!;
    expect(path.keys.map((k) => k.atMs)).toEqual([0, 1000, 2000]);
    expect(path.keys[1].x).toBeCloseTo(0.5);
    expect(path.keys[1].y).toBeCloseTo(0.2);
    expect(path.keys[0].y).toBeCloseTo(0.2);
  });

  it("samples the curve between the first and the last key", () => {
    const path = motionPath({ ...still, keyframes: travel }, 9)!;
    expect(path.points).toHaveLength(9);
    expect(path.points[0]).toEqual({ x: 0.1, y: 0.2 });
    expect(path.points.at(-1)!.x).toBeCloseTo(0.9);
    expect(path.points.at(-1)!.y).toBeCloseTo(0.8);
  });

  it("uses the static value for an axis that is not animated", () => {
    const path = motionPath({ ...still, keyframes: { x: travel.x } })!;
    expect(path.keys.every((k) => k.y === 0.5)).toBe(true);
  });

  it("moves a pad by keying every animated axis at its time", () => {
    const patch = movePathKeyPatch({ ...still, keyframes: travel }, 1000, 0.3, 0.6);
    expect(patch.keyframes?.x?.map((f) => [f.atMs, f.value])).toEqual([
      [0, 0.1],
      [1000, 0.3],
      [2000, 0.9],
    ]);
    expect(patch.keyframes?.y?.find((f) => f.atMs === 1000)?.value).toBe(0.6);
  });

  it("leaves a static axis alone and clamps to the key range", () => {
    const patch = movePathKeyPatch({ ...still, keyframes: { x: travel.x } }, 0, 5, 0.9);
    expect(patch.keyframes?.x?.[0].value).toBe(2);
    expect(patch.keyframes?.y).toBeUndefined();
    expect(patch.transform).toBeUndefined();
  });
});

describe("floating key button position", () => {
  const frame = { width: 400, height: 800 };

  it("sits outside the top right corner when there is room", () => {
    const box = { x: 0.5, y: 0.5, w: 0.5, h: 0.25, rotation: 0, opacity: 1 };
    expect(keyButtonPosition(box, frame, 24, 6)).toEqual({ left: 306, top: 270, inside: false });
  });

  it("flips inside the box when the corner touches the preview edge", () => {
    const full = { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 };
    expect(keyButtonPosition(full, frame, 24, 6)).toEqual({ left: 370, top: 6, inside: true });
  });

  it("uses the rotated bounding box", () => {
    const turned = { x: 0.5, y: 0.5, w: 0.25, h: 0.125, rotation: 90, opacity: 1 };
    const position = keyButtonPosition(turned, frame, 24, 6);
    expect(position.left).toBeCloseTo(256);
    expect(position.top).toBeCloseTo(320);
  });
});
