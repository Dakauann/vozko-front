import { describe, expect, it } from "vitest";

import type { DailyPoint } from "@/lib/unofficial-whatsapp-groups/types";

import {
  clipLabel,
  flowSeries,
  flowTotals,
  hasFlow,
  hasVolume,
  isIsolatedValue,
  outerSegmentKey,
  rowTotal,
  stackedHeight,
  volumeSeries,
} from "./chart-model";

function point(day: string, joins: number, leaves: number, messages = 0, activeGroups = 0): DailyPoint {
  return { day, joins, leaves, messages, activeGroups, net: joins - leaves };
}

describe("flowSeries", () => {
  it("mirrors leaves below zero and runs the balance", () => {
    expect(flowSeries([point("2026-10-01T00:00:00Z", 3, 1), point("2026-10-02", 0, 4), point("2026-10-03", 2, 0)])).toEqual([
      { day: "2026-10-01", joins: 3, leaves: 1, leavesDown: -1, net: 2, balance: 2 },
      { day: "2026-10-02", joins: 0, leaves: 4, leavesDown: -4, net: -4, balance: -2 },
      { day: "2026-10-03", joins: 2, leaves: 0, leavesDown: 0, net: 2, balance: 0 },
    ]);
  });

  it("totals the window", () => {
    expect(flowTotals([point("2026-10-01", 3, 1), point("2026-10-02", 0, 4)])).toEqual({ joins: 3, leaves: 5, net: -2 });
    expect(hasFlow([point("2026-10-01", 0, 0)])).toBe(false);
    expect(hasFlow([point("2026-10-01", 0, 1)])).toBe(true);
  });
});

describe("volumeSeries", () => {
  it("keeps messages and active groups per calendar day", () => {
    expect(volumeSeries([point("2026-10-01T00:00:00Z", 0, 0, 12, 3)])).toEqual([{ day: "2026-10-01", messages: 12, activeGroups: 3 }]);
    expect(hasVolume([point("2026-10-01", 0, 0, 0, 2)])).toBe(false);
    expect(hasVolume([point("2026-10-01", 0, 0, 1, 1)])).toBe(true);
  });
});

describe("isIsolatedValue", () => {
  it("detects a value with no neighbours", () => {
    const values = [null, 4, null, 2, 3, null];
    expect(isIsolatedValue(values, 1)).toBe(true);
    expect(isIsolatedValue(values, 3)).toBe(false);
    expect(isIsolatedValue(values, 0)).toBe(false);
    expect(isIsolatedValue([5], 0)).toBe(true);
    expect(isIsolatedValue(values, 9)).toBe(false);
  });
});

describe("clipLabel", () => {
  it("cuts long labels with an ellipsis", () => {
    expect(clipLabel("Grupo de vendas", 18)).toBe("Grupo de vendas");
    expect(clipLabel("Grupo de vendas da região sul", 18)).toBe("Grupo de vendas da…");
    expect(clipLabel("Grupo de vendas   extra", 16)).toBe("Grupo de vendas…");
  });
});

describe("stacked bars", () => {
  it("grows with the rows from a minimum height", () => {
    expect(stackedHeight(3, 30)).toBe(200);
    expect(stackedHeight(10, 30)).toBe(300);
  });

  it("sums the segments and finds the outer one", () => {
    const keys = ["positive", "neutral", "negative"];
    expect(rowTotal({ positive: 2, neutral: 0, negative: 3 }, keys)).toBe(5);
    expect(outerSegmentKey({ positive: 2, neutral: 1, negative: 0 }, keys)).toBe("neutral");
    expect(outerSegmentKey({ positive: 0 }, keys)).toBeUndefined();
  });
});
