import { describe, expect, it } from "vitest";

import {
  MAXIMUM_MONTHS,
  RANGE_PRESETS,
  addDays,
  civilToday,
  dayToLocalDate,
  localDateToDay,
  earliestDay,
  isDay,
  previousRange,
  rangeForPreset,
  relativeSince,
  resolveRange,
  validRange,
  zonedDayStart,
} from "./date-range";

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

describe("Meta presets", () => {
  const today = "2026-10-03";

  it("lists the presets in Meta's order, ending with Personalizado", () => {
    expect(RANGE_PRESETS).toEqual([
      "today",
      "yesterday",
      "todayAndYesterday",
      "last7",
      "last14",
      "last28",
      "last30",
      "thisWeek",
      "lastWeek",
      "thisMonth",
      "lastMonth",
      "maximum",
      "custom",
    ]);
  });

  it("covers today and yesterday together and the 28 day window", () => {
    expect(rangeForPreset("todayAndYesterday", today)).toEqual({ since: "2026-10-02", until: today });
    expect(rangeForPreset("last28", today)).toEqual({ since: "2026-09-06", until: today });
  });

  it("starts weeks on Monday", () => {
    expect(rangeForPreset("thisWeek", today)).toEqual({ since: "2026-09-28", until: today });
    expect(rangeForPreset("lastWeek", today)).toEqual({ since: "2026-09-21", until: "2026-09-27" });
    expect(rangeForPreset("thisWeek", "2026-09-28")).toEqual({ since: "2026-09-28", until: "2026-09-28" });
    expect(rangeForPreset("lastWeek", "2026-10-04")).toEqual({ since: "2026-09-21", until: "2026-09-27" });
  });

  it("goes back 37 months for the maximum, clamping to the end of a shorter month", () => {
    expect(MAXIMUM_MONTHS).toBe(37);
    expect(rangeForPreset("maximum", today)).toEqual({ since: "2023-09-03", until: today });
    expect(rangeForPreset("maximum", "2026-03-31")).toEqual({ since: "2023-02-28", until: "2026-03-31" });
    expect(earliestDay(today)).toBe("2023-09-03");
  });
});

describe("resolveRange", () => {
  const today = "2026-10-03";

  it("uses the preset when one is chosen", () => {
    expect(resolveRange("last7", { since: "", until: "" }, today)).toEqual({ since: "2026-09-27", until: today });
  });

  it("accepts a custom range only when it is valid and inside the maximum window", () => {
    expect(resolveRange("custom", { since: "2026-09-01", until: "2026-09-10" }, today)).toEqual({ since: "2026-09-01", until: "2026-09-10" });
    expect(resolveRange("custom", { since: "2026-09-10", until: "2026-09-01" }, today)).toBeNull();
    expect(resolveRange("custom", { since: "2020-01-01", until: "2026-09-10" }, today)).toBeNull();
    expect(resolveRange("custom", { since: "2026-09-01", until: "2026-10-04" }, today)).toBeNull();
  });

  it("knows nothing without the account's today", () => {
    expect(resolveRange("last7", { since: "", until: "" }, null)).toBeNull();
    expect(resolveRange("custom", { since: "2026-09-01", until: "2026-09-10" }, null)).toBeNull();
  });
});

describe("previousRange", () => {
  it("is the same number of days right before the range", () => {
    expect(previousRange({ since: "2026-09-04", until: "2026-10-03" })).toEqual({ since: "2026-08-05", until: "2026-09-03" });
    expect(previousRange({ since: "2026-10-03", until: "2026-10-03" })).toEqual({ since: "2026-10-02", until: "2026-10-02" });
  });

  it("refuses an invalid range", () => {
    expect(previousRange({ since: "2026-10-03", until: "2026-10-01" })).toBeNull();
  });
});

describe("calendar days", () => {
  it("turns a civil day into a local calendar date and back without shifting it", () => {
    const date = dayToLocalDate("2026-10-03");
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(9);
    expect(date?.getDate()).toBe(3);
    expect(localDateToDay(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(dayToLocalDate("2026-02-30")).toBeNull();
  });
});
