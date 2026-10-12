import { describe, expect, it } from "vitest";

import { emptyArtboard, fullFrame, IMAGE_DOCUMENT_VERSION, IMAGE_SCHEMA, newImageLayer, newShapeLayer, type Artboard, type ImageDocument } from "../document";
import { documentIssue } from "../validate";
import { planBatch } from "./batch";
import { applyImageOperation, IMAGE_ID_FIELDS, imageIds, type ImageOpContext, type ImageOperation } from "./image-ops";
import { imageOutline } from "./outline";

function doc(): ImageDocument {
  const main: Artboard = {
    ...emptyArtboard({ width: 1080, height: 1080 }),
    id: "main",
    layers: [
      { ...newImageLayer("photo", fullFrame()), id: "pic" },
      { ...newShapeLayer("rect"), id: "box" },
      { ...newImageLayer("photo", fullFrame()), id: "held", locked: true },
    ],
  };
  const side: Artboard = { ...emptyArtboard({ width: 1080, height: 1920 }), id: "story", x: 1200, layers: [] };
  return { schema: IMAGE_SCHEMA, version: IMAGE_DOCUMENT_VERSION, artboards: [main, side] };
}

const ctx: ImageOpContext = { naturalSize: () => ({ width: 100, height: 100 }), icons: [], activeArtboard: "main" };

function run(ops: ImageOperation[], base: ImageDocument = doc()) {
  return planBatch(base, ops, (d, op) => applyImageOperation(d, op, ctx), IMAGE_ID_FIELDS, imageIds);
}

function done(ops: ImageOperation[], base?: ImageDocument): ImageDocument {
  const plan = run(ops, base);
  if (!plan.ok) throw new Error(`${plan.op}: ${plan.reason}`);
  expect(documentIssue("image", plan.final)).toBeNull();
  return plan.final;
}

function refusal(ops: ImageOperation[], base?: ImageDocument): string {
  const plan = run(ops, base);
  if (plan.ok) throw new Error("expected a refusal");
  return plan.reason;
}

describe("still effects for Elo in the image editor", () => {
  it("adds seeded effects to a photo and tunes them by ref", () => {
    const final = done([
      { op: "add_vfx", ref: "grain", layer_id: "pic", vfx_kind: "grain", vfx_seed: 12, vfx_params: { amount: 0.6, chroma: 0.3 } },
      { op: "add_vfx", layer_id: "pic", vfx_kind: "lightLeak", vfx_params: { color: "#ff9900", x: 0.8 } },
      { op: "update_vfx", layer_id: "pic", vfx_id: "@grain", vfx_params: { size: 3 }, vfx_hidden: true },
      { op: "move_vfx", layer_id: "pic", vfx_id: "@grain", to_index: 1 },
    ]);
    const list = final.artboards[0].layers[0].vfx ?? [];
    expect(list.map((vfx) => vfx.kind)).toEqual(["lightLeak", "grain"]);
    expect(list[1]).toMatchObject({ seed: 12, hidden: true, params: { amount: 0.6, chroma: 0.3, size: 3 } });
    expect(list[0].colors).toEqual({ color: "#ff9900" });
  });

  it("puts an effect on the artboard when only artboard_id is given, and removes it", () => {
    const added = done([{ op: "add_vfx", artboard_id: "story", vfx_kind: "vignette", vfx_params: { amount: 0.7 } }]);
    expect(added.artboards[1].canvas.vfx?.map((vfx) => vfx.kind)).toEqual(["vignette"]);
    expect(added.artboards[0].canvas.vfx).toBeUndefined();
    const removed = done([{ op: "remove_vfx", artboard_id: "story" }], added);
    expect(removed.artboards[1].canvas.vfx).toBeUndefined();
  });

  it("uses the active artboard when neither a layer nor an artboard is named", () => {
    const added = done([{ op: "add_vfx", vfx_kind: "chromaticAberration" }]);
    expect(added.artboards[0].canvas.vfx?.map((vfx) => vfx.kind)).toEqual(["chromaticAberration"]);
  });

  it("explains what a still picture cannot hold", () => {
    expect(refusal([{ op: "add_vfx", layer_id: "pic", vfx_kind: "particles" }])).toContain("grain, lightLeak, vignette, chromaticAberration, glitch, lensFlare");
    expect(refusal([{ op: "add_vfx", layer_id: "pic", vfx_kind: "grain", vfx_params: { rate: 12 } }])).toContain("amount, size, chroma");
    expect(refusal([{ op: "add_vfx", layer_id: "pic", vfx_kind: "lensFlare", vfx_params: { flicker: 0.5 } }])).toContain("flicker");
    expect(refusal([{ op: "add_vfx", layer_id: "pic", vfx_kind: "grain", vfx_params: { amount: 3 } }])).toContain("0 a 1");
    expect(refusal([{ op: "add_vfx", layer_id: "box", vfx_kind: "grain" }])).toContain("não é uma imagem");
    expect(refusal([{ op: "add_vfx", layer_id: "held", vfx_kind: "grain" }])).toContain("travada");
    expect(refusal([{ op: "add_vfx", layer_id: "nope", vfx_kind: "grain" }])).toContain("não existe");
    expect(refusal([{ op: "update_vfx", layer_id: "pic", vfx_params: { amount: 0.2 } }])).toContain("não tem efeitos");
    const two = done([
      { op: "add_vfx", layer_id: "pic", vfx_kind: "grain" },
      { op: "add_vfx", layer_id: "pic", vfx_kind: "glitch" },
    ]);
    expect(refusal([{ op: "remove_vfx", layer_id: "pic" }], two)).toContain("mande vfx_id");
    expect(refusal([{ op: "update_vfx", layer_id: "pic", vfx_id: "ghost" }], two)).toContain("ghost");
  });

  it("lists effect ids so short ids and refs resolve", () => {
    const final = done([{ op: "add_vfx", layer_id: "pic", vfx_kind: "grain" }, { op: "add_vfx", artboard_id: "story", vfx_kind: "vignette" }]);
    const ids = imageIds(final);
    expect(ids).toContain(final.artboards[0].layers[0].vfx![0].id);
    expect(ids).toContain(final.artboards[1].canvas.vfx![0].id);
  });
});

describe("still effects in what Elo reads", () => {
  it("lists a photo's and an artboard's effects with only the values a still picture uses", () => {
    const final = done([
      { op: "add_vfx", layer_id: "pic", vfx_kind: "lensFlare", vfx_seed: 3, vfx_params: { streak: 0.7 } },
      { op: "add_vfx", artboard_id: "story", vfx_kind: "grain", vfx_seed: 8 },
    ]);
    const outline = imageOutline(final, { detail: "summary", asset: () => undefined, playheadMs: 0, selection: [], jobs: [], activeArtboard: "main" });
    const layer = outline.artboards[0].layers.find((entry) => entry.id === "pic");
    expect(layer?.vfx).toEqual([{ id: final.artboards[0].layers[0].vfx![0].id, kind: "lensFlare", seed: 3, params: { amount: 0.8, size: 1, x: 0.25, y: 0.25, ghosts: 0.6, streak: 0.7 }, colors: { color: "#ffd29a" } }]);
    expect(outline.artboards[1].vfx?.[0]).toMatchObject({ kind: "grain", seed: 8, params: { amount: 0.35, size: 1.5, chroma: 0 } });
    expect(outline.artboards[0].vfx).toBeUndefined();
  });
});
