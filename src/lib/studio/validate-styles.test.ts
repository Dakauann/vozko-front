import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { documentIssue } from "./validate";

type Json = Record<string, unknown>;
type Doc = { styles: Json[]; artboards: { canvas: Json; layers: Json[] }[] };

function fixture(): Doc {
  return JSON.parse(readFileSync(resolve(__dirname, "../../../../vozko-back/domain/studio/testdata/editor_styles.json"), "utf8"));
}

function edited(edit: (doc: Doc) => void): Doc {
  const doc = fixture();
  edit(doc);
  return doc;
}

const STYLES = { field: "document.styles", code: "invalid" };
const LAYERS = { field: "document.layers", code: "invalid" };

describe("shared styles in the image document", () => {
  it("accept the shared fixture", () => {
    expect(documentIssue("image", fixture())).toBeNull();
  });

  it("check every style definition", () => {
    expect(documentIssue("image", edited((d) => void (d.styles[1].id = "red")))).toEqual({ field: "document.styles", code: "duplicate" });
    expect(documentIssue("image", edited((d) => void (d.styles[0].kind = "grid")))).toEqual({ field: "document.styles", code: "unknown" });
    expect(documentIssue("image", edited((d) => void (d.styles[0].name = " ")))).toEqual(STYLES);
    expect(documentIssue("image", edited((d) => void (d.styles[0].gradient = d.styles[1].gradient)))).toEqual(STYLES);
    expect(documentIssue("image", edited((d) => void delete d.styles[0].color))).toEqual(STYLES);
    expect(documentIssue("image", edited((d) => void (d.styles[0].color = "red")))).toEqual(STYLES);
    expect(documentIssue("image", edited((d) => void (d.styles[0].fontId = "inter")))).toEqual(STYLES);
    expect(documentIssue("image", edited((d) => void (d.styles[0].role = "heading")))).toEqual(STYLES);
    expect(documentIssue("image", edited((d) => void (d.styles[2].fontSizePx = 0.5)))).toEqual({ field: "document.styles", code: "out_of_range" });
    expect(documentIssue("image", edited((d) => void (d.styles[2].fontId = "comic-sans")))).toEqual({ field: "document.styles", code: "unknown" });
    expect(documentIssue("image", edited((d) => void (d.styles[2].role = "caption")))).toEqual({ field: "document.styles", code: "unknown" });
    expect(documentIssue("image", edited((d) => void (d.styles[3] = { id: "empty", kind: "text", name: "Vazio" })))).toEqual(STYLES);
    expect(documentIssue("image", edited((d) => void delete d.styles[4].shadow))).toEqual(STYLES);
    expect(documentIssue("image", edited((d) => void (d.styles[4].shadow = { color: "#000000", blur: 900, x: 0, y: 0 })))).toEqual(STYLES);
    expect(documentIssue("image", edited((d) => void (d.styles[0].description = "x".repeat(501))))).toEqual(STYLES);
  });

  it("refuse links to missing styles, the wrong kind or a slot the layer does not paint", () => {
    expect(documentIssue("image", edited((d) => void (d.artboards[0].layers[0].textStyleId = "ghost")))).toEqual(LAYERS);
    expect(documentIssue("image", edited((d) => void (d.artboards[0].layers[0].textStyleId = "red")))).toEqual(LAYERS);
    expect(documentIssue("image", edited((d) => void (d.artboards[0].layers[1].textStyleId = "h1")))).toEqual(LAYERS);
    expect(documentIssue("image", edited((d) => void (d.artboards[0].layers[1].strokeStyleId = "sunset")))).toEqual(LAYERS);
    expect(documentIssue("image", edited((d) => void Object.assign(d.artboards[0].layers[2], { fillStyleId: "sunset", gradient: { from: "#ff7a00", to: "#e4003a", angle: 90, kind: "linear" }, fill: "#ff7a00" })))).toEqual(LAYERS);
    expect(documentIssue("image", edited((d) => void (d.artboards[0].canvas.backgroundStyleId = "soft")))).toEqual(LAYERS);
    expect(documentIssue("image", edited((d) => void (d.artboards[0].layers[0].fillStyleId = "bad id")))).toEqual(LAYERS);
  });

  it("refuse a linked value that does not match its style", () => {
    expect(documentIssue("image", edited((d) => void (d.artboards[0].layers[0].fontWeight = 700)))).toEqual(LAYERS);
    expect(documentIssue("image", edited((d) => void (d.artboards[1].layers[0].fontSize = 72 / 1080)))).toEqual(LAYERS);
    expect(documentIssue("image", edited((d) => void (d.artboards[0].layers[2].fill = "#000000")))).toEqual(LAYERS);
    expect(documentIssue("image", edited((d) => void (d.artboards[0].layers[0].shadow = { color: "#00000059", blur: 12, x: 0, y: 8 })))).toEqual(LAYERS);
    expect(documentIssue("image", edited((d) => void (d.artboards[0].canvas.background = "#000000")))).toEqual(LAYERS);
  });

  it("keep styles out of older documents, instances and video", () => {
    const legacy = { schema: "studio.image", version: 1, canvas: { width: 1080, height: 1080, background: "#ffffff" }, layers: [{ id: "l", type: "icon", iconId: "star", fill: "#e4003a", fillStyleId: "red", transform: { x: 0.5, y: 0.5, w: 0.1, h: 0.1, rotation: 0, opacity: 1 } }] };
    expect(documentIssue("image", legacy)).toEqual(LAYERS);
    const video = {
      schema: "studio.video",
      version: 1,
      canvas: { aspect: "square", background: "#000000" },
      durationMs: 2000,
      tracks: [{ id: "t1", kind: "visual", clips: [{ id: "c1", type: "overlay", startMs: 0, durationMs: 1000, trimInMs: 0, volume: 1, fadeInMs: 0, fadeOutMs: 0, transform: { x: 0.5, y: 0.5, w: 0.5, h: 0.5, rotation: 0, opacity: 1 }, layer: legacy.layers[0] }] }],
    };
    expect(documentIssue("video", video)).toEqual({ field: "document.tracks", code: "invalid" });
  });
});
