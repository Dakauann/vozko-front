import { describe, expect, it } from "vitest";

import { chartRows, formatChartValue, type ValueFormatter } from "./chart";
import type { ChatChart } from "./types";

const fmt: ValueFormatter = {
  na: "n/d",
  num: (v) => `n${v}`,
  pct: (v) => `${v}%`,
  mins: (v) => `${v} min`,
  money: (v) => `R$${(v ?? 0) / 100}`,
};

const chart: ChatChart = {
  type: "bar",
  title: "Volume",
  xLabel: "Mês",
  xKind: "date",
  categories: ["2026-08", "__other__"],
  series: [
    { key: "human", label: "Humano", kind: "number", values: [10, null] },
    { key: "ai", label: "IA", kind: "number", values: [4, 2] },
  ],
};

describe("formatChartValue", () => {
  it("formats by the column kind the server declared", () => {
    expect(formatChartValue(fmt, "percent", 12.5)).toBe("12.5%");
    expect(formatChartValue(fmt, "minutes", 3)).toBe("3 min");
    expect(formatChartValue(fmt, "money", 1990)).toBe("R$19.9");
    expect(formatChartValue(fmt, "number", 7)).toBe("n7");
  });

  it("says a missing value is missing instead of zero", () => {
    expect(formatChartValue(fmt, "number", null)).toBe("n/d");
  });
});

describe("chartRows", () => {
  it("pivots series into one row per category and labels the folded tail", () => {
    expect(chartRows(chart, "Outros")).toEqual([
      { category: "2026-08", s0: 10, s1: 4 },
      { category: "Outros", s0: null, s1: 2 },
    ]);
  });

  it("uses the numeric x values of a scatter", () => {
    const scatter: ChatChart = { ...chart, type: "scatter", categories: undefined, xValues: [1, 2] };
    expect(chartRows(scatter, "Outros").map((r) => r.x)).toEqual([1, 2]);
  });
});
