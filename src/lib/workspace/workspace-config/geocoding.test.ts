import { describe, expect, it } from "vitest";

import {
  geocodingProviderStamp,
  geocodingCeilingStamp,
  geocodingUsage,
  providerMissing,
  providerToEnable,
  readCeilingInput,
  readGeocodingSettings,
  type GeocodingSettings,
} from "./geocoding";

const answer = {
  provider: "opencage",
  enabled: true,
  providerChangedBy: "u-1",
  providerChangedByName: "Ana Souza",
  providerChangedAt: "2026-10-08T12:00:00Z",
  monthlyCeiling: 5000,
  dailyShare: 323,
  usedThisCycle: 120,
  usedToday: 12,
  exhausted: "",
  cycleStart: "2026-10-01T03:00:00Z",
  nextCycleStart: "2026-11-01T03:00:00Z",
  availableProviders: ["opencage"],
  attribution: "IBGE, CNEFE 2022",
  canChangeProvider: true,
  canChangeCeiling: false,
  providerPause: null,
};

const paused = { state: "paused", reason: "key_rejected", since: "2026-10-08T15:00:00Z", until: "2026-10-08T16:00:00Z" };

function settings(overrides: Partial<GeocodingSettings> = {}): GeocodingSettings {
  return { ...(readGeocodingSettings(answer) as GeocodingSettings), ...overrides };
}

describe("readGeocodingSettings", () => {
  it("keeps every verdict, count and stamp the server sent", () => {
    expect(readGeocodingSettings(answer)).toEqual({
      provider: "opencage",
      enabled: true,
      providerChangedBy: "u-1",
      providerChangedByName: "Ana Souza",
      providerChangedAt: "2026-10-08T12:00:00Z",
      monthlyCeiling: 5000,
      ceilingChangedBy: undefined,
      ceilingChangedByName: undefined,
      ceilingChangedAt: undefined,
      dailyShare: 323,
      usedThisCycle: 120,
      usedToday: 12,
      exhausted: "",
      cycleStart: "2026-10-01T03:00:00Z",
      nextCycleStart: "2026-11-01T03:00:00Z",
      availableProviders: ["opencage"],
      attribution: "IBGE, CNEFE 2022",
      canChangeProvider: true,
      canChangeCeiling: false,
      providerPause: null,
    });
  });

  it.each(["key_rejected", "account_quota_spent", "key_disabled", "account_refused", "queries_refused"])(
    "keeps a provider pause for %s with when it started and ends",
    (reason) => {
      expect(readGeocodingSettings({ ...answer, providerPause: { ...paused, reason } })?.providerPause).toEqual({ ...paused, reason });
    },
  );

  it("keeps a pause whose reason this front does not know yet, without guessing the reason", () => {
    expect(readGeocodingSettings({ ...answer, providerPause: { ...paused, reason: "key_expired" } })?.providerPause).toEqual({ ...paused, reason: "other" });
    expect(readGeocodingSettings({ ...answer, providerPause: { ...paused, reason: undefined } })?.providerPause).toEqual({ ...paused, reason: "other" });
  });

  it("keeps a pause the server could not read as unknown", () => {
    expect(readGeocodingSettings({ ...answer, providerPause: { state: "unknown" } })?.providerPause).toEqual({ state: "unknown" });
  });

  it("refuses an answer that does not say whether the provider is paused", () => {
    const partial: Record<string, unknown> = { ...answer };
    delete partial.providerPause;
    expect(readGeocodingSettings(partial)).toBeNull();
  });

  it.each([
    ["an unknown state", { ...paused, state: "resting" }],
    ["a pause without its start", { ...paused, since: undefined }],
    ["a pause without its end", { ...paused, until: undefined }],
    ["a start that is not a date", { ...paused, since: "ontem" }],
    ["a reason that is not text", { ...paused, reason: 3 }],
    ["a pause that is not an object", "paused"],
  ])("refuses %s", (_, providerPause) => {
    expect(readGeocodingSettings({ ...answer, providerPause })).toBeNull();
  });

  it.each(["enabled", "canChangeProvider", "canChangeCeiling"])("refuses an answer without the %s verdict", (key) => {
    const partial: Record<string, unknown> = { ...answer };
    delete partial[key];
    expect(readGeocodingSettings(partial)).toBeNull();
    expect(readGeocodingSettings({ ...answer, [key]: "true" })).toBeNull();
  });

  it.each(["monthlyCeiling", "dailyShare", "usedThisCycle", "usedToday"])("never reads a missing %s as zero", (key) => {
    const partial: Record<string, unknown> = { ...answer };
    delete partial[key];
    expect(readGeocodingSettings(partial)).toBeNull();
    expect(readGeocodingSettings({ ...answer, [key]: -1 })).toBeNull();
    expect(readGeocodingSettings({ ...answer, [key]: 1.5 })).toBeNull();
  });

  it.each(["monthly", "daily", ""])("keeps the server's %j exhaustion verdict", (exhausted) => {
    expect(readGeocodingSettings({ ...answer, exhausted })?.exhausted).toBe(exhausted);
  });

  it("refuses an answer without a known exhaustion verdict", () => {
    const partial: Record<string, unknown> = { ...answer };
    delete partial.exhausted;
    expect(readGeocodingSettings(partial)).toBeNull();
    expect(readGeocodingSettings({ ...answer, exhausted: "weekly" })).toBeNull();
  });

  it("refuses a provider list that is not a list of names", () => {
    expect(readGeocodingSettings({ ...answer, availableProviders: "opencage" })).toBeNull();
    expect(readGeocodingSettings({ ...answer, availableProviders: [3] })).toBeNull();
  });

  it("refuses a provider or attribution that is not text, and a cycle date that is not a date", () => {
    expect(readGeocodingSettings({ ...answer, provider: null })).toBeNull();
    expect(readGeocodingSettings({ ...answer, attribution: 1 })).toBeNull();
    expect(readGeocodingSettings({ ...answer, cycleStart: "ontem" })).toBeNull();
    expect(readGeocodingSettings({ ...answer, ceilingChangedAt: "ontem" })).toBeNull();
  });

  it("reads a workspace without a cycle yet", () => {
    const partial: Record<string, unknown> = { ...answer };
    delete partial.cycleStart;
    delete partial.nextCycleStart;
    expect(readGeocodingSettings(partial)).toMatchObject({ cycleStart: undefined, nextCycleStart: undefined });
  });

  it.each([null, [], "x"])("refuses %j", (value) => {
    expect(readGeocodingSettings(value)).toBeNull();
  });
});

describe("providerToEnable", () => {
  it("is the first provider this server can use", () => {
    expect(providerToEnable(settings({ provider: "", enabled: false }))).toBe("opencage");
  });

  it("keeps the provider the workspace already chose", () => {
    expect(providerToEnable(settings({ provider: "opencage", availableProviders: ["other", "opencage"] }))).toBe("opencage");
  });

  it("has nothing to enable when the server has no provider", () => {
    expect(providerToEnable(settings({ provider: "", enabled: false, availableProviders: [] }))).toBeNull();
  });
});

describe("providerMissing", () => {
  it("is true when the workspace turned on a provider this server can no longer use", () => {
    expect(providerMissing(settings({ availableProviders: [] }))).toBe(true);
    expect(providerMissing(settings({ availableProviders: ["other"] }))).toBe(true);
  });

  it("is false for a usable provider and while the provider is off", () => {
    expect(providerMissing(settings())).toBe(false);
    expect(providerMissing(settings({ provider: "", enabled: false, availableProviders: [] }))).toBe(false);
  });
});

describe("geocodingUsage", () => {
  it("measures the cycle's queries against the ceiling", () => {
    expect(geocodingUsage(settings({ usedThisCycle: 1250, monthlyCeiling: 5000 }))).toEqual({ percent: 25, state: "open" });
  });

  it("is reached when the server says the month is used, and never draws past the ceiling", () => {
    expect(geocodingUsage(settings({ usedThisCycle: 5000, monthlyCeiling: 5000, exhausted: "monthly" }))).toEqual({ percent: 100, state: "reached" });
    expect(geocodingUsage(settings({ usedThisCycle: 6000, monthlyCeiling: 5000, exhausted: "monthly" }))).toEqual({ percent: 100, state: "reached" });
  });

  it("takes the verdict from the server, not from the counts", () => {
    expect(geocodingUsage(settings({ usedThisCycle: 5000, monthlyCeiling: 5000, exhausted: "" }))).toEqual({ percent: 100, state: "open" });
    expect(geocodingUsage(settings({ usedThisCycle: 10, monthlyCeiling: 5000, exhausted: "monthly" }))).toEqual({ percent: 0.2, state: "reached" });
  });

  it("is today's share reached when the server says the day is used", () => {
    expect(geocodingUsage(settings({ usedThisCycle: 1250, monthlyCeiling: 5000, exhausted: "daily" }))).toEqual({ percent: 25, state: "todayReached" });
  });

  it("has no share for a zero ceiling, which allows no query at all", () => {
    expect(geocodingUsage(settings({ usedThisCycle: 0, monthlyCeiling: 0 }))).toEqual({ percent: null, state: "none" });
  });

  it("has no share while the provider is off", () => {
    expect(geocodingUsage(settings({ provider: "", enabled: false, monthlyCeiling: 0 }))).toEqual({ percent: null, state: "off" });
  });
});

describe("readCeilingInput", () => {
  it.each([
    ["5000", 5000],
    [" 0 ", 0],
    ["12500", 12500],
  ])("reads %j as %d", (text, value) => {
    expect(readCeilingInput(text)).toBe(value);
  });

  it.each(["", "abc", "-1", "1,5", "1.5", "5e3", "5,000", "5.000"])("refuses %j", (text) => {
    expect(readCeilingInput(text)).toBeNull();
  });
});

describe("stamps", () => {
  it("reads who chose the provider and who set the ceiling", () => {
    expect(geocodingProviderStamp(settings())).toEqual({ by: "Ana Souza", at: "2026-10-08T12:00:00Z" });
    expect(geocodingCeilingStamp(settings())).toBeNull();
    expect(geocodingCeilingStamp(settings({ ceilingChangedAt: "2026-10-09T12:00:00Z" }))).toEqual({ by: null, at: "2026-10-09T12:00:00Z" });
  });
});
