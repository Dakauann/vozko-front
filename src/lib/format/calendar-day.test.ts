import { describe, expect, it } from "vitest";

import { relativeDayOf } from "./calendar-day";

const SAO_PAULO = "America/Sao_Paulo";

describe("relativeDayOf", () => {
  const now = new Date("2026-10-08T18:00:00Z");

  it.each([
    ["earlier the same day", "2026-10-08T12:32:00Z", "today"],
    ["the day before", "2026-10-07T13:05:00Z", "yesterday"],
    ["two days before", "2026-10-06T23:00:00Z", "thisYear"],
    ["earlier the same year", "2026-01-02T15:00:00Z", "thisYear"],
    ["a past year", "2025-12-30T15:00:00Z", "older"],
  ])("calls a moment %s by its calendar day", (_, at, expected) => {
    expect(relativeDayOf(new Date(at), now, SAO_PAULO)).toBe(expected);
  });

  it("counts days on the viewer's own calendar, not in UTC", () => {
    const lateEvening = new Date("2026-10-09T01:30:00Z");
    expect(relativeDayOf(new Date("2026-10-08T12:00:00Z"), lateEvening, SAO_PAULO)).toBe("today");
    expect(relativeDayOf(new Date("2026-10-08T12:00:00Z"), lateEvening, "UTC")).toBe("yesterday");
  });

  it("gives a later moment of today as today and a later day as a plain date", () => {
    expect(relativeDayOf(new Date("2026-10-08T20:00:00Z"), now, SAO_PAULO)).toBe("today");
    expect(relativeDayOf(new Date("2026-10-10T12:00:00Z"), now, SAO_PAULO)).toBe("thisYear");
  });

  it("refuses to call an invalid moment anything but a plain date", () => {
    expect(relativeDayOf(new Date("x"), now, SAO_PAULO)).toBe("older");
  });
});
