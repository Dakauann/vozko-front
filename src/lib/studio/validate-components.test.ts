import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { documentIssue } from "./validate";

type Json = Record<string, unknown>;

function fixture(): Json {
  return JSON.parse(readFileSync(resolve(__dirname, "../../../../vozko-back/domain/studio/testdata/editor_components.json"), "utf8"));
}

function edited(edit: (doc: { artboards: { component?: boolean; layers: Json[] }[] }) => void): Json {
  const doc = fixture();
  edit(doc as never);
  return doc;
}

function instance(doc: { artboards: { layers: Json[] }[] }): Json {
  return doc.artboards[0].layers[1];
}

describe("components in the image document", () => {
  it("accept the shared fixture", () => {
    expect(documentIssue("image", fixture())).toBeNull();
  });

  it("refuse an instance whose component is missing or not flagged", () => {
    expect(documentIssue("image", edited((d) => void (instance(d).componentId = "nothing")))).toEqual({ field: "document.layers", code: "invalid" });
    expect(documentIssue("image", edited((d) => void (instance(d).componentId = "post")))).toEqual({ field: "document.layers", code: "invalid" });
    expect(documentIssue("image", edited((d) => void delete d.artboards[1].component))).toEqual({ field: "document.layers", code: "invalid" });
  });

  it("refuse nesting an instance inside a component", () => {
    expect(documentIssue("image", edited((d) => d.artboards[1].layers.push({ id: "nested", type: "instance", componentId: "badge", transform: { x: 0.5, y: 0.5, w: 0.2, h: 0.2, rotation: 0, opacity: 1 } })))).toEqual({ field: "document.layers", code: "invalid" });
  });

  it("refuse style fields on an instance and instance fields on other layers", () => {
    expect(documentIssue("image", edited((d) => void (instance(d).fill = "#ff0000")))).toEqual({ field: "document.layers", code: "invalid" });
    expect(documentIssue("image", edited((d) => void (instance(d).text = "Oi")))).toEqual({ field: "document.layers", code: "invalid" });
    expect(documentIssue("image", edited((d) => void (d.artboards[0].layers[0].componentId = "cta")))).toEqual({ field: "document.layers", code: "invalid" });
    expect(documentIssue("image", edited((d) => void (d.artboards[0].layers[0].overrides = [{ layerId: "pill", fill: "#ff0000" }])))).toEqual({ field: "document.layers", code: "invalid" });
  });

  it("check every override against its main layer", () => {
    const override = (entry: Json) => edited((d) => void (instance(d).overrides = [entry]));
    expect(documentIssue("image", override({ layerId: "ghost", fill: "#ff0000" }))).toEqual({ field: "document.layers", code: "invalid" });
    expect(documentIssue("image", override({ layerId: "pill" }))).toEqual({ field: "document.layers", code: "invalid" });
    expect(documentIssue("image", override({ layerId: "pill", text: "Oi" }))).toEqual({ field: "document.layers", code: "invalid" });
    expect(documentIssue("image", override({ layerId: "pill", stroke: "#000000" }))).toEqual({ field: "document.layers", code: "invalid" });
    expect(documentIssue("image", override({ layerId: "label", fill: "red" }))).toEqual({ field: "document.layers", code: "invalid" });
    expect(documentIssue("image", override({ layerId: "label", fontId: "comic-sans" }))).toEqual({ field: "document.layers", code: "unknown" });
    expect(documentIssue("image", override({ layerId: "label", fontWeight: 450 }))).toEqual({ field: "document.layers", code: "out_of_range" });
    expect(documentIssue("image", override({ layerId: "label", text: "   " }))).toEqual({ field: "document.layers", code: "invalid" });
    expect(documentIssue("image", override({ layerId: "label", unknown: true }))).toEqual({ field: "document", code: "invalid" });
    expect(documentIssue("image", edited((d) => void (instance(d).overrides = [{ layerId: "pill", fill: "#000000" }, { layerId: "pill", hidden: true }])))).toEqual({ field: "document.layers", code: "duplicate" });
  });

  it("refuse a crop override past the image", () => {
    expect(documentIssue("image", edited((d) => void (d.artboards[0].layers[3].overrides = [{ layerId: "shot", crop: { x: 0.6, y: 0, w: 0.5, h: 1 } }])))).toEqual({ field: "document.layers", code: "out_of_range" });
  });

  it("refuse a part id stored as a layer id", () => {
    expect(documentIssue("image", edited((d) => void (d.artboards[0].layers[0].id = "cta-1;pill")))).toEqual({ field: "document.layers", code: "invalid" });
  });

  it("keep instances out of video overlays", () => {
    const video = {
      schema: "studio.video",
      version: 1,
      canvas: { aspect: "square", background: "#000000" },
      durationMs: 2000,
      tracks: [{ id: "t1", kind: "visual", clips: [{ id: "c1", type: "overlay", startMs: 0, durationMs: 1000, trimInMs: 0, volume: 1, fadeInMs: 0, fadeOutMs: 0, transform: { x: 0.5, y: 0.5, w: 0.5, h: 0.5, rotation: 0, opacity: 1 }, layer: { id: "l1", type: "instance", componentId: "cta", transform: { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 } } }] }],
    };
    expect(documentIssue("video", video)).toEqual({ field: "document.tracks", code: "invalid" });
  });
});
