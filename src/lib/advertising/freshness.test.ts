import { describe, expect, it } from "vitest";

import { STALE_AFTER_MS, syncIsStale } from "./freshness";

describe("syncIsStale", () => {
  const now = new Date("2026-10-04T15:00:00Z");

  it("refreshes an account whose numbers are older than a few minutes", () => {
    expect(syncIsStale("2026-10-04T14:28:00Z", now)).toBe(true);
    expect(syncIsStale(new Date(now.getTime() - STALE_AFTER_MS - 1).toISOString(), now)).toBe(true);
  });

  it("leaves a recent sync alone", () => {
    expect(syncIsStale("2026-10-04T14:58:00Z", now)).toBe(false);
  });

  it("refreshes an account that was never synced or has an unreadable time", () => {
    expect(syncIsStale(undefined, now)).toBe(true);
    expect(syncIsStale("not a date", now)).toBe(true);
  });
});
