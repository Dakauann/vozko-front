import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { documentIssue } from "./validate";

type Json = Record<string, unknown>;
type Doc = { artboards: { layers: Json[]; groups: Json[] }[] };

function fixture(): Doc {
  return JSON.parse(readFileSync(resolve(__dirname, "../../../../vozko-back/domain/studio/testdata/editor_layout.json"), "utf8"));
}

function edited(edit: (doc: Doc) => void): Doc {
  const doc = fixture();
  edit(doc);
  return doc;
}

function layer(d: Doc, id: string): Json {
  return d.artboards[0].layers.find((l) => l.id === id)!;
}

function group(d: Doc, id: string): Json {
  return d.artboards[0].groups.find((g) => g.id === id)!;
}

function layout(d: Doc, id: string): Json {
  return group(d, id).layout as Json;
}

const LAYERS = (code: string) => ({ field: "document.layers", code });

describe("auto layout in the image document", () => {
  it("accepts the shared fixture", () => {
    expect(documentIssue("image", fixture())).toBeNull();
  });

  it("checks every layout value", () => {
    expect(documentIssue("image", edited((d) => void (layout(d, "cta").direction = "diagonal")))).toEqual(LAYERS("unknown"));
    expect(documentIssue("image", edited((d) => void delete layout(d, "cta").width))).toEqual(LAYERS("unknown"));
    expect(documentIssue("image", edited((d) => void (layout(d, "cta").alignMain = "middle")))).toEqual(LAYERS("unknown"));
    expect(documentIssue("image", edited((d) => void (layout(d, "cta").gap = 20000)))).toEqual(LAYERS("out_of_range"));
    expect(documentIssue("image", edited((d) => void (layout(d, "cta").padding = { top: -1, right: 0, bottom: 0, left: 0 })))).toEqual(LAYERS("out_of_range"));
    expect(documentIssue("image", edited((d) => void (layout(d, "auto").gap = 10)))).toEqual(LAYERS("invalid"));
    expect(documentIssue("image", edited((d) => void (layout(d, "auto").alignMain = "center")))).toEqual(LAYERS("invalid"));
  });

  it("needs a scaffold base standing upright and no repeat", () => {
    expect(documentIssue("image", edited((d) => void delete group(d, "auto").baseId))).toEqual(LAYERS("invalid"));
    expect(documentIssue("image", edited((d) => void ((layer(d, "row-bg").transform as Json).rotation = 10)))).toEqual(LAYERS("invalid"));
    expect(documentIssue("image", edited((d) => void (group(d, "auto").repeat = { mode: "mirror", angle: 90 })))).toEqual(LAYERS("invalid"));
  });

  it("checks item sizing against the layer and its container", () => {
    expect(documentIssue("image", edited((d) => void (layer(d, "cta-icon").layoutItem = {})))).toEqual(LAYERS("invalid"));
    expect(documentIssue("image", edited((d) => void (layer(d, "cta-icon").layoutItem = { width: "stretch" })))).toEqual(LAYERS("unknown"));
    expect(documentIssue("image", edited((d) => void (layer(d, "cta-icon").layoutItem = { width: "hug" })))).toEqual(LAYERS("invalid"));
    expect(documentIssue("image", edited((d) => void (layer(d, "badge").layoutItem = { absolute: true, width: "fill" })))).toEqual(LAYERS("invalid"));
    expect(documentIssue("image", edited((d) => void (layer(d, "cta-icon").layoutItem = { width: "fill" })))).toEqual(LAYERS("invalid"));
    expect(documentIssue("image", edited((d) => void (layer(d, "card").layoutItem = { width: "fill" })))).toEqual(LAYERS("invalid"));
    expect(documentIssue("image", edited((d) => void Object.assign(layer(d, "row-a"), { layoutItem: { width: "fill" }, transform: { ...(layer(d, "row-a").transform as Json), rotation: 5 } })))).toEqual(LAYERS("invalid"));
    expect(documentIssue("image", edited((d) => void (layer(d, "row-a").groupId = undefined)))).toBeNull();
    expect(documentIssue("image", edited((d) => void Object.assign(layer(d, "row-a"), { groupId: undefined, layoutItem: { width: "fixed" } })))).toEqual(LAYERS("invalid"));
  });

  it("checks nested groups as items", () => {
    expect(documentIssue("image", edited((d) => void (group(d, "cta").layoutItem = { width: "fixed" })))).toBeNull();
    expect(documentIssue("image", edited((d) => void (group(d, "cta").layoutItem = { height: "hug" })))).toEqual(LAYERS("invalid"));
    expect(documentIssue("image", edited((d) => void (group(d, "cta").layoutItem = { width: "fill" })))).toEqual(LAYERS("invalid"));
    expect(documentIssue("image", edited((d) => void (group(d, "auto").layoutItem = { width: "fixed" })))).toEqual(LAYERS("invalid"));
  });

  it("keeps layout items out of video overlays", () => {
    const video = {
      schema: "studio.video",
      version: 1,
      canvas: { aspect: "square", background: "#000000" },
      durationMs: 2000,
      tracks: [{ id: "t1", kind: "visual", clips: [{ id: "c1", type: "overlay", startMs: 0, durationMs: 1000, trimInMs: 0, volume: 1, fadeInMs: 0, fadeOutMs: 0, transform: { x: 0.5, y: 0.5, w: 0.5, h: 0.5, rotation: 0, opacity: 1 }, layer: { id: "l1", type: "icon", iconId: "star", fill: "#000000", layoutItem: { absolute: true }, transform: { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 } } }] }],
    };
    expect(documentIssue("video", video)?.field).toBe("document.tracks");
  });
});
