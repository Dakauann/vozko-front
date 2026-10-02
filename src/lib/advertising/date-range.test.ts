import { describe, expect, it } from "vitest";

import { addDays, civilToday, isDay, rangeForPreset, relativeSince, validRange, zonedDayStart } from "./date-range";

describe("civilToday", () => {
  it("reads the day in the ad account timezone, not the browser's", () => {
    const now = new Date("2026-10-02T01:30:00Z");
    expect(civilToday("America/Sao_Paulo", now)).toBe("2026-10-01");
    expect(civilToday("Asia/Tokyo", now)).toBe("2026-10-02");
  });

  it("returns null for an unknown timezone", () => {
    expect(civilToday("Mars/Olympus", new Date())).toBeNull();
    expect(civilToday("", new Date())).toBeNull();
  });
});

describe("rangeForPreset", () => {
  const today = "2026-03-15";

  it("builds inclusive civil-day ranges", () => {
    expect(rangeForPreset("today", today)).toEqual({ since: today, until: today });
    expect(rangeForPreset("yesterday", today)).toEqual({ since: "2026-03-14", until: "2026-03-14" });
    expect(rangeForPreset("last7", today)).toEqual({ since: "2026-03-09", until: today });
    expect(rangeForPreset("last14", today)).toEqual({ since: "2026-03-02", until: today });
    expect(rangeForPreset("last30", today)).toEqual({ since: "2026-02-14", until: today });
    expect(rangeForPreset("thisMonth", today)).toEqual({ since: "2026-03-01", until: today });
    expect(rangeForPreset("lastMonth", today)).toEqual({ since: "2026-02-01", until: "2026-02-28" });
  });

  it("crosses the year for last month in January", () => {
    expect(rangeForPreset("lastMonth", "2026-01-10")).toEqual({ since: "2025-12-01", until: "2025-12-31" });
  });
});

describe("day helpers", () => {
  it("validates days and ranges", () => {
    expect(isDay("2026-02-29")).toBe(false);
    expect(isDay("2028-02-29")).toBe(true);
    expect(validRange({ since: "2026-01-02", until: "2026-01-01" })).toBe(false);
    expect(validRange({ since: "2026-01-01", until: "2026-01-01" })).toBe(true);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("finds midnight of a civil day in a timezone", () => {
    expect(zonedDayStart("2026-10-01", "America/Sao_Paulo")).toBe("2026-10-01T03:00:00.000Z");
    expect(zonedDayStart("2026-10-01", "UTC")).toBe("2026-10-01T00:00:00.000Z");
    expect(zonedDayStart("2026-10-01", "")).toBeNull();
  });
});

describe("relativeSince", () => {
  it("describes how long ago a sync happened", () => {
    const now = new Date("2026-10-01T12:00:00Z");
    expect(relativeSince("2026-10-01T11:55:00Z", now, "pt-BR")).toBe("há 5 minutos");
    expect(relativeSince("2026-10-01T12:00:00Z", now, "pt-BR")).toBe("agora");
    expect(relativeSince(undefined, now, "pt-BR")).toBeNull();
  });
});
