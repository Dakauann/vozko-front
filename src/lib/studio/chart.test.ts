import { describe, expect, it } from "vitest";

import {
  CHART_KINDS,
  CHART_PALETTE,
  chartInk,
  chartIssue,
  chartLayerIssue,
  chartValueText,
  dataOfGrid,
  gridOf,
  insertColumn,
  insertRow,
  newChartSpec,
  paletteColor,
  parseChartNumber,
  parseDelimited,
  pasteCells,
  removeColumn,
  removeRow,
  shownSeries,
  stylePalette,
  withStylePalette,
  type ChartData,
  type ChartSpec,
} from "./chart";
import { fullFrame, type Layer } from "./document";
import { layerIssue } from "./validate";

const DATA: ChartData = {
  labels: ["Jan", "Fev", "Mar"],
  series: [
    { name: "2025", values: [10, 20, 30] },
    { name: "2026", values: [15, null, 35] },
  ],
};

function spec(overrides: Partial<ChartSpec> = {}): ChartSpec {
  return { ...newChartSpec("barGrouped", DATA, "pt-BR", chartInk("#111111")), ...overrides };
}

function chartLayer(chart: ChartSpec): Layer {
  return { id: "chart-1", type: "chart", transform: fullFrame(), chart };
}

describe("chart spec validation", () => {
  it("accepts every kind with sample data", () => {
    for (const kind of CHART_KINDS) expect(chartIssue(newChartSpec(kind, DATA, "en-US", chartInk("#ffffff")))).toBeNull();
  });

  it("refuses rows that do not match the labels", () => {
    expect(chartIssue(spec({ data: { labels: ["a", "b"], series: [{ name: "x", values: [1] }] } }))).toBe("invalid");
  });

  it("refuses an empty table and a scatter with a single column", () => {
    expect(chartIssue(spec({ data: { labels: [], series: [] } }))).toBe("required");
    expect(chartIssue({ ...spec(), kind: "scatter", data: { labels: ["a"], series: [{ name: "x", values: [1] }] } })).toBe("required");
  });

  it("refuses non finite or huge numbers and keeps empty cells", () => {
    expect(chartIssue(spec({ data: { labels: ["a"], series: [{ name: "x", values: [Number.NaN] }] } }))).toBe("out_of_range");
    expect(chartIssue(spec({ data: { labels: ["a"], series: [{ name: "x", values: [2e12] }] } }))).toBe("out_of_range");
    expect(chartIssue(spec({ data: { labels: ["a"], series: [{ name: "x", values: [null] }] } }))).toBeNull();
  });

  it("refuses unknown kinds, legends, fonts, bad colors and ranges", () => {
    expect(chartIssue({ ...spec(), kind: "stream" as never })).toBe("unknown");
    expect(chartIssue({ ...spec(), style: { ...spec().style, legend: "left" as never } })).toBe("unknown");
    expect(chartIssue({ ...spec(), style: { ...spec().style, fontId: "comic" as never } })).toBe("unknown");
    expect(chartIssue({ ...spec(), style: { ...spec().style, palette: [] } })).toBe("invalid");
    expect(chartIssue({ ...spec(), style: { ...spec().style, palette: ["red"] } })).toBe("invalid");
    expect(chartIssue({ ...spec(), style: { ...spec().style, fontSize: 0.5 } })).toBe("out_of_range");
    expect(chartIssue({ ...spec(), style: { ...spec().style, hole: 0.95 } })).toBe("out_of_range");
    expect(chartIssue({ ...spec(), format: { ...spec().format, locale: "fr-FR" as never } })).toBe("unknown");
    expect(chartIssue({ ...spec(), format: { ...spec().format, decimals: 1.5 } })).toBe("invalid");
    expect(chartIssue({ ...spec(), format: { ...spec().format, prefix: "R$ R$ R$ R$ R$ R$ " } })).toBe("too_large");
  });

  it("refuses control characters in labels and names", () => {
    expect(chartIssue(spec({ data: { labels: ["a\nb"], series: [{ name: "x", values: [1] }] } }))).toBe("invalid");
  });

  it("keeps a chart layer to its own fields through the shared layer check", () => {
    expect(layerIssue(chartLayer(spec()))).toBeNull();
    expect(chartLayerIssue({ ...chartLayer(spec()), fill: "#ff0000" })).toBe("invalid");
    expect(layerIssue({ ...chartLayer(spec()), flipX: true })).toBe("invalid");
    expect(layerIssue({ id: "c", type: "chart", transform: fullFrame() })).toBe("required");
  });
});

describe("chart series and palette", () => {
  it("picks the series each kind draws", () => {
    expect(shownSeries({ kind: "bar", data: DATA })).toEqual([0]);
    expect(shownSeries({ kind: "lineMulti", data: DATA })).toEqual([0, 1]);
    expect(shownSeries({ kind: "scatter", data: DATA })).toEqual([1]);
  });

  it("cycles the palette", () => {
    expect(paletteColor({ palette: ["#000000", "#ffffff"] }, 3)).toBe("#ffffff");
  });

  it("starts the palette with the project color styles", () => {
    const styles = [{ id: "brand", kind: "color" as const, name: "Marca", color: "#FF0066" }, { id: "t", kind: "text" as const, name: "Título", fontId: "inter" as const }];
    expect(stylePalette(styles).slice(0, 2)).toEqual(["#ff0066", CHART_PALETTE[0]]);
    expect(stylePalette([])).toEqual([...CHART_PALETTE]);
    expect(withStylePalette(chartLayer(spec()), styles).chart?.style.palette[0]).toBe("#ff0066");
    expect(withStylePalette(chartLayer(spec()), []).chart?.style.palette).toEqual(spec().style.palette);
  });
});

describe("chart numbers", () => {
  it("formats by the chart locale", () => {
    const format = { locale: "pt-BR" as const, decimals: 1, percent: false, prefix: "R$ " };
    expect(chartValueText(1234.5, format)).toBe("R$ 1.234,5");
    expect(chartValueText(1234.5, { ...format, locale: "en-US" })).toBe("R$ 1,234.5");
  });

  it("reads numbers typed or pasted in any common shape", () => {
    expect(parseChartNumber("1.234,5", "pt-BR")).toBe(1234.5);
    expect(parseChartNumber("1,234.5", "pt-BR")).toBe(1234.5);
    expect(parseChartNumber("1,234", "en-US")).toBe(1234);
    expect(parseChartNumber("1.234", "pt-BR")).toBe(1234);
    expect(parseChartNumber("12,5", "pt-BR")).toBe(12.5);
    expect(parseChartNumber("12.5", "en-US")).toBe(12.5);
    expect(parseChartNumber("R$ 300", "pt-BR")).toBe(300);
    expect(parseChartNumber("45%", "pt-BR")).toBe(45);
    expect(parseChartNumber("-7", "pt-BR")).toBe(-7);
    expect(parseChartNumber("(7)", "en-US")).toBe(-7);
    expect(parseChartNumber("", "pt-BR")).toBeNull();
    expect(parseChartNumber("abc", "pt-BR")).toBeNull();
  });
});

describe("chart grid", () => {
  it("round trips data through the grid", () => {
    expect(dataOfGrid(gridOf(DATA, "pt-BR"), "pt-BR")).toEqual(DATA);
  });

  it("parses tab separated cells from a spreadsheet and quoted CSV", () => {
    expect(parseDelimited("Mês\tVendas\nJan\t1.200,50\n")).toEqual([
      ["Mês", "Vendas"],
      ["Jan", "1.200,50"],
    ]);
    expect(parseDelimited('name,value\r\n"Doe, J.",3\r\n"say ""hi""",4')).toEqual([
      ["name", "value"],
      ["Doe, J.", "3"],
      ['say "hi"', "4"],
    ]);
    expect(parseDelimited("a;b\n1,5;2")).toEqual([
      ["a", "b"],
      ["1,5", "2"],
    ]);
  });

  it("turns a pasted table into labels and series and drops blank rows", () => {
    const data = dataOfGrid(parseDelimited("Mês\tVendas\tMeta\nJan\t10\t12\n\t\t\nFev\t\t14"), "pt-BR");
    expect(data).toEqual({ labels: ["Jan", "Fev"], series: [{ name: "Vendas", values: [10, null] }, { name: "Meta", values: [12, 14] }] });
  });

  it("pastes over a cell and grows the grid", () => {
    const grid = pasteCells([["", "A"], ["x", "1"]], { row: 1, column: 1 }, [["5", "6"], ["7", "8"]]);
    expect(grid).toEqual([
      ["", "A", ""],
      ["x", "5", "6"],
      ["", "7", "8"],
    ]);
  });

  it("adds and removes rows and columns but keeps the header and the label column", () => {
    const grid = [["", "A"], ["x", "1"]];
    expect(insertRow(grid, 2)).toEqual([["", "A"], ["x", "1"], ["", ""]]);
    expect(insertColumn(grid, 2)).toEqual([["", "A", ""], ["x", "1", ""]]);
    expect(removeRow(grid, 0)).toBe(grid);
    expect(removeRow(grid, 1)).toBe(grid);
    expect(removeRow(insertRow(grid, 2), 2)).toEqual(grid);
    expect(removeColumn(grid, 1)).toBe(grid);
    expect(removeColumn(insertColumn(grid, 2), 2)).toEqual(grid);
  });
});
