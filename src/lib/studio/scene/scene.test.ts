import { describe, expect, it } from "vitest";

import { emptyVideoDocument, newMediaClip, newShapeLayer, newTextLayer, type Transform, type VideoDocument } from "../document";
import { overlayClip } from "../media-clips";
import { visualPlan } from "../playback";
import { rasterPlan } from "./raster";
import { videoSources } from "./scene";
import { videoScene } from "./video-scene";

const box = (x: number, y: number, w: number, h: number): Transform => ({ x, y, w, h, rotation: 0, opacity: 1 });

function film(): VideoDocument {
  const d = emptyVideoDocument("square");
  const title = { ...overlayClip({ ...newTextLayer("Oferta"), id: "l-title" }, 0, box(0.5, 0.3, 0.8, 0.2)), id: "title", startMs: 0, durationMs: 3000 };
  const pulse = {
    ...overlayClip({ ...newShapeLayer("rect"), id: "l-dot" }, 0, box(0.5, 0.7, 0.2, 0.2)),
    id: "dot",
    startMs: 0,
    durationMs: 3000,
    keyframes: { scale: [{ atMs: 0, value: 1, easing: "linear" as const }, { atMs: 1000, value: 2, easing: "linear" as const }] },
  };
  d.tracks = [
    { id: "v1", kind: "visual", clips: [{ ...newMediaClip("video", "vid", 0, 3000), id: "clip", trimInMs: 500 }] },
    { id: "v2", kind: "visual", clips: [title, pulse] },
    { id: "v3", kind: "visual", clips: [{ ...newMediaClip("image", "pic", 2500, 1000), id: "later", fit: "contain" }] },
  ];
  d.durationMs = 3500;
  return d;
}

describe("video scene", () => {
  it("draws clips bottom track first with their source, box in canvas pixels, fit and opacity", () => {
    const d = film();
    const scene = videoScene(d, visualPlan(d, 1000));
    expect(scene).toMatchObject({ width: 1080, height: 1080, background: d.canvas.background });
    expect(scene.nodes.map((n) => n.id)).toEqual(["clip", "title", "dot", "later"]);
    expect(scene.nodes[0]).toMatchObject({ source: { kind: "video", clipId: "clip", assetId: "vid", sourceMs: 1500 }, fit: "cover", visible: true, box: { x: 540, y: 540, width: 1080, height: 1080 } });
    expect(scene.nodes[1].source.kind).toBe("raster");
  });

  it("lists the video sources a frame needs, with whether each one is on screen", () => {
    const d = film();
    d.tracks[2].clips = [{ ...newMediaClip("video", "next", 2500, 1000), id: "next" }];
    expect(videoSources(videoScene(d, visualPlan(d, 1000)))).toEqual([
      { source: { kind: "video", clipId: "clip", assetId: "vid", sourceMs: 1500 }, visible: true },
      { source: { kind: "video", clipId: "next", assetId: "next", sourceMs: 0 }, visible: false },
    ]);
  });

  it("keeps clips that are about to start as hidden nodes so their media warms up", () => {
    const d = film();
    const later = videoScene(d, visualPlan(d, 1000)).nodes.find((n) => n.id === "later")!;
    expect(later).toMatchObject({ visible: false, fit: "contain", source: { kind: "image", assetId: "pic" } });
  });

  it("rasterizes an overlay once at its base size and scales the texture with its keyframes, like the export", () => {
    const d = film();
    const before = videoScene(d, visualPlan(d, 0)).nodes.find((n) => n.id === "dot")!;
    const after = videoScene(d, visualPlan(d, 1000)).nodes.find((n) => n.id === "dot")!;
    expect(after.source).toEqual(before.source);
    expect(after.box.width).toBeCloseTo(before.box.width * 2, 5);
    expect(after.box.x).toBeCloseTo(before.box.x, 5);
  });

  it("blends an overlay in the renderer and keeps its raster free of the blend", () => {
    const d = film();
    const plain = videoScene(d, visualPlan(d, 1000)).nodes.find((n) => n.id === "title")!;
    d.tracks[1].clips[0] = { ...d.tracks[1].clips[0], layer: { ...d.tracks[1].clips[0].layer!, blendMode: "screen" } };
    const blended = videoScene(d, visualPlan(d, 1000)).nodes.find((n) => n.id === "title")!;
    expect(blended.blend).toBe("screen");
    expect(plain.blend).toBeUndefined();
    expect(blended.source).toEqual(plain.source);
  });
});

describe("raster plan", () => {
  it("pads the stage so shadows and strokes are not clipped, keeping the layer where it was", () => {
    const layer = { ...newTextLayer("Oi"), id: "t", shadow: { color: "#00000066", blur: 12, x: 0, y: 6 } };
    const { source, padPx } = rasterPlan(layer, 400, 100, 1080);
    expect(padPx).toBeGreaterThanOrEqual(24);
    expect(source.widthPx).toBe(400 + 2 * padPx);
    expect(source.layer.transform.w * source.widthPx).toBeCloseTo(layer.transform.w * 400, 5);
    expect(source.layer.transform.x * source.widthPx).toBeCloseTo(padPx + layer.transform.x * 400, 5);
  });

  it("gives the same key for the same content and a new key when content or size changes", () => {
    const layer = { ...newTextLayer("Oi"), id: "t" };
    const key = (l: typeof layer, width: number) => rasterPlan(l, width, 100, 1080).source.key;
    expect(key(layer, 400)).toBe(key({ ...layer, id: "other" }, 400));
    expect(key({ ...layer, text: "Olá" }, 400)).not.toBe(key(layer, 400));
    expect(key(layer, 401)).not.toBe(key(layer, 400));
  });
});
