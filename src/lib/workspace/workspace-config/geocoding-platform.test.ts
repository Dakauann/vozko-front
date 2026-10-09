import { describe, expect, it } from "vitest";

import { geocodingPlatformErrorKey, geocodingPlatformUsage, readGeocodingPlatformPage } from "./geocoding-platform";

const months = Array.from({ length: 12 }, (_, i) => ({
  cycleStart: new Date(Date.UTC(2026, 9 - i, 1, 3)).toISOString(),
  requests: i === 0 ? 40 : 0,
}));

const coverage = {
  total: 10,
  withAddress: 8,
  withoutAddress: 2,
  onMap: 5,
  approximate: 2,
  pending: 1,
  notFound: 0,
  quotaExceeded: 0,
  refused: 0,
  addressShare: 0.8,
  mapShare: 0.5,
};

const item = {
  workspaceId: "ws-1",
  workspaceName: "Escola",
  provider: "opencage",
  enabled: true,
  monthlyCeiling: 5000,
  ceilingSet: false,
  providerChangedAt: "2026-10-02T12:00:00Z",
  usedThisCycle: 40,
  usedToday: 3,
  months,
  coverage,
};

const answer = {
  cycleStart: "2026-10-01T03:00:00Z",
  nextCycleStart: "2026-11-01T03:00:00Z",
  today: "2026-10-08T03:00:00Z",
  cycles: months.map((m) => m.cycleStart),
  items: [item],
  page: 1,
  pageSize: 20,
  totalItems: 1,
  totalPages: 1,
};

describe("readGeocodingPlatformPage", () => {
  it("reads a page of workspaces with their usage history and coverage", () => {
    const page = readGeocodingPlatformPage(answer);
    expect(page?.items[0]).toEqual(item);
    expect(page?.cycles).toHaveLength(12);
    expect(page?.totalItems).toBe(1);
  });

  it("reads a workspace that never changed its provider", () => {
    const page = readGeocodingPlatformPage({ ...answer, items: [{ ...item, provider: "", enabled: false, providerChangedAt: null }] });
    expect(page?.items[0].providerChangedAt).toBeUndefined();
    expect(page?.items[0].provider).toBe("");
  });

  it.each([
    ["not an object", null],
    ["a missing items list", { ...answer, items: undefined }],
    ["a negative count", { ...answer, items: [{ ...item, usedThisCycle: -1 }] }],
    ["a share above one", { ...answer, items: [{ ...item, coverage: { ...coverage, mapShare: 1.5 } }] }],
    ["a month without its cycle", { ...answer, items: [{ ...item, months: [{ requests: 1 }] }] }],
    ["an unreadable cycle", { ...answer, cycleStart: "soon" }],
    ["a missing verdict", { ...answer, items: [{ ...item, enabled: "yes" }] }],
    ["a missing page count", { ...answer, totalPages: undefined }],
  ])("refuses %s", (_, value) => {
    expect(readGeocodingPlatformPage(value)).toBeNull();
  });
});

describe("geocodingPlatformUsage", () => {
  it.each([
    [true, 40, 5000, { percent: 0.8, state: "open" }],
    [true, 5000, 5000, { percent: 100, state: "reached" }],
    [true, 6000, 5000, { percent: 100, state: "reached" }],
    [true, 10, 0, { percent: null, state: "none" }],
    [false, 10, 0, { percent: null, state: "off" }],
  ])("reads enabled %s with %i of %i", (enabled, used, ceiling, usage) => {
    expect(geocodingPlatformUsage({ enabled, usedThisCycle: used, monthlyCeiling: ceiling })).toEqual(usage);
  });
});

describe("geocodingPlatformErrorKey", () => {
  it.each([
    [{ status: 403 }, "forbidden"],
    [{ status: 403, code: "geocoding_platform_forbidden" }, "forbidden"],
    [{ status: 503, code: "geocoding_unavailable" }, "unavailable"],
    [{ status: 503 }, "busy"],
    [{ status: 504 }, "slow"],
    [{ status: 500, code: "geocoding_usage_unreadable" }, "default"],
    [{ message: "Malformed" }, "default"],
  ])("maps %o to %s", (error, key) => {
    expect(geocodingPlatformErrorKey(error)).toBe(key);
  });
});
