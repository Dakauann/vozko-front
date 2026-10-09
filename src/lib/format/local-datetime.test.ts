import { describe, expect, it } from "vitest";

import { fromLocalDateTimeInput, toLocalDateTimeInput } from "./local-datetime";

describe("local date-time inputs", () => {
  it("writes a moment as the viewer's wall clock, to the minute", () => {
    const moment = new Date(2026, 9, 8, 14, 32, 59);
    expect(toLocalDateTimeInput(moment)).toBe("2026-10-08T14:32");
  });

  it("reads the wall clock back as the same moment", () => {
    expect(fromLocalDateTimeInput("2026-10-08T14:32")?.getTime()).toBe(new Date(2026, 9, 8, 14, 32).getTime());
  });

  it("refuses an empty or malformed value", () => {
    expect(fromLocalDateTimeInput("")).toBeNull();
    expect(fromLocalDateTimeInput("amanhã")).toBeNull();
    expect(fromLocalDateTimeInput("2026-13-40T99:99")).toBeNull();
  });
});
