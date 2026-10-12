import { describe, expect, it } from "vitest";

import { emptyArtboard, emptyVideoDocument, IMAGE_DOCUMENT_VERSION, IMAGE_SCHEMA, newMediaClip, newShapeLayer, newTextLayer, type Artboard, type ImageDocument, type Layer, type VideoDocument } from "../document";
import { newChromaKey, setChromaLane } from "../chroma-key";
import { newMask } from "../masks";
import { newEffectClip, newVfx, setVfxKey } from "../vfx";
import { overlayClip } from "../media-clips";
import { DEFAULT_PATTERN } from "../pattern";
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
  it("reads back pan, the crossfades and the loudness of each audio track as heard", () => {
    const d = video();
    d.tracks[2] = { ...d.tracks[2], pan: -0.25, gainDb: -3, clips: [{ ...d.tracks[2].clips[0], pan: 0.5, durationMs: 1500 }, { ...newMediaClip("audio", "song", 1500, 1500), id: "m2" }] };
    d.tracks[2].transitions = [{ id: "x1", fromClipId: "m1", toClipId: "m2", kind: "constantPower", durationMs: 1000, alignment: "center", easing: "linear" }];
    const outline = videoOutline(d, { ...ctx, trackLoudness: (trackId) => (trackId === "a1" ? -17.04 : null) });
    expect(outline.tracks[2]).toMatchObject({ pan: -0.25, gain_db: -3, loudness_lufs: -20 });
    expect(outline.tracks[2].clips[0]).toMatchObject({ pan: 0.5 });
    expect(outline.tracks[2].transitions).toMatchObject([{ kind: "constantPower", duration_ms: 1000 }]);
    expect(outline.tracks[0]).not.toHaveProperty("loudness_lufs");
    expect(videoOutline(d, ctx).tracks[2]).not.toHaveProperty("loudness_lufs");
  });

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

  it("lists the transitions of a track with their window and options", () => {
    const d = video();
    d.tracks[0].clips = [{ ...newMediaClip("video", "vid", 0, 1500), id: "c1" }, { ...newMediaClip("video", "vid", 1500, 1500), id: "c2" }];
    d.tracks[0].transitions = [{ id: "tr", fromClipId: "c1", toClipId: "c2", kind: "push", durationMs: 400, alignment: "center", easing: "easeInOut" }];
    expect(videoOutline(d, ctx).tracks[0].transitions).toEqual([{ id: "tr", from: "c1", to: "c2", kind: "push", duration_ms: 400, window_ms: [1300, 1700], alignment: "center", easing: "easeInOut", options: { direction: "left" } }]);
  });

  it("shows the speed, direction and freeze of a clip", () => {
    const d = video();
    d.tracks[0].clips[0] = { ...d.tracks[0].clips[0], speed: 0.5, reverse: true, preservePitch: false, color: { exposure: 0.5 } };
    expect(videoOutline(d, ctx).tracks[0].clips[0]).toMatchObject({ speed: 0.5, reverse: true, preserve_pitch: false, color_grade: { exposure: 0.5 } });
  });

  it("shows masks with their animated lanes, the keys only in the full detail, and the matte", () => {
    const d = video();
    d.tracks[0].clips[0].masks = [{ ...newMask("ellipse", "m1"), feather: 0.1, invert: true, keyframes: { opacity: [{ atMs: 0, value: 0, easing: "linear" }] } }];
    d.tracks[1].clips[0].matte = true;
    const summary = videoOutline(d, ctx);
    expect(summary.tracks[0].clips[0].masks).toEqual([{ id: "m1", shape: "ellipse", mode: "add", invert: true, x: 0.5, y: 0.5, w: 0.5, h: 0.5, rotation: 0, feather: 0.1, expansion: 0, opacity: 1, animated: ["opacity"] }]);
    expect(summary.tracks[1].clips[0].matte).toBe(true);
    expect(videoOutline(d, { ...ctx, detail: "full" }).tracks[0].clips[0].masks?.[0].keyframes).toEqual({ opacity: [{ at_ms: 0, value: 0, easing: "linear" }] });
  });

  it("shows the chroma key with its animated values, the keys only in the full detail", () => {
    const d = video();
    d.tracks[0].clips[0].chromaKey = setChromaLane(newChromaKey("#0099ff"), "spill", [{ atMs: 0, value: 0.2, easing: "linear" }]);
    expect(videoOutline(d, ctx).tracks[0].clips[0].chroma_key).toEqual({ color: "#0099ff", similarity: 0.4, smoothness: 0.08, spill: 0.1, animated: ["spill"] });
    expect(videoOutline(d, { ...ctx, detail: "full" }).tracks[0].clips[0].chroma_key?.keyframes).toEqual({ spill: [{ at_ms: 0, value: 0.2, easing: "linear" }] });
  });

  it("shows the level and ducking of a sound track", () => {
    const d = video();
    d.tracks[2] = { ...d.tracks[2], gainDb: -4, ducking: { triggerTrackIds: ["v1"], reduceDb: 12, attackMs: 250, releaseMs: 500, holdMs: 300, sensitivity: 0.5 } };
    expect(videoOutline(d, ctx).tracks[2]).toMatchObject({ gain_db: -4, ducking: { trigger_track_ids: ["v1"], reduce_db: 12, attack_ms: 250 } });
  });

  it("shows how a text animates in and out", () => {
    const d = video();
    d.tracks[1].clips[0].textIn = { unit: "word", style: "rise", durationMs: 400, staggerMs: 90, easing: "easeOut" };
    expect(videoOutline(d, ctx).tracks[1].clips[0].text_in).toEqual({ unit: "word", text_style: "rise", duration_ms: 400, stagger_ms: 90, easing: "easeOut" });
    expect(videoOutline(d, ctx).tracks[1].clips[0].text_out).toBeUndefined();
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

describe("paint readback", () => {
  it("says which picture a frame or an image fill shows, so Elo can target the element itself", () => {
    const box = { x: 0.5, y: 0.5, w: 0.4, h: 0.4, rotation: 0, opacity: 1 };
    const frame: Layer = { ...newShapeLayer("rect", box), id: "f" };
    const photo: Layer = { id: "p", type: "image", assetId: "foto", clip: true, transform: box };
    const filled: Layer = { ...newShapeLayer("rect"), id: "s", pattern: { ...DEFAULT_PATTERN, source: "asset", presetId: "", assetId: "textura" } };
    const plain: Layer = { ...newShapeLayer("rect"), id: "r" };
    const [f, p, s, r] = imageOutline(single([frame, photo, filled, plain]), ctx).artboards[0].layers;
    expect(f.shows).toEqual({ layer_id: "p", media_id: "foto" });
    expect(p.shows).toBeUndefined();
    expect(p.media_id).toBe("foto");
    expect(s.shows).toEqual({ media_id: "textura" });
    expect(r.shows).toBeUndefined();
  });

  it("reads patterns, gradient maps, paint lists and effects back in the shape Elo writes them", () => {
    const card: Layer = { ...newShapeLayer("rect"), id: "card", pattern: { source: "preset", presetId: "dots", color: "#111111", tile: "brick-row", size: 32, offset: 0.5, spacing: { x: 4, y: 0 }, opacity: 0.8, blendMode: "multiply" } };
    const photo: Layer = { id: "photo", type: "image", assetId: "img", transform: { x: 0.5, y: 0.5, w: 0.5, h: 0.5, rotation: 0, opacity: 1 }, gradientMap: { stops: [{ at: 0, color: "#000000" }, { at: 1, color: "#ffffff" }], intensity: 0.5, reverse: true } };
    const title: Layer = {
      ...newTextLayer("Oi"),
      id: "title",
      fill: undefined,
      fills: [{ type: "solid", color: "#ffffff", opacity: 1 }],
      strokes: [{ type: "solid", color: "#000000", opacity: 1, width: 6, align: "outside", dashArray: [2, 1] }],
      effects: [{ id: "glow", type: "outer-glow", color: "#ff2d75", opacity: 0.75, x: 0, y: 0, blur: 24, spread: 0 }],
    };
    const [shape, picture, text] = imageOutline(single([card, photo, title]), { ...ctx, detail: "full" }).artboards[0].layers;
    expect(shape.style?.pattern).toEqual({ preset: "dots", color: "#111111", tile: "brick-row", size: 32, spacing_x: 4, spacing_y: 0, offset: 0.5, opacity: 0.8, blend_mode: "multiply" });
    expect(picture.style?.gradient_map).toEqual({ stops: [{ at: 0, color: "#000000" }, { at: 1, color: "#ffffff" }], intensity: 0.5, reverse: true });
    expect(text.style).toMatchObject({
      fills: [{ type: "solid", color: "#ffffff", opacity: 1 }],
      strokes: [{ type: "solid", color: "#000000", opacity: 1, width: 6, align: "outside", dash_array: [2, 1] }],
      effects: [{ id: "glow", type: "outer-glow", color: "#ff2d75", opacity: 0.75, x: 0, y: 0, blur: 24, spread: 0 }],
    });
  });
});

describe("vfx readback", () => {
  it("lists every parameter of each effect with its default, colors, keys and the strength of an effect clip", () => {
    const d = video();
    const grain = setVfxKey({ ...newVfx("grain", "g", 7), params: { size: 3 } }, "amount", 0, 0.1);
    d.tracks[0].clips[0].vfx = [grain];
    d.tracks.push({ id: "fx", kind: "visual", clips: [{ ...newEffectClip([{ ...newVfx("lightLeak", "l", 2), hidden: true }], 0, 1000), id: "e", transform: { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 0.6 } }] });
    const outline = videoOutline(d, { ...ctx, detail: "full" });
    expect(outline.tracks[0].clips[0].vfx).toEqual([{ id: "g", kind: "grain", seed: 7, params: { amount: 0.35, size: 3, rate: 24, chroma: 0 }, animated: ["amount"], keyframes: { amount: [{ at_ms: 0, value: 0.1, easing: "linear" }] } }]);
    const effect = outline.tracks[3].clips[0];
    expect(effect).toMatchObject({ type: "effect", strength: 0.6, vfx: [{ id: "l", kind: "lightLeak", hidden: true, colors: { color: "#ff7a2f", color2: "#ff2f6d" } }] });
    expect(effect.box).toBeUndefined();
  });
});
