import { describe, expect, it } from "vitest";

import {
  calendarDate,
  calendarDay,
  displayPhone,
  highAlertMark,
  initialsOf,
  isHiddenJid,
  jidLocal,
  lastEventBucket,
  personName,
  runDuration,
  shareOf,
} from "./format";

describe("jidLocal", () => {
  it("strips the server and the device suffix", () => {
    expect(jidLocal("5511999990000@s.whatsapp.net")).toBe("5511999990000");
    expect(jidLocal("5511999990000:12@s.whatsapp.net")).toBe("5511999990000");
    expect(jidLocal("12345678901234@lid")).toBe("12345678901234");
    expect(jidLocal("5511999990000")).toBe("5511999990000");
  });
});

describe("displayPhone", () => {
  it("formats the phone when present", () => {
    expect(displayPhone("5511987654321")).toBe("+55 (11) 98765-4321");
  });

  it("falls back to a phone JID", () => {
    expect(displayPhone(undefined, "5511987654321:3@s.whatsapp.net")).toBe("+55 (11) 98765-4321");
  });

  it("hides a lid JID", () => {
    expect(displayPhone(undefined, "123456789012345@lid")).toBeNull();
    expect(isHiddenJid("123456789012345@lid")).toBe(true);
    expect(isHiddenJid("5511987654321@s.whatsapp.net")).toBe(false);
  });

  it("prefers the phone over a lid JID", () => {
    expect(displayPhone("5511987654321", "123456789012345@lid")).toBe("+55 (11) 98765-4321");
  });

  it("returns null with nothing to show", () => {
    expect(displayPhone()).toBeNull();
    expect(displayPhone("", "")).toBeNull();
  });
});

describe("personName", () => {
  it("follows displayName, contactName, leadName, name", () => {
    expect(personName({ displayName: " Ana ", contactName: "Bia", leadName: "Cris", name: "Duda" })).toEqual({ label: "Ana", isFallback: false });
    expect(personName({ displayName: " ", contactName: "Bia", leadName: "Cris" })).toEqual({ label: "Bia", isFallback: false });
    expect(personName({ leadName: "Cris", name: "Duda" })).toEqual({ label: "Cris", isFallback: false });
    expect(personName({ name: "Duda" })).toEqual({ label: "Duda", isFallback: false });
  });

  it("falls back to the formatted phone", () => {
    expect(personName({ phone: "5511987654321" })).toEqual({ label: "+55 (11) 98765-4321", isFallback: true });
  });

  it("falls back to the JID local part when the number is hidden", () => {
    expect(personName({ jid: "123456789012345@lid" })).toEqual({ label: "123456789012345", isFallback: true });
  });

  it("returns an empty label with nothing at all", () => {
    expect(personName({})).toEqual({ label: "", isFallback: true });
  });
});

describe("initialsOf", () => {
  it("takes the first letter of two words", () => {
    expect(initialsOf("ana maria souza")).toBe("AM");
    expect(initialsOf("  Bia ")).toBe("B");
    expect(initialsOf("+55 (11)")).toBe("51");
    expect(initialsOf("")).toBe("");
  });
});

describe("runDuration", () => {
  const start = "2026-10-18T10:00:00.000Z";

  it("uses milliseconds under one second", () => {
    expect(runDuration(start, "2026-10-18T10:00:00.850Z")).toEqual({ unit: "ms", value: 850 });
  });

  it("uses tenths of a second under one minute", () => {
    expect(runDuration(start, "2026-10-18T10:00:03.240Z")).toEqual({ unit: "s", value: 3.2 });
  });

  it("splits minutes and seconds", () => {
    expect(runDuration(start, "2026-10-18T10:01:05.000Z")).toEqual({ unit: "min", value: 1, seconds: 5 });
    expect(runDuration(start, "2026-10-18T10:02:00.000Z")).toEqual({ unit: "min", value: 2, seconds: 0 });
  });

  it("returns null without a valid completion", () => {
    expect(runDuration(start)).toBeNull();
    expect(runDuration(start, "not a date")).toBeNull();
    expect(runDuration(start, "2026-10-18T09:59:00.000Z")).toBeNull();
  });
});

describe("lastEventBucket", () => {
  const now = new Date("2026-10-18T15:00:00.000Z");

  it("buckets by calendar day in the given timezone", () => {
    expect(lastEventBucket("2026-10-18T03:30:00.000Z", now, "America/Sao_Paulo")).toEqual({ kind: "today" });
    expect(lastEventBucket("2026-10-18T02:30:00.000Z", now, "America/Sao_Paulo")).toEqual({ kind: "yesterday" });
  });

  it("counts days under 30", () => {
    expect(lastEventBucket("2026-10-08T12:00:00.000Z", now, "UTC")).toEqual({ kind: "days", count: 10 });
    expect(lastEventBucket("2026-09-19T12:00:00.000Z", now, "UTC")).toEqual({ kind: "days", count: 29 });
  });

  it("counts months under 12", () => {
    expect(lastEventBucket("2026-09-18T12:00:00.000Z", now, "UTC")).toEqual({ kind: "months", count: 1 });
    expect(lastEventBucket("2026-04-18T12:00:00.000Z", now, "UTC")).toEqual({ kind: "months", count: 6 });
  });

  it("falls back to the date when older", () => {
    expect(lastEventBucket("2025-09-01T12:00:00.000Z", now, "UTC")).toEqual({ kind: "date" });
  });

  it("reports none without a valid instant", () => {
    expect(lastEventBucket(undefined, now)).toEqual({ kind: "none" });
    expect(lastEventBucket("garbage", now)).toEqual({ kind: "none" });
  });

  it("treats a future instant as today", () => {
    expect(lastEventBucket("2026-10-19T12:00:00.000Z", now, "UTC")).toEqual({ kind: "today" });
  });
});

describe("highAlertMark", () => {
  it("marks fault from 40 percent", () => {
    expect(highAlertMark(40, 5)).toBe("fault");
    expect(highAlertMark(72.5, 5)).toBe("fault");
  });

  it("marks warning above zero", () => {
    expect(highAlertMark(0.1, 5)).toBe("warning");
    expect(highAlertMark(39.9, 5)).toBe("warning");
  });

  it("marks healthy at zero with completed cycles", () => {
    expect(highAlertMark(0, 3)).toBe("healthy");
  });

  it("has no mark without a completed cycle", () => {
    expect(highAlertMark(0, 0)).toBeUndefined();
    expect(highAlertMark(50, 0)).toBeUndefined();
  });
});

describe("shareOf", () => {
  it("returns a percentage", () => {
    expect(shareOf(1, 4)).toBe(25);
    expect(shareOf(0, 4)).toBe(0);
  });

  it("returns null without a base", () => {
    expect(shareOf(3, 0)).toBeNull();
  });
});

describe("calendar days", () => {
  it("keeps the calendar date without shifting", () => {
    expect(calendarDay("2026-10-01T00:00:00-03:00")).toBe("2026-10-01");
    expect(calendarDate("2026-10-01")?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(calendarDate("nope")).toBeNull();
  });
});
