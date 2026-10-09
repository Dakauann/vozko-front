import { describe, expect, it } from "vitest";

import { emptyArtboard, newShapeLayer, type ImageSurface, type Layer, type StudioGroup } from "./document";
import {
  captureGroup,
  dissolveGroup,
  dropPlacement,
  groupLayerIds,
  layerChain,
  moveItem,
  nestGroup,
  renameGroup,
} from "./groups";
import { duplicateLayers, groupLayers, pasteLayers, ungroupLayers, withGroupMembers } from "./layers";
import { surfaceIssue } from "./validate";

function rect(id: string, groupId?: string): Layer {
  return { ...newShapeLayer("rect"), id, ...(groupId ? { groupId } : {}) };
}

function doc(layers: Layer[], groups?: StudioGroup[]): ImageSurface {
  return { ...emptyArtboard({ width: 1000, height: 1000 }), layers, ...(groups ? { groups } : {}) };
}

const ids = (d: ImageSurface) => d.layers.map((l) => l.id);

function nested(): ImageSurface {
  return doc([rect("a"), rect("b", "inner"), rect("c", "inner"), rect("d", "outer"), rect("e")], [{ id: "outer" }, { id: "inner", parentId: "outer" }]);
}

describe("group tree", () => {
  it("walks a layer's chain from the innermost group out", () => {
    const d = nested();
    expect(layerChain(d, "b")).toEqual(["inner", "outer"]);
    expect(layerChain(d, "a")).toEqual([]);
    expect(captureGroup(d, "c")).toBe("outer");
    expect(groupLayerIds(d, "outer")).toEqual(["b", "c", "d"]);
    expect(groupLayerIds(d, "inner")).toEqual(["b", "c"]);
  });

  it("treats a group known only from its layers as a top level group", () => {
    const d = doc([rect("a", "g"), rect("b", "g")]);
    expect(layerChain(d, "a")).toEqual(["g"]);
    expect(withGroupMembers(d, ["a"])).toEqual(["a", "b"]);
  });

  it("selects the whole outermost group from any member", () => {
    expect(withGroupMembers(nested(), ["b"])).toEqual(["b", "c", "d"]);
  });
});

describe("grouping", () => {
  it("wraps top level items, nesting existing groups under the new one", () => {
    const { document, groupId } = groupLayers(nested(), ["b", "e"]);
    expect(groupId).not.toBeNull();
    expect(document.groups?.find((g) => g.id === "outer")?.parentId).toBe(groupId);
    expect(document.layers.find((l) => l.id === "e")?.groupId).toBe(groupId);
    expect(layerChain(document, "b")).toEqual(["inner", "outer", groupId]);
    expect(surfaceIssue(document)).toBeNull();
  });

  it("makes a subgroup when the layers share a group", () => {
    const d = nested();
    d.layers.splice(4, 0, rect("f", "outer"));
    const { document, groupId } = groupLayers(d, ["c", "d"]);
    expect(document.groups?.find((g) => g.id === groupId)?.parentId).toBe("outer");
    expect(layerChain(document, "d")).toEqual([groupId, "outer"]);
    expect(layerChain(document, "b")).toEqual(["inner", groupId, "outer"]);
    expect(layerChain(document, "f")).toEqual(["outer"]);
  });

  it("dissolves a parent left holding only the new group", () => {
    const { document, groupId } = groupLayers(nested(), ["c", "d"]);
    expect(layerChain(document, "d")).toEqual([groupId]);
  });

  it("does nothing when the selection already is one whole group", () => {
    const d = nested();
    const { document, groupId } = groupLayers(d, ["b", "c", "d"]);
    expect(groupId).toBeNull();
    expect(document).toBe(d);
  });

  it("keeps the members of the new group next to each other", () => {
    const d = doc([rect("a"), rect("b"), rect("c"), rect("d")]);
    expect(ids(groupLayers(d, ["a", "c"]).document)).toEqual(["b", "a", "c", "d"]);
  });

  it("ungroups the outermost group and moves its children up a level", () => {
    const d = ungroupLayers(nested(), ["d"]);
    expect(d.groups).toEqual([{ id: "inner" }]);
    expect(d.layers.find((l) => l.id === "d")?.groupId).toBeUndefined();
    expect(layerChain(d, "b")).toEqual(["inner"]);
  });

  it("dissolves a chosen inner group", () => {
    const d = dissolveGroup(nested(), "inner");
    expect(layerChain(d, "b")).toEqual(["outer"]);
    expect(d.groups).toEqual([{ id: "outer" }]);
  });

  it("drops groups left with a single child, keeping their child in the parent", () => {
    const d = dissolveGroup(doc([rect("a", "inner"), rect("b", "outer"), rect("c", "outer")], [{ id: "outer" }, { id: "inner", parentId: "outer" }]), "outer");
    expect(d.groups).toBeUndefined();
    expect(d.layers.every((l) => l.groupId === undefined)).toBe(true);
  });

  it("renames a group, materializing an implicit one", () => {
    const d = renameGroup(doc([rect("a", "g"), rect("b", "g")]), "g", "  Topo  ");
    expect(d.groups).toEqual([{ id: "g", name: "Topo" }]);
    expect(renameGroup(d, "g", "").groups).toEqual([{ id: "g" }]);
  });
});

describe("moving items between groups", () => {
  it("moves a layer into a group above an anchor", () => {
    const d = moveItem(nested(), { kind: "layer", id: "e" }, 2, "inner");
    expect(ids(d)).toEqual(["a", "b", "e", "c", "d"]);
    expect(layerChain(d, "e")).toEqual(["inner", "outer"]);
  });

  it("moves a layer out of its group to the top level", () => {
    const d = moveItem(nested(), { kind: "layer", id: "d" }, 4, null);
    expect(ids(d)).toEqual(["a", "b", "c", "e", "d"]);
    expect(layerChain(d, "d")).toEqual([]);
    expect(d.groups).toEqual([{ id: "inner" }]);
  });

  it("moves a whole group as one block and reparents it", () => {
    const d = moveItem(nested(), { kind: "group", id: "inner" }, 0, null);
    expect(ids(d)).toEqual(["b", "c", "a", "d", "e"]);
    expect(layerChain(d, "b")).toEqual(["inner"]);
  });

  it("refuses to move a group into itself", () => {
    const d = nested();
    expect(moveItem(d, { kind: "group", id: "outer" }, 0, "inner")).toBe(d);
  });

  it("nests one group under another", () => {
    const d = nestGroup(doc([rect("a", "g"), rect("b", "g"), rect("c", "h"), rect("d", "h")]), "g", "h");
    expect(layerChain(d, "a")).toEqual(["g", "h"]);
  });
});

describe("dropPlacement", () => {
  const d = nested();

  it("drops above or below a layer row inside that layer's group", () => {
    expect(dropPlacement(d, { kind: "layer", id: "e" }, { kind: "layer", id: "b" }, "above")).toEqual({ toIndex: 2, parent: "inner" });
    expect(dropPlacement(d, { kind: "layer", id: "e" }, { kind: "layer", id: "b" }, "below")).toEqual({ toIndex: 1, parent: "inner" });
    expect(dropPlacement(d, { kind: "layer", id: "a" }, { kind: "layer", id: "e" }, "above")).toEqual({ toIndex: 4, parent: null });
  });

  it("drops onto a group header as its top child, or above it in its parent", () => {
    expect(dropPlacement(d, { kind: "layer", id: "e" }, { kind: "group", id: "inner" }, "into")).toEqual({ toIndex: 3, parent: "inner" });
    expect(dropPlacement(d, { kind: "layer", id: "a" }, { kind: "group", id: "outer" }, "above")).toEqual({ toIndex: 3, parent: null });
  });
});

describe("copies keep their groups", () => {
  it("duplicates a whole nested group under new group ids", () => {
    const { document, ids: copies } = duplicateLayers(nested(), ["b", "c", "d"]);
    expect(copies).toHaveLength(3);
    const [b] = copies;
    const chain = layerChain(document, b);
    expect(chain).toHaveLength(2);
    expect(chain).not.toContain("inner");
    expect(surfaceIssue(document)).toBeNull();
  });

  it("keeps a duplicated child inside the group it came from", () => {
    const { document, ids: copies } = duplicateLayers(nested(), ["c"]);
    expect(layerChain(document, copies[0])).toEqual(["inner", "outer"]);
  });

  it("pastes into another document without dangling group ids", () => {
    const source = nested();
    const { document } = pasteLayers(doc([rect("x")]), source.layers.slice(1, 4), 0, source.groups);
    expect(surfaceIssue(document)).toBeNull();
    const pasted = document.layers.slice(1);
    expect(new Set(pasted.map((l) => layerChain(document, l.id).length))).toEqual(new Set([2, 1]));
  });
});
