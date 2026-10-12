import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newOverlayClip, newTextLayer, type VideoDocument } from "./document";
import { LUMA_DEFAULTS, lumaAlpha, lumaAt, lumaIssue, lumaKeyState, lumaValue, newLumaKey, setLumaLane } from "./luma-key";
import { visualPlan } from "./playback";
import { videoScene, withChromaView } from "./scene/video-scene";
import { documentIssue } from "./validate";

describe("luma key math", () => {
  it("removes dark pixels below the threshold and ramps over the softness", () => {
    const key = { ...newLumaKey("dark"), threshold: 0.2, softness: 0.2 };
    expect(lumaAlpha(key, [0, 0, 0])).toBe(0);
    expect(lumaAlpha(key, [0.2, 0.2, 0.2])).toBeCloseTo(0);
    expect(lumaAlpha(key, [0.3, 0.3, 0.3])).toBeCloseTo(0.5);
    expect(lumaAlpha(key, [0.4, 0.4, 0.4])).toBe(1);
    expect(lumaAlpha(key, [1, 1, 1])).toBe(1);
  });

  it("removes light pixels in light mode with the threshold counted from white", () => {
    const key = { ...newLumaKey("light"), threshold: 0.1, softness: 0.2 };
    expect(lumaAlpha(key, [1, 1, 1])).toBe(0);
    expect(lumaAlpha(key, [0.8, 0.8, 0.8])).toBeCloseTo(0.5);
    expect(lumaAlpha(key, [0, 0, 0])).toBe(1);
  });

  it("weighs the channels by Rec. 709 luma", () => {
    const key = { ...newLumaKey("dark"), threshold: 0, softness: 1 };
    expect(lumaAlpha(key, [1, 0, 0])).toBeCloseTo(0.2126);
    expect(lumaAlpha(key, [0, 1, 0])).toBeCloseTo(0.7152);
    expect(lumaAlpha(key, [0, 0, 1])).toBeCloseTo(0.0722);
  });
});

describe("luma key values and keys", () => {
  it("starts from the defaults and animates a value from a moment on", () => {
    const key = newLumaKey("light");
    expect(key).toEqual({ mode: "light", threshold: LUMA_DEFAULTS.threshold, softness: LUMA_DEFAULTS.softness });
    const keyed = setLumaLane(key, "threshold", [
      { atMs: 0, value: 0, easing: "linear" },
      { atMs: 1000, value: 0.4, easing: "linear" },
    ]);
    expect(lumaValue(keyed, "threshold", 500)).toBeCloseTo(0.2);
    expect(lumaAt(keyed, 1000)).toEqual({ mode: "light", threshold: 0.4, softness: LUMA_DEFAULTS.softness });
    expect(lumaKeyState(keyed, "threshold", 1000)).toBe("key");
    expect(lumaKeyState(keyed, "softness", 1000)).toBe("static");
  });

  it("checks the mode, the ranges and the keys like the backend", () => {
    expect(lumaIssue(newLumaKey("dark"))).toBeNull();
    expect(lumaIssue({ ...newLumaKey("dark"), mode: "gray" as "dark" })).toBe("unknown");
    expect(lumaIssue({ ...newLumaKey("dark"), threshold: 1.2 })).toBe("out_of_range");
    expect(lumaIssue({ ...newLumaKey("dark"), softness: 0 })).toBe("out_of_range");
    expect(lumaIssue({ ...newLumaKey("dark"), keyframes: { softness: [{ atMs: 0, value: 2, easing: "linear" }] } })).toBe("out_of_range");
    expect(lumaIssue({ ...newLumaKey("dark"), keyframes: { mode: [{ atMs: 0, value: 0.2, easing: "linear" }] } as never })).toBe("invalid");
  });
});

function keyedFilm(): VideoDocument {
  const doc = emptyVideoDocument("square");
  doc.tracks = [{ id: "v", kind: "visual", clips: [{ ...newMediaClip("video", "m", 0, 2000), id: "c", lumaKey: setLumaLane(newLumaKey("dark"), "threshold", [{ atMs: 0, value: 0, easing: "linear" }, { atMs: 2000, value: 0.4, easing: "linear" }]) }] }];
  doc.durationMs = 2000;
  return doc;
}

describe("luma key on the timeline", () => {
  it("is saved on video and image clips only and passes the document check", () => {
    const doc = keyedFilm();
    expect(documentIssue("video", doc)).toBeNull();
    const onText = structuredClone(doc);
    onText.tracks[0].clips[0] = { ...newOverlayClip(newTextLayer("Oi"), 0, 2000), id: "c", lumaKey: newLumaKey("dark") };
    expect(documentIssue("video", onText)).not.toBeNull();
  });

  it("reaches the scene resolved at the playhead, and the key views show the matte or the original", () => {
    const doc = keyedFilm();
    const scene = videoScene(doc, visualPlan(doc, 1000));
    expect(scene.nodes[0].lumaKey).toEqual({ mode: "dark", threshold: 0.2, softness: LUMA_DEFAULTS.softness });
    expect(withChromaView(scene, { clipId: "c", mode: "matte" }).nodes[0].keyMatte).toBe(true);
    const original = withChromaView(scene, { clipId: "c", mode: "original" }).nodes[0];
    expect(original.lumaKey).toBeUndefined();
    expect(original.chroma).toBeUndefined();
  });
});
