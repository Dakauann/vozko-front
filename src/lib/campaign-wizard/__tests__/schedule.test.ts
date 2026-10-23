import { describe, expect, it } from "vitest";

import { defaultScheduleValue, isoFromZonedInput, zonedInputFromIso, zonedInputValue } from "../schedule";

const ZONE = "America/Sao_Paulo";

describe("schedule in the campaign time zone", () => {
  it("reads the picked wall time in the campaign zone, not the browser zone", () => {
    expect(isoFromZonedInput("2026-11-20T09:30", ZONE)).toBe("2026-11-20T12:30:00.000Z");
    expect(isoFromZonedInput("2026-11-20T09:30", "UTC")).toBe("2026-11-20T09:30:00.000Z");
  });

  it("refuses an empty or malformed value", () => {
    expect(isoFromZonedInput("", ZONE)).toBeNull();
    expect(isoFromZonedInput("amanhã", ZONE)).toBeNull();
  });

  it("shows a stored instant as wall time in the campaign zone", () => {
    expect(zonedInputFromIso("2026-11-20T12:30:00Z", ZONE)).toBe("2026-11-20T09:30");
    expect(zonedInputFromIso(undefined, ZONE)).toBe("");
    expect(zonedInputValue(new Date("2026-01-01T02:05:00Z"), ZONE)).toBe("2025-12-31T23:05");
  });

  it("suggests the next whole hour in the campaign zone", () => {
    expect(defaultScheduleValue(new Date("2026-11-20T12:10:00Z"), ZONE)).toBe("2026-11-20T10:00");
  });
});
