import { describe, expect, it } from "vitest";

import { clipboardOf } from "./clipboard";
import { emptyArtboard, type ImageSurface, type Layer, type StudioGroup, type Transform } from "./document";
import { childrenSelection, clickSelection, drillSelection, layersInRect, parentSelection } from "./geometry";
import { adoptItem, captureGroup, dropItem, familyOf, layerChain, scaffoldOf } from "./groups";
import {
  alignLayers,
  canUngroup,
  changedTransforms,
  createScaffold,
  deleteLayers,
  duplicateLayers,
  groupLayers,
  leaveFamily,
  pasteLayers,
  reorderLayers,
  setLayersHidden,
  setLayersLocked,
  translateLayers,
  ungroupLayers,
  ungroupTargets,
  updateLayers,
  withGroupMembers,
} from "./layers";
import { dropParent, reparentOnDrop } from "./reparent";
import { surfaceIssue } from "./validate";

function box(x: number, y: number, w = 0.1, h = 0.1, rotation = 0): Transform {
  return { x, y, w, h, rotation, opacity: 1 };
}

function rect(id: string, transform: Transform = box(0.5, 0.5), groupId?: string): Layer {
  return { id, type: "shape", shape: "rect", fill: "#000000", transform, ...(groupId ? { groupId } : {}) };
}

function doc(layers: Layer[], groups?: StudioGroup[]): ImageSurface {
  return { ...emptyArtboard({ width: 1000, height: 1000 }), layers, ...(groups ? { groups } : {}) };
}

function card(): ImageSurface {
  return doc(
    [rect("under", box(0.1, 0.1)), rect("card", box(0.5, 0.5, 0.4, 0.3), "s"), rect("title", box(0.5, 0.45, 0.3, 0.05), "s"), rect("badge", box(0.65, 0.4, 0.05, 0.05), "s"), rect("over", box(0.9, 0.9))],
    [{ id: "s", baseId: "card" }],
  );
}

const order = (d: ImageSurface) => d.layers.map((l) => l.id);
const at = (d: ImageSurface, id: string) => d.layers.find((l) => l.id === id)!;

function close(value: number, expected: number) {
  expect(value).toBeCloseTo(expected, 6);
}

describe("scaffold identity", () => {
  it("knows the scaffold a base stands for and the family that follows it", () => {
    const d = card();
    expect(scaffoldOf(d, "card")).toBe("s");
    expect(scaffoldOf(d, "title")).toBeNull();
    expect(familyOf(d, ["card"])).toEqual(["card", "title", "badge"]);
    expect(familyOf(d, ["title"])).toEqual(["title"]);
    expect(surfaceIssue(d)).toBeNull();
  });

  it("includes nested families", () => {
    const d = doc([rect("card", box(0.5, 0.5), "s"), rect("chip", box(0.5, 0.5), "t"), rect("dot", box(0.5, 0.5), "t")], [{ id: "s", baseId: "card" }, { id: "t", parentId: "s", baseId: "chip" }]);
    expect(familyOf(d, ["card"])).toEqual(["card", "chip", "dot"]);
    expect(familyOf(d, ["chip"])).toEqual(["chip", "dot"]);
  });
});

describe("clicking inside a family", () => {
  it("selects the parent alone, or a child alone, never the whole family", () => {
    const d = card();
    expect(clickSelection(d, [], "card", false)).toEqual(["card"]);
    expect(clickSelection(d, [], "title", false)).toEqual(["title"]);
    expect(withGroupMembers(d, ["badge"])).toEqual(["badge"]);
  });

  it("lets a plain group inside the family capture its own members", () => {
    const d = doc([rect("card", box(0.5, 0.5), "s"), rect("a", box(0.5, 0.5), "g"), rect("b", box(0.5, 0.5), "g"), rect("title", box(0.5, 0.5), "s")], [{ id: "s", baseId: "card" }, { id: "g", parentId: "s" }]);
    expect(captureGroup(d, "a")).toBe("g");
    expect(clickSelection(d, [], "a", false)).toEqual(["a", "b"]);
    expect(clickSelection(d, [], "title", false)).toEqual(["title"]);
  });

  it("lets a plain group around the family capture every click inside it", () => {
    const d = doc(
      [rect("card", box(0.5, 0.5), "s"), rect("a", box(0.5, 0.5), "g"), rect("b", box(0.5, 0.5), "g"), rect("side", box(0.2, 0.2), "outer")],
      [{ id: "outer" }, { id: "s", parentId: "outer", baseId: "card" }, { id: "g", parentId: "s" }],
    );
    expect(captureGroup(d, "card")).toBe("outer");
    expect(captureGroup(d, "a")).toBe("outer");
    expect(clickSelection(d, [], "card", false)).toEqual(["card", "a", "b", "side"]);
  });

  it("drills one level down each time a selected layer is clicked again", () => {
    const d = doc(
      [rect("card", box(0.5, 0.5), "s"), rect("a", box(0.5, 0.5), "g"), rect("b", box(0.5, 0.5), "g"), rect("side", box(0.2, 0.2), "outer")],
      [{ id: "outer" }, { id: "s", parentId: "outer", baseId: "card" }, { id: "g", parentId: "s" }],
    );
    const group = clickSelection(d, [], "a", false);
    expect(drillSelection(d, group, "a")).toEqual(["a", "b"]);
    expect(drillSelection(d, group, "card")).toEqual(["card"]);
    expect(drillSelection(d, ["card"], "card")).toBeNull();
    expect(drillSelection(d, ["a", "b"], "a")).toEqual(["a"]);
    expect(drillSelection(d, ["a"], "a")).toBeNull();
    expect(drillSelection(d, ["a", "side"], "a")).toBeNull();
  });

  it("deep selects the clicked layer with the deep modifier", () => {
    const d = groupLayers(card(), ["under", "over"]).document;
    expect(clickSelection(d, [], "over", false)).toEqual(["under", "over"]);
    expect(clickSelection(d, [], "over", false, true)).toEqual(["over"]);
    expect(clickSelection(d, ["title"], "over", true, true)).toEqual(["title", "over"]);
  });

  it("walks to the children and back to the parent", () => {
    expect(childrenSelection(card(), ["card"])).toEqual(["title", "badge"]);
    expect(childrenSelection(card(), ["title"])).toEqual(["title"]);
    expect(parentSelection(card(), ["badge"])).toEqual(["card"]);
    expect(parentSelection(card(), ["over"])).toEqual(["over"]);
    const grouped = groupLayers(card(), ["title", "badge"]).document;
    expect(parentSelection(grouped, ["title"])).toEqual(["title", "badge"]);
    expect(parentSelection(grouped, ["title", "badge"])).toEqual(["card"]);
  });

  it("marquees children of a family one by one", () => {
    const d = card();
    expect(layersInRect(d, { left: 640, top: 390, right: 660, bottom: 410 })).toEqual(["card", "badge"]);
  });
});

describe("creating a scaffold", () => {
  it("makes the lowest selected element the parent of the others", () => {
    const d = doc([rect("bg", box(0.5, 0.5, 0.5, 0.5)), rect("between"), rect("text"), rect("icon")]);
    const { document, scaffoldId } = createScaffold(d, ["icon", "bg", "text"]);
    expect(scaffoldId).not.toBeNull();
    expect(scaffoldOf(document, "bg")).toBe(scaffoldId);
    expect(order(document)).toEqual(["between", "bg", "text", "icon"]);
    expect(familyOf(document, ["bg"])).toEqual(["bg", "text", "icon"]);
    expect(surfaceIssue(document)).toBeNull();
  });

  it("adds the others to a family that is already the lowest of the selection", () => {
    const { document, scaffoldId } = createScaffold(card(), ["card", "over"]);
    expect(scaffoldId).toBe("s");
    expect(familyOf(document, ["card"])).toEqual(["card", "title", "badge", "over"]);
  });

  it("nests a family under an element below it", () => {
    const { document, scaffoldId } = createScaffold(card(), ["under", "card"]);
    expect(scaffoldOf(document, "under")).toBe(scaffoldId);
    expect(layerChain(document, "title")).toEqual(["s", scaffoldId]);
    expect(surfaceIssue(document)).toBeNull();
  });

  it("refuses a single element and a plain group at the bottom", () => {
    expect(createScaffold(card(), ["over"]).scaffoldId).toBeNull();
    const grouped = groupLayers(doc([rect("a"), rect("b"), rect("c")]), ["a", "b"]).document;
    expect(createScaffold(grouped, ["a", "b", "c"]).document).toBe(grouped);
  });
});

describe("adopting children", () => {
  it("turns any element into a parent when something is dropped into it", () => {
    const d = doc([rect("bg"), rect("text")]);
    const next = adoptItem(d, { kind: "layer", id: "text" }, "bg");
    const scaffold = scaffoldOf(next, "bg");
    expect(scaffold).not.toBeNull();
    expect(at(next, "text").groupId).toBe(scaffold);
    expect(surfaceIssue(next)).toBeNull();
  });

  it("puts a new child on top of the existing children", () => {
    const next = adoptItem(card(), { kind: "layer", id: "under" }, "card");
    expect(order(next)).toEqual(["card", "title", "badge", "under", "over"]);
    expect(at(next, "under").groupId).toBe("s");
  });

  it("refuses to put a family inside one of its own children", () => {
    const d = card();
    expect(adoptItem(d, { kind: "group", id: "s" }, "title")).toBe(d);
    expect(adoptItem(d, { kind: "layer", id: "card" }, "card")).toBe(d);
  });

  it("drops a row into another row to adopt it, and beside a row to leave the family", () => {
    const into = dropItem(card(), { kind: "layer", id: "over" }, { kind: "layer", id: "title" }, "into");
    expect(scaffoldOf(into, "title")).not.toBeNull();
    const out = dropItem(card(), { kind: "layer", id: "badge" }, { kind: "layer", id: "over" }, "above");
    expect(at(out, "badge").groupId).toBeUndefined();
    expect(familyOf(out, ["card"])).toEqual(["card", "title"]);
  });
});

describe("keeping families whole", () => {
  it("releases a family whose parent is left alone or is gone", () => {
    const lonely = deleteLayers(card(), ["title", "badge"]);
    expect(lonely.groups).toBeUndefined();
    expect(at(lonely, "card").groupId).toBeUndefined();
    const orphan = { ...card(), layers: card().layers.filter((l) => l.id !== "card") };
    const repaired = deleteLayers(orphan, ["over"]);
    expect(surfaceIssue(repaired)).toBeNull();
    expect(repaired.layers.map((l) => l.groupId)).toEqual([undefined, undefined, undefined]);
  });

  it("keeps the parent at the bottom of its family", () => {
    const d = reorderLayers(card(), ["title"], "back");
    expect(order(d)).toEqual(["under", "card", "title", "badge", "over"]);
  });

  it("releases a family from its parent with ungroup", () => {
    const d = ungroupLayers(card(), ["card"]);
    expect(d.groups).toBeUndefined();
    expect(order(d)).toEqual(order(card()));
    expect(d.layers.every((l) => l.groupId === undefined)).toBe(true);
  });
});

describe("moving a family", () => {
  it("carries the children when the parent moves, and leaves the parent when a child moves", () => {
    const moved = translateLayers(card(), ["card"], 0.1, -0.1);
    close(at(moved, "card").transform.x, 0.6);
    close(at(moved, "title").transform.x, 0.6);
    close(at(moved, "badge").transform.y, 0.3);
    close(at(moved, "over").transform.x, 0.9);
    const child = translateLayers(card(), ["title"], 0.1, 0);
    close(at(child, "card").transform.x, 0.5);
    close(at(child, "title").transform.x, 0.6);
  });

  it("previews a move as the transforms that changed, children of a moved parent included", () => {
    const before = card();
    const preview = changedTransforms(before, translateLayers(before, ["card"], 0.1, 0));
    expect([...preview.keys()]).toEqual(["card", "title", "badge"]);
    close(preview.get("title")!.x, 0.6);
    expect(changedTransforms(before, before).size).toBe(0);
  });

  it("moves a child selected with its parent only once", () => {
    const moved = translateLayers(card(), ["card", "title"], 0.1, 0);
    close(at(moved, "title").transform.x, 0.6);
  });

  it("carries locked children along with their parent", () => {
    const locked = setLayersLocked(card(), ["badge"], true);
    const moved = translateLayers(locked, ["card"], 0.1, 0);
    close(at(moved, "badge").transform.x, 0.75);
    expect(at(moved, "badge").locked).toBe(true);
  });

  it("does not move a locked parent", () => {
    const locked = setLayersLocked(card(), ["card"], true);
    expect(translateLayers(locked, ["card"], 0.1, 0)).toBe(locked);
  });

  it("turns the children around the parent's center when the parent turns", () => {
    const turned = updateLayers(card(), ["card"], { transform: box(0.5, 0.5, 0.4, 0.3, 90) });
    close(at(turned, "badge").transform.x, 0.6);
    close(at(turned, "badge").transform.y, 0.65);
    close(at(turned, "badge").transform.rotation, 90);
    close(at(turned, "title").transform.rotation, 90);
  });

  it("leaves the children in place when the parent is resized", () => {
    const resized = updateLayers(card(), ["card"], { transform: box(0.55, 0.5, 0.5, 0.3) });
    close(at(resized, "title").transform.x, 0.5);
    close(at(resized, "badge").transform.x, 0.65);
  });

  it("aligns a lone child to its parent, and a parent with its family to the canvas", () => {
    const child = alignLayers(card(), ["title"], "top");
    close(at(child, "title").transform.y, 0.375);
    const parent = alignLayers(card(), ["card"], "left");
    close(at(parent, "card").transform.x, 0.2);
    close(at(parent, "title").transform.x, 0.2);
  });
});

describe("structure follows the parent", () => {
  it("deletes, hides and locks the family with its parent", () => {
    expect(order(deleteLayers(card(), ["card"]))).toEqual(["under", "over"]);
    expect(setLayersHidden(card(), ["card"], true).layers.filter((l) => l.hidden).map((l) => l.id)).toEqual(["card", "title", "badge"]);
    expect(setLayersLocked(card(), ["title"], true).layers.filter((l) => l.locked).map((l) => l.id)).toEqual(["title"]);
  });

  it("duplicates a parent as a new family with fresh ids", () => {
    const { document, ids } = duplicateLayers(card(), ["card"]);
    expect(ids).toHaveLength(3);
    const copy = scaffoldOf(document, ids[0]);
    expect(copy).not.toBeNull();
    expect(copy).not.toBe("s");
    expect(familyOf(document, [ids[0]])).toEqual(ids);
    expect(surfaceIssue(document)).toBeNull();
  });

  it("keeps a duplicated child inside the family", () => {
    const { document, ids } = duplicateLayers(card(), ["title"]);
    expect(at(document, ids[0]).groupId).toBe("s");
  });

  it("copies a parent with its family and pastes a lone child without a dangling parent", () => {
    const content = clipboardOf(card(), ["card"]);
    expect(content.layers.map((l) => l.id)).toEqual(["card", "title", "badge"]);
    const pasted = pasteLayers(doc([]), content.layers, 0, content.groups);
    expect(scaffoldOf(pasted.document, pasted.ids[0])).not.toBeNull();
    const lone = clipboardOf(card(), ["title"]);
    const single = pasteLayers(doc([]), lone.layers, 0, lone.groups);
    expect(single.document.groups).toBeUndefined();
    expect(surfaceIssue(single.document)).toBeNull();
  });

  it("reorders a parent with its whole family, and a child among its siblings", () => {
    expect(order(reorderLayers(card(), ["card"], "forward"))).toEqual(["under", "over", "card", "title", "badge"]);
    expect(order(reorderLayers(card(), ["card"], "back"))).toEqual(["card", "title", "badge", "under", "over"]);
    expect(order(reorderLayers(card(), ["badge"], "back"))).toEqual(["under", "card", "badge", "title", "over"]);
    expect(order(reorderLayers(card(), ["title"], "front"))).toEqual(["under", "card", "badge", "title", "over"]);
  });
});

describe("leaving a family", () => {
  it("takes a lone child out of its family with ungroup, keeping it above the family", () => {
    const d = ungroupLayers(card(), ["badge"]);
    expect(at(d, "badge").groupId).toBeUndefined();
    expect(order(d)).toEqual(["under", "card", "title", "badge", "over"]);
    expect(familyOf(d, ["card"])).toEqual(["card", "title"]);
    expect(ungroupTargets(card(), ["badge"])).toEqual([]);
    expect(canUngroup(card(), ["badge"])).toBe(true);
    expect(canUngroup(card(), ["over"])).toBe(false);
  });

  it("moves a child out to the container of its family", () => {
    const d = doc([rect("card", box(0.5, 0.5), "s"), rect("title", box(0.5, 0.5), "s"), rect("side", box(0.2, 0.2), "g"), rect("other", box(0.2, 0.2), "g")], [{ id: "g" }, { id: "s", parentId: "g", baseId: "card" }]);
    const out = leaveFamily(d, ["title"]);
    expect(at(out, "title").groupId).toBe("g");
    expect(surfaceIssue(out)).toBeNull();
  });
});

describe("dropping on the canvas", () => {
  it("adopts a smaller element dropped onto an existing parent", () => {
    const d = translateLayers(card(), ["over"], -0.35, -0.35);
    const next = reparentOnDrop(d, ["over"], { x: 550, y: 550 });
    expect(at(next, "over").groupId).toBe("s");
    expect(order(next)).toEqual(["under", "card", "title", "badge", "over"]);
  });

  it("lets a child leave when it is dropped outside its parent", () => {
    const d = translateLayers(card(), ["badge"], 0.3, 0.3);
    const next = reparentOnDrop(d, ["badge"], { x: 950, y: 700 });
    expect(at(next, "badge").groupId).toBeUndefined();
    expect(familyOf(next, ["card"])).toEqual(["card", "title"]);
  });

  it("keeps the family when the child stays over its parent, and never adopts into plain elements", () => {
    const d = card();
    expect(reparentOnDrop(d, ["badge"], { x: 650, y: 400 })).toBe(d);
    expect(reparentOnDrop(d, ["under"], { x: 900, y: 900 })).toBe(d);
  });

  it("refuses elements bigger than the parent, locked parents and its own family", () => {
    const big = updateLayers(card(), ["over"], { transform: box(0.5, 0.5, 0.9, 0.9) });
    expect(reparentOnDrop(big, ["over"], { x: 500, y: 500 })).toBe(big);
    const locked = setLayersLocked(translateLayers(card(), ["over"], -0.35, -0.35), ["card"], true);
    expect(at(reparentOnDrop(locked, ["over"], { x: 550, y: 550 }), "over").groupId).toBeUndefined();
    const own = card();
    expect(reparentOnDrop(own, ["card"], { x: 500, y: 500 })).toBe(own);
  });

  it("names the parent a drop would land in", () => {
    const d = translateLayers(card(), ["over"], -0.35, -0.35);
    expect(dropParent(d, ["over"], { x: 550, y: 550 })).toBe("card");
    expect(dropParent(d, ["over"], { x: 50, y: 950 })).toBeNull();
  });
});
