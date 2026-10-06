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
  type Transform,
  type VideoDocument,
} from "./document";
import { canvasSizeIssue, documentIssue, parseDocument, projectNameIssue } from "./validate";

function box(): Transform {
  return { x: 0.5, y: 0.5, w: 0.5, h: 0.2, rotation: 0, opacity: 1 };
}

function imageDoc(): ImageDocument {
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
    ["unknown font", (d: ImageDocument) => (d.layers[1].fontId = "comic-sans" as "inter"), "unknown"],
    ["empty text", (d: ImageDocument) => (d.layers[1].text = "  "), "invalid"],
    ["bad weight", (d: ImageDocument) => (d.layers[1].fontWeight = 450), "out_of_range"],
    ["image without asset", (d: ImageDocument) => (d.layers[0].assetId = ""), "required"],
    ["crop outside", (d: ImageDocument) => (d.layers[0].crop!.w = 0.95), "out_of_range"],
    ["unknown shape", (d: ImageDocument) => (d.layers[2].shape = "blob" as "rect"), "unknown"],
    ["bad color", (d: ImageDocument) => (d.layers[2].stroke = "red"), "invalid"],
    ["duplicate id", (d: ImageDocument) => (d.layers[3].id = "photo"), "duplicate"],
    ["bad id", (d: ImageDocument) => (d.layers[3].id = "Star!"), "invalid"],
    ["too transparent", (d: ImageDocument) => (d.layers[3].transform.opacity = 1.5), "out_of_range"],
    ["no icon", (d: ImageDocument) => (d.layers[3].iconId = ""), "invalid"],
  ])("rejects image layers with %s", (_, change, code) => {
    const doc = imageDoc();
    change(doc);
    expect(documentIssue("image", doc)).toEqual({ field: "document.layers", code });
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

  it("caps the document size", () => {
    const doc = imageDoc();
    const huge = { ...doc, layers: Array.from({ length: 300 }, (_, i) => ({ ...doc.layers[1], id: `t${i}`, text: "a".repeat(1999) })) };
    expect(documentIssue("image", huge)).toEqual({ field: "document", code: "too_large" });
  });

  it("parses into a typed document", () => {
    const parsed = parseDocument("video", videoDoc());
    expect(parsed.ok && parsed.document.tracks.length).toBe(4);
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
    const doc = emptyImageDocument({ width: 1080, height: 1080 });
    doc.layers = [newTextLayer("Oi", "heading"), newShapeLayer("rect"), newShapeLayer("arrow"), newImageLayer("m-1"), newIconLayer("star")];
    expect(documentIssue("image", doc)).toBeNull();
    expect(new Set(doc.layers.map((l) => l.id)).size).toBe(5);
    for (const layer of doc.layers) expect(layer.id).toMatch(/^[a-z0-9][a-z0-9_-]*$/);
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
