import { describe, expect, it } from "vitest";

import {
  emptyImageDocument,
  emptyVideoDocument,
  frameOf,
  fullFrame,
  IMAGE_PRESETS,
  msOfFrame,
  newIconLayer,
  newImageLayer,
  newMediaClip,
  newOverlayClip,
  newShapeLayer,
  newTextLayer,
  quantizeMs,
  STUDIO_LIMITS,
  type ImageDocument,
  type Layer,
  type LegacyImageDocument,
  type Transform,
  type VideoDocument,
} from "./document";
import { canvasSizeIssue, documentIssue, parseDocument, projectNameIssue } from "./validate";

function box(): Transform {
  return { x: 0.5, y: 0.5, w: 0.5, h: 0.2, rotation: 0, opacity: 1 };
}

function imageDoc(): LegacyImageDocument {
  return {
    schema: "studio.image",
    version: 1,
    canvas: { width: 1080, height: 1350, background: "#ffffff" },
    layers: [
      { id: "photo", type: "image", assetId: "m-1", transform: box(), crop: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 }, filters: { brightness: 0.1, contrast: 0, saturation: 0, blur: 0 } },
      { id: "title", type: "text", text: "Oferta da semana", fontId: "montserrat", fontSize: 0.06, fontWeight: 800, fill: "#111111", align: "center", transform: box() },
      { id: "arrow", type: "shape", shape: "arrow", stroke: "#ff0000", strokeWidth: 8, arrowEnd: true, transform: box() },
      { id: "star", type: "icon", iconId: "star", fill: "#ffcc00", transform: box() },
    ],
  };
}

function videoDoc(): VideoDocument {
  const text = { id: "headline", type: "text" as const, text: "Todos os canais", fontId: "inter" as const, fontSize: 0.05, fill: "#ffffff", transform: box() };
  const clip = { trimInMs: 0, volume: 0, fadeInMs: 0, fadeOutMs: 0, transform: fullFrame() };
  return {
    schema: "studio.video",
    version: 1,
    durationMs: 6000,
    canvas: { aspect: "story", background: "#000000" },
    tracks: [
      {
        id: "main",
        kind: "visual",
        clips: [
          { ...clip, id: "c1", type: "image", assetId: "m-1", startMs: 0, durationMs: 3000, fit: "cover" },
          { ...clip, id: "c2", type: "video", assetId: "m-2", startMs: 3000, durationMs: 3000, trimInMs: 1200, fit: "contain" },
        ],
      },
      {
        id: "text",
        kind: "visual",
        clips: [{ ...clip, id: "o1", type: "overlay", startMs: 500, durationMs: 2000, fadeInMs: 200, layer: text, transform: { x: 0.5, y: 0.2, w: 0.8, h: 0.1, rotation: 0, opacity: 1 } }],
      },
      { id: "music", kind: "audio", clips: [{ ...clip, id: "a1", type: "audio", assetId: "song", startMs: 0, durationMs: 6000, volume: 0.3, fadeOutMs: 1500 }] },
      { id: "muted", kind: "audio", muted: true, clips: [{ ...clip, id: "a2", type: "audio", assetId: "voice", startMs: 0, durationMs: 2000, volume: 1 }] },
    ],
  };
}

describe("document validation mirrors the backend", () => {
  it("accepts valid documents", () => {
    expect(documentIssue("image", imageDoc())).toBeNull();
    expect(documentIssue("video", videoDoc())).toBeNull();
  });

  it("refuses unknown fields, wrong types and other schemas", () => {
    expect(documentIssue("image", { script: "x", ...imageDoc() })).toEqual({ field: "document", code: "invalid" });
    expect(documentIssue("image", { ...imageDoc(), canvas: { width: 1080.5, height: 1080, background: "" } })).toEqual({ field: "document", code: "invalid" });
    expect(documentIssue("video", imageDoc())?.field).toBe("document");
    expect(documentIssue("gif" as "image", imageDoc())).toEqual({ field: "kind", code: "unknown" });
    expect(documentIssue("image", null)).toEqual({ field: "document", code: "required" });
  });

  it.each([
    ["unknown font", (d: LegacyImageDocument) => (d.layers[1].fontId = "comic-sans" as "inter"), "unknown"],
    ["empty text", (d: LegacyImageDocument) => (d.layers[1].text = "  "), "invalid"],
    ["bad weight", (d: LegacyImageDocument) => (d.layers[1].fontWeight = 450), "out_of_range"],
    ["image without asset", (d: LegacyImageDocument) => (d.layers[0].assetId = ""), "required"],
    ["crop outside", (d: LegacyImageDocument) => (d.layers[0].crop!.w = 0.95), "out_of_range"],
    ["unknown shape", (d: LegacyImageDocument) => (d.layers[2].shape = "blob" as "rect"), "unknown"],
    ["bad color", (d: LegacyImageDocument) => (d.layers[2].stroke = "red"), "invalid"],
    ["duplicate id", (d: LegacyImageDocument) => (d.layers[3].id = "photo"), "duplicate"],
    ["bad id", (d: LegacyImageDocument) => (d.layers[3].id = "Star!"), "invalid"],
    ["too transparent", (d: LegacyImageDocument) => (d.layers[3].transform.opacity = 1.5), "out_of_range"],
    ["no icon", (d: LegacyImageDocument) => (d.layers[3].iconId = ""), "invalid"],
    ["unknown gradient kind", (d: LegacyImageDocument) => (d.layers[2].gradient = { kind: "conic" as "radial", from: "#111111", to: "#222222", angle: 0 }), "invalid"],
    ["radial without radius", (d: LegacyImageDocument) => (d.layers[2].gradient = { kind: "radial", from: "#111111", to: "#222222", angle: 0, cx: 0.5, cy: 0.5 }), "invalid"],
    ["radial center outside", (d: LegacyImageDocument) => (d.layers[2].gradient = { kind: "radial", from: "#111111", to: "#222222", angle: 0, cx: 1.5, cy: 0.5, radius: 1 }), "invalid"],
    ["bad middle color", (d: LegacyImageDocument) => (d.layers[2].gradient = { from: "#111111", via: "orange", to: "#222222", angle: 0 }), "invalid"],
  ])("rejects image layers with %s", (_, change, code) => {
    const doc = imageDoc();
    change(doc);
    expect(documentIssue("image", doc)).toEqual({ field: "document.layers", code });
  });

  it("accepts a radial gradient with a middle color, centered anywhere in the box", () => {
    const doc = imageDoc();
    doc.layers[2].gradient = { kind: "radial", from: "#ffffff", via: "#ff8800", to: "#000000", angle: 0, cx: 0.5, cy: 0.35, radius: 1 };
    doc.canvas.gradient = { kind: "radial", from: "#1e1b4b", to: "#000000", angle: 0, cx: 0.5, cy: 0.5, radius: 1.4 };
    expect(documentIssue("image", doc)).toBeNull();
  });

  it("bounds the image canvas", () => {
    const tiny = imageDoc();
    tiny.canvas.width = 50;
    expect(documentIssue("image", tiny)).toEqual({ field: "document.canvas", code: "out_of_range" });
  });

  it.each([
    ["overlap", (d: VideoDocument) => (d.tracks[0].clips[1].startMs = 2500), "overlap"],
    ["past the end", (d: VideoDocument) => (d.tracks[0].clips[1].durationMs = 4000), "out_of_range"],
    ["audio on visual", (d: VideoDocument) => (d.tracks[0].clips[0].type = "audio"), "unknown"],
    ["visual on audio", (d: VideoDocument) => (d.tracks[2].clips[0].type = "image"), "invalid"],
    ["overlay with asset", (d: VideoDocument) => (d.tracks[1].clips[0].assetId = "m-9"), "invalid"],
    ["bad overlay layer", (d: VideoDocument) => (d.tracks[1].clips[0].layer!.fontId = "x" as "inter"), "unknown"],
    ["duplicate clip id", (d: VideoDocument) => (d.tracks[2].clips[0].id = "c1"), "invalid"],
    ["too loud", (d: VideoDocument) => (d.tracks[2].clips[0].volume = 3), "out_of_range"],
  ])("rejects video tracks with %s", (_, change, code) => {
    const doc = videoDoc();
    change(doc);
    expect(documentIssue("video", doc)).toEqual({ field: "document.tracks", code });
  });

  it("refuses fractional milliseconds like the integer decoder", () => {
    const doc = videoDoc();
    doc.tracks[0].clips[0].durationMs = 2999.5;
    expect(documentIssue("video", doc)).toEqual({ field: "document", code: "invalid" });
  });

  it("knows only the supported aspects, landscape included", () => {
    const unknown = videoDoc();
    unknown.canvas.aspect = "panorama" as "story";
    expect(documentIssue("video", unknown)).toEqual({ field: "document.canvas", code: "unknown" });
    const wide = videoDoc();
    wide.canvas.aspect = "landscape";
    expect(documentIssue("video", wide)).toBeNull();
  });

  it("takes vector paths and tuned stars as shapes", () => {
    const doc = imageDoc();
    doc.layers.push({ id: "band", type: "shape", shape: "path", path: "M0 0.58 L1 0.40 L1 1 L0 1 Z", fill: "#e10600", transform: box() });
    doc.layers.push({ id: "burst", type: "shape", shape: "star", points: 16, inner: 0.78, fill: "#ffcc00", transform: box() });
    expect(documentIssue("image", doc)).toBeNull();
  });

  it("takes stroke caps, joins, miter limit and dash patterns", () => {
    const doc = imageDoc();
    doc.layers.push({ id: "s", type: "shape", shape: "path", path: "M0 0 L1 1", stroke: "#000000", strokeWidth: 4, lineCap: "square", lineJoin: "miter", miterLimit: 8, dashArray: [4, 2, 0, 2], dashOffset: 1.5, transform: box() });
    doc.layers.push({ id: "t", type: "text", text: "Oi", fontId: "inter", fontSize: 0.1, fill: "#000000", stroke: "#ffffff", strokeWidth: 3, lineJoin: "round", dashArray: [2], transform: box() });
    expect(documentIssue("image", doc)).toBeNull();
    const cases: [Partial<Layer>, string][] = [
      [{ lineCap: "flat" as never }, "unknown"],
      [{ lineJoin: "pointy" as never }, "unknown"],
      [{ miterLimit: 0.5 }, "out_of_range"],
      [{ miterLimit: 30 }, "out_of_range"],
      [{ dashArray: [0, 0] }, "invalid"],
      [{ dashArray: [1, 2, 3, 4, 5, 6, 7, 8, 9] }, "invalid"],
      [{ dashArray: [-1, 2] }, "invalid"],
      [{ dashOffset: 5000 }, "out_of_range"],
    ];
    for (const [patch, code] of cases) {
      const bad = imageDoc();
      bad.layers.push({ id: "x", type: "shape", shape: "rect", fill: "#000000", transform: box(), ...patch } as Layer);
      expect(documentIssue("image", bad), JSON.stringify(patch)).toEqual({ field: "document.layers", code });
    }
    const icon = imageDoc();
    icon.layers.push({ ...newIconLayer("star"), id: "i", lineCap: "butt" });
    expect(documentIssue("image", icon)).toEqual({ field: "document.layers", code: "invalid" });
  });

  it("lets a path cut out its overlaps with the even-odd fill rule", () => {
    const doc = imageDoc();
    doc.layers.push({ id: "ring", type: "shape", shape: "path", path: "M0 0 L1 0 L1 1 L0 1 Z M0.3 0.3 L0.7 0.3 L0.7 0.7 L0.3 0.7 Z", fillRule: "evenodd", transform: box() });
    doc.layers.push({ id: "solid", type: "shape", shape: "path", path: "M0 0 L1 1 L0 1 Z", fillRule: "nonzero", transform: box() });
    expect(documentIssue("image", doc)).toBeNull();
    const onRect = imageDoc();
    onRect.layers.push({ id: "x", type: "shape", shape: "rect", fillRule: "evenodd", transform: box() });
    expect(documentIssue("image", onRect)).toEqual({ field: "document.layers", code: "invalid" });
    const unknown = imageDoc();
    unknown.layers.push({ id: "x", type: "shape", shape: "path", path: "M0 0 L1 1", fillRule: "winding" as never, transform: box() });
    expect(documentIssue("image", unknown)).toEqual({ field: "document.layers", code: "unknown" });
  });

  it("refuses broken paths and shape fields on the wrong shape", () => {
    const cases: [Partial<Layer>, string][] = [
      [{ shape: "path" }, "invalid"],
      [{ shape: "path", path: "L0 0 Z" }, "invalid"],
      [{ shape: "rect", path: "M0 0 L1 1" }, "invalid"],
      [{ shape: "rect", points: 6 }, "invalid"],
      [{ shape: "star", points: 2 }, "out_of_range"],
      [{ shape: "star", points: 65 }, "out_of_range"],
      [{ shape: "star", inner: 1.2 }, "out_of_range"],
    ];
    for (const [patch, code] of cases) {
      const doc = imageDoc();
      doc.layers.push({ id: "x", type: "shape", transform: box(), ...patch } as Layer);
      expect(documentIssue("image", doc), JSON.stringify(patch)).toEqual({ field: "document.layers", code });
    }
    const fractional = imageDoc();
    fractional.layers.push({ id: "x", type: "shape", shape: "star", points: 7.5, transform: box() });
    expect(documentIssue("image", fractional)).not.toBeNull();
  });

  it("takes any number of layers, groups, tracks and clips while the document fits its size", () => {
    const layered = imageDoc();
    layered.layers = [...layered.layers, ...Array.from({ length: 600 }, (_, i) => ({ ...layered.layers[2], id: `l${i}`, groupId: `g${Math.floor(i / 2)}` }))];
    layered.groups = Array.from({ length: 300 }, (_, i) => ({ id: `g${i}` }));
    expect(documentIssue("image", layered)).toBeNull();
    const timeline = videoDoc();
    timeline.durationMs = 90_000;
    const overlay = timeline.tracks[1].clips[0];
    timeline.tracks[1].clips = [...timeline.tracks[1].clips, ...Array.from({ length: 300 }, (_, i) => ({ ...overlay, id: `x${i}`, startMs: 3000 + i * 200, durationMs: 200, fadeInMs: 0 }))];
    timeline.tracks = [...timeline.tracks, ...Array.from({ length: 40 }, (_, i) => ({ id: `t${i}`, kind: i % 4 === 0 ? ("audio" as const) : ("visual" as const), clips: [] }))];
    expect(documentIssue("video", timeline)).toBeNull();
  });

  it("caps the document size", () => {
    const doc = imageDoc();
    const count = Math.ceil(STUDIO_LIMITS.maxDocumentBytes / 1999) + 1;
    const huge = { ...doc, layers: Array.from({ length: count }, (_, i) => ({ ...doc.layers[1], id: `t${i}`, text: "a".repeat(1999) })) };
    expect(documentIssue("image", huge)).toEqual({ field: "document", code: "too_large" });
  });

  it("parses into a typed document", () => {
    const parsed = parseDocument("video", videoDoc());
    expect(parsed.ok && parsed.document.tracks.length).toBe(4);
  });

  it("reads a single canvas project as one artboard", () => {
    const parsed = parseDocument("image", imageDoc());
    if (!parsed.ok) throw new Error(parsed.issue.code);
    expect(parsed.document.version).toBe(2);
    expect(parsed.document.artboards).toHaveLength(1);
    expect(parsed.document.artboards[0]).toMatchObject({ x: 0, y: 0, canvas: { width: 1080, height: 1350 } });
    expect(parsed.document.artboards[0].layers.map((l) => l.id)).toEqual(["photo", "title", "arrow", "star"]);
  });

  it("checks artboards: at least one, valid unique ids, a sane place, and ids unique across the whole project", () => {
    const legacy = imageDoc();
    const artboard = (id: string, layers: Layer[], extra: object = {}) => ({ id, x: 0, y: 0, canvas: legacy.canvas, layers, ...extra });
    const project = (...artboards: object[]): unknown => ({ schema: "studio.image", version: 2, artboards });
    expect(documentIssue("image", project(artboard("feed", legacy.layers), artboard("story", [], { x: 1180, name: "Story" })))).toBeNull();
    expect(documentIssue("image", project())).toEqual({ field: "document.artboards", code: "required" });
    expect(documentIssue("image", project(artboard("Feed!", [])))).toEqual({ field: "document.artboards", code: "invalid" });
    expect(documentIssue("image", project(artboard("feed", []), artboard("feed", [])))).toEqual({ field: "document.artboards", code: "duplicate" });
    expect(documentIssue("image", project(artboard("feed", [], { x: STUDIO_LIMITS.maxArtboardCoordinate + 1 })))).toEqual({ field: "document.artboards", code: "out_of_range" });
    expect(documentIssue("image", project(artboard("feed", [legacy.layers[0]]), artboard("story", [legacy.layers[0]])))).toEqual({ field: "document.layers", code: "duplicate" });
    expect(documentIssue("image", project(artboard("feed", [], { groups: [{ id: "g" }] }), artboard("story", [], { groups: [{ id: "g" }] })))).toEqual({ field: "document.layers", code: "duplicate" });
    expect(documentIssue("image", { ...(project(artboard("feed", [])) as object), canvas: legacy.canvas })).toEqual({ field: "document", code: "invalid" });
  });

  it("cleans project names like the backend", () => {
    expect(projectNameIssue("   ")).toEqual({ field: "name", code: "required" });
    expect(projectNameIssue("a".repeat(STUDIO_LIMITS.maxProjectNameRunes + 1))).toEqual({ field: "name", code: "too_large" });
    expect(projectNameIssue("  Post   de   segunda ")).toBeNull();
  });
});

describe("document factories", () => {
  it("builds valid empty documents for every preset and aspect", () => {
    for (const preset of IMAGE_PRESETS) expect(documentIssue("image", emptyImageDocument(preset))).toBeNull();
    for (const aspect of ["square", "portrait", "story"] as const) expect(documentIssue("video", emptyVideoDocument(aspect))).toBeNull();
  });

  it("builds layers the backend accepts, with unique token ids", () => {
    const doc: ImageDocument = emptyImageDocument({ width: 1080, height: 1080 });
    const [artboard] = doc.artboards;
    artboard.layers = [newTextLayer("Oi", "heading"), newShapeLayer("rect"), newShapeLayer("arrow"), newImageLayer("m-1"), newIconLayer("star")];
    expect(documentIssue("image", doc)).toBeNull();
    expect(new Set(artboard.layers.map((l) => l.id)).size).toBe(5);
    for (const id of [artboard.id, ...artboard.layers.map((l) => l.id)]) expect(id).toMatch(/^[a-z0-9][a-z0-9_-]*$/);
  });

  it("builds clips the backend accepts", () => {
    const doc = emptyVideoDocument("portrait");
    doc.tracks[0].clips = [newMediaClip("video", "m-1", 0, 2000)];
    doc.tracks[1].clips = [newOverlayClip(newTextLayer("Oferta"), 500, 1000)];
    doc.tracks[2].clips = [newMediaClip("audio", "m-2", 0, 2000)];
    doc.durationMs = 2000;
    expect(documentIssue("video", doc)).toBeNull();
  });
});

describe("frame quantizer", () => {
  it("maps milliseconds to 30 fps frames and back", () => {
    expect(frameOf(0)).toBe(0);
    expect(frameOf(1000)).toBe(30);
    expect(frameOf(16)).toBe(0);
    expect(frameOf(17)).toBe(1);
    expect(msOfFrame(1)).toBe(33);
    expect(quantizeMs(1010)).toBe(1000);
    expect(quantizeMs(1020)).toBe(1033);
  });
});

describe("canvas size", () => {
  it("accepts whole pixel sides inside the limits", () => {
    expect(canvasSizeIssue({ width: 1080, height: 1920 })).toBeNull();
    expect(canvasSizeIssue({ width: 99, height: 1080 })).toEqual({ field: "document.canvas", code: "out_of_range" });
    expect(canvasSizeIssue({ width: 1080, height: 4097 })).toEqual({ field: "document.canvas", code: "out_of_range" });
    expect(canvasSizeIssue({ width: 1080.5, height: 1080 })).toEqual({ field: "document.canvas", code: "out_of_range" });
  });
});
