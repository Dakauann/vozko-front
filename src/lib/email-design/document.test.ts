import { describe, expect, it } from "vitest";

import {
  blockCount,
  canMoveBy,
  collectIds,
  createBlock,
  createId,
  duplicateBlock,
  findBlock,
  footerIndex,
  insertBlock,
  moveBlock,
  moveBlockBy,
  removeBlock,
  ROOT,
  setColumnsRatio,
  updateBlock,
  updateBlockOf,
  updateSettings,
  type BlockCopy,
} from "./document";
import { BLOCK_KINDS, type Block, type ColumnsBlock, type Document } from "./types";

const COPY: BlockCopy = { heading: "Título", text: "Texto", button: "Saiba mais", footerCompany: "Empresa", footerAddress: "Rua 1" };
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function heading(id: string): Block {
  return { id, kind: "heading", heading: { text: id, level: 2 } };
}

function footer(): Block {
  return { id: "footer", kind: "footer", footer: { company_name: "Empresa", address: "Rua 1" } };
}

function columns(id: string, ...children: Block[][]): ColumnsBlock {
  return { id, kind: "columns", columns: { ratio: children.length === 3 ? "33-33-33" : "50-50", columns: children.map((blocks) => ({ blocks })) } };
}

function doc(...blocks: Block[]): Document {
  return { version: 1, settings: {}, blocks };
}

function rootIds(document: Document): string[] {
  return document.blocks.map((block) => block.id);
}

function columnIds(document: Document, id: string, column: number): string[] {
  const found = findBlock(document, id);
  if (!found || found.block.kind !== "columns") throw new Error("not columns");
  return found.block.columns.columns[column].blocks.map((block) => block.id);
}

describe("createBlock", () => {
  it.each(BLOCK_KINDS)("creates a %s with a valid id and its own props only", (kind) => {
    const block = createBlock(kind, COPY);
    expect(block.kind).toBe(kind);
    expect(block.id).toMatch(ID_PATTERN);
    const props = Object.keys(block).filter((key) => !["id", "kind", "padding", "background_color"].includes(key));
    expect(props).toEqual([kind]);
  });

  it("fills required text with the given copy and backend ranges", () => {
    expect(createBlock("heading", COPY).heading).toEqual({ text: "Título", level: 2 });
    expect(createBlock("text", COPY).text.paragraphs).toEqual([{ runs: [{ text: "Texto" }] }]);
    expect(createBlock("button", COPY).button).toEqual({ label: "Saiba mais", href: "https://example.com" });
    expect(createBlock("image", COPY).image.width).toBe(100);
    expect(createBlock("divider", COPY).divider.thickness).toBe(1);
    expect(createBlock("spacer", COPY).spacer.height).toBe(24);
    expect(createBlock("columns", COPY).columns).toEqual({ ratio: "50-50", columns: [{ blocks: [] }, { blocks: [] }] });
    expect(createBlock("social", COPY).social.links).toEqual([{ network: "instagram", url: "https://instagram.com" }]);
    expect(createBlock("footer", COPY).footer).toEqual({ company_name: "Empresa", address: "Rua 1" });
  });

  it("never reuses a taken id", () => {
    let calls = 0;
    const random = () => (calls++ < 6 ? 0 : 0.5);
    const taken = new Set(["text-aaaaaa"]);
    const id = createId("text", taken, random);
    expect(id).not.toBe("text-aaaaaa");
    expect(id).toMatch(ID_PATTERN);
  });
});

describe("insertBlock", () => {
  it("inserts before the footer even when asked for the end", () => {
    const next = insertBlock(doc(heading("a"), footer()), heading("b"), { container: ROOT, index: 99 });
    expect(rootIds(next)).toEqual(["a", "b", "footer"]);
  });

  it("inserts at the start", () => {
    const next = insertBlock(doc(heading("a"), footer()), heading("b"), { container: ROOT, index: 0 });
    expect(rootIds(next)).toEqual(["b", "a", "footer"]);
  });

  it("inserts into a column and refuses columns or footers there", () => {
    const start = doc(columns("cols", [heading("x")], []), footer());
    const target = { container: { kind: "column" as const, columnsId: "cols", column: 1 }, index: 0 };
    const next = insertBlock(start, heading("y"), target);
    expect(columnIds(next, "cols", 1)).toEqual(["y"]);
    expect(insertBlock(start, columns("inner", [], []), target)).toBe(start);
    expect(insertBlock(start, { ...footer(), id: "f2" }, target)).toBe(start);
  });

  it("refuses a second footer", () => {
    const start = doc(heading("a"), footer());
    expect(insertBlock(start, { ...footer(), id: "f2" }, { container: ROOT, index: 0 })).toBe(start);
  });

  it("does not mutate the original document", () => {
    const start = doc(heading("a"), footer());
    insertBlock(start, heading("b"), { container: ROOT, index: 0 });
    expect(rootIds(start)).toEqual(["a", "footer"]);
  });
});

describe("removeBlock", () => {
  it("removes root and column blocks", () => {
    const start = doc(heading("a"), columns("cols", [heading("x")], []), footer());
    expect(rootIds(removeBlock(start, "a"))).toEqual(["cols", "footer"]);
    expect(columnIds(removeBlock(start, "x"), "cols", 0)).toEqual([]);
  });

  it("never removes the footer", () => {
    const start = doc(heading("a"), footer());
    expect(removeBlock(start, "footer")).toBe(start);
  });
});

describe("moveBlock", () => {
  it("moves down and up using insertion points", () => {
    const start = doc(heading("a"), heading("b"), heading("c"), footer());
    expect(rootIds(moveBlock(start, "a", { container: ROOT, index: 3 }))).toEqual(["b", "c", "a", "footer"]);
    expect(rootIds(moveBlock(start, "c", { container: ROOT, index: 0 }))).toEqual(["c", "a", "b", "footer"]);
  });

  it("keeps the footer last and refuses to move it", () => {
    const start = doc(heading("a"), footer());
    expect(rootIds(moveBlock(start, "a", { container: ROOT, index: 5 }))).toEqual(["a", "footer"]);
    expect(moveBlock(start, "footer", { container: ROOT, index: 0 })).toBe(start);
  });

  it("moves a root block into a column but never a columns block", () => {
    const start = doc(heading("a"), columns("cols", [], []), footer());
    const target = { container: { kind: "column" as const, columnsId: "cols", column: 0 }, index: 0 };
    const next = moveBlock(start, "a", target);
    expect(rootIds(next)).toEqual(["cols", "footer"]);
    expect(columnIds(next, "cols", 0)).toEqual(["a"]);
    expect(moveBlock(start, "cols", target)).toBe(start);
  });
});

describe("moveBlockBy", () => {
  it("swaps root neighbours and stops at the edges and the footer", () => {
    const start = doc(heading("a"), heading("b"), footer());
    expect(rootIds(moveBlockBy(start, "a", 1))).toEqual(["b", "a", "footer"]);
    expect(rootIds(moveBlockBy(start, "b", -1))).toEqual(["b", "a", "footer"]);
    expect(moveBlockBy(start, "b", 1)).toBe(start);
    expect(moveBlockBy(start, "a", -1)).toBe(start);
    expect(canMoveBy(start, "a", -1)).toBe(false);
    expect(canMoveBy(start, "a", 1)).toBe(true);
  });

  it("moves within a column and out of it at the edges", () => {
    const start = doc(heading("a"), columns("cols", [heading("x"), heading("y")], []), footer());
    expect(columnIds(moveBlockBy(start, "x", 1), "cols", 0)).toEqual(["y", "x"]);
    const out = moveBlockBy(start, "x", -1);
    expect(rootIds(out)).toEqual(["a", "x", "cols", "footer"]);
    const after = moveBlockBy(start, "y", 1);
    expect(rootIds(after)).toEqual(["a", "cols", "y", "footer"]);
  });
});

describe("duplicateBlock", () => {
  it("places the copy right after with fresh ids, deep for columns", () => {
    const start = doc(columns("cols", [heading("x")], [heading("y")]), footer());
    const { document, id } = duplicateBlock(start, "cols");
    expect(id).not.toBeNull();
    expect(rootIds(document)).toEqual(["cols", id, "footer"]);
    const ids = [...collectIds(document)];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((value) => ID_PATTERN.test(value))).toBe(true);
    expect(blockCount(document)).toBe(7);
  });

  it("duplicates a column child inside its column", () => {
    const start = doc(columns("cols", [heading("x")], []), footer());
    const { document, id } = duplicateBlock(start, "x");
    expect(columnIds(document, "cols", 0)).toEqual(["x", id]);
  });

  it("never duplicates the footer", () => {
    const start = doc(heading("a"), footer());
    expect(duplicateBlock(start, "footer")).toEqual({ document: start, id: null });
  });
});

describe("updates", () => {
  it("updates a nested block and keeps untouched blocks identical", () => {
    const start = doc(heading("a"), columns("cols", [heading("x")], []), footer());
    const next = updateBlockOf(start, "x", "heading", (block) => ({ ...block, heading: { ...block.heading, text: "novo" } }));
    const found = findBlock(next, "x");
    expect(found?.block.kind === "heading" && found.block.heading.text).toBe("novo");
    expect(next.blocks[0]).toBe(start.blocks[0]);
    expect(next.blocks[2]).toBe(start.blocks[2]);
  });

  it("returns the same document when nothing changes", () => {
    const start = doc(heading("a"), footer());
    expect(updateBlock(start, "missing", (block) => block)).toBe(start);
  });

  it("merges settings and drops emptied keys", () => {
    const start: Document = { version: 1, settings: { text_color: "#111111", preheader: "Oi" }, blocks: [footer()] };
    const next = updateSettings(start, { preheader: "", width: 640 });
    expect(next.settings).toEqual({ text_color: "#111111", width: 640 });
  });
});

describe("findBlock", () => {
  it("finds root and column blocks with their positions", () => {
    const start = doc(heading("a"), columns("cols", [], [heading("y")]), footer());
    expect(findBlock(start, "a")?.position).toEqual({ container: ROOT, index: 0 });
    expect(findBlock(start, "y")?.position).toEqual({ container: { kind: "column", columnsId: "cols", column: 1 }, index: 0 });
    expect(findBlock(start, "nope")).toBeNull();
    expect(footerIndex(start)).toBe(2);
  });
});

describe("setColumnsRatio", () => {
  it("adds an empty third column", () => {
    const next = setColumnsRatio(doc(columns("cols", [heading("x")], [heading("y")]), footer()), "cols", "33-33-33");
    const found = findBlock(next, "cols")?.block as ColumnsBlock;
    expect(found.columns.ratio).toBe("33-33-33");
    expect(found.columns.columns.map((column) => column.blocks.map((block) => block.id))).toEqual([["x"], ["y"], []]);
  });

  it("keeps every child when going from three columns to two", () => {
    const next = setColumnsRatio(doc(columns("cols", [heading("x")], [heading("y")], [heading("z")]), footer()), "cols", "33-67");
    const found = findBlock(next, "cols")?.block as ColumnsBlock;
    expect(found.columns.ratio).toBe("33-67");
    expect(found.columns.columns.map((column) => column.blocks.map((block) => block.id))).toEqual([["x"], ["y", "z"]]);
  });
});
