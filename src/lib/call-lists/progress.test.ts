import { describe, expect, it } from "vitest";

import { callListProgress, skippedReasons } from "./progress";
import type { CallList } from "./types";

function list(overrides: Partial<CallList> = {}): CallList {
  return {
    id: "l1",
    name: "Lista",
    status: "active",
    createdBy: "u1",
    assigneeIds: ["u1"],
    phone: { source: "identity" },
    selected: 1200,
    itemCount: 1000,
    closedCount: 250,
    openCount: 750,
    calledCount: 300,
    callbackCount: 12,
    acceptsOutcomes: true,
    statusMoves: ["paused", "archived"],
    skipped: { blocked: 150, no_number: 50 },
    createdAt: "2026-10-07T12:00:00Z",
    updatedAt: "2026-10-07T12:00:00Z",
    ...overrides,
  };
}

describe("callListProgress", () => {
  it("counts what is left, what is closed and what stayed out", () => {
    expect(callListProgress(list())).toEqual({ total: 1000, open: 750, closed: 250, skipped: 200, percent: 25 });
  });

  it("reads an empty list as no progress instead of dividing by zero", () => {
    expect(callListProgress(list({ itemCount: 0, closedCount: 0, openCount: 0, skipped: {} }))).toEqual({
      total: 0,
      open: 0,
      closed: 0,
      skipped: 0,
      percent: 0,
    });
  });

  it("never rounds an unfinished list up to 100 percent", () => {
    expect(callListProgress(list({ itemCount: 1000, closedCount: 999, openCount: 1 })).percent).toBe(99);
    expect(callListProgress(list({ itemCount: 3, closedCount: 3, openCount: 0 })).percent).toBe(100);
  });
});

describe("skippedReasons", () => {
  it("lists the reasons with leads, largest first, folding unknown reasons into other", () => {
    expect(skippedReasons({ blocked: 3, opted_out: 0, no_number: 9, legacy_reason: 2, other_new: 1 })).toEqual([
      { reason: "no_number", count: 9 },
      { reason: "blocked", count: 3 },
      { reason: "other", count: 3 },
    ]);
  });

  it("folds the reasons of the retired consent policy and list sign-off into other", () => {
    expect(skippedReasons({ blocked: 1, no_consent: 4, call_list_not_signed_off: 2 })).toEqual([
      { reason: "blocked", count: 1 },
      { reason: "other", count: 6 },
    ]);
  });

  it("is empty when nobody stayed out", () => {
    expect(skippedReasons({})).toEqual([]);
  });
});
