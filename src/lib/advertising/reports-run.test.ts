import { describe, expect, it } from "vitest";

import {
  BREAKDOWN_METRICS,
  breakdownRunRequest,
  exportLabels,
  hasReportData,
  pivotRows,
  reportBars,
  type ReportLabelTexts,
} from "./reports-run";
import { MAX_LIVE_OBJECT_IDS } from "./report-query";
import type { AdReportRun, AdReportRunRow } from "./types";

const row = (key: string, overrides: Partial<AdReportRunRow> = {}): AdReportRunRow => ({
  key,
  dimensions: [],
  share: 0,
  values: {},
  ...overrides,
});

const run = (overrides: Partial<AdReportRun> = {}): AdReportRun => ({
  currency: "BRL",
  view: "pivot",
  breakdowns: [],
  metrics: ["spend"],
  metricKinds: { spend: "money" },
  rows: [],
  totals: {},
  series: [],
  ...overrides,
});

const texts: ReportLabelTexts = {
  object: "Campanha",
  day: "Dia",
  total: "Total",
  breakdown: (breakdown) => `B:${breakdown}`,
  value: (breakdown, value) => `${breakdown}=${value}`,
  metric: (metric) => `M:${metric}`,
};

describe("pivotRows", () => {
  it("starts a group whenever the object changes, keeping the server order", () => {
    const rows = pivotRows([
      row("a1", { objectId: "a", dimensions: ["18-24"] }),
      row("a2", { objectId: "a", dimensions: ["25-34"] }),
      row("b1", { objectId: "b", dimensions: ["18-24"] }),
    ]);
    expect(rows.map((entry) => [entry.key, entry.groupStart])).toEqual([
      ["a1", true],
      ["a2", false],
      ["b1", true],
    ]);
  });

  it("has no rows for an empty run", () => {
    expect(pivotRows([])).toEqual([]);
  });
});

describe("reportBars", () => {
  it("labels each bar with every breakdown value and reads the first metric", () => {
    const bars = reportBars(
      run({
        view: "bars",
        breakdowns: ["age", "gender"],
        metrics: ["results", "spend"],
        rows: [row("r1", { dimensions: ["18-24", "female"], values: { results: 4, spend: 9 } })],
      }),
      texts.value,
    );
    expect(bars).toEqual([{ key: "r1", label: "age=18-24 · gender=female", value: 4 }]);
  });

  it("uses the object name when there are no breakdowns", () => {
    const bars = reportBars(run({ view: "bars", rows: [row("c1", { objectId: "c1", name: "Campanha 1", values: { spend: 2 } })] }), texts.value);
    expect(bars).toEqual([{ key: "c1", label: "Campanha 1", value: 2 }]);
  });

  it("keeps an unknown value unknown instead of zero", () => {
    const bars = reportBars(run({ view: "bars", metrics: ["costPerResult"], rows: [row("c1", { name: "C", values: { costPerResult: null } })] }), texts.value);
    expect(bars[0].value).toBeNull();
  });

  it("has no bars without a metric", () => {
    expect(reportBars(run({ metrics: [], rows: [row("c1", { name: "C" })] }), texts.value)).toEqual([]);
  });
});

describe("exportLabels", () => {
  it("labels the columns, the metrics and every breakdown value present in the run", () => {
    const labels = exportLabels(
      run({
        breakdowns: ["age", "gender"],
        metrics: ["spend", "ctr"],
        rows: [
          row("r1", { dimensions: ["18-24", "female"] }),
          row("r2", { dimensions: ["25-34", "female"] }),
          row("r3", { dimensions: ["18-24", ""] }),
        ],
      }),
      texts,
    );
    expect(labels).toEqual({
      object: "Campanha",
      day: "Dia",
      total: "Total",
      breakdowns: { age: "B:age", gender: "B:gender" },
      values: {
        age: { "18-24": "age=18-24", "25-34": "age=25-34" },
        gender: { female: "gender=female", "": "gender=" },
      },
      metrics: { spend: "M:spend", ctr: "M:ctr" },
    });
  });

  it("labels a trend export by its metrics alone", () => {
    const labels = exportLabels(run({ view: "trend", metrics: ["spend"], series: [{ day: "2026-10-01", values: { spend: 1 } }] }), texts);
    expect(labels.breakdowns).toEqual({});
    expect(labels.values).toEqual({});
    expect(labels.metrics).toEqual({ spend: "M:spend" });
  });
});

describe("breakdownRunRequest", () => {
  it("asks for the bars of the chosen group over the selection and its range", () => {
    expect(
      breakdownRunRequest({
        group: ["age", "gender"],
        level: "adset",
        range: { since: "2026-09-01", until: "2026-09-30" },
        objectIds: ["1", "2"],
        windows: [],
      }),
    ).toEqual({
      definition: {
        view: "bars",
        level: "adset",
        breakdowns: ["age", "gender"],
        metrics: BREAKDOWN_METRICS,
        datePreset: "custom",
        since: "2026-09-01",
        until: "2026-09-30",
      },
      range: { since: "2026-09-01", until: "2026-09-30" },
      objectIds: ["1", "2"],
    });
  });

  it("keeps the manager's attribution window", () => {
    const input = { group: ["age"], level: "ad" as const, range: { since: "2026-09-01", until: "2026-09-30" }, objectIds: ["1"], windows: ["7d_click" as const] };
    expect(breakdownRunRequest(input)?.windows).toEqual(["7d_click"]);
  });

  it("refuses an empty selection and more objects than Meta takes in one call, instead of widening the scope", () => {
    const base = { group: ["age"], level: "ad" as const, range: { since: "2026-09-01", until: "2026-09-30" }, windows: [] };
    expect(breakdownRunRequest({ ...base, objectIds: [] })).toBeNull();
    expect(breakdownRunRequest({ ...base, objectIds: Array.from({ length: MAX_LIVE_OBJECT_IDS + 1 }, (_, index) => String(index)) })).toBeNull();
  });

  it("shows the sheet's columns in Meta's order", () => {
    expect(BREAKDOWN_METRICS).toEqual(["spend", "impressions", "reach", "results", "costPerResult", "cpm"]);
  });
});

describe("hasReportData", () => {
  it("reads the days of a trend and the rows of a table or bars", () => {
    expect(hasReportData(run({ view: "trend", series: [{ day: "2026-10-01", values: {} }] }))).toBe(true);
    expect(hasReportData(run({ view: "trend", rows: [row("r")] }))).toBe(false);
    expect(hasReportData(run({ view: "pivot", rows: [row("r")] }))).toBe(true);
    expect(hasReportData(run({ view: "bars" }))).toBe(false);
  });
});
