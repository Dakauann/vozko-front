import { describe, expect, it } from "vitest";

import {
  COLUMN_PRESETS,
  DEFAULT_COLUMNS,
  METRIC_COLUMNS,
  needsLiveData,
  nextSort,
  parseVisibleColumns,
  presetColumns,
  presetOf,
  sortRows,
  toggleColumn,
} from "./columns";
import type { AdMetrics, AdOutcome, AdRow } from "./types";

const metrics = (overrides: Partial<AdMetrics> = {}): AdMetrics => ({
  currency: "BRL",
  spend: 0,
  impressions: 0,
  clicks: 0,
  linkClicks: 0,
  results: 0,
  resultAction: "onsite_conversion.messaging_conversation_started_7d",
  mixedResults: false,
  costPerResult: null,
  conversations: 0,
  costPerConversation: null,
  cpc: null,
  cpm: null,
  ctr: null,
  ...overrides,
});

const outcome = (overrides: Partial<AdOutcome> = {}): AdOutcome => ({
  conversations: 0,
  leads: 0,
  wonDeals: 0,
  revenue: 0,
  costPerConversation: null,
  costPerLead: null,
  roas: null,
  ...overrides,
});

const row = (name: string, m: Partial<AdMetrics> = {}, o: Partial<AdOutcome> = {}): AdRow => ({
  metaId: name,
  level: "campaign",
  name,
  status: "ACTIVE",
  effectiveStatus: "ACTIVE",
  delivery: "active",
  isOn: true,
  canToggle: true,
  dailyBudget: 0,
  lifetimeBudget: 0,
  issues: [],
  metrics: metrics(m),
  outcome: outcome(o),
});

describe("parseVisibleColumns", () => {
  it("shows the stored report columns when nothing is stored or the value is broken", () => {
    expect(parseVisibleColumns(null)).toEqual(DEFAULT_COLUMNS);
    expect(parseVisibleColumns("{")).toEqual(DEFAULT_COLUMNS);
    expect(parseVisibleColumns("\"spend\"")).toEqual(DEFAULT_COLUMNS);
    expect(needsLiveData(DEFAULT_COLUMNS)).toBe(false);
  });

  it("offers the live columns without showing them by default", () => {
    expect(METRIC_COLUMNS).toContain("thruPlays");
    expect(DEFAULT_COLUMNS).not.toContain("reach");
    expect(parseVisibleColumns(JSON.stringify(["spend", "reach"]))).toEqual(["spend", "reach"]);
    expect(needsLiveData(["spend", "reach"])).toBe(true);
  });

  it("keeps known columns in catalog order", () => {
    expect(parseVisibleColumns(JSON.stringify(["roas", "spend", "bogus"]))).toEqual(["spend", "roas"]);
  });

  it("toggles a column in place", () => {
    expect(toggleColumn(["spend", "roas"], "spend")).toEqual(["roas"]);
    expect(toggleColumn(["roas"], "delivery")).toEqual(["delivery", "roas"]);
  });
});

describe("sortRows", () => {
  it("sorts numbers descending with unknown values last", () => {
    const rows = [row("a", { costPerResult: null }), row("b", { costPerResult: 5 }), row("c", { costPerResult: 9 })];
    expect(sortRows(rows, { key: "costPerResult", direction: "desc" }).map((r) => r.name)).toEqual(["c", "b", "a"]);
    expect(sortRows(rows, { key: "costPerResult", direction: "asc" }).map((r) => r.name)).toEqual(["b", "c", "a"]);
  });

  it("treats mixed results as unknown", () => {
    const rows = [row("mixed", { results: 100, mixedResults: true }), row("known", { results: 3 })];
    expect(sortRows(rows, { key: "results", direction: "desc" }).map((r) => r.name)).toEqual(["known", "mixed"]);
  });

  it("sorts names alphabetically and leaves order alone without a sort", () => {
    const rows = [row("Zeta"), row("alpha")];
    expect(sortRows(rows, { key: "name", direction: "asc" }).map((r) => r.name)).toEqual(["alpha", "Zeta"]);
    expect(sortRows(rows, null)).toBe(rows);
  });
});

describe("nextSort", () => {
  it("cycles metrics desc, asc, off", () => {
    const first = nextSort(null, "spend");
    expect(first).toEqual({ key: "spend", direction: "desc" });
    const second = nextSort(first, "spend");
    expect(second).toEqual({ key: "spend", direction: "asc" });
    expect(nextSort(second, "spend")).toBeNull();
  });

  it("starts names ascending", () => {
    expect(nextSort(null, "name")).toEqual({ key: "name", direction: "asc" });
  });
});

describe("column presets", () => {
  it("matches Meta's Desempenho e cliques with reach, frequency, link CPC and all clicks", () => {
    const columns = presetColumns("performanceClicks");
    for (const column of ["reach", "frequency", "cpc", "clicks", "linkClicks", "ctr", "cpm"] as const) {
      expect(columns).toContain(column);
    }
  });

  it("offers Meta's presets in Meta's order", () => {
    expect(COLUMN_PRESETS).toEqual(["performance", "performanceClicks", "engagement", "delivery"]);
  });

  it("opens on Desempenho without any live column, so the table loads from the report alone", () => {
    expect(DEFAULT_COLUMNS).toEqual(presetColumns("performance"));
    expect(needsLiveData(presetColumns("performance"))).toBe(false);
  });

  it("keeps every preset in catalog order with known columns only", () => {
    for (const preset of COLUMN_PRESETS) {
      const columns = presetColumns(preset);
      expect(columns).toEqual(METRIC_COLUMNS.filter((column) => columns.includes(column)));
      expect(columns[0]).toBe("delivery");
    }
  });

  it("names the preset the visible columns match, whatever order they come in", () => {
    expect(presetOf(presetColumns("engagement"))).toBe("engagement");
    expect(presetOf([...presetColumns("delivery")].reverse())).toBe("delivery");
    expect(presetOf(toggleColumn(presetColumns("performance"), "ctr"))).toBeNull();
  });

  it("hands out a copy, so toggling never changes the preset", () => {
    const columns = presetColumns("performance");
    columns.pop();
    expect(presetColumns("performance")).toEqual(DEFAULT_COLUMNS);
  });
});
