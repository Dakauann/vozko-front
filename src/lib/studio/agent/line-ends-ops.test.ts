import { describe, expect, it } from "vitest";

import { emptyArtboard, IMAGE_DOCUMENT_VERSION, IMAGE_SCHEMA, type ImageDocument, type Layer } from "../document";
import { documentIssue } from "../validate";
import { planBatch } from "./batch";
import { applyImageOperation, IMAGE_ID_FIELDS, type ImageOpContext, type ImageOperation } from "./image-ops";
import { imageOutline } from "./outline";

const ctx: ImageOpContext = { naturalSize: () => undefined, icons: [], activeArtboard: "main" };

function doc(): ImageDocument {
  return { schema: IMAGE_SCHEMA, version: IMAGE_DOCUMENT_VERSION, artboards: [{ ...emptyArtboard({ width: 1080, height: 1080 }), id: "main" }] };
}

function run(ops: ImageOperation[], base: ImageDocument = doc()) {
  return planBatch(base, ops, (d, op) => applyImageOperation(d, op, ctx), IMAGE_ID_FIELDS);
}

function created(ops: ImageOperation[], ref: string): { layer: Layer; final: ImageDocument } {
  const plan = run(ops);
  if (!plan.ok) throw new Error(`${plan.op}: ${plan.reason}`);
  expect(documentIssue("image", plan.final)).toBeNull();
  const id = plan.created[ref][0];
  return { layer: plan.final.artboards[0].layers.find((layer) => layer.id === id)!, final: plan.final };
}

describe("line ends and polygons through Elo", () => {
  it("turns an end on with its style and keeps the filled arrow as the plain head", () => {
    const { layer } = created([{ op: "add_shape", ref: "l", shape: "line", arrow_start_kind: "dot", arrow_end_kind: "arrow" }], "l");
    expect(layer).toMatchObject({ arrowStart: true, arrowStartKind: "dot", arrowEnd: true });
    expect(layer.arrowEndKind).toBeUndefined();
  });

  it("clears the style when the end is switched off", () => {
    const { final, layer } = created([{ op: "add_shape", ref: "l", shape: "line", arrow_end_kind: "diamond" }], "l");
    const plan = run([{ op: "update_layer", layer_id: layer.id, arrow_end: false }], final);
    if (!plan.ok) throw new Error(plan.reason);
    const next = plan.final.artboards[0].layers.find((item) => item.id === layer.id)!;
    expect(next.arrowEnd).toBeUndefined();
    expect(next.arrowEndKind).toBeUndefined();
  });

  it("refuses unknown styles and a style on a switched off end", () => {
    const unknown = run([{ op: "add_shape", shape: "line", arrow_end_kind: "spiral" }]);
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.reason).toContain("diamond");
    expect(run([{ op: "add_shape", shape: "line", arrow_end: false, arrow_end_kind: "dot" }]).ok).toBe(false);
  });

  it("adds a polygon with a side count and reads the ends back in the outline", () => {
    const { layer } = created([{ op: "add_shape", ref: "p", shape: "polygon", points: 8 }], "p");
    expect(layer).toMatchObject({ shape: "polygon", points: 8 });
    const { final } = created([{ op: "add_shape", ref: "l", shape: "line", arrow_start_kind: "bar" }], "l");
    const outline = imageOutline(final, { detail: "full", asset: () => undefined, icons: [], playheadMs: 0, selection: [], jobs: [], activeArtboard: "main" });
    expect(JSON.stringify(outline)).toContain('"arrow_start_kind":"bar"');
  });
});
