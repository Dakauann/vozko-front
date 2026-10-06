import { describe, expect, it } from "vitest";

import { emptyImageDocument, newIconLayer, newShapeLayer, newTextLayer, type Layer } from "./document";
import { layerCaption, layerRows, rangeBetween, toggleIn } from "./layer-list";

function rect(id: string, groupId?: string): Layer {
  return { ...newShapeLayer("rect"), id, ...(groupId ? { groupId } : {}) };
}

function nested() {
  return {
    ...emptyImageDocument({ width: 100, height: 100 }),
    layers: [rect("a"), rect("b", "inner"), rect("c", "inner"), rect("d", "outer"), rect("e")],
    groups: [{ id: "outer", name: "Topo" }, { id: "inner", parentId: "outer" }],
  };
}

describe("layerRows", () => {
  it("lists layers top first with a header before each group, indented by depth", () => {
    expect(layerRows(nested())).toEqual([
      { kind: "layer", id: "e", index: 4, depth: 0, groupId: null },
      { kind: "group", groupId: "outer", depth: 0, ids: ["d", "c", "b"], name: "Topo" },
      { kind: "layer", id: "d", index: 3, depth: 1, groupId: "outer" },
      { kind: "group", groupId: "inner", depth: 1, ids: ["c", "b"], name: null },
      { kind: "layer", id: "c", index: 2, depth: 2, groupId: "inner" },
      { kind: "layer", id: "b", index: 1, depth: 2, groupId: "inner" },
      { kind: "layer", id: "a", index: 0, depth: 0, groupId: null },
    ]);
  });

  it("hides the contents of collapsed groups but keeps their headers", () => {
    const rows = layerRows(nested(), new Set(["inner"]));
    expect(rows.map((r) => (r.kind === "group" ? `g:${r.groupId}` : r.id))).toEqual(["e", "g:outer", "d", "g:inner", "a"]);
    expect(layerRows(nested(), new Set(["outer"])).map((r) => (r.kind === "group" ? `g:${r.groupId}` : r.id))).toEqual(["e", "g:outer", "a"]);
  });
});

describe("selection helpers", () => {
  const order = ["e", "d", "c", "b", "a"];

  it("selects the range between the anchor and the target in list order", () => {
    expect(rangeBetween(order, "d", "b")).toEqual(["d", "c", "b"]);
    expect(rangeBetween(order, "b", "d")).toEqual(["d", "c", "b"]);
    expect(rangeBetween(order, null, "c")).toEqual(["c"]);
  });

  it("toggles ids in and out", () => {
    expect(toggleIn(["a"], ["b", "c"])).toEqual(["a", "b", "c"]);
    expect(toggleIn(["a", "b", "c"], ["b", "c"])).toEqual(["a"]);
  });
});

describe("layerCaption", () => {
  it("prefers the given name, then a text excerpt, then the kind", () => {
    expect(layerCaption({ ...rect("a"), name: "Fundo" })).toEqual({ name: "Fundo" });
    expect(layerCaption(newTextLayer("  Promoção\nde verão com um título bem longo demais  "))).toEqual({ name: "Promoção de verão com um título…" });
    expect(layerCaption(rect("a"))).toEqual({ kind: "shape.rect" });
    expect(layerCaption(newIconLayer("heart"))).toEqual({ kind: "icon" });
  });
});
