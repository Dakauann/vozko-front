import { describe, expect, it } from "vitest";

import { IMAGE_DOCUMENT_VERSION, IMAGE_SCHEMA, newShapeLayer, newTextLayer, type Artboard, type ImageDocument, type Layer } from "../document";
import { documentIssue } from "../validate";
import { planBatch } from "./batch";
import { applyImageOperation, IMAGE_ID_FIELDS, imageIds, type ImageOpContext, type ImageOperation } from "./image-ops";
import { imageOutline } from "./outline";

function board(id: string, x: number, layers: Layer[], name?: string): Artboard {
  return { id, ...(name ? { name } : {}), x, y: 0, canvas: { width: 1080, height: 1080, background: "#ffffff" }, layers };
}

function cards(): ImageDocument {
  return {
    schema: IMAGE_SCHEMA,
    version: IMAGE_DOCUMENT_VERSION,
    artboards: [
      board("c1", 0, [{ ...newShapeLayer("rect"), id: "door1" }, { ...newTextLayer("Um"), id: "t1" }], "Cartão 1"),
      board("c2", 1180, [{ ...newShapeLayer("rect"), id: "door2" }, { ...newTextLayer("Dois"), id: "t2" }], "Cartão 2"),
      board("c3", 2360, [{ ...newShapeLayer("rect"), id: "door3" }, { ...newShapeLayer("ellipse"), id: "dot3", locked: true }], "Cartão 3"),
    ],
  };
}

const ctx: ImageOpContext = { naturalSize: () => undefined, icons: [], activeArtboard: "c1" };

function run(ops: ImageOperation[], base: ImageDocument = cards()) {
  return planBatch(base, ops, (d, op) => applyImageOperation(d, op, ctx), IMAGE_ID_FIELDS, imageIds);
}

function accepted(ops: ImageOperation[], base?: ImageDocument) {
  const plan = run(ops, base);
  if (!plan.ok) throw new Error(`${plan.op}: ${plan.reason}`);
  expect(documentIssue("image", plan.final)).toBeNull();
  return plan;
}

function refusal(ops: ImageOperation[], base?: ImageDocument): string {
  const plan = run(ops, base);
  if (plan.ok) throw new Error("the batch was accepted");
  return plan.reason;
}

function layer(doc: ImageDocument, id: string): Layer {
  return doc.artboards.flatMap((a) => a.layers).find((l) => l.id === id)!;
}

function place(doc: ImageDocument, id: string): [number, number] {
  const found = doc.artboards.find((a) => a.id === id)!;
  return [found.x, found.y];
}

describe("one operation over layers on several artboards", () => {
  it("applies an update to every artboard it reaches as one step and says what changed on each", () => {
    const plan = accepted([{ op: "update_layer", layer_ids: ["door1", "door2", "door3"], y: 0.7, h: 0.4 }]);
    for (const id of ["door1", "door2", "door3"]) expect(layer(plan.final, id).transform).toMatchObject({ y: 0.7, h: 0.4 });
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].operation).toBe(0);
    expect(plan.changed).toEqual(["door1", "door2", "door3"]);
    expect(plan.spread).toEqual([
      {
        operation: 0,
        op: "update_layer",
        artboards: [
          { artboard: "c1", ids: ["door1"] },
          { artboard: "c2", ids: ["door2"] },
          { artboard: "c3", ids: ["door3"] },
        ],
      },
    ]);
  });

  it("keeps the order the layers were named in within each artboard", () => {
    const plan = accepted([{ op: "set_hidden", layer_ids: ["t2", "door1", "door2"], hidden: true }]);
    expect(plan.spread[0].artboards).toEqual([
      { artboard: "c1", ids: ["door1"] },
      { artboard: "c2", ids: ["t2", "door2"] },
    ]);
    expect(layer(plan.final, "t2").hidden).toBe(true);
  });

  it("spreads deletes, duplicates and z order steps, and later operations reach the copies by ref", () => {
    const plan = accepted([
      { op: "duplicate_layers", ref: "copies", layer_ids: ["t1", "t2"] },
      { op: "update_layer", layer_ids: ["@copies"], fill: "#ff0000" },
      { op: "order_layers", layer_ids: ["door1", "door2"], direction: "front" },
      { op: "delete_layers", layer_ids: ["t1", "t2"] },
    ]);
    expect(plan.created.copies).toHaveLength(2);
    for (const id of plan.created.copies) expect(layer(plan.final, id).fill).toBe("#ff0000");
    expect(plan.final.artboards[0].layers.at(-1)?.id).toBe("door1");
    expect(plan.final.artboards[1].layers.at(-1)?.id).toBe("door2");
    expect(layer(plan.final, "t1")).toBeUndefined();
    expect(plan.spread.map((entry) => entry.operation)).toEqual([0, 1, 2, 3]);
  });

  it("refuses the whole operation, naming the artboard, when one part of it fails", () => {
    const reason = refusal([{ op: "update_layer", layer_ids: ["door1", "dot3"], y: 0.2 }]);
    expect(reason).toContain("prancheta c3");
    expect(reason).toContain("travada");
  });

  it("still refuses operations whose meaning depends on a single artboard, and says how to do it", () => {
    for (const op of [
      { op: "align_layers", layer_ids: ["door1", "door2"], alignment: "center" },
      { op: "distribute_layers", layer_ids: ["door1", "door2", "door3"], axis: "horizontal" },
      { op: "group_layers", layer_ids: ["door1", "door2"] },
      { op: "order_layers", layer_ids: ["door1"], above_id: "t2" },
      { op: "combine_shapes", layer_ids: ["door1", "door2"], mode: "union" },
    ] as ImageOperation[]) {
      const reason = refusal([op]);
      expect(reason).toContain("pranchetas diferentes");
      expect(reason).toContain("move_to_artboard");
    }
  });
});

describe("artboard position", () => {
  it("moves an artboard with update_artboard and studio_read reads the new place back", () => {
    const plan = accepted([{ op: "update_artboard", artboard_id: "c2", artboard_x: -500, artboard_y: 2400 }]);
    expect(place(plan.final, "c2")).toEqual([-500, 2400]);
    expect(plan.changed).toEqual(["c2"]);
    const outline = imageOutline(plan.final, { detail: "summary", asset: () => undefined, playheadMs: 0, selection: [], jobs: [] });
    expect(outline.artboards[1]).toMatchObject({ id: "c2", x: -500, y: 2400 });
  });

  it("moves one axis and keeps the other", () => {
    expect(place(accepted([{ op: "update_artboard", artboard_id: "c3", artboard_y: 300 }]).final, "c3")).toEqual([2360, 300]);
  });

  it("refuses a place out of range and explains that x and y belong to layers", () => {
    expect(refusal([{ op: "update_artboard", artboard_id: "c2", artboard_x: 200_000 }])).toContain("artboard_x");
    expect(refusal([{ op: "update_artboard", artboard_id: "c2", x: 0.5, y: 0.5 }])).toContain("artboard_x e artboard_y");
  });
});

describe("arranging artboards", () => {
  it("lines up a carousel in the order given with no gap so the seams meet", () => {
    const plan = accepted([{ op: "arrange_artboards", artboard_ids: ["c3", "c1", "c2"], arrange_layout: "row", arrange_gap: 0, arrange_order: "given" }]);
    expect([place(plan.final, "c3"), place(plan.final, "c1"), place(plan.final, "c2")]).toEqual([
      [0, 0],
      [1080, 0],
      [2160, 0],
    ]);
    expect(plan.changed).toEqual(["c3", "c1", "c2"]);
    expect(plan.steps).toHaveLength(1);
  });

  it("arranges every artboard when none is named, ordered by name in a column", () => {
    const shuffled = { ...cards(), artboards: [...cards().artboards].reverse() };
    const plan = accepted([{ op: "arrange_artboards", arrange_layout: "column", arrange_order: "name", arrange_gap: 40 }], shuffled);
    expect(place(plan.final, "c1")).toEqual([0, 0]);
    expect(place(plan.final, "c2")).toEqual([0, 1120]);
    expect(place(plan.final, "c3")).toEqual([0, 2240]);
  });

  it("reaches an artboard created earlier in the batch", () => {
    const plan = accepted([
      { op: "add_artboard", ref: "story", width: 1080, height: 1920 },
      { op: "arrange_artboards", artboard_ids: ["c1", "@story"], arrange_layout: "row", arrange_gap: 100, arrange_align: "end", arrange_order: "given" },
    ]);
    const story = plan.created.story[0];
    expect(place(plan.final, "c1")).toEqual([0, 840]);
    expect(place(plan.final, story)).toEqual([1180, 0]);
  });

  it("refuses a request it cannot read instead of guessing", () => {
    expect(refusal([{ op: "arrange_artboards", arrange_gap: 10 }])).toContain("arrange_layout");
    expect(refusal([{ op: "arrange_artboards", artboard_ids: ["c1"], arrange_layout: "row" }])).toContain("pelo menos 2");
    expect(refusal([{ op: "arrange_artboards", artboard_ids: ["c1", "nowhere"], arrange_layout: "row" }])).toContain("não existe");
    expect(refusal([{ op: "arrange_artboards", arrange_layout: "row", arrange_gap: -5 }])).toContain("arrange_gap");
    expect(refusal([{ op: "arrange_artboards", arrange_layout: "grid", arrange_columns: 0 }])).toContain("arrange_columns");
    expect(refusal([{ op: "arrange_artboards", arrange_layout: "diagonal" as never }])).toContain("arrange_layout");
  });

  it("says plainly when the artboards are already in place", () => {
    const tidy = accepted([{ op: "arrange_artboards", arrange_layout: "row", arrange_gap: 100 }]);
    expect(tidy.changed).toEqual([]);
    expect(tidy.notes.join(" ")).toContain("já estavam");
  });
});
