import { describe, expect, it } from "vitest";

import {
  BLANK_REPORT_DEFINITION,
  customDays,
  exportsForAccount,
  filterReports,
  isReportDirty,
  newReportHref,
  reportInput,
  reportRange,
  reportRunRequest,
  reportsListHref,
  reportsSection,
  reportStamp,
  resolveTemplate,
  toggleBreakdown,
  toggleMetric,
  breakdownToggleAllowed,
  trendMetrics,
  withRange,
  withView,
  type ReportDraft,
} from "./reports";
import type { AdReportDefinition, AdReportExport, AdReportMetric, AdSavedReport } from "./types";

const definition = (overrides: Partial<AdReportDefinition> = {}): AdReportDefinition => ({
  ...BLANK_REPORT_DEFINITION,
  ...overrides,
});

const draft = (overrides: Partial<ReportDraft> = {}): ReportDraft => ({
  name: "Relatório",
  adAccountId: "acc-1",
  definition: definition(),
  ...overrides,
});

const saved = (id: string, overrides: Partial<AdSavedReport> = {}): AdSavedReport => ({
  id,
  name: id,
  adAccountId: "acc-1",
  definition: definition(),
  createdBy: "user",
  createdAt: "2026-10-01T10:00:00Z",
  updatedAt: "2026-10-01T10:00:00Z",
  ...overrides,
});

describe("reportRange", () => {
  it("resolves a preset against the account's today", () => {
    expect(reportRange(definition({ datePreset: "last7" }), "2026-10-03")).toEqual({ since: "2026-09-26", until: "2026-10-02" });
  });

  it("uses the saved days for a valid custom range", () => {
    expect(reportRange(definition({ datePreset: "custom", since: "2026-09-01", until: "2026-09-10" }), "2026-10-03")).toEqual({
      since: "2026-09-01",
      until: "2026-09-10",
    });
  });

  it("refuses a custom range that is missing or inverted", () => {
    expect(reportRange(definition({ datePreset: "custom" }), "2026-10-03")).toBeNull();
    expect(reportRange(definition({ datePreset: "custom", since: "2026-09-10", until: "2026-09-01" }), "2026-10-03")).toBeNull();
  });

  it("has no range before the account's today is known", () => {
    expect(reportRange(definition({ datePreset: "last7" }), null)).toBeNull();
  });
});

describe("withRange", () => {
  const days = { since: "2026-09-01", until: "2026-09-30" };

  it("drops the custom days when a preset is picked", () => {
    const next = withRange(definition({ datePreset: "custom", since: "2026-09-01", until: "2026-09-02" }), "last14", days);
    expect(next).toEqual(definition({ datePreset: "last14" }));
  });

  it("keeps the picked days for a custom range", () => {
    expect(withRange(definition(), "custom", days)).toMatchObject({ datePreset: "custom", ...days });
  });
});

describe("customDays", () => {
  it("reads the saved days, empty when missing", () => {
    expect(customDays(definition({ since: "2026-09-01" }))).toEqual({ since: "2026-09-01", until: "" });
  });
});

describe("toggleMetric and toggleBreakdown", () => {
  it("adds a metric at the end and removes it again", () => {
    const added = toggleMetric(["spend", "reach"], "impressions");
    expect(added).toEqual(["spend", "reach", "impressions"]);
    expect(toggleMetric(added, "reach")).toEqual(["spend", "impressions"]);
  });

  it("adds and removes breakdowns in the order chosen", () => {
    expect(toggleBreakdown(["gender"], "age")).toEqual(["gender", "age"]);
    expect(toggleBreakdown(["gender", "age"], "gender")).toEqual(["age"]);
  });
});

describe("trendMetrics", () => {
  it("keeps only the metrics the trend endpoint returns, in the chosen order", () => {
    const daily: AdReportMetric[] = ["spend", "impressions", "linkClicks", "results", "conversations"];
    expect(trendMetrics(["reach", "results", "spend", "ctr", "conversations"], daily)).toEqual(["results", "spend", "conversations"]);
  });
});

describe("isReportDirty", () => {
  it("is clean when nothing changed", () => {
    expect(isReportDirty(draft(), draft())).toBe(false);
  });

  it("notices a renamed report, another account or a changed definition", () => {
    expect(isReportDirty(draft(), draft({ name: "Outro" }))).toBe(true);
    expect(isReportDirty(draft(), draft({ adAccountId: "acc-2" }))).toBe(true);
    expect(isReportDirty(draft(), draft({ definition: definition({ view: "bars" }) }))).toBe(true);
    expect(isReportDirty(draft(), draft({ definition: definition({ metrics: ["reach", "spend"] }) }))).toBe(true);
  });

  it("ignores leftover custom days when a preset is in use", () => {
    expect(isReportDirty(draft(), draft({ definition: definition({ since: "2026-09-01", until: "2026-09-02" }) }))).toBe(false);
  });

  it("ignores spaces around the name", () => {
    expect(isReportDirty(draft(), draft({ name: "  Relatório " }))).toBe(false);
  });
});

describe("resolveTemplate", () => {
  const templates = [{ key: "age_gender", definition: definition({ breakdowns: ["age", "gender"] }) }];

  it("finds a template by key", () => {
    expect(resolveTemplate(templates, "age_gender")?.definition.breakdowns).toEqual(["age", "gender"]);
  });

  it("finds nothing for an unknown key", () => {
    expect(resolveTemplate(templates, "missing")).toBeNull();
    expect(resolveTemplate(templates, null)).toBeNull();
  });
});

describe("reportInput", () => {
  it("trims the name and keeps only the custom days a custom range uses", () => {
    const input = reportInput(draft({ name: "  Gastos  ", definition: definition({ since: "2026-09-01", until: "2026-09-02" }) }), "Sem título");
    expect(input).toEqual({ name: "Gastos", adAccountId: "acc-1", definition: definition() });
  });

  it("falls back to the untitled name when the name is blank", () => {
    expect(reportInput(draft({ name: "   " }), "Relatório sem título").name).toBe("Relatório sem título");
  });
});

describe("newReportHref", () => {
  it("opens a blank report on the chosen account", () => {
    expect(newReportHref("acc 1")).toBe("/dashboard/advertising/reports/new?account=acc+1");
  });
});

describe("reportStamp", () => {
  it("formats a timestamp as a short date and time", () => {
    expect(reportStamp("2026-10-01T13:05:00Z", "pt-BR", "UTC")).toBe("01/10/2026, 13:05");
  });

  it("has nothing for a missing or broken timestamp", () => {
    expect(reportStamp(undefined, "pt-BR", "UTC")).toBeNull();
    expect(reportStamp("not a date", "pt-BR", "UTC")).toBeNull();
  });
});

describe("filterReports", () => {
  const reports = [saved("Gastos de setembro"), saved("Idade", { adAccountId: "acc-2" }), saved("Gasto por região")];

  it("keeps the reports of the chosen account", () => {
    expect(filterReports(reports, "acc-1", "").map((report) => report.id)).toEqual(["Gastos de setembro", "Gasto por região"]);
  });

  it("filters by name ignoring case", () => {
    expect(filterReports(reports, "acc-1", " REGIÃO ").map((report) => report.id)).toEqual(["Gasto por região"]);
  });
});

describe("reportsSection", () => {
  it("opens the exports history only when asked", () => {
    expect(reportsSection(new URLSearchParams("section=exports&account=1"))).toBe("exports");
  });

  it("falls back to the reports for a missing or unknown section", () => {
    expect(reportsSection(new URLSearchParams("account=1"))).toBe("reports");
    expect(reportsSection(new URLSearchParams("section=other"))).toBe("reports");
  });
});

describe("reportsListHref", () => {
  it("links to the reports of an account", () => {
    expect(reportsListHref("acc 1", "reports")).toBe("/dashboard/advertising/reports?account=acc+1");
  });

  it("links to the exports history of an account", () => {
    expect(reportsListHref("acc-1", "exports")).toBe("/dashboard/advertising/reports?account=acc-1&section=exports");
  });
});

describe("exportsForAccount", () => {
  const entry = (id: string, adAccountId: string): AdReportExport => ({
    id,
    name: id,
    adAccountId,
    since: "2026-09-01",
    until: "2026-09-30",
    rows: 3,
    sizeBytes: 120,
    createdBy: "user",
    createdAt: "2026-10-01T10:00:00Z",
  });

  it("keeps the exports of the chosen account in the server order", () => {
    const exports = [entry("b", "acc-1"), entry("x", "acc-2"), entry("a", "acc-1")];
    expect(exportsForAccount(exports, "acc-1").map((value) => value.id)).toEqual(["b", "a"]);
  });
});

describe("reportRunRequest", () => {
  const range = { since: "2026-09-01", until: "2026-09-30" };
  const daily: AdReportMetric[] = ["spend", "results"];

  it("runs the definition over the resolved range", () => {
    const chosen = definition({ breakdowns: ["age"] });
    expect(reportRunRequest(chosen, range, daily)).toEqual({ definition: chosen, range });
  });

  it("runs nothing without a range or a metric", () => {
    expect(reportRunRequest(definition(), null, daily)).toBeNull();
    expect(reportRunRequest(definition({ metrics: [] }), range, daily)).toBeNull();
  });

  it("runs a trend only when every metric has a daily series, as the server requires", () => {
    expect(reportRunRequest(definition({ view: "trend", metrics: ["reach", "ctr"] }), range, daily)).toBeNull();
    expect(reportRunRequest(definition({ view: "trend", metrics: ["reach", "spend"] }), range, daily)).toBeNull();
    expect(reportRunRequest(definition({ view: "trend", metrics: ["spend"] }), range, daily)).not.toBeNull();
  });
});

describe("withView", () => {
  const daily: AdReportMetric[] = ["spend", "impressions", "linkClicks", "results", "conversations"];

  it("keeps only daily metrics and drops breakdowns for the trend, which the server accepts", () => {
    const pivot = definition({ breakdowns: ["age"], metrics: ["reach", "spend", "ctr", "results"] });
    expect(withView(pivot, "trend", daily)).toEqual({ ...pivot, view: "trend", breakdowns: [], metrics: ["spend", "results"] });
  });

  it("changes only the view for a table or bars", () => {
    const pivot = definition({ breakdowns: ["age"] });
    expect(withView(pivot, "bars", daily)).toEqual({ ...pivot, view: "bars" });
  });
});

describe("breakdownToggleAllowed", () => {
  const groups = [["age"], ["gender"], ["age", "gender"], ["publisher_platform"], ["publisher_platform", "platform_position"]];

  it("offers only selections Meta accepts", () => {
    expect(breakdownToggleAllowed([], "age", groups)).toBe(true);
    expect(breakdownToggleAllowed(["age"], "gender", groups)).toBe(true);
    expect(breakdownToggleAllowed(["age"], "publisher_platform", groups)).toBe(false);
    expect(breakdownToggleAllowed([], "platform_position", groups)).toBe(false);
    expect(breakdownToggleAllowed(["publisher_platform"], "platform_position", groups)).toBe(true);
  });

  it("never strands a selection Meta refuses when unticking", () => {
    expect(breakdownToggleAllowed(["publisher_platform", "platform_position"], "publisher_platform", groups)).toBe(false);
    expect(breakdownToggleAllowed(["publisher_platform", "platform_position"], "platform_position", groups)).toBe(true);
    expect(breakdownToggleAllowed(["age"], "age", groups)).toBe(true);
  });
});
