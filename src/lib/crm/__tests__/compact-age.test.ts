import { describe, expect, it } from "vitest";

import { compactAge } from "../compact-age";

const now = new Date("2026-10-18T12:00:00Z").getTime();

describe("compact age on a kanban card", () => {
  it("says now for anything under a minute", () => {
    expect(compactAge("2026-10-18T11:59:30Z", now)).toEqual({ unit: "now" });
  });

  it("counts minutes, hours and days as numbers so each locale writes its own unit", () => {
    expect(compactAge("2026-10-18T11:15:00Z", now)).toEqual({ unit: "minutes", value: 45 });
    expect(compactAge("2026-10-18T07:00:00Z", now)).toEqual({ unit: "hours", value: 5 });
    expect(compactAge("2026-10-15T12:00:00Z", now)).toEqual({ unit: "days", value: 3 });
  });

  it("falls back to the date after a week", () => {
    expect(compactAge("2026-10-01T12:00:00Z", now)).toEqual({
      unit: "date",
      date: new Date("2026-10-01T12:00:00Z"),
    });
  });

  it("has no age for a missing or broken timestamp", () => {
    expect(compactAge("", now)).toBeNull();
    expect(compactAge("not a date", now)).toBeNull();
  });
});
