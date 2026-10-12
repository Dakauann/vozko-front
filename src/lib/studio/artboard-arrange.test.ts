import { describe, expect, it } from "vitest";

import { arrangeArtboards, arrangeIssue, arrangeTargets, tidyArrangement } from "./artboard-arrange";
import { IMAGE_DOCUMENT_VERSION, IMAGE_SCHEMA, type Artboard, type ImageDocument } from "./document";
import { createStudioStore } from "./store";
import { documentIssue } from "./validate";

function board(id: string, x: number, y: number, width = 1080, height = 1080, name?: string): Artboard {
  return { id, ...(name ? { name } : {}), x, y, canvas: { width, height, background: "#ffffff" }, layers: [] };
}

function project(...artboards: Artboard[]): ImageDocument {
  return { schema: IMAGE_SCHEMA, version: IMAGE_DOCUMENT_VERSION, artboards };
}

function places(doc: ImageDocument): Record<string, [number, number]> {
  return Object.fromEntries(doc.artboards.map((a) => [a.id, [a.x, a.y]]));
}

const ALL = ["a", "b", "c"];

describe("arranging artboards", () => {
  it("lays scattered artboards in a row with an even gap from the top left of where they were", () => {
    const doc = project(board("a", 500, 900), board("b", 3000, 40), board("c", 1800, 2000));
    const next = arrangeArtboards(doc, ALL, { layout: "row", gap: 50 });
    expect(places(next)).toEqual({ a: [500, 40], c: [1630, 40], b: [2760, 40] });
    expect(documentIssue("image", next)).toBeNull();
  });

  it("stacks artboards in a column ordered by their height on the canvas", () => {
    const doc = project(board("a", 0, 3000), board("b", 900, 0), board("c", 0, 1500));
    expect(places(arrangeArtboards(doc, ALL, { layout: "column", gap: 0 }))).toEqual({ b: [0, 0], c: [0, 1080], a: [0, 2160] });
  });

  it("fills a grid row by row, with the column count asked or a square by default", () => {
    const four = project(board("a", 0, 0), board("b", 2000, 0), board("c", 0, 2000), board("d", 2000, 2000));
    const square = arrangeArtboards(four, ["a", "b", "c", "d"], { layout: "grid", gap: 100 });
    expect(places(square)).toEqual({ a: [0, 0], b: [1180, 0], c: [0, 1180], d: [1180, 1180] });
    const strip = arrangeArtboards(four, ["a", "b", "c", "d"], { layout: "grid", gap: 100, columns: 3 });
    expect(places(strip)).toEqual({ a: [0, 0], b: [1180, 0], c: [2360, 0], d: [0, 1180] });
  });

  it("reads a loose grid in reading order even when a row is a little uneven", () => {
    const doc = project(board("c", 0, 1300), board("b", 1300, 20), board("a", 0, 0), board("d", 1310, 1290));
    const next = arrangeArtboards(doc, ["a", "b", "c", "d"], { layout: "grid", gap: 0, columns: 2 });
    expect(places(next)).toEqual({ a: [0, 0], b: [1080, 0], c: [0, 1080], d: [1080, 1080] });
  });

  it("orders by name with numbers in human order, or exactly in the order given", () => {
    const doc = project(board("x", 0, 0, 100, 100, "Cartão 10"), board("y", 400, 0, 100, 100, "Cartão 2"), board("z", 800, 0, 100, 100, "Cartão 1"));
    expect(places(arrangeArtboards(doc, ["x", "y", "z"], { layout: "row", gap: 0, order: "name" }))).toEqual({ z: [0, 0], y: [100, 0], x: [200, 0] });
    expect(places(arrangeArtboards(doc, ["y", "x", "z"], { layout: "row", gap: 10, order: "given" }))).toEqual({ y: [0, 0], x: [110, 0], z: [220, 0] });
  });

  it("aligns mixed sizes in a row to the top, the center or the bottom", () => {
    const doc = project(board("feed", 0, 0, 1080, 1080), board("story", 2000, 0, 1080, 1920));
    const ids = ["feed", "story"];
    expect(places(arrangeArtboards(doc, ids, { layout: "row", gap: 100, align: "start" })).feed).toEqual([0, 0]);
    expect(places(arrangeArtboards(doc, ids, { layout: "row", gap: 100, align: "center" })).feed).toEqual([0, 420]);
    expect(places(arrangeArtboards(doc, ids, { layout: "row", gap: 100, align: "end" })).feed).toEqual([0, 840]);
  });

  it("aligns a column of mixed widths to the left, the center or the right", () => {
    const doc = project(board("wide", 0, 0, 1920, 1080), board("square", 0, 2000, 1080, 1080));
    expect(places(arrangeArtboards(doc, ["wide", "square"], { layout: "column", gap: 0, align: "center" })).square).toEqual([420, 1080]);
    expect(places(arrangeArtboards(doc, ["wide", "square"], { layout: "column", gap: 0, align: "end" })).square).toEqual([840, 1080]);
  });

  it("sizes each grid column and row by its largest artboard", () => {
    const doc = project(board("a", 0, 0, 1080, 1920), board("b", 2000, 0, 1080, 1080), board("c", 0, 3000, 1920, 1080));
    const next = arrangeArtboards(doc, ["a", "b", "c"], { layout: "grid", gap: 100, columns: 2 });
    expect(places(next)).toEqual({ a: [0, 0], b: [2020, 0], c: [0, 2020] });
  });

  it("groups artboards by size, one line per size in the order the sizes first appear", () => {
    const doc = project(board("feed1", 0, 0), board("story1", 1200, 0, 1080, 1920), board("feed2", 2400, 0), board("story2", 3600, 0, 1080, 1920));
    const ids = ["feed1", "story1", "feed2", "story2"];
    expect(places(arrangeArtboards(doc, ids, { layout: "row", gap: 100, bySize: true }))).toEqual({ feed1: [0, 0], feed2: [1180, 0], story1: [0, 1180], story2: [1180, 1180] });
    expect(places(arrangeArtboards(doc, ids, { layout: "column", gap: 100, bySize: true }))).toEqual({ feed1: [0, 0], feed2: [0, 1180], story1: [1180, 0], story2: [1180, 2020] });
  });

  it("leaves artboards outside the arrangement where they are and returns the same document when nothing moves", () => {
    const doc = project(board("a", 0, 0), board("b", 1180, 0), board("c", 9000, 9000));
    expect(arrangeArtboards(doc, ["a", "b"], { layout: "row", gap: 100 })).toBe(doc);
    const next = arrangeArtboards(doc, ["a", "b"], { layout: "row", gap: 0 });
    expect(places(next)).toEqual({ a: [0, 0], b: [1080, 0], c: [9000, 9000] });
  });

  it("names what is wrong with a request instead of guessing", () => {
    const doc = project(board("a", 0, 0), board("b", 1180, 0));
    expect(arrangeIssue(doc, ["a"], { layout: "row" })).toBe("too_few");
    expect(arrangeIssue(doc, ["a", "nope"], { layout: "row" })).toBe("unknown");
    expect(arrangeIssue(doc, ["a", "a"], { layout: "row" })).toBe("too_few");
    expect(arrangeIssue(doc, ["a", "b"], { layout: "row", gap: -1 })).toBe("gap");
    expect(arrangeIssue(doc, ["a", "b"], { layout: "grid", columns: 0 })).toBe("columns");
    expect(arrangeIssue(doc, ["a", "b"], { layout: "grid", columns: 1.5 })).toBe("columns");
    expect(arrangeIssue(doc, ["a", "b"], { layout: "grid", gap: 0, columns: 2 })).toBeNull();
  });

  it("arranges the selected artboards when two or more are picked, and all of them otherwise", () => {
    const doc = project(board("a", 0, 0), board("b", 0, 0), board("c", 0, 0));
    expect(arrangeTargets(doc, ["c", "a", "layer-1"])).toEqual(["a", "c"]);
    expect(arrangeTargets(doc, ["a"])).toEqual(ALL);
    expect(arrangeTargets(doc, [])).toEqual(ALL);
  });

  it("tidies a rough layout into an even grid that keeps its rows", () => {
    const doc = project(board("a", 0, 0), board("b", 1250, 30), board("c", 2400, -20), board("d", 40, 1300), board("e", 1190, 1350));
    const ids = ["a", "b", "c", "d", "e"];
    const options = tidyArrangement(doc, ids);
    expect(options).toEqual({ layout: "grid", order: "position", columns: 3 });
    expect(places(arrangeArtboards(doc, ids, { ...options, gap: 100 }))).toEqual({ a: [0, -20], b: [1180, -20], c: [2360, -20], d: [0, 1160], e: [1180, 1160] });
  });

  it("is one undo step in the editor", () => {
    const doc = project(board("a", 500, 900), board("b", 3000, 40), board("c", 1800, 2000));
    const store = createStudioStore(doc);
    store.getState().apply((d) => arrangeArtboards(d, ALL, { layout: "row", gap: 0 }));
    expect(places(store.getState().document).b).toEqual([2660, 40]);
    store.getState().undo();
    expect(places(store.getState().document)).toEqual(places(doc));
  });
});
