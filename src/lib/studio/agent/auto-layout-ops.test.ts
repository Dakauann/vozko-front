import { describe, expect, it } from "vitest";

import { emptyArtboard, IMAGE_DOCUMENT_VERSION, IMAGE_SCHEMA, type Artboard, type ImageDocument, type Layer } from "../document";
import { documentIssue } from "../validate";
import { planBatch } from "./batch";
import { applyImageOperation, IMAGE_ID_FIELDS, imageIds, type ImageOpContext, type ImageOperation } from "./image-ops";
import { imageOutline } from "./outline";

function px(x: number, y: number, w: number, h: number) {
  return { x: x / 1000, y: y / 1000, w: w / 1000, h: h / 1000, rotation: 0, opacity: 1 };
}

function doc(): ImageDocument {
  const board: Artboard = {
    ...emptyArtboard({ width: 1000, height: 1000 }),
    id: "board",
    layers: [
      { id: "pill", type: "shape", shape: "rect", fill: "#e4003a", transform: px(500, 500, 300, 80) },
      { id: "label", type: "text", text: "Compre agora", fontId: "inter", fontSize: 0.03, fill: "#ffffff", transform: px(480, 500, 200, 40) },
      { id: "arrow", type: "icon", iconId: "star", fill: "#ffffff", transform: px(610, 500, 30, 30) },
    ],
  };
  return { schema: IMAGE_SCHEMA, version: IMAGE_DOCUMENT_VERSION, artboards: [board] };
}

const ctx: ImageOpContext = { naturalSize: () => undefined, icons: ["star"], activeArtboard: "board", measure: (layer, width) => (layer.id === "label" ? { width: width ?? 180, height: 36 } : null) };

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
  return d.artboards[0].layers.find((l) => l.id === id)!;
}

function widthPx(d: ImageDocument, id: string): number {
  return Math.round(layer(d, id).transform.w * 1000);
}

describe("auto layout operations", () => {
  it("turn a button into a hugging row that grows with its label", () => {
    const plan = done([
      { op: "set_layout", ref: "cta", layer_ids: ["pill", "label", "arrow"], layout_direction: "horizontal", layout_gap: 16, layout_padding: [20, 40], layout_align_cross: "center", layout_width: "hug", layout_height: "hug" },
      { op: "set_layout_item", layer_id: "label", item_width: "hug", item_height: "hug" },
    ]);
    expect(widthPx(plan.final, "pill")).toBe(40 + 180 + 16 + 30 + 40);
    const longer = done([{ op: "update_layer", layer_id: "label", text: "Compre agora mesmo" }], plan.final);
    expect(widthPx(longer.final, "pill")).toBe(40 + 180 + 16 + 30 + 40);
    const group = plan.final.artboards[0].groups![0];
    expect(group).toMatchObject({ baseId: "pill", layout: { direction: "horizontal", gap: 16, padding: { top: 20, right: 40, bottom: 20, left: 40 }, alignCross: "center" } });
  });

  it("reorders a child moved along the flow and removes the layout keeping positions", () => {
    const made = done([{ op: "set_layout", ref: "cta", layer_ids: ["pill", "label", "arrow"], layout_direction: "horizontal", layout_gap: 10, layout_width: "hug", layout_height: "hug" }]);
    const moved = done([{ op: "update_layer", layer_id: "arrow", x: 0.1 }], made.final);
    expect(moved.final.artboards[0].layers.map((l) => l.id)).toEqual(["pill", "arrow", "label"]);
    const groupId = made.created.cta[0];
    const removed = done([{ op: "remove_layout", group_id: groupId }], moved.final);
    expect(removed.final.artboards[0].groups?.[0].layout).toBeUndefined();
    expect(layer(removed.final, "label").transform).toEqual(layer(moved.final, "label").transform);
  });

  it("explain what cannot be laid out", () => {
    const made = done([{ op: "set_layout", ref: "cta", layer_ids: ["pill", "label", "arrow"], layout_direction: "horizontal", layout_width: "hug", layout_height: "hug" }]);
    expect(reason([{ op: "set_layout_item", layer_id: "arrow", item_width: "hug" }], made.final)).toContain("hug só em textos");
    expect(reason([{ op: "set_layout_item", layer_id: "pill", item_width: "fill" }], made.final)).toContain("base");
    expect(reason([{ op: "set_layout", group_id: made.created.cta[0], layout_gap: 9000 }], made.final)).toContain("longe demais");
    expect(reason([{ op: "set_layout", group_id: made.created.cta[0], layout_padding: [1, 2, 3] }], made.final)).toContain("layout_padding");
    expect(reason([{ op: "set_layout", group_id: made.created.cta[0], layout_auto_gap: true, layout_gap: 4 }], made.final)).toContain("layout_auto_gap");
    expect(reason([{ op: "update_layer", layer_id: "pill", rotation: 20 }], made.final)).toContain("layout automático");
  });

  it("note when filling switches the group to a fixed size", () => {
    const made = done([{ op: "set_layout", ref: "cta", layer_ids: ["pill", "label", "arrow"], layout_direction: "horizontal", layout_width: "hug", layout_height: "hug" }]);
    const filled = done([{ op: "set_layout_item", layer_id: "label", item_width: "fill" }], made.final);
    expect(filled.notes.join(" ")).toContain("tamanho fixo em width");
  });

  it("show layouts and items in the outline", () => {
    const plan = done([
      { op: "set_layout", ref: "cta", layer_ids: ["pill", "label", "arrow"], layout_direction: "horizontal", layout_auto_gap: true, layout_width: "fixed", layout_height: "hug" },
      { op: "set_layout_item", layer_id: "arrow", item_absolute: true },
    ]);
    const outline = imageOutline(plan.final, { detail: "summary", asset: () => undefined, playheadMs: 0, selection: [], jobs: [], activeArtboard: "board" });
    expect(outline.artboards[0].groups[0].layout).toMatchObject({ direction: "horizontal", gap: "auto", width: "fixed", height: "hug" });
    expect(outline.artboards[0].layers.find((l) => l.id === "arrow")?.item).toEqual({ absolute: true });
  });
});
