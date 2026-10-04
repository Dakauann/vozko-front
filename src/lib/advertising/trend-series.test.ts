import { describe, expect, it } from "vitest";

import { bucketLabel, metricFormat, rowsFromHours, rowsFromTrend } from "./trend-series";
import type { AdLiveRow, AdMetrics } from "./types";

const metrics = (overrides: Partial<AdMetrics> = {}): AdMetrics => ({
  currency: "BRL",
  spend: 0,
  impressions: 0,
  clicks: 0,
  linkClicks: 0,
  results: 0,
  resultAction: "",
  mixedResults: false,
  costPerResult: null,
  conversations: 0,
  costPerConversation: null,
  cpc: null,
  cpm: null,
  ctr: null,
  ...overrides,
});

describe("rowsFromTrend", () => {
  it("keeps every chartable metric the backend computed for each bucket", () => {
    const [row] = rowsFromTrend([{ day: "2026-09-28", ...metrics({ results: 4, costPerResult: 2_500_000, ctr: 1.5 }) }], "week", "pt-BR");
    expect(row.key).toBe("2026-09-28");
    expect(row.values).toMatchObject({ results: 4, costPerResult: 2_500_000, ctr: 1.5, cpm: null });
  });
});

describe("bucketLabel", () => {
  it("names days and weeks by their first day and months by month", () => {
    expect(bucketLabel("2026-09-28", "week", "pt-BR")).toBe(bucketLabel("2026-09-28", "day", "pt-BR"));
    expect(bucketLabel("2026-10-01", "month", "en-US")).toBe("Oct 2026");
  });
});

describe("rowsFromHours", () => {
  it("orders Meta's hourly rows by hour of day and skips rows without an hour", () => {
    const live = (hour: string | null, results: number): AdLiveRow => ({
      objectId: "a1",
      dimensions: hour ? { hourly_stats_aggregated_by_advertiser_time_zone: hour } : null,
      metrics: metrics({ results }),
      reach: 0,
      frequency: 0,
      video: {} as AdLiveRow["video"],
      costPerThruPlay: null,
    });
    const rows = rowsFromHours([live("13:00:00 - 13:59:59", 2), live(null, 9), live("09:00:00 - 09:59:59", 1)]);
    expect(rows.map((row) => [row.label, row.values.results])).toEqual([
      ["09h", 1],
      ["13h", 2],
    ]);
  });
});

describe("metricFormat", () => {
  it("formats money, counts and rates differently", () => {
    expect(metricFormat("costPerResult")).toBe("micros");
    expect(metricFormat("ctr")).toBe("percent");
    expect(metricFormat("impressions")).toBe("count");
  });
});
