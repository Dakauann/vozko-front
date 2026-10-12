import { describe, expect, it } from "vitest";

import { counterCells, counterTokens, newCounter } from "./counter";
import { newTextLayer, type Layer } from "./document";
import { shownLayer } from "./text-glyphs";
import { glyphCells } from "./text-run-glyphs";

const counter = { ...newCounter("pt-BR"), prefix: "R$ ", suffix: "%" };

function layer(extra: Partial<Layer> = {}): Layer {
  return { ...newTextLayer("Frete grátis"), fill: "#ffffff", ...extra };
}

describe("text run glyphs", () => {
  it("keeps the plain glyph cells when the text has no runs", () => {
    expect(glyphCells({ counter: { counter, value: 1250 } }, layer())).toEqual({ cells: counterCells(counter), content: { kind: "counter", tokens: counterTokens(counter, 1250), slotCells: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] } });
    expect(glyphCells({ path: { textPath: { shape: "arc", bend: 0.5, offset: 0.5, align: "center" }, offset: 0.5 } }, layer())).toEqual({ cells: ["Frete grátis"], content: { kind: "text", cells: [0] } });
  });

  it("splits text on a path into one cell per style, caps drawn in the cell", () => {
    const styled = layer({ runs: [{ start: 6, end: 12, fill: "#22c55e", caps: true }] });
    const glyphs = glyphCells({ path: { textPath: { shape: "arc", bend: 0.5, offset: 0.5, align: "center" }, offset: 0.5 } }, styled);
    expect(glyphs.cells).toEqual(["Frete ", "GRÁTIS"]);
    expect(glyphs.styles?.map((style) => style.fill)).toEqual(["#ffffff", "#22c55e"]);
    expect(glyphs.content).toEqual({ kind: "text", cells: [0, 1] });
  });

  it("styles a counter by prefix pieces, the number and suffix pieces", () => {
    const styled = layer({ runs: [{ start: 0, end: 2, fill: "#ffcc00" }, { start: 3, end: 4, fontWeight: 900 }, { start: 4, end: 5, fontSize: 0.03 }] });
    const glyphs = glyphCells({ counter: { counter, value: 1250 } }, styled);
    const numberCells = counterCells({ ...counter, prefix: undefined, suffix: undefined });
    expect(glyphs.cells).toEqual([...numberCells, "R$", " ", "%"]);
    expect(glyphs.styles?.slice(0, numberCells.length).every((style) => style.fontWeight === 900)).toBe(true);
    expect(glyphs.styles?.slice(numberCells.length).map((style) => [style.fill, style.fontSize])).toEqual([
      ["#ffcc00", 0.032],
      ["#ffffff", 0.032],
      ["#ffffff", 0.03],
    ]);
    const tokens = glyphs.content.kind === "counter" ? glyphs.content.tokens : [];
    expect(tokens.map((token) => glyphs.cells[token.cell]).join("")).toBe("R$ 1.250%");
  });
});

describe("counter shown in the fallback preview", () => {
  it("moves the template runs onto the formatted text", () => {
    const styled = layer({ runs: [{ start: 0, end: 2, fill: "#ffcc00" }, { start: 3, end: 4, fontWeight: 900 }] });
    const shown = shownLayer(styled, { counter: { counter, value: 1250 } });
    expect(shown.text).toBe("R$ 1.250%");
    expect(shown.runs).toEqual([
      { start: 0, end: 2, fill: "#ffcc00" },
      { start: 3, end: 8, fontWeight: 900 },
    ]);
    expect(shownLayer(layer(), { counter: { counter, value: 5 } }).runs).toBeUndefined();
  });
});
