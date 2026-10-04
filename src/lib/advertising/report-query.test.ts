import { describe, expect, it } from "vitest";

import { MAX_LIVE_OBJECT_IDS, liveInsightsPath, reportCsvPath, reportQuery } from "./report-query";

const range = { since: "2026-09-01", until: "2026-09-30" };

describe("reportQuery", () => {
  it("carries the range, level and only the filters that are set", () => {
    expect(reportQuery({ level: "adset", range, campaignIds: ["1", "2"], adSetIds: [], search: "  promo " })).toBe(
      "since=2026-09-01&until=2026-09-30&level=adset&campaignIds=1%2C2&search=promo",
    );
  });

  it("scopes a report to given objects and groups a trend by week", () => {
    expect(reportQuery({ level: "adset", range, objectIds: ["s1"], compare: true })).toBe("since=2026-09-01&until=2026-09-30&level=adset&objectIds=s1&compare=1");
    expect(reportQuery({ range, granularity: "week" })).toBe("since=2026-09-01&until=2026-09-30&granularity=week");
    expect(reportQuery({ range, granularity: "day" })).toBe("since=2026-09-01&until=2026-09-30");
  });

  it("narrows a trend to one ad", () => {
    expect(reportQuery({ range, adIds: ["7"] })).toBe("since=2026-09-01&until=2026-09-30&adIds=7");
  });

  it("asks for the previous period only when comparing", () => {
    expect(reportQuery({ level: "campaign", range, compare: true })).toContain("compare=1");
    expect(reportQuery({ level: "campaign", range, compare: false })).not.toContain("compare");
  });
});

describe("reportCsvPath", () => {
  it("exports the same filters as the table, without the comparison", () => {
    expect(reportCsvPath("acc 1", { level: "ad", range, adSetIds: ["9"], search: "x", compare: true })).toBe(
      "/ads/accounts/acc%201/report.csv?since=2026-09-01&until=2026-09-30&level=ad&adSetIds=9&search=x",
    );
  });
});

describe("liveInsightsPath", () => {
  it("passes object ids, breakdowns and windows", () => {
    expect(
      liveInsightsPath("a", { level: "campaign", range, objectIds: ["1", "2"], breakdowns: ["age", "gender"], windows: ["7d_click"] }),
    ).toBe("/ads/accounts/a/insights?level=campaign&since=2026-09-01&until=2026-09-30&objectIds=1%2C2&breakdowns=age%2Cgender&windows=7d_click");
  });

  it("drops the id list when it would make the URL too long and merges by id instead", () => {
    const ids = Array.from({ length: MAX_LIVE_OBJECT_IDS + 1 }, (_, index) => String(index));
    expect(liveInsightsPath("a", { level: "ad", range, objectIds: ids })).not.toContain("objectIds");
  });
});
