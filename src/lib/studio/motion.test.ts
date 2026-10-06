import { describe, expect, it } from "vitest";

import { MOTION_DISTANCE } from "./document";
import { motionOffset, motionPresetPatch, movedTransform, presetOf } from "./motion";

const clip = { durationMs: 4000, motionIn: { edge: "left" as const, durationMs: 1000 }, motionOut: { edge: "bottom" as const, durationMs: 1000 } };

describe("motion", () => {
  it("starts one distance away from its edge and eases in like the renderer", () => {
    expect(motionOffset(clip, 0)).toEqual({ dx: -MOTION_DISTANCE, dy: 0 });
    expect(motionOffset(clip, 500).dx).toBeCloseTo(-MOTION_DISTANCE * 0.125);
    expect(motionOffset(clip, 2000)).toEqual({ dx: 0, dy: 0 });
    expect(motionOffset(clip, 3500).dy).toBeCloseTo(MOTION_DISTANCE * 0.125);
    expect(motionOffset(clip, 4000)).toEqual({ dx: 0, dy: MOTION_DISTANCE });
    expect(motionOffset({ durationMs: 1000 }, 0)).toEqual({ dx: 0, dy: 0 });
  });

  it("shifts the box without touching a still one", () => {
    const box = { x: 0.5, y: 0.5, w: 0.4, h: 0.2, rotation: 0, opacity: 1 };
    expect(movedTransform(box, { dx: 0, dy: 0 })).toBe(box);
    expect(movedTransform(box, { dx: -0.1, dy: 0.05 })).toMatchObject({ x: 0.4, y: 0.55 });
  });

  it("turns presets into clip patches and reads them back", () => {
    expect(motionPresetPatch("in", "slideUp", 600)).toEqual({ motionIn: { edge: "bottom", durationMs: 600 }, fadeInMs: 600 });
    expect(motionPresetPatch("out", "slideLeft")).toEqual({ motionOut: { edge: "left", durationMs: 500 }, fadeOutMs: 500 });
    expect(motionPresetPatch("in", "fade", 300)).toEqual({ motionIn: undefined, fadeInMs: 300 });
    expect(motionPresetPatch("out", "none")).toEqual({ motionOut: undefined, fadeOutMs: 0 });
    expect(presetOf({ motionIn: { edge: "bottom", durationMs: 600 }, fadeInMs: 600, fadeOutMs: 0 }, "in")).toBe("slideUp");
    expect(presetOf({ fadeInMs: 0, fadeOutMs: 200 }, "out")).toBe("fade");
    expect(presetOf({ fadeInMs: 0, fadeOutMs: 0 }, "in")).toBe("none");
    expect(presetOf({ motionIn: { edge: "bottom", durationMs: 600 }, fadeInMs: 0, fadeOutMs: 0 }, "in")).toBe("custom");
  });
});
