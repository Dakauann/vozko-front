import { describe, expect, it } from "vitest";

import { newMediaClip, newOverlayClip, newShapeLayer, newTextLayer, type Clip } from "./document";
import { editPaint, keyTimes, laneProperties, paintValue, recordMoment, setAllEasing, toggleAnimation, toggleKeyAt } from "./keyframe-edit";
import { VISUAL_KEYFRAME_PROPERTIES } from "./keyframes";
import { paintPatch, shownPaint } from "./selection-edit";

function title(extra: Partial<Clip> = {}): Clip {
  return { ...newOverlayClip({ ...newTextLayer("Oferta"), fill: "#ff0000" }, 0, 2000), id: "o", ...extra };
}

const fading: Partial<Clip> = {
  keyframes: {
    fill: [
      { atMs: 0, color: "#000000", easing: "linear" },
      { atMs: 1000, color: "#ffffff", easing: "linear" },
    ],
  },
};

describe("color lanes", () => {
  it("offer the paints the layer has after the numeric properties", () => {
    expect(laneProperties(title())).toEqual([...VISUAL_KEYFRAME_PROPERTIES, "fill"]);
    const outlined = title({ layer: { ...newTextLayer("Oi"), stroke: "#000000", strokeWidth: 4 } });
    expect(laneProperties(outlined)).toEqual([...VISUAL_KEYFRAME_PROPERTIES, "fill", "stroke"]);
    expect(laneProperties({ ...newOverlayClip(newShapeLayer("line"), 0, 1000), id: "l" })).toEqual([...VISUAL_KEYFRAME_PROPERTIES, "stroke"]);
    expect(laneProperties({ ...newMediaClip("video", "vid", 0, 1000), id: "v" })).toEqual([...VISUAL_KEYFRAME_PROPERTIES]);
    expect(laneProperties({ ...newMediaClip("audio", "song", 0, 1000), id: "a" })).toEqual(["gainDb", "pan"]);
  });
});

describe("editing color keys", () => {
  it("starts animating a paint from its current color and stops keeping the color shown", () => {
    const started = toggleAnimation(title(), "fill", 300, 1);
    expect(started.keyframes?.fill).toEqual([{ atMs: 300, color: "#ff0000", easing: "linear" }]);
    const stopped = toggleAnimation(title(fading), "fill", 500, 1);
    expect(stopped.keyframes).toBeUndefined();
    expect(stopped.layer?.fill).toBe("#808080");
  });

  it("adds or removes the key under the playhead with the color shown there", () => {
    expect(toggleKeyAt(title(fading), "fill", 500, 1).keyframes?.fill?.map((f) => [f.atMs, f.color])).toEqual([
      [0, "#000000"],
      [500, "#808080"],
      [1000, "#ffffff"],
    ]);
    expect(toggleKeyAt(title(fading), "fill", 1000, 1).keyframes?.fill?.map((f) => f.atMs)).toEqual([0]);
  });

  it("paints the layer when the color is still and keys it when it is animated", () => {
    const still = title();
    expect(editPaint(still, "fill", "#00ff00", 500)).toEqual({ patch: { layer: { ...still.layer!, fill: "#00ff00" } }, outside: false });
    expect(editPaint(title(fading), "fill", "#00ff00", 250).patch.keyframes?.fill?.map((f) => f.color)).toEqual(["#000000", "#00ff00", "#ffffff"]);
    expect(editPaint(title(fading), "fill", "#00ff00", null)).toEqual({ patch: {}, outside: true });
    expect(paintValue(title(fading), "fill", 500)).toBe("#808080");
    expect(paintValue(title(), "fill", 500)).toBe("#ff0000");
  });

  it("records animated colors with the rest of a moment and sets one easing for all keys", () => {
    const moment = recordMoment(title(fading), 500, 1);
    expect(moment?.keyframes?.fill?.map((f) => f.atMs)).toEqual([0, 500, 1000]);
    expect(moment?.keyframes?.x).toHaveLength(1);
    expect(keyTimes(title(fading))).toEqual([0, 1000]);
    expect(setAllEasing(title(fading), "spring")?.keyframes?.fill?.every((f) => f.easing === "spring")).toBe(true);
  });

  it("reads and edits the paint shown at the playhead across a selection", () => {
    const clip = title({ ...fading, startMs: 1000 });
    expect(shownPaint(clip, "fill", 1500)).toBe("#808080");
    expect(paintPatch(clip, "fill", "#0000ff", 1250)).toMatchObject({ keyframes: { fill: [{ atMs: 0 }, { atMs: 250, color: "#0000ff" }, { atMs: 1000 }] } });
    expect(paintPatch(clip, "fill", "#0000ff", 5000)).toBe("keyframeOutside");
    expect(paintPatch(title(), "fill", "#0000ff", 500)).toMatchObject({ layer: { fill: "#0000ff" } });
  });
});
