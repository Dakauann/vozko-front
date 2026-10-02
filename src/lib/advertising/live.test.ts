import { describe, expect, it } from "vitest";

import { aggregateBreakdown, liveById, liveValue, mergeLiveRows, withLiveResults } from "./live";
import type { AdLiveRow, AdMetrics, AdRow } from "./types";

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

const live = (objectId: string, overrides: Partial<AdLiveRow> = {}): AdLiveRow => ({
  objectId,
  dimensions: null,
  metrics: metrics(),
  reach: 100,
  frequency: 1.5,
  video: { plays: 10, p25: 8, p50: 6, p75: 4, p95: 3, p100: 2, thruPlays: 5, avgWatchSeconds: 7.5 },
  costPerThruPlay: 2_000_000,
  ...overrides,
});

const row = (metaId: string): AdRow => ({
  metaId,
  level: "campaign",
  name: metaId,
  status: "ACTIVE",
  effectiveStatus: "ACTIVE",
  delivery: "active",
  isOn: true,
  canToggle: true,
  dailyBudget: 0,
  lifetimeBudget: 0,
  issues: [],
  metrics: metrics(),
  outcome: { conversations: 0, leads: 0, wonDeals: 0, revenue: 0, costPerConversation: null, costPerLead: null, roas: null },
});

describe("mergeLiveRows", () => {
  it("attaches the live row with the same id and leaves the others unknown, never zero", () => {
    const merged = mergeLiveRows([row("1"), row("2")], liveById([live("1", { reach: 42 })]));
    expect(merged[0].live?.reach).toBe(42);
    expect(merged[1].live).toBeNull();
    expect(liveValue(merged[1].live, "reach")).toBeNull();
  });

  it("marks every row unknown when the live call failed", () => {
    const merged = mergeLiveRows([row("1")], null);
    expect(liveValue(merged[0].live, "thruPlays")).toBeNull();
  });

  it("ignores breakdown rows when matching totals by id", () => {
    const map = liveById([live("1", { dimensions: { age: "18-24" }, reach: 5 }), live("1", { reach: 50 })]);
    expect(map.get("1")?.reach).toBe(50);
  });

  it("reads each video column", () => {
    const value = live("1");
    expect(liveValue(value, "videoPlays")).toBe(10);
    expect(liveValue(value, "videoP100")).toBe(2);
    expect(liveValue(value, "avgWatchSeconds")).toBe(7.5);
    expect(liveValue(value, "costPerThruPlay")).toBe(2_000_000);
  });
});

describe("aggregateBreakdown", () => {
  it("sums slices across objects, largest spend first, with each share", () => {
    const slices = aggregateBreakdown(
      [
        live("1", { dimensions: { age: "18-24" }, metrics: metrics({ spend: 1_000_000, impressions: 1000, results: 2 }) }),
        live("2", { dimensions: { age: "18-24" }, metrics: metrics({ spend: 1_000_000, impressions: 1000, results: 2 }) }),
        live("1", { dimensions: { age: "25-34" }, metrics: metrics({ spend: 6_000_000, impressions: 2000, results: 3 }) }),
      ],
      ["age"],
    );
    expect(slices.map((slice) => slice.values)).toEqual([["25-34"], ["18-24"]]);
    expect(slices[1].spend).toBe(2_000_000);
    expect(slices[1].results).toBe(4);
    expect(slices[1].costPerResult).toBe(500_000);
    expect(slices[0].share).toBe(0.75);
  });

  it("does not add reach across objects, since people overlap", () => {
    const slices = aggregateBreakdown(
      [live("1", { dimensions: { gender: "female" }, reach: 10 }), live("2", { dimensions: { gender: "female" }, reach: 20 })],
      ["gender"],
    );
    expect(slices[0].reach).toBeNull();
    expect(aggregateBreakdown([live("1", { dimensions: { gender: "male" }, reach: 10 })], ["gender"])[0].reach).toBe(10);
  });

  it("leaves results unknown when the slices count different things", () => {
    const slices = aggregateBreakdown(
      [
        live("1", { dimensions: { age: "18-24" }, metrics: metrics({ results: 2 }) }),
        live("2", { dimensions: { age: "18-24" }, metrics: metrics({ results: 2, resultAction: "lead" }) }),
      ],
      ["age"],
    );
    expect(slices[0].results).toBeNull();
    expect(slices[0].costPerResult).toBeNull();
  });
});

describe("withLiveResults", () => {
  it("reads results from the live row when an attribution window is chosen", () => {
    const [merged] = mergeLiveRows([row("1")], liveById([live("1", { metrics: metrics({ results: 7, costPerResult: 3 }) })]));
    expect(withLiveResults(merged).metrics.results).toBe(7);
    expect(withLiveResults(merged).metrics.costPerResult).toBe(3);
  });

  it("makes results unknown when the live row is missing", () => {
    const [merged] = mergeLiveRows([row("1")], null);
    expect(withLiveResults(merged).metrics.resultAction).toBe("");
    expect(withLiveResults(merged).metrics.costPerResult).toBeNull();
  });
});
