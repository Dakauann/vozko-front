import { describe, expect, it } from "vitest";

import { chartRows, formatChartValue, humanizeChart, type ValueFormatter } from "./chart";
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

describe("humanizeChart", () => {
  const names: Record<string, string> = { avg_frt_mins: "Tempo até a 1ª resposta", month: "Mês", channel: "Canal", unofficial_whatsapp: "WhatsApp (QR code)" };
  const dict = {
    column: (key: string) => names[key],
    value: (key: string) => names[key],
    month: (ym: string) => `mês ${ym}`,
    day: (ymd: string) => `dia ${ymd}`,
  };

  it("names columns the way a manager would, and keeps words the model already chose", () => {
    const out = humanizeChart(
      { ...chart, xLabel: "month", series: [{ key: "a", label: "avg_frt_mins", kind: "minutes", values: [1] }, { key: "b", label: "Resolvidas em agosto", kind: "number", values: [2] }] },
      dict,
    );
    expect(out.xLabel).toBe("Mês");
    expect(out.series.map((s) => s.label)).toEqual(["Tempo até a 1ª resposta", "Resolvidas em agosto"]);
  });

  it("formats month buckets and translates known values, leaving names untouched", () => {
    const out = humanizeChart({ ...chart, xKind: "date", categories: ["2026-08", "Ana"] }, dict);
    expect(out.categories).toEqual(["mês 2026-08", "Ana"]);
    expect(humanizeChart({ ...chart, xKind: "date", categories: ["2026-09-01"] }, dict).categories).toEqual(["dia 2026-09-01"]);
    const channels = humanizeChart({ ...chart, xKind: "text", categories: ["unofficial_whatsapp", "__other__"] }, dict);
    expect(channels.categories).toEqual(["WhatsApp (QR code)", "__other__"]);
  });
});
