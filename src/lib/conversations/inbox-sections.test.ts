import { describe, expect, it } from "vitest";

import { inboxSections, sectionEntries } from "./inbox-sections";
import { NO_PERSONAL_MARKS, withMark } from "./personal-marks";
import type { InboxEntry } from "./types";

function entry(id: string): InboxEntry {
  return { entry_id: id, entry_type: "whatsapp" } as InboxEntry;
}

function shape(items: ReturnType<typeof inboxSections>): string[] {
  return items.map((item) => (item.kind === "header" ? `#${item.section}` : item.entry.entry_id));
}

describe("inbox sections", () => {
  it("shows a plain list when nothing is pinned", () => {
    expect(shape(inboxSections([entry("a"), entry("b")], NO_PERSONAL_MARKS))).toEqual(["a", "b"]);
  });

  it("puts the pinned group on top with a header, then the rest under its own header", () => {
    const marks = withMark(NO_PERSONAL_MARKS, entry("b"), { pinned_at: "2026-10-18T10:00:00Z" });
    expect(shape(inboxSections([entry("a"), entry("b"), entry("c")], marks))).toEqual(["#pinned", "b", "#others", "a", "c"]);
  });

  it("drops the second header when every row is pinned", () => {
    const marks = withMark(NO_PERSONAL_MARKS, entry("a"), { pinned_at: "2026-10-18T10:00:00Z" });
    expect(shape(inboxSections([entry("a")], marks))).toEqual(["#pinned", "a"]);
  });

  it("lists the rows in the order shown, for keyboard focus and range selection", () => {
    const marks = withMark(NO_PERSONAL_MARKS, entry("c"), { pinned_at: "2026-10-18T10:00:00Z" });
    expect(sectionEntries(inboxSections([entry("a"), entry("c")], marks)).map((e) => e.entry_id)).toEqual(["c", "a"]);
  });
});
