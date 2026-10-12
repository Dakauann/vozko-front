import { describe, expect, it } from "vitest";

import { counterCells, counterTokens, type Counter } from "./counter";
import { cellCharTiles, composeGlyphs, measureCell, sheetLayout, SHEET_ROW_PX, type GlyphRun, type GlyphSheet } from "./glyph-layout";
import { textPathData } from "./text-path";

const WIDTHS: Record<string, number> = { "1": 6, " ": 5, ".": 4 };

function measure(text: string): number {
  return [...text].reduce((sum, char) => sum + (WIDTHS[char] ?? 10), 0);
}

const LINE = 20;
const PAD = 3;

function sheetOf(cells: readonly string[], backdrop?: { width: number; height: number }): GlyphSheet {
  return sheetLayout(
    cells.map((text) => measureCell(text, measure, 0)),
    LINE,
    PAD,
    backdrop,
  );
}

const counter: Counter = { value: 0, decimals: 0, locale: "pt-BR", grouping: true, prefix: "R$ " };

function counterRun(value: number, patch: Partial<GlyphRun> = {}): GlyphRun {
  return { box: { x: 0, y: 0, width: 200, height: 40 }, align: "center", content: { kind: "counter", tokens: counterTokens(counter, value), slotCells: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] }, backdrop: false, ...patch };
}

describe("glyph measuring", () => {
  it("places letters where the text draws them", () => {
    expect(measureCell("R$ ", measure, 0)).toEqual({
      text: "R$ ",
      advance: 25,
      chars: [
        { char: "R", left: 0, right: 10 },
        { char: "$", left: 10, right: 20 },
        { char: " ", left: 20, right: 25 },
      ],
    });
    const spaced = measureCell("11", measure, 2);
    expect(spaced.chars).toEqual([
      { char: "1", left: 0, right: 6 },
      { char: "1", left: 8, right: 14 },
    ]);
    expect(spaced.advance).toBe(16);
  });

  it("lays cells out without overlap, padded, in rows", () => {
    const many = Array.from({ length: 400 }, (_, i) => `cell${i}`);
    const sheet = sheetOf(many);
    expect(sheet.width).toBeLessThanOrEqual(SHEET_ROW_PX);
    for (let i = 1; i < sheet.cells.length; i++) {
      const a = sheet.cells[i - 1];
      const b = sheet.cells[i];
      const apart = b.y >= a.y + a.height || b.x >= a.x + a.width;
      expect(apart).toBe(true);
    }
    expect(sheet.cells[0]).toMatchObject({ x: 0, y: 0, penX: PAD, penY: PAD, height: LINE + 2 * PAD });
  });

  it("keeps room for a backdrop under the cells", () => {
    const sheet = sheetOf(["1"], { width: 120, height: 30 });
    expect(sheet.backdrop).toEqual({ x: 0, y: LINE + 2 * PAD, width: 120 + 2 * PAD, height: 30 + 2 * PAD });
    expect(sheet.height).toBe(LINE + 2 * PAD + 30 + 2 * PAD);
  });

  it("tiles each cell between its letters, skipping blanks", () => {
    const sheet = sheetOf(["R$ x"]);
    const tiles = cellCharTiles(sheet.cells[0]);
    expect(tiles[2]).toBeNull();
    expect(tiles[0]).toEqual({ x: 0, y: 0, width: PAD + 10, height: LINE + 2 * PAD });
    expect(tiles[1]).toEqual({ x: PAD + 10, y: 0, width: (20 + 25) / 2 - 10, height: LINE + 2 * PAD });
    expect(tiles[3]!.x + tiles[3]!.width).toBe(sheet.cells[0].width);
  });
});

describe("counter glyphs", () => {
  const sheet = sheetOf(counterCells(counter));

  it("gives every digit the same slot so the number does not shake", () => {
    const narrow = composeGlyphs(counterRun(111), sheet);
    const wide = composeGlyphs(counterRun(888), sheet);
    expect(narrow.length).toBe(wide.length);
    expect(narrow[narrow.length - 1].x).toBeCloseTo(wide[wide.length - 1].x + (10 - 6) / 2 - (10 - 6) / 2, 6);
    const lastSlot = (pieces: typeof narrow) => pieces[pieces.length - 1];
    expect(lastSlot(narrow).width).not.toBe(0);
  });

  it("centers the number in the box", () => {
    const pieces = composeGlyphs(counterRun(1000), sheet);
    const width = 25 + 4 * 10 + 4;
    const start = (200 - width) / 2;
    const first = pieces[0];
    expect(first.tile.x).toBe(sheet.cells[counterCells(counter).indexOf("R$ ")].x);
    expect(first.x - first.width / 2).toBeCloseTo(start - PAD, 6);
    expect(pieces.every((piece) => piece.rotation === 0 && piece.opacity === 1)).toBe(true);
  });

  it("aligns to the left and right edges of the box", () => {
    const left = composeGlyphs(counterRun(5, { align: "left" }), sheet);
    const right = composeGlyphs(counterRun(5, { align: "right" }), sheet);
    expect(left[0].x - left[0].width / 2).toBeCloseTo(-PAD, 6);
    const last = right[right.length - 1];
    expect(last.x + last.width / 2).toBeCloseTo(200 + PAD, 6);
  });

  it("draws the backdrop first, over the whole box", () => {
    const withBackdrop = sheetOf(counterCells(counter), { width: 200, height: 40 });
    const pieces = composeGlyphs(counterRun(5, { backdrop: true }), withBackdrop);
    expect(pieces[0].tile).toEqual(withBackdrop.backdrop);
    expect(pieces[0]).toMatchObject({ x: 100, y: 20, width: 200 + 2 * PAD, height: 40 + 2 * PAD });
  });

  it("lets text animators move each unit", () => {
    const run = counterRun(1000, { motion: { in: { unit: "char", style: "fade", durationMs: 100, staggerMs: 100, easing: "linear" }, localMs: 150, durationMs: 3000 } });
    const opacities = composeGlyphs(run, sheet).map((piece) => piece.opacity);
    expect(opacities[0]).toBe(1);
    expect(opacities[1]).toBeCloseTo(0.5, 6);
    expect(opacities.slice(2).every((opacity) => opacity === 0)).toBe(true);
  });
});

describe("text on a path", () => {
  const word = "ABCD";
  const sheet = sheetOf([word]);
  const textRun = (path: GlyphRun["path"]): GlyphRun => ({ box: { x: 0, y: 0, width: 200, height: 100 }, align: "left", content: { kind: "text", cells: [0] }, backdrop: false, path });

  it("follows a straight path from the offset point", () => {
    const pieces = composeGlyphs(textRun({ data: "M 0 50 L 200 50", offset: 0.25, align: "start", upright: false, reverse: false }), sheet);
    const straight = composeGlyphs({ ...textRun(undefined), content: { kind: "text", cells: [0] } }, sheet);
    pieces.forEach((piece, i) => {
      expect(piece.rotation).toBeCloseTo(0, 6);
      expect(piece.x).toBeCloseTo(straight[i].x + 50, 1);
      expect(piece.y).toBeCloseTo(50 + (sheet.cells[0].height / 2 - PAD - LINE / 2), 1);
    });
  });

  it("centers the text on the offset point", () => {
    const pieces = composeGlyphs(textRun({ data: "M 0 50 L 200 50", offset: 0.5, align: "center", upright: false, reverse: false }), sheet);
    const middle = (pieces[1].x + pieces[2].x) / 2;
    expect(middle).toBeCloseTo(100, 0);
  });

  it("turns letters with the circle and keeps them upright on request", () => {
    const data = textPathData({ shape: "circle", offset: 0.5, align: "center" }, 200, 200);
    const turned = composeGlyphs(textRun({ data, offset: 0.5, align: "center", upright: false, reverse: false }), sheet);
    expect(Math.abs(turned[1].rotation) + Math.abs(turned[2].rotation)).toBeLessThan(20);
    expect(turned[0].rotation).toBeLessThan(0);
    expect(turned[3].rotation).toBeGreaterThan(0);
    expect(Math.min(...turned.map((piece) => piece.y))).toBeLessThan(10);
    const upright = composeGlyphs(textRun({ data, offset: 0.5, align: "center", upright: true, reverse: false }), sheet);
    expect(upright.every((piece) => piece.rotation === 0)).toBe(true);
  });

  it("runs the path backwards when reversed", () => {
    const pieces = composeGlyphs(textRun({ data: "M 0 50 L 200 50", offset: 0.25, align: "start", upright: false, reverse: true }), sheet);
    expect(pieces[0].x).toBeGreaterThan(pieces[1].x);
    expect(Math.abs(pieces[0].rotation)).toBeCloseTo(180, 6);
  });

  it("hides letters past the ends of an open path and wraps a closed one", () => {
    const open = composeGlyphs(textRun({ data: "M 0 50 L 200 50", offset: 0.98, align: "start", upright: false, reverse: false }), sheet);
    expect(open[0].opacity).toBe(1);
    expect(open[3].opacity).toBe(0);
    const ring = textPathData({ shape: "circle", offset: 0, align: "start" }, 200, 200);
    const wrapped = composeGlyphs(textRun({ data: ring, offset: 0.99, align: "start", upright: false, reverse: false }), sheet);
    expect(wrapped.every((piece) => piece.opacity === 1)).toBe(true);
  });

  it("draws nothing visible on a path with no length", () => {
    const pieces = composeGlyphs(textRun({ data: "M 10 10 L 10 10", offset: 0, align: "start", upright: false, reverse: false }), sheet);
    expect(pieces.every((piece) => piece.opacity === 0)).toBe(true);
  });
});
