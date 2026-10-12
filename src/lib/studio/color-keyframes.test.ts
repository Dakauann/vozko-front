import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newOverlayClip, newShapeLayer, newTextLayer, type Clip, type VideoDocument } from "./document";
import { colorAt, colorSegment, keyframeCount, keyframeFault, keyframesInRange, moveKeyframes, removeKeyframe, setColorKey, shiftKeyframes, type ColorKeyframe, type Keyframes } from "./keyframes";
import { paintsProperty } from "./paint";
import { visualPlan } from "./playback";
import { videoScene } from "./scene/video-scene";
import { documentIssue } from "./validate";

const box = { x: 0.5, y: 0.5, w: 0.4, h: 0.2, rotation: 0, opacity: 1 };

function fade(from: string, to: string, easing: ColorKeyframe["easing"] = "linear"): ColorKeyframe[] {
  return [
    { atMs: 0, color: from, easing },
    { atMs: 1000, color: to, easing: "linear" },
  ];
}

describe("color keys", () => {
  it("mixes the two key colors in sRGB with the outgoing easing and never overshoots", () => {
    expect(colorAt(fade("#000000", "#ffffff"), 500)).toBe("#808080");
    expect(colorAt(fade("#ff0000", "#0000ff"), 0)).toBe("#ff0000");
    expect(colorAt(fade("#ff0000", "#0000ff"), 2000)).toBe("#0000ff");
    expect(colorAt(fade("#00000000", "#000000ff"), 500)).toBe("#00000080");
    expect(colorSegment(fade("#000000", "#ffffff", "backOut"), 800)).toMatchObject({ from: "#000000", to: "#ffffff" });
    expect(colorSegment(fade("#000000", "#ffffff", "backOut"), 800).weight).toBeLessThanOrEqual(1);
    expect(colorSegment(fade("#000000", "#ffffff", "hold"), 999)).toEqual({ from: "#000000", to: "#ffffff", weight: 0 });
  });

  it("are added, replaced, removed, counted, shifted, ranged and moved like any key", () => {
    let k: Keyframes | undefined = setColorKey(undefined, "fill", 0, "#ff0000");
    k = setColorKey(k, "fill", 600, "#00ff00", "easeOut");
    k = setColorKey(k, "fill", 600, "#0000ff");
    expect(k?.fill).toEqual([
      { atMs: 0, color: "#ff0000", easing: "linear" },
      { atMs: 600, color: "#0000ff", easing: "easeOut" },
    ]);
    expect(keyframeCount(k)).toBe(2);
    expect(shiftKeyframes(k, 100)?.fill?.map((f) => f.atMs)).toEqual([100, 700]);
    expect(keyframesInRange({ ...k, fill: [...k!.fill!, { atMs: 1200, color: "#ffffff", easing: "linear" }] }, 100, 500)?.fill?.map((f) => f.atMs)).toEqual([0, 600]);
    expect(moveKeyframes(k, [{ property: "fill", atMs: 600 }], 200)?.fill?.map((f) => f.atMs)).toEqual([0, 800]);
    expect(removeKeyframe(removeKeyframe(k, "fill", 0), "fill", 600)).toBeUndefined();
  });

  it("names the key whose color or order is wrong", () => {
    expect(keyframeFault({ fill: [{ atMs: 200, color: "red", easing: "linear" }] }, box)).toEqual({ kind: "color", property: "fill", atMs: 200, color: "red" });
    expect(keyframeFault({ stroke: [{ atMs: 0, color: "#ffffff", easing: "wiggle" as never }] }, box)).toMatchObject({ kind: "easing", property: "stroke" });
    expect(keyframeFault({ fill: [{ atMs: 300, color: "#ffffff", easing: "linear" }, { atMs: 300, color: "#000000", easing: "linear" }] }, box)).toMatchObject({ kind: "order", property: "fill" });
  });
});

describe("which layers paint a color", () => {
  it("fills text, icons and closed shapes without a gradient, and strokes lines and outlined text or shapes", () => {
    const text = newTextLayer("Oi");
    expect(paintsProperty(text, "fill")).toBe(true);
    expect(paintsProperty({ ...text, gradient: { from: "#ffffff", to: "#000000", angle: 0 } }, "fill")).toBe(false);
    expect(paintsProperty(text, "stroke")).toBe(false);
    expect(paintsProperty({ ...text, stroke: "#000000", strokeWidth: 4 }, "stroke")).toBe(true);
    expect(paintsProperty(newShapeLayer("line"), "fill")).toBe(false);
    expect(paintsProperty(newShapeLayer("line"), "stroke")).toBe(true);
    expect(paintsProperty({ ...newShapeLayer("rect"), strokeWidth: 0 }, "stroke")).toBe(false);
    expect(paintsProperty({ id: "p", type: "image", assetId: "a", transform: box }, "fill")).toBe(false);
  });
});

function doc(): VideoDocument {
  const d = emptyVideoDocument("square");
  d.tracks = [
    { id: "main", kind: "visual", clips: [{ ...newMediaClip("video", "vid", 0, 3000), id: "v" }] },
    { id: "text", kind: "visual", clips: [{ ...newOverlayClip({ ...newTextLayer("Oferta"), fill: "#ff0000" }, 0, 2000), id: "o" }] },
  ];
  d.durationMs = 3000;
  return d;
}

function overlay(d: VideoDocument): Clip {
  return d.tracks[1].clips[0];
}

describe("color keys in the document", () => {
  it("accepts color keys on a layer that paints that color, like the backend", () => {
    const d = doc();
    overlay(d).keyframes = { fill: fade("#ff0000", "#0000ff") };
    expect(documentIssue("video", d)).toBeNull();
  });

  it.each([
    ["color keys on a video", (d: VideoDocument) => (d.tracks[0].clips[0].keyframes = { fill: fade("#ff0000", "#0000ff") })],
    ["fill keys on a gradient text", (d: VideoDocument) => (overlay(d).layer = { ...overlay(d).layer!, gradient: { from: "#ffffff", to: "#000000", angle: 0 } }) && (overlay(d).keyframes = { fill: fade("#ff0000", "#0000ff") })],
    ["stroke keys on a text without outline", (d: VideoDocument) => (overlay(d).keyframes = { stroke: fade("#ff0000", "#0000ff") })],
  ])("refuses %s", (_, change) => {
    const d = doc();
    change(d);
    expect(documentIssue("video", d)).toEqual({ field: "document.tracks", code: "invalid" });
  });

  it("refuses a malformed color like the backend", () => {
    const d = doc();
    overlay(d).keyframes = { fill: [{ atMs: 0, color: "red", easing: "linear" }] };
    expect(documentIssue("video", d)).toEqual({ field: "document.tracks", code: "invalid" });
  });
});

describe("color keys in playback and the scene", () => {
  it("draws an animated fill as a weighted blend of the rasters of its two key colors", () => {
    const d = doc();
    overlay(d).keyframes = { fill: fade("#ff0000", "#0000ff") };
    const plan = visualPlan(d, 250);
    expect(plan.find((item) => item.clipId === "o")?.paint).toEqual({ fill: { from: "#ff0000", to: "#0000ff", weight: 0.25 } });
    const node = videoScene(d, plan).nodes.find((n) => n.id === "o")!;
    expect(node.mix?.map((part) => part.weight)).toEqual([0.75, 0.25]);
    expect(node.mix?.map((part) => part.source.layer.fill)).toEqual(["#ff0000", "#0000ff"]);
    expect(node.source).toEqual(node.mix?.[0].source);
    expect(new Set(node.mix?.map((part) => part.source.key)).size).toBe(2);
  });

  it("blends four rasters when fill and stroke both animate, keeping the raster of each key across frames", () => {
    const d = doc();
    overlay(d).layer = { ...overlay(d).layer!, stroke: "#000000", strokeWidth: 4 };
    overlay(d).keyframes = { fill: fade("#ff0000", "#0000ff"), stroke: fade("#000000", "#ffffff") };
    const early = videoScene(d, visualPlan(d, 250)).nodes.find((n) => n.id === "o")!;
    const late = videoScene(d, visualPlan(d, 750)).nodes.find((n) => n.id === "o")!;
    expect(early.mix).toHaveLength(4);
    expect(early.mix!.reduce((sum, part) => sum + part.weight, 0)).toBeCloseTo(1, 9);
    expect(early.mix!.map((part) => part.source.key)).toEqual(late.mix!.map((part) => part.source.key));
  });

  it("keeps a still overlay as one raster", () => {
    const node = videoScene(doc(), visualPlan(doc(), 250)).nodes.find((n) => n.id === "o")!;
    expect(node.mix).toBeUndefined();
  });
});
