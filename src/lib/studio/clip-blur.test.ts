import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newOverlayClip, newTextLayer, type VideoDocument } from "./document";
import { editBlur, propertyValue, recordMoment, toggleAnimation } from "./keyframe-edit";
import { blurPatch, shownBlur } from "./selection-edit";
import { KEYFRAME_RANGES, keyframeFault } from "./keyframes";
import { visualPlan } from "./playback";
import { videoScene } from "./scene/video-scene";
import { documentIssue } from "./validate";

const box = { x: 0.5, y: 0.5, w: 0.4, h: 0.2, rotation: 0, opacity: 1 };

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "main", kind: "visual", clips: [{ ...newMediaClip("video", "vid", 0, 3000), id: "v" }] },
    { id: "text", kind: "visual", clips: [{ ...newOverlayClip(newTextLayer("Oi"), 0, 2000), id: "o" }] },
    { id: "sound", kind: "audio", clips: [{ ...newMediaClip("audio", "song", 0, 3000), id: "a" }] },
  ];
  d.durationMs = 3000;
  return d;
}

describe("clip blur in the document", () => {
  it("accepts a static or animated blur on visual clips like the backend", () => {
    const d = doc();
    d.tracks[0].clips[0].blur = 12;
    d.tracks[1].clips[0].keyframes = { blur: [{ atMs: 0, value: 20, easing: "easeOut" }, { atMs: 600, value: 0, easing: "linear" }] };
    expect(documentIssue("video", d)).toBeNull();
  });

  it.each([
    ["a blur past the limit", (d: VideoDocument) => (d.tracks[0].clips[0].blur = KEYFRAME_RANGES.blur[1] + 1), "out_of_range"],
    ["a negative blur", (d: VideoDocument) => (d.tracks[0].clips[0].blur = -1), "out_of_range"],
    ["a blur on sound", (d: VideoDocument) => (d.tracks[2].clips[0].blur = 4), "invalid"],
    ["a blur key past the limit", (d: VideoDocument) => (d.tracks[1].clips[0].keyframes = { blur: [{ atMs: 0, value: 500, easing: "linear" }] }), "out_of_range"],
  ])("refuses %s", (_, change, code) => {
    const d = doc();
    change(d);
    expect(documentIssue("video", d)).toEqual({ field: "document.tracks", code });
  });

  it("names the blur key that leaves the range", () => {
    expect(keyframeFault({ blur: [{ atMs: 100, value: 101, easing: "linear" }] }, box)).toMatchObject({ kind: "value", property: "blur", atMs: 100 });
  });
});

describe("clip blur in playback and the scene", () => {
  it("blurs a clip by its static blur and by its keys at the clip time", () => {
    const d = doc();
    d.tracks[0].clips[0].blur = 8;
    d.tracks[1].clips[0].keyframes = { blur: [{ atMs: 0, value: 20, easing: "linear" }, { atMs: 1000, value: 0, easing: "linear" }] };
    const plan = visualPlan(d, 500);
    expect(plan.find((item) => item.clipId === "v")?.blurPx).toBe(8);
    expect(plan.find((item) => item.clipId === "o")?.blurPx).toBeCloseTo(10, 6);
    const scene = videoScene(d, plan);
    expect(scene.nodes.find((node) => node.id === "v")?.blurPx).toBe(8);
    expect(scene.nodes.find((node) => node.id === "o")?.blurPx).toBeCloseTo(10, 6);
  });

  it("leaves a sharp clip without a blur pass", () => {
    const d = doc();
    expect(videoScene(d, visualPlan(d, 500)).nodes.every((node) => node.blurPx === undefined)).toBe(true);
  });
});

describe("blur across a selection", () => {
  it("reads the blur shown at the playhead and changes it through the same rules", () => {
    const clip = { ...newMediaClip("video", "vid", 1000, 2000), id: "v", keyframes: { blur: [{ atMs: 0, value: 0, easing: "linear" as const }, { atMs: 1000, value: 10, easing: "linear" as const }] } };
    expect(shownBlur(clip, 1500)).toBeCloseTo(5);
    expect(blurPatch(clip, (blur) => blur + 4, 1500)).toMatchObject({ keyframes: { blur: [{ atMs: 0 }, { atMs: 500, value: 9 }, { atMs: 1000 }] } });
    expect(blurPatch(clip, () => 4, 4000)).toBe("keyframeOutside");
    expect(blurPatch({ ...clip, keyframes: undefined }, () => 500, 1500)).toEqual({ blur: KEYFRAME_RANGES.blur[1] });
  });
});

describe("editing blur", () => {
  const still = { startMs: 0, durationMs: 2000, transform: box };

  it("sets the static blur when the blur is not animated", () => {
    expect(editBlur(still, 6, 500)).toEqual({ patch: { blur: 6 }, outside: false });
    expect(editBlur(still, 0, 500)).toEqual({ patch: { blur: undefined }, outside: false });
  });

  it("keys an animated blur at the playhead and flags an edit outside the clip", () => {
    const animated = { ...still, keyframes: { blur: [{ atMs: 0, value: 10, easing: "linear" as const }] } };
    const inside = editBlur(animated, 4, 800);
    expect(inside.patch.keyframes?.blur).toEqual([
      { atMs: 0, value: 10, easing: "linear" },
      { atMs: 800, value: 4, easing: "linear" },
    ]);
    expect(editBlur(animated, 4, null)).toEqual({ patch: {}, outside: true });
  });

  it("starts animating from the static blur and stops keeping the current blur", () => {
    const soft = { ...still, blur: 5 };
    const started = toggleAnimation(soft, "blur", 300);
    expect(started.keyframes?.blur).toEqual([{ atMs: 300, value: 5, easing: "linear" }]);
    const animated = { ...still, keyframes: { blur: [{ atMs: 0, value: 0, easing: "linear" as const }, { atMs: 1000, value: 10, easing: "linear" as const }] } };
    expect(propertyValue(animated, "blur", 500)).toBeCloseTo(5);
    expect(toggleAnimation(animated, "blur", 500)).toEqual({ keyframes: undefined, blur: 5 });
  });

  it("records a moment on the transform without adding blur keys to a sharp clip", () => {
    const moment = recordMoment(still, 400);
    expect(moment?.keyframes?.blur).toBeUndefined();
    expect(moment?.keyframes?.x).toHaveLength(1);
    const blurred = { ...still, keyframes: { blur: [{ atMs: 0, value: 10, easing: "linear" as const }] } };
    expect(recordMoment(blurred, 400)?.keyframes?.blur).toHaveLength(2);
  });
});
