import { describe, expect, it } from "vitest";

import { emptyArtboard, emptyVideoDocument, IMAGE_DOCUMENT_VERSION, IMAGE_SCHEMA, newMediaClip, newShapeLayer, newTextLayer, type Artboard, type ImageDocument, type Layer, type VideoDocument } from "../document";
import { overlayClip } from "../media-clips";
import { documentChanges, imageOutline, videoOutline, type OutlineContext } from "./outline";

function video(): VideoDocument {
  const d = emptyVideoDocument("story");
  const title = { ...overlayClip(newTextLayer("Oferta"), 0), id: "t1", keyframes: { scale: [{ atMs: 0, value: 1, easing: "linear" as const }, { atMs: 900, value: 1.1, easing: "linear" as const }] } };
  d.tracks = [
    { id: "v1", kind: "visual", clips: [{ ...newMediaClip("video", "vid", 0, 3000), id: "c1", trimInMs: 1234 }] },
    { id: "v2", kind: "visual", name: "Textos", clips: [title] },
    { id: "a1", kind: "audio", muted: true, clips: [{ ...newMediaClip("audio", "song", 0, 3000), id: "m1", volume: 0.25 }] },
  ];
  d.durationMs = 3000;
  return d;
}

const ctx: OutlineContext = {
  detail: "summary",
  asset: (id) => (id === "vid" ? { name: "Depoimento.mp4", type: "video", durationMs: 12_000 } : undefined),
  playheadMs: 1500,
  selection: ["c1"],
  jobs: [{ jobId: "j1", purpose: "captions", status: "running" }],
};

describe("videoOutline", () => {
  it("names media, keeps ids and times, and lists tracks bottom first", () => {
    const outline = videoOutline(video(), ctx);
    expect(outline.aspect).toBe("story");
    expect(outline.tracks.map((t) => t.id)).toEqual(["v1", "v2", "a1"]);
    expect(outline.tracks[0].clips[0]).toMatchObject({ id: "c1", type: "video", media: "Depoimento.mp4", media_id: "vid", start_ms: 0, end_ms: 3000, trim_in_ms: 1234 });
    expect(outline.tracks[1].clips[0]).toMatchObject({ id: "t1", type: "overlay", text: "Oferta", animated: ["scale"] });
    expect(outline.tracks[2]).toMatchObject({ muted: true });
    expect(outline.tracks[2].clips[0]).toMatchObject({ volume: 0.25 });
    expect(outline.jobs).toEqual(ctx.jobs);
  });

  it("adds positions, styles and keyframes only when asked for the full detail", () => {
    const summary = videoOutline(video(), ctx).tracks[1].clips[0];
    const full = videoOutline(video(), { ...ctx, detail: "full" }).tracks[1].clips[0];
    expect(summary.box).toBeUndefined();
    expect(full.box).toMatchObject({ x: 0.5 });
    expect(full.keyframes?.scale).toHaveLength(2);
    expect(full.style).toMatchObject({ font_id: "inter" });
  });

  it("lists the icon catalog and the overlay effects in the full detail", () => {
    const d = video();
    d.tracks[1].clips[0].layer = { ...d.tracks[1].clips[0].layer!, gradient: { kind: "linear", from: "#ffffff", to: "#ff8a00", angle: 90 }, highlight: { color: "#111111", radius: 0.2 }, curve: 0.4, blendMode: "screen" };
    expect(videoOutline(d, { ...ctx, icons: ["heart"] }).icons).toBeUndefined();
    const outline = videoOutline(d, { ...ctx, detail: "full", icons: ["heart"] });
    expect(outline.icons).toEqual(["heart"]);
    expect(outline.tracks[1].clips[0].style).toMatchObject({ gradient: { to: "#ff8a00" }, highlight: { color: "#111111" }, curve: 0.4, blend_mode: "screen" });
  });

  it("rounds numbers to keep the outline short", () => {
    const d = video();
    d.tracks[1].clips[0].transform = { ...d.tracks[1].clips[0].transform, x: 0.123456789 };
    expect(videoOutline(d, { ...ctx, detail: "full" }).tracks[1].clips[0].box?.x).toBe(0.123);
  });
});

function artboard(id: string, layers: Layer[], width = 1080, height = 1080, extra: Partial<Artboard> = {}): Artboard {
  return { ...emptyArtboard({ width, height }), id, layers, ...extra };
}

function single(layers: Layer[], width = 1080, height = 1080): ImageDocument {
  return { schema: IMAGE_SCHEMA, version: IMAGE_DOCUMENT_VERSION, artboards: [artboard("a1", layers, width, height)] };
}

describe("imageOutline", () => {
  it("lists every artboard with its size, place and layers bottom first, and says which one the person is on", () => {
    const d: ImageDocument = {
      schema: IMAGE_SCHEMA,
      version: IMAGE_DOCUMENT_VERSION,
      artboards: [artboard("feed", [{ ...newShapeLayer("rect"), id: "bg" }, { ...newTextLayer("Oi"), id: "t" }], 1080, 1350, { name: "Feed" }), artboard("story", [], 1080, 1920, { x: 1180 })],
    };
    const outline = imageOutline(d, { ...ctx, selection: ["t"], activeArtboard: "story" });
    expect(outline.selection).toEqual(["t"]);
    expect(outline.active_artboard).toBe("story");
    expect(outline.artboards[0]).toMatchObject({ id: "feed", name: "Feed", width: 1080, height: 1350, x: 0, y: 0 });
    expect(outline.artboards[0].layers.map((l) => l.id)).toEqual(["bg", "t"]);
    expect(outline.artboards[0].layers[1]).toMatchObject({ type: "text", text: "Oi", box: { x: 0.5, y: 0.5 } });
    expect(outline.artboards[1]).toMatchObject({ id: "story", height: 1920, x: 1180, layers: [] });
  });

  it("shows vector geometry and stroke details in full detail, so drawn and traced shapes can be edited", () => {
    const star: Layer = { ...newShapeLayer("star"), id: "s", points: 6, inner: 0.4, lineCap: "round", lineJoin: "bevel", dashArray: [4, 2], dashOffset: 1, strokeWidth: 3, stroke: "#111111" };
    const path: Layer = { id: "p", type: "shape", shape: "path", path: "M0 0 L1 1", fillRule: "evenodd", miterLimit: 6, arrowEnd: true, stroke: "#111111", strokeWidth: 4, transform: { x: 0.5, y: 0.5, w: 0.2, h: 0.2, rotation: 0, opacity: 1 } };
    const [shape, line] = imageOutline(single([star, path]), { ...ctx, detail: "full" }).artboards[0].layers;
    expect(shape.style).toMatchObject({ points: 6, inner: 0.4, line_cap: "round", line_join: "bevel", dash_array: [4, 2], dash_offset: 1 });
    expect(line.style).toMatchObject({ path: "M0 0 L1 1", fill_rule: "evenodd", miter_limit: 6, arrow_end: true });
  });

  it("states the stacking order and, in full detail, every effect and the icon catalog", () => {
    const d: ImageDocument = single(
      [
        { ...newShapeLayer("ellipse"), id: "mask", gradient: { kind: "radial", from: "#ffffff", to: "#000000", angle: 0, cx: 0.5, cy: 0.4, radius: 1 } },
        { id: "photo", type: "image", assetId: "p", transform: { x: 0.5, y: 0.5, w: 0.5, h: 0.5, rotation: 0, opacity: 1 }, clip: true, frame: "ellipse", crop: { x: 0.1, y: 0, w: 0.8, h: 1 }, filters: { brightness: 0.1, contrast: 0, saturation: 0, blur: 0 }, blendMode: "multiply", flipX: true },
        { ...newTextLayer("Oi"), id: "t", italic: true, shadow: { color: "#00000066", blur: 12, x: 0, y: 6 }, highlight: { color: "#ffe14d", radius: 0.2 }, curve: 0.3 },
      ],
    );
    const summary = imageOutline(d, ctx).artboards[0];
    expect(summary.layers.map((l) => l.z)).toEqual([0, 1, 2]);
    expect(summary.layers[2].style).toBeUndefined();
    const outline = imageOutline(d, { ...ctx, detail: "full", icons: ["heart", "star"] });
    const full = outline.artboards[0];
    expect(outline.icons).toEqual(["heart", "star"]);
    expect(full.layers[0].style).toMatchObject({ gradient: { kind: "radial", cy: 0.4 } });
    expect(full.layers[1].style).toMatchObject({ clip: true, frame: "ellipse", crop: { x: 0.1, w: 0.8 }, filters: { brightness: 0.1 }, blend_mode: "multiply", flip_x: true });
    expect(full.layers[2].style).toMatchObject({ italic: true, shadow: { blur: 12 }, highlight: { color: "#ffe14d" }, curve: 0.3 });
  });
});

describe("documentChanges", () => {
  it("tells Elo what the person added, removed and changed since she last looked", () => {
    const before = video();
    const after = structuredClone(before);
    after.tracks[0].clips[0].durationMs = 2000;
    after.tracks[1].clips = [];
    after.tracks[2].clips.push({ ...newMediaClip("audio", "voice", 0, 1000), id: "m2" });
    expect(documentChanges(before, after)).toEqual({ added: ["m2"], removed: ["t1"], changed: ["c1"] });
    expect(documentChanges(before, structuredClone(before))).toBeNull();
  });

  it("notices artboards the person added, removed or changed, and layers on any of them", () => {
    const before: ImageDocument = { schema: IMAGE_SCHEMA, version: IMAGE_DOCUMENT_VERSION, artboards: [artboard("one", [{ ...newTextLayer("Oi"), id: "t" }]), artboard("two", [])] };
    const after = structuredClone(before);
    after.artboards[0].name = "Feed";
    after.artboards.splice(1, 1, artboard("three", [{ ...newShapeLayer("rect"), id: "r" }]));
    expect(documentChanges(before, after)).toEqual({ added: ["three", "r"], removed: ["two"], changed: ["one"] });
  });
});
