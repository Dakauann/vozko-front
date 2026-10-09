import { describe, expect, it } from "vitest";

import {
  activeArtboard,
  addArtboard,
  artboardNames,
  artboardOfItem,
  layerOf,
  selectedArtboards,
  ARTBOARD_GAP,
  artboardAt,
  artboardOfLayer,
  artboardsBounds,
  deleteArtboards,
  duplicateArtboard,
  editArtboard,
  FIRST_ARTBOARD_ID,
  moveLayersToArtboard,
  neighborArtboard,
  updateArtboard,
  upgradeImageDocument,
} from "./artboards";
import { emptyArtboard, IMAGE_DOCUMENT_VERSION, IMAGE_SCHEMA, type Artboard, type ImageDocument, type Layer } from "./document";
import { translateLayers } from "./layers";
import { documentIssue } from "./validate";

function rect(id: string, x = 0.5, y = 0.5, groupId?: string): Layer {
  return { id, type: "shape", shape: "rect", fill: "#000000", transform: { x, y, w: 0.2, h: 0.2, rotation: 0, opacity: 1 }, ...(groupId ? { groupId } : {}) };
}

function board(id: string, x: number, y: number, layers: Layer[], width = 1000, height = 1000): Artboard {
  return { ...emptyArtboard({ width, height }), id, x, y, layers };
}

function doc(...artboards: Artboard[]): ImageDocument {
  return { schema: IMAGE_SCHEMA, version: IMAGE_DOCUMENT_VERSION, artboards };
}

const ids = (d: ImageDocument) => d.artboards.map((a) => a.id);

describe("upgrading a single canvas project", () => {
  it("turns the old canvas into the first artboard at the origin, keeping layers and groups", () => {
    const upgraded = upgradeImageDocument({ schema: IMAGE_SCHEMA, version: 1, canvas: { width: 1080, height: 1350, background: "#ffffff" }, layers: [rect("a", 0.5, 0.5, "g")], groups: [{ id: "g", name: "Título" }] });
    expect(upgraded.version).toBe(IMAGE_DOCUMENT_VERSION);
    expect(upgraded.artboards).toEqual([{ id: FIRST_ARTBOARD_ID, x: 0, y: 0, canvas: { width: 1080, height: 1350, background: "#ffffff" }, layers: [rect("a", 0.5, 0.5, "g")], groups: [{ id: "g", name: "Título" }] }]);
    expect(documentIssue("image", upgraded)).toBeNull();
  });
});

describe("finding artboards", () => {
  const d = doc(board("one", 0, 0, [rect("a")]), board("two", 1100, 0, [rect("b")]));

  it("finds the artboard that holds a layer", () => {
    expect(artboardOfLayer(d, "b")?.id).toBe("two");
    expect(artboardOfLayer(d, "missing")).toBeUndefined();
    expect(layerOf(d, "b")?.id).toBe("b");
    expect(layerOf(d, "missing")).toBeUndefined();
  });

  it("finds the artboard of a layer, a group or the artboard itself, and the artboards in a selection", () => {
    const grouped = doc(board("one", 0, 0, [rect("a", 0.5, 0.5, "g")]), board("two", 1100, 0, [rect("b")]));
    grouped.artboards[0].groups = [{ id: "g" }];
    expect(artboardOfItem(grouped, "g")?.id).toBe("one");
    expect(artboardOfItem(grouped, "two")?.id).toBe("two");
    expect(artboardOfItem(grouped, "b")?.id).toBe("two");
    expect(selectedArtboards(grouped, ["two", "a"]).map((a) => a.id)).toEqual(["two"]);
  });

  it("names unnamed artboards by their place in the project", () => {
    const named = doc(board("one", 0, 0, []), { ...board("two", 1100, 0, []), name: "Story" }, board("three", 2200, 0, []));
    expect([...artboardNames(named.artboards, (n) => `Prancheta ${n}`).values()]).toEqual(["Prancheta 1", "Story", "Prancheta 3"]);
  });

  it("falls back to the first artboard when the preferred one is gone", () => {
    expect(activeArtboard(d, "two").id).toBe("two");
    expect(activeArtboard(d, "gone").id).toBe("one");
    expect(activeArtboard(d, null).id).toBe("one");
  });

  it("knows which artboard is under a point of the board and the bounds of all of them", () => {
    expect(artboardAt(d, { x: 1500, y: 500 })?.id).toBe("two");
    expect(artboardAt(d, { x: 1050, y: 500 })).toBeUndefined();
    expect(artboardsBounds(d)).toEqual({ left: 0, top: 0, right: 2100, bottom: 1000 });
  });

  it("steps to the next artboard left to right, then top to bottom, wrapping around", () => {
    const grid = doc(board("b", 1100, 0, []), board("c", 0, 1100, []), board("a", 0, 0, []));
    expect(neighborArtboard(grid, "a", 1).id).toBe("b");
    expect(neighborArtboard(grid, "b", 1).id).toBe("c");
    expect(neighborArtboard(grid, "c", 1).id).toBe("a");
    expect(neighborArtboard(grid, "a", -1).id).toBe("c");
  });
});

describe("editing one artboard", () => {
  it("runs a layer operation on one artboard and leaves the others untouched", () => {
    const d = doc(board("one", 0, 0, [rect("a")]), board("two", 1100, 0, [rect("b")]));
    const moved = editArtboard(d, "two", (s) => translateLayers(s, ["b"], 0.1, 0));
    expect(moved.artboards[1].layers[0].transform.x).toBeCloseTo(0.6);
    expect(moved.artboards[0]).toBe(d.artboards[0]);
    expect(moved.artboards[1].id).toBe("two");
  });

  it("returns the same document when nothing changed or the artboard does not exist", () => {
    const d = doc(board("one", 0, 0, [rect("a")]));
    expect(editArtboard(d, "one", (s) => s)).toBe(d);
    expect(editArtboard(d, "gone", (s) => translateLayers(s, ["a"], 0.1, 0))).toBe(d);
  });
});

describe("adding and duplicating artboards", () => {
  it("places a new artboard to the right of the rightmost one on the same row, with the gap", () => {
    const d = doc(board("one", 0, 0, []), board("two", 1100, 0, [], 500, 500));
    const added = addArtboard(d, { width: 1080, height: 1920 }, { after: "one", name: "Story" });
    const created = added.document.artboards.find((a) => a.id === added.id)!;
    expect(created).toMatchObject({ x: 1600 + ARTBOARD_GAP, y: 0, name: "Story", canvas: { width: 1080, height: 1920, background: "#ffffff" }, layers: [] });
    expect(documentIssue("image", added.document)).toBeNull();
  });

  it("copies an artboard to its right with fresh ids for every layer and group, and says which copy is which", () => {
    const d = doc(board("one", 0, 0, [rect("base", 0.5, 0.5, "s"), rect("title", 0.5, 0.4, "s"), { ...rect("bg"), locked: true }]));
    d.artboards[0].groups = [{ id: "s", baseId: "base", name: "Cartão" }];
    const copy = duplicateArtboard(d, "one", { name: "Versão 2" });
    const created = copy.document.artboards[1];
    expect(created).toMatchObject({ id: copy.id, x: 1000 + ARTBOARD_GAP, y: 0, name: "Versão 2" });
    expect(Object.keys(copy.copies)).toEqual(["base", "title", "bg"]);
    expect(created.layers.map((l) => l.id)).toEqual(Object.values(copy.copies));
    expect(created.layers[2].locked).toBe(true);
    expect(created.groups?.[0]).toMatchObject({ baseId: copy.copies.base, name: "Cartão" });
    expect(created.groups?.[0].id).not.toBe("s");
    expect(documentIssue("image", copy.document)).toBeNull();
  });

  it("duplicates into another size by adapting the layout instead of stretching it", () => {
    const d = doc(board("one", 0, 0, [rect("logo", 0.5, 0.5)], 1000, 1000));
    const wide = duplicateArtboard(d, "one", { size: { width: 2000, height: 1000 } });
    const created = wide.document.artboards[1];
    expect(created.canvas).toMatchObject({ width: 2000, height: 1000 });
    expect(created.layers[0].transform.w * 2000).toBeCloseTo(d.artboards[0].layers[0].transform.w * 1000);
  });

  it("refuses to copy an artboard that does not exist", () => {
    const d = doc(board("one", 0, 0, []));
    expect(duplicateArtboard(d, "gone", {}).document).toBe(d);
  });
});

describe("changing and removing artboards", () => {
  it("renames and moves an artboard, trimming the name and dropping an empty one", () => {
    const d = doc(board("one", 0, 0, []));
    expect(updateArtboard(d, "one", { name: "  Feed  ", x: 40, y: -20 }).artboards[0]).toMatchObject({ name: "Feed", x: 40, y: -20 });
    expect(updateArtboard(d, "one", { name: "   " }).artboards[0].name).toBeUndefined();
  });

  it("deletes artboards but always keeps one", () => {
    const d = doc(board("one", 0, 0, []), board("two", 1100, 0, []));
    expect(ids(deleteArtboards(d, ["two"]))).toEqual(["one"]);
    expect(deleteArtboards(d, ["one", "two"])).toBe(d);
  });
});

describe("moving layers between artboards", () => {
  it("keeps the place on screen when dropped by hand, and the pixel size", () => {
    const d = doc(board("one", 0, 0, [rect("a", 0.9, 0.5)]), board("two", 1000, 0, [], 500, 1000));
    const moved = moveLayersToArtboard(d, ["a"], "two", "keep-place");
    const layer = moved.artboards[1].layers[0];
    expect(moved.artboards[0].layers).toEqual([]);
    expect(layer.id).toBe("a");
    expect(layer.transform.x * 500 + 1000).toBeCloseTo(900);
    expect(layer.transform.w * 500).toBeCloseTo(200);
  });

  it("keeps the relative place when moved by name, scaling the font to keep its pixel size", () => {
    const text: Layer = { id: "t", type: "text", text: "Oi", fontSize: 0.05, transform: { x: 0.25, y: 0.5, w: 0.4, h: 0.1, rotation: 0, opacity: 1 } };
    const d = doc(board("one", 0, 0, [text]), board("two", 1100, 0, [], 1000, 2000));
    const layer = moveLayersToArtboard(d, ["t"], "two", "keep-relative").artboards[1].layers[0];
    expect(layer.transform.x).toBeCloseTo(0.25);
    expect(layer.fontSize! * 2000).toBeCloseTo(50);
  });

  it("carries a group only when all of it moves, and keeps ids unique", () => {
    const d = doc(board("one", 0, 0, [rect("a", 0.5, 0.5, "g"), rect("b", 0.5, 0.5, "g"), rect("c", 0.5, 0.5, "h"), rect("d", 0.5, 0.5, "h")]), board("two", 1100, 0, []));
    d.artboards[0].groups = [{ id: "g" }, { id: "h" }];
    const moved = moveLayersToArtboard(d, ["a", "b", "c"], "two", "keep-relative");
    expect(moved.artboards[1].layers.map((l) => [l.id, l.groupId])).toEqual([["a", "g"], ["b", "g"], ["c", undefined]]);
    expect(moved.artboards[1].groups).toEqual([{ id: "g" }]);
    expect(documentIssue("image", moved)).toBeNull();
  });

  it("does nothing for layers already on the target, locked layers or a missing artboard", () => {
    const d = doc(board("one", 0, 0, [rect("a"), { ...rect("l"), locked: true }]), board("two", 1100, 0, []));
    expect(moveLayersToArtboard(d, ["a"], "one", "keep-place")).toBe(d);
    expect(moveLayersToArtboard(d, ["l"], "two", "keep-place")).toBe(d);
    expect(moveLayersToArtboard(d, ["a"], "gone", "keep-place")).toBe(d);
  });
});

describe("artboard order", () => {
  it("lists new and duplicated artboards last, matching their place at the end of the row", () => {
    const d = doc(board("one", 0, 0, []), board("two", 1100, 0, []));
    const copy = duplicateArtboard(d, "one", {});
    expect(ids(copy.document)).toEqual(["one", "two", copy.id]);
    expect(copy.document.artboards[2].x).toBe(2100 + ARTBOARD_GAP);
    const added = addArtboard(copy.document, { width: 500, height: 500 }, { after: "one" });
    expect(ids(added.document).at(-1)).toBe(added.id);
  });
});

describe("dropping layers far away", () => {
  it("places a layer dropped on a distant artboard where it was let go, beyond the source's own range", () => {
    const d = doc(board("one", 0, 0, [rect("a", 0.5, 0.5)]), board("far", 5000, 0, []));
    const moved = moveLayersToArtboard(d, ["a"], "far", "keep-place", { x: 5000, y: 0 });
    const layer = moved.artboards[1].layers[0];
    expect(layer.transform.x).toBeCloseTo(0.5);
    expect(layer.transform.y).toBeCloseTo(0.5);
  });
});
