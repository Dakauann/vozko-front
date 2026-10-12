import { describe, expect, it } from "vitest";

import { emptyArtboard, IMAGE_DOCUMENT_VERSION, IMAGE_SCHEMA, type Artboard, type ImageDocument, type Layer } from "../document";
import { documentIssue } from "../validate";
import { planBatch } from "./batch";
import { applyImageOperation, IMAGE_ID_FIELDS, imageIds, type ImageOpContext, type ImageOperation } from "./image-ops";
import { imageOutline } from "./outline";

function doc(): ImageDocument {
  const feed: Artboard = {
    ...emptyArtboard({ width: 1080, height: 1080 }),
    id: "feed",
    layers: [
      { id: "title", type: "text", text: "Oferta", fontId: "montserrat", fontWeight: 800, fontSize: 72 / 1080, fill: "#e4003a", transform: { x: 0.5, y: 0.3, w: 0.8, h: 0.2, rotation: 0, opacity: 1 } },
      { id: "card", type: "shape", shape: "rect", fill: "#111111", transform: { x: 0.5, y: 0.7, w: 0.6, h: 0.2, rotation: 0, opacity: 1 } },
    ],
  };
  const story: Artboard = { ...emptyArtboard({ width: 1080, height: 1920 }), id: "story", x: 1200, layers: [{ id: "story-title", type: "text", text: "Oferta", fontId: "inter", fontSize: 0.03, fill: "#000000", transform: { x: 0.5, y: 0.3, w: 0.8, h: 0.1, rotation: 0, opacity: 1 } }] };
  return { schema: IMAGE_SCHEMA, version: IMAGE_DOCUMENT_VERSION, artboards: [feed, story] };
}

const ctx: ImageOpContext = { naturalSize: () => undefined, icons: ["star"], activeArtboard: "feed" };

function run(ops: ImageOperation[], base: ImageDocument = doc()) {
  return planBatch(base, ops, (d, op) => applyImageOperation(d, op, ctx), IMAGE_ID_FIELDS, imageIds);
}

function done(ops: ImageOperation[], base?: ImageDocument) {
  const plan = run(ops, base);
  if (!plan.ok) throw new Error(`${plan.op}: ${plan.reason}`);
  expect(documentIssue("image", plan.final)).toBeNull();
  return plan;
}

function reason(ops: ImageOperation[], base?: ImageDocument): string {
  const plan = run(ops, base);
  if (plan.ok) throw new Error("expected a refusal");
  return plan.reason;
}

function layer(d: ImageDocument, id: string): Layer {
  return d.artboards.flatMap((a) => a.layers).find((l) => l.id === id)!;
}

describe("style operations", () => {
  it("capture a heading from a layer and apply it on another format in its units", () => {
    const plan = done([
      { op: "create_style", ref: "h1", style_kind: "text", name: "Título", role: "heading", layer_id: "title" },
      { op: "apply_style", style_id: "@h1", layer_ids: ["story-title"] },
    ]);
    const styleId = plan.created.h1[0];
    expect(layer(plan.final, "title").textStyleId).toBe(styleId);
    expect(layer(plan.final, "story-title")).toMatchObject({ fontId: "montserrat", fontWeight: 800, textStyleId: styleId });
    expect(layer(plan.final, "story-title").fontSize).toBeCloseTo(72 / 1920);
  });

  it("create brand colors from values, paint the background and propagate an edit", () => {
    const plan = done([
      { op: "create_style", ref: "red", style_kind: "color", name: "Marca/Vermelho", style_values: { color: "#e4003a" } },
      { op: "apply_style", style_id: "@red", layer_ids: ["card"] },
      { op: "apply_style", style_id: "@red", artboard_id: "story" },
      { op: "update_style", style_id: "@red", style_values: { color: "#0044ff" } },
    ]);
    expect(layer(plan.final, "card")).toMatchObject({ fill: "#0044ff" });
    expect(plan.final.artboards[1].canvas).toMatchObject({ background: "#0044ff" });
  });

  it("removes fields from a partial style, detaches and deletes", () => {
    const made = done([{ op: "create_style", ref: "h1", style_kind: "text", name: "Título", layer_id: "title" }]);
    const styleId = made.created.h1[0];
    const partial = done([{ op: "update_style", style_id: styleId, style_clear: ["font_size_px", "font_weight"] }], made.final);
    expect(partial.final.styles?.[0]).toEqual({ id: styleId, kind: "text", name: "Título", fontId: "montserrat" });
    const detached = done([{ op: "detach_style", layer_ids: ["title"] }], made.final);
    expect(layer(detached.final, "title").textStyleId).toBeUndefined();
    const deleted = done([{ op: "delete_style", style_id: styleId }], made.final);
    expect(deleted.final.styles).toBeUndefined();
  });

  it("detach a link when a governed value is written directly", () => {
    const made = done([{ op: "create_style", ref: "h1", style_kind: "text", name: "Título", layer_id: "title" }]);
    const plan = done([{ op: "update_layer", layer_id: "title", font_size: 0.05 }], made.final);
    expect(layer(plan.final, "title").textStyleId).toBeUndefined();
    const kept = done([{ op: "update_layer", layer_id: "title", x: 0.4 }], made.final);
    expect(layer(kept.final, "title").textStyleId).toBe(made.created.h1[0]);
  });

  it("refuse what cannot be linked", () => {
    const made = done([{ op: "create_style", ref: "h1", style_kind: "text", name: "Título", layer_id: "title" }]);
    expect(reason([{ op: "apply_style", style_id: made.created.h1[0], layer_ids: ["card"] }], made.final)).toContain("card");
    expect(reason([{ op: "apply_style", style_id: "ghost", layer_ids: ["card"] }])).toContain("não existe");
    expect(reason([{ op: "create_style", style_kind: "effect", name: "Sombra", layer_id: "card" }])).toContain("sombra");
    expect(reason([{ op: "create_style", style_kind: "color", name: "Nada" }])).toContain("style");
    expect(reason([{ op: "update_style", style_id: made.created.h1[0], style_values: { font_size_px: 900 } }], made.final)).toContain("title");
    expect(reason([{ op: "update_style", style_id: made.created.h1[0], style_clear: ["shadow"] }], made.final)).toContain("style_clear");
  });

  it("show styles, uses and links in the outline", () => {
    const plan = done([
      { op: "create_style", ref: "h1", style_kind: "text", name: "Título", layer_id: "title" },
      { op: "create_style", ref: "red", style_kind: "color", name: "Vermelho", layer_id: "title" },
    ]);
    const outline = imageOutline(plan.final, { detail: "summary", asset: () => undefined, playheadMs: 0, selection: [], jobs: [], activeArtboard: "feed" });
    expect(outline.styles).toEqual([
      { id: plan.created.h1[0], kind: "text", name: "Título", value: "montserrat 800 72px", uses: 1 },
      { id: plan.created.red[0], kind: "color", name: "Vermelho", value: "#e4003a", uses: 1 },
    ]);
    expect(outline.artboards[0].layers[0].styles).toEqual({ fill: plan.created.red[0], text: plan.created.h1[0] });
  });
});
