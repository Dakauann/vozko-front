import { freeze } from "immer";
import { describe, expect, it } from "vitest";

import { emptyArtboard, type ImageSurface, type Layer } from "./document";
import { indexOf } from "./layer-index";

function rect(id: string, groupId?: string): Layer {
  return { id, type: "shape", shape: "rect", fill: "#000000", transform: { x: 0.5, y: 0.5, w: 0.1, h: 0.1, rotation: 0, opacity: 1 }, ...(groupId ? { groupId } : {}) };
}

function nested(): ImageSurface {
  return {
    ...emptyArtboard({ width: 1000, height: 1000 }),
    layers: [rect("a"), rect("card", "s"), rect("title", "inner"), rect("b")],
    groups: [{ id: "s", baseId: "card" }, { id: "inner", parentId: "s" }],
  };
}

describe("document index", () => {
  it("answers membership, parents, bases and stacking positions in one pass", () => {
    const index = indexOf(nested());
    expect(index.members.get("s")).toEqual(["card", "title"]);
    expect(index.members.get("inner")).toEqual(["title"]);
    expect(index.parents.get("inner")).toBe("s");
    expect(index.bases.get("s")).toBe("card");
    expect(index.bases.get("inner")).toBeNull();
    expect(index.position.get("title")).toBe(2);
    expect(index.bottom.get("s")).toBe(1);
  });

  it("ignores a base that is not a direct member of its group", () => {
    const doc = nested();
    const index = indexOf({ ...doc, groups: [{ id: "s", baseId: "title" }, { id: "inner", parentId: "s" }] });
    expect(index.bases.get("s")).toBeNull();
  });

  it("reuses the index of a frozen document and rebuilds it for one that can still change", () => {
    const frozen = freeze(nested(), true);
    expect(indexOf(frozen)).toBe(indexOf(frozen));
    const ungrouped = freeze({ ...emptyArtboard({ width: 100, height: 100 }), layers: [rect("a")] }, true);
    expect(indexOf(ungrouped)).toBe(indexOf(ungrouped));
    const draft = nested();
    expect(indexOf(draft).layers.has("c")).toBe(false);
    draft.layers.push(rect("c"));
    expect(indexOf(draft).layers.has("c")).toBe(true);
  });
});
