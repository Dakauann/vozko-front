import { describe, expect, it } from "vitest";

import { textAdvance } from "./font-metrics";
import { columnShares, gridOfTable, newTableSpec, tableInk, tableIssue, withCell, withGrid, type TableSpec } from "./table";
import { tableCellAt, tableLayout, tablePartLayers, wrappedLines } from "./table-parts";
import { tableCellUnder } from "./generated-edits";

const SIZE = { width: 800, height: 400 };

function spec(): TableSpec {
  return newTableSpec(
    [
      ["Plano", "Preço", "Usuários"],
      ["Básico", "R$ 49,90", "3"],
      ["Pro", "R$ 99,90", "10"],
    ],
    tableInk("#111111"),
  );
}

describe("table spec", () => {
  it("builds a valid table from a grid with a header and even columns", () => {
    const table = spec();
    expect(tableIssue(table)).toBeNull();
    expect(table.header).toBe(true);
    expect(table.columns).toHaveLength(3);
    expect(gridOfTable(table)).toEqual([
      ["Plano", "Preço", "Usuários"],
      ["Básico", "R$ 49,90", "3"],
      ["Pro", "R$ 99,90", "10"],
    ]);
  });

  it("keeps rich runs on cells whose text stays and drops them when the text changes", () => {
    const styled = withCell(spec(), 1, 0, { text: "Básico", runs: [{ start: 0, end: 6, fontWeight: 700 }] });
    const grid = gridOfTable(styled);
    expect(withGrid(styled, grid).rows[1][0].runs).toEqual([{ start: 0, end: 6, fontWeight: 700 }]);
    grid[1][0] = "Essencial";
    expect(withGrid(styled, grid).rows[1][0].runs).toBeUndefined();
  });

  it("pads ragged pasted rows and keeps column settings when the grid grows", () => {
    const table = { ...spec(), columns: [{ width: 2, align: "left" as const }, { width: 1, align: "right" as const }, { width: 1, align: "center" as const }] };
    const grown = withGrid(table, [["a", "b", "c", "d"], ["e"]]);
    expect(grown.rows.map((row) => row.length)).toEqual([4, 4]);
    expect(grown.columns.map((column) => column.align)).toEqual(["left", "right", "center", "left"]);
    expect(tableIssue(grown)).toBeNull();
  });

  it("shares the width by the column weights", () => {
    expect(columnShares([{ width: 2, align: "left" }, { width: 1, align: "left" }, { width: 1, align: "left" }])).toEqual([0.5, 0.25, 0.25]);
  });
});

describe("table parts", () => {
  it("fills the box exactly with its rows and columns", () => {
    const layout = tableLayout(spec(), SIZE);
    expect(layout.columns.reduce((a, b) => a + b, 0)).toBeCloseTo(SIZE.width);
    expect(layout.rows.reduce((a, b) => a + b, 0)).toBeCloseTo(SIZE.height);
  });

  it("shrinks the letters until every row fits the box", () => {
    const long = withCell(spec(), 1, 0, { text: "Um plano com uma descrição bem longa que precisa quebrar em várias linhas dentro da célula" });
    const crowded = { ...long, style: { ...long.style, fontSize: 0.2 } };
    const layout = tableLayout(crowded, SIZE);
    expect(layout.fontPx).toBeLessThan(0.2 * SIZE.height);
    const natural = layout.rows.reduce((a, b) => a + b, 0);
    expect(natural).toBeCloseTo(SIZE.height);
  });

  it("draws header fill, bands, borders and one text part per filled cell", () => {
    const table = { ...spec(), rows: [...spec().rows, [{ text: "Empresa" }, { text: "" }, { text: "∞" }]] };
    const parts = tablePartLayers(table, SIZE);
    const ids = parts.map((part) => part.id);
    expect(ids).toContain("header-fill");
    expect(ids).toContain("band-2");
    expect(ids).not.toContain("band-1");
    expect(ids.filter((id) => id.startsWith("border-h-"))).toEqual(["border-h-0", "border-h-1", "border-h-2", "border-h-3", "border-h-4"]);
    expect(ids.filter((id) => id.startsWith("border-v-"))).toEqual(["border-v-0", "border-v-3"]);
    expect(ids).not.toContain("cell-3-1");
    expect(ids).not.toContain("fill");
    const header = parts.find((part) => part.id === "cell-0-0")!;
    expect(header.fill).toBe("#ffffff");
    expect(header.fontWeight).toBe(700);
    expect(parts.find((part) => part.id === "cell-1-0")!.fontWeight).toBe(400);
    expect(ids.indexOf("header-fill")).toBeLessThan(ids.indexOf("border-h-0"));
    expect(ids.indexOf("border-h-0")).toBeLessThan(ids.indexOf("cell-0-0"));
  });

  it("puts every border inside the box and centers inner borders on the cell edge", () => {
    const table = { ...spec(), style: { ...spec().style, borders: "all" as const, borderWidth: 0.01 } };
    const layout = tableLayout(table, SIZE);
    const parts = tablePartLayers(table, SIZE);
    const px = (id: string) => {
      const t = parts.find((part) => part.id === id)!.transform;
      return { left: (t.x - t.w / 2) * SIZE.width, right: (t.x + t.w / 2) * SIZE.width, top: (t.y - t.h / 2) * SIZE.height, bottom: (t.y + t.h / 2) * SIZE.height };
    };
    expect(px("border-h-0").top).toBeCloseTo(0);
    expect(px("border-h-3").bottom).toBeCloseTo(SIZE.height, 1);
    expect(px("border-v-3").right).toBeCloseTo(SIZE.width, 1);
    const inner = px("border-v-1");
    expect((inner.left + inner.right) / 2).toBeCloseTo(layout.columns[0], 1);
    expect(inner.right - inner.left).toBeCloseTo(0.01 * SIZE.height, 1);
  });

  it("aligns cell text by its column and carries the cell runs", () => {
    const table = withCell({ ...spec(), columns: [{ width: 1, align: "left" }, { width: 1, align: "right" }, { width: 1, align: "center" }] }, 1, 1, { text: "R$ 49,90", runs: [{ start: 0, end: 2, fill: "#ff0000" }] });
    const parts = tablePartLayers(table, SIZE);
    const cell = parts.find((part) => part.id === "cell-1-1")!;
    expect(cell.align).toBe("right");
    expect(cell.runs).toEqual([{ start: 0, end: 2, fill: "#ff0000" }]);
    expect(parts.find((part) => part.id === "cell-1-2")!.align).toBe("center");
  });

  it("skips transparent fills and borders of zero width", () => {
    const table = { ...spec(), header: false, style: { ...spec().style, borderWidth: 0, banding: false } };
    expect(tablePartLayers(table, SIZE).every((part) => part.type === "text")).toBe(true);
  });

  it("finds the cell under a point", () => {
    const table = spec();
    expect(tableCellAt(table, SIZE, 10, 10)).toEqual({ row: 0, column: 0 });
    expect(tableCellAt(table, SIZE, SIZE.width - 1, SIZE.height - 1)).toEqual({ row: 2, column: 2 });
    expect(tableCellAt(table, SIZE, -1, 10)).toBeNull();
  });

  it("counts wrapped lines conservatively and keeps explicit breaks", () => {
    const measure = (text: string) => textAdvance(text, "inter", 400);
    expect(wrappedLines("um\ndois", 1000, 20, measure)).toBe(2);
    expect(wrappedLines("palavra ".repeat(10).trim(), 200, 20, measure)).toBeGreaterThan(2);
    expect(wrappedLines("", 100, 20, measure)).toBe(1);
  });
});

describe("table cell under the pointer", () => {
  it("finds the cell in artboard pixels, turned tables included", () => {
    const layer = { id: "t", type: "table" as const, transform: { x: 0.5, y: 0.5, w: 0.8, h: 0.4, rotation: 0, opacity: 1 }, table: spec() };
    const canvas = { width: 1000, height: 1000 };
    expect(tableCellUnder(layer, canvas, { x: 110, y: 310 })).toEqual({ row: 0, column: 0 });
    expect(tableCellUnder(layer, canvas, { x: 890, y: 690 })).toEqual({ row: 2, column: 2 });
    expect(tableCellUnder(layer, canvas, { x: 50, y: 50 })).toBeNull();
    const turned = { ...layer, transform: { ...layer.transform, rotation: 180 } };
    expect(tableCellUnder(turned, canvas, { x: 890, y: 690 })).toEqual({ row: 0, column: 0 });
  });
});
