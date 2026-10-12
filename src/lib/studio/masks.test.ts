import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newOverlayClip, newTextLayer, type VideoDocument } from "./document";
import { MASK_RASTER_MAX, MASK_RASTER_MIN, maskAt, maskCoverage, maskIssue, maskKeyState, maskRasterSize, newMask, rasterizeMasks, setMaskKey, toggleMaskKey, type Mask } from "./masks";
import { visualPlan } from "./playback";
import { videoScene } from "./scene/video-scene";
import { documentIssue } from "./validate";

describe("mask geometry", () => {
  it("covers the inside of an ellipse and nothing outside, with a soft edge", () => {
    const ellipse = { ...newMask("ellipse", "m1"), w: 0.5, h: 0.5 };
    expect(maskCoverage([ellipse], 0.5, 0.5, 1000, 1000)).toBe(1);
    expect(maskCoverage([ellipse], 0.95, 0.5, 1000, 1000)).toBe(0);
    const soft = { ...ellipse, feather: 0.1 };
    const edge = maskCoverage([soft], 0.75, 0.5, 1000, 1000);
    expect(edge).toBeGreaterThan(0.3);
    expect(edge).toBeLessThan(0.7);
  });

  it("starts from hidden for an add mask and from visible for a subtract mask, and combines in order", () => {
    const left = { ...newMask("rectangle", "a"), x: 0.25, w: 0.5, h: 1 };
    const hole = { ...newMask("ellipse", "b"), mode: "subtract" as const, w: 0.2, h: 0.2, x: 0.25 };
    expect(maskCoverage([left], 0.75, 0.5, 100, 100)).toBe(0);
    expect(maskCoverage([left, hole], 0.25, 0.5, 100, 100)).toBe(0);
    expect(maskCoverage([left, hole], 0.1, 0.5, 100, 100)).toBe(1);
    expect(maskCoverage([hole], 0.9, 0.9, 100, 100)).toBe(1);
    expect(maskCoverage([{ ...left, invert: true }], 0.75, 0.5, 100, 100)).toBe(1);
  });

  it("reveals one side of a linear wipe and a band with mirror", () => {
    const wipe = { ...newMask("linear", "w"), x: 0.5, rotation: 0 };
    expect(maskCoverage([wipe], 0.25, 0.5, 100, 100)).toBe(1);
    expect(maskCoverage([wipe], 0.75, 0.5, 100, 100)).toBe(0);
    const band = { ...newMask("mirror", "b"), h: 0.2 };
    expect(maskCoverage([band], 0.5, 0.5, 100, 100)).toBe(1);
    expect(maskCoverage([band], 0.5, 0.9, 100, 100)).toBe(0);
  });
});

describe("mask keyframes", () => {
  it("animates a mask so it appears only from a moment on", () => {
    let mask: Mask = { ...newMask("ellipse", "m"), opacity: 0 };
    mask = setMaskKey(mask, "opacity", 0, 0);
    mask = setMaskKey(mask, "opacity", 1000, 1);
    expect(maskAt(mask, 0).opacity).toBe(0);
    expect(maskAt(mask, 500).opacity).toBeCloseTo(0.5);
    expect(maskAt(mask, 2000).opacity).toBe(1);
    const moved = toggleMaskKey(setMaskKey(mask, "x", 0, 0.2), "x", 0);
    expect(moved.keyframes?.x).toBeUndefined();
    expect(moved.x).toBeCloseTo(0.2);
  });

  it("tells whether a property has a key at the moment, is animated elsewhere, or is still", () => {
    const mask = setMaskKey(newMask("ellipse", "m"), "x", 400, 0.3);
    expect(maskKeyState(mask, "x", 400)).toBe("key");
    expect(maskKeyState(mask, "x", 100)).toBe("interpolated");
    expect(maskKeyState(mask, "x", null)).toBe("interpolated");
    expect(maskKeyState(mask, "y", 400)).toBe("static");
  });
});

function film(): VideoDocument {
  const d = emptyVideoDocument("square");
  d.tracks = [
    { id: "v", kind: "visual", clips: [{ ...newMediaClip("video", "vid", 0, 2000), id: "c" }] },
    { id: "t", kind: "visual", clips: [{ ...newOverlayClip(newTextLayer("Oi"), 0, 2000), id: "o" }] },
    { id: "a", kind: "audio", clips: [{ ...newMediaClip("audio", "song", 0, 2000), id: "s" }] },
  ];
  d.durationMs = 2000;
  return d;
}

describe("masks in the document", () => {
  it("accepts masks and a matte on visual clips like the backend", () => {
    const d = film();
    d.tracks[0].clips[0].masks = [{ ...newMask("star", "m1"), keyframes: { opacity: [{ atMs: 0, value: 0, easing: "linear" }] } }];
    d.tracks[1].clips[0].matte = true;
    expect(documentIssue("video", d)).toBeNull();
  });

  it.each([
    ["a mask on sound", (d: VideoDocument) => (d.tracks[2].clips[0].masks = [newMask("ellipse", "m")]), "invalid"],
    ["two masks with one id", (d: VideoDocument) => (d.tracks[0].clips[0].masks = [newMask("ellipse", "m"), newMask("rectangle", "m")]), "invalid"],
    ["an unknown shape", (d: VideoDocument) => (d.tracks[0].clips[0].masks = [{ ...newMask("ellipse", "m"), shape: "blob" as never }]), "unknown"],
    ["a feather past the limit", (d: VideoDocument) => (d.tracks[0].clips[0].masks = [{ ...newMask("ellipse", "m"), feather: 0.9 }]), "out_of_range"],
    ["star points on an ellipse", (d: VideoDocument) => (d.tracks[0].clips[0].masks = [{ ...newMask("ellipse", "m"), points: 6 }]), "invalid"],
    ["a path mask without a path", (d: VideoDocument) => (d.tracks[0].clips[0].masks = [{ ...newMask("path", "m"), path: undefined }]), "invalid"],
    ["a key outside the range", (d: VideoDocument) => (d.tracks[0].clips[0].masks = [{ ...newMask("ellipse", "m"), keyframes: { opacity: [{ atMs: 0, value: 3, easing: "linear" }] } }]), "out_of_range"],
    ["a matte on sound", (d: VideoDocument) => (d.tracks[2].clips[0].matte = true), "invalid"],
  ])("refuses %s", (_, change, code) => {
    const d = film();
    change(d);
    expect(documentIssue("video", d)).toEqual({ field: "document.tracks", code });
  });

  it("checks a mask list on its own", () => {
    expect(maskIssue([{ ...newMask("path", "p"), path: "M0 0 L1 0 L0.5 1 Z" }])).toBeNull();
  });
});

describe("mask raster", () => {
  it("writes coverage into the alpha of a white image the size asked", () => {
    const data = rasterizeMasks([{ ...newMask("rectangle", "r"), x: 0.25, w: 0.5, h: 1 }], 8, 4);
    expect(data.length).toBe(8 * 4 * 4);
    const alpha = (x: number, y: number) => data[(y * 8 + x) * 4 + 3];
    expect(alpha(1, 1)).toBe(255);
    expect(alpha(6, 1)).toBe(0);
    expect(data[0]).toBe(255);
  });

  it("sizes the raster to what the screen shows, within the limits", () => {
    expect(maskRasterSize(1000, 500, 0.4)).toEqual({ width: 400, height: 200 });
    expect(maskRasterSize(4000, 2000, 1)).toEqual({ width: MASK_RASTER_MAX, height: MASK_RASTER_MAX / 2 });
    expect(maskRasterSize(10, 5, 0.01)).toEqual({ width: MASK_RASTER_MIN, height: MASK_RASTER_MIN / 2 });
  });
});

describe("masks and mattes in the scene", () => {
  it("hands resolved masks to the renderer and clips a matte to the clip below it", () => {
    const d = film();
    d.tracks[0].clips[0].masks = [{ ...newMask("ellipse", "m"), keyframes: { opacity: [{ atMs: 0, value: 0, easing: "linear" }, { atMs: 1000, value: 1, easing: "linear" }] } }];
    d.tracks[1].clips[0].matte = true;
    const scene = videoScene(d, visualPlan(d, 500));
    const video = scene.nodes.find((node) => node.id === "c")!;
    expect(video.clipMasks?.[0].opacity).toBeCloseTo(0.5);
    expect(scene.nodes.find((node) => node.id === "o")!.clipOf).toBe("c");
    const alone = film();
    alone.tracks[0].clips = [];
    alone.tracks[1].clips[0].matte = true;
    expect(videoScene(alone, visualPlan(alone, 500)).nodes.find((node) => node.id === "o")!.visible).toBe(false);
  });
});
