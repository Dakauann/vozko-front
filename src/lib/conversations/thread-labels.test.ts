import { describe, expect, it } from "vitest";

import { dayLabel, fullDateTime, mediaLabelKey, messageTime, readAtLabel } from "./thread-labels";

const now = new Date(2026, 9, 18, 15, 30);
const at = (day: number, hour = 9, minute = 5) => new Date(2026, 9, day, hour, minute).toISOString();

describe("day label", () => {
  const cases: { name: string; iso: string; locale: string; expected: ReturnType<typeof dayLabel> }[] = [
    { name: "a message from earlier today says today", iso: at(18, 0, 1), locale: "pt", expected: { kind: "today" } },
    { name: "a message from late yesterday says yesterday", iso: at(17, 23, 59), locale: "pt", expected: { kind: "yesterday" } },
    {
      name: "an older message shows the date in the viewer's language",
      iso: at(3),
      locale: "en",
      expected: { kind: "date", text: new Intl.DateTimeFormat("en", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(2026, 9, 3, 9, 5)) },
    },
    {
      name: "the same date reads differently in German",
      iso: at(3),
      locale: "de",
      expected: { kind: "date", text: new Intl.DateTimeFormat("de", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(2026, 9, 3, 9, 5)) },
    },
    { name: "an unreadable timestamp is a missing value, never invented", iso: "not a date", locale: "pt", expected: { kind: "unknown" } },
    { name: "an empty timestamp is a missing value", iso: "", locale: "pt", expected: { kind: "unknown" } },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect(dayLabel(c.iso, now, c.locale)).toEqual(c.expected);
    });
  }

  it("does not call the first of the month yesterday when today is the second of the next", () => {
    const secondOfNovember = new Date(2026, 10, 2, 8, 0);
    expect(dayLabel(new Date(2026, 9, 31, 22, 0).toISOString(), secondOfNovember, "pt").kind).toBe("date");
    expect(dayLabel(new Date(2026, 10, 1, 22, 0).toISOString(), secondOfNovember, "pt").kind).toBe("yesterday");
  });
});

describe("message time", () => {
  it("formats hours and minutes in the viewer's language", () => {
    const iso = at(18, 14, 7);
    expect(messageTime(iso, "en")).toBe(
      new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso)),
    );
  });

  it("returns nothing for an unreadable timestamp so the caller shows the missing value", () => {
    expect(messageTime("garbage", "pt")).toBeNull();
  });
});

describe("media label key", () => {
  it.each([
    ["image", "image"],
    ["video", "video"],
    ["audio", "audio"],
    ["document", "document"],
    ["sticker", "document"],
  ])("labels %s as %s", (mediaType, key) => {
    expect(mediaLabelKey(mediaType)).toBe(key);
  });
});

describe("full date and time", () => {
  it("spells out the date and the time in the viewer's language", () => {
    const iso = at(3, 14, 7);
    expect(fullDateTime(iso, "de")).toBe(
      new Intl.DateTimeFormat("de", { dateStyle: "long", timeStyle: "short" }).format(new Date(iso)),
    );
  });

  it("returns nothing for an unreadable timestamp", () => {
    expect(fullDateTime("garbage", "pt")).toBeNull();
  });
});

describe("read at label", () => {
  it("gives only the time when the message was read the day it was sent", () => {
    const sent = at(18, 9, 0);
    const read = at(18, 14, 7);
    expect(readAtLabel(sent, read, "pt")).toEqual({ kind: "same-day", text: messageTime(read, "pt") });
  });

  it("gives the full date when the message was read on a later day", () => {
    const sent = at(17, 9, 0);
    const read = at(18, 14, 7);
    expect(readAtLabel(sent, read, "pt")).toEqual({ kind: "other-day", text: fullDateTime(read, "pt") });
  });

  it("says nothing when the message has no read time", () => {
    expect(readAtLabel(at(18), null, "pt")).toBeNull();
    expect(readAtLabel(at(18), "garbage", "pt")).toBeNull();
  });
});
