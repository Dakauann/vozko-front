import { describe, expect, it } from "vitest";

import {
  NO_PERSONAL_MARKS,
  isMarkedUnread,
  isPinned,
  markRefusalKey,
  marksFromPage,
  pinnedFirst,
  pinnedMark,
  rendersUnread,
  unreadMark,
  withMark,
  withoutUnreadMark,
} from "./personal-marks";
import type { InboxEntry } from "./types";

const LATER = "2026-10-18T15:00:00Z";
const EARLIER = "2026-10-18T09:00:00Z";

function entry(id: string, extra: Partial<InboxEntry> = {}): InboxEntry {
  return { entry_id: id, entry_type: "whatsapp", unread_count: 0, ...extra } as InboxEntry;
}

describe("reading personal marks", () => {
  it("answers pinned and unread per entry", () => {
    const marks = withMark(withMark(NO_PERSONAL_MARKS, entry("a"), { pinned_at: EARLIER, unread_marked_at: EARLIER }), entry("b"), { unread_marked_at: LATER });
    expect(isPinned(marks, entry("a"))).toBe(true);
    expect(isMarkedUnread(marks, entry("a"))).toBe(true);
    expect(isMarkedUnread(marks, entry("b"))).toBe(true);
    expect(isPinned(marks, entry("b"))).toBe(false);
  });

  it("keeps the same id on another channel apart", () => {
    const marks = withMark(NO_PERSONAL_MARKS, entry("a"), { pinned_at: EARLIER });
    expect(isPinned(marks, entry("a", { entry_type: "telegram" }))).toBe(false);
  });

  it("forgets a mark that carries nothing", () => {
    const marks = withMark(withMark(NO_PERSONAL_MARKS, entry("a"), { pinned_at: EARLIER }), entry("a"), {});
    expect(marks.size).toBe(0);
  });

  it("renders a row unread when it has unread messages or the operator marked it unread", () => {
    const marks = withMark(NO_PERSONAL_MARKS, entry("a"), { unread_marked_at: EARLIER });
    expect(rendersUnread(entry("a"), marks)).toBe(true);
    expect(rendersUnread(entry("b", { unread_count: 2 }), marks)).toBe(true);
    expect(rendersUnread(entry("b"), marks)).toBe(false);
  });
});

describe("marks from a page", () => {
  it("replaces what it knew about every entry in the page, so a mark cleared elsewhere does not linger", () => {
    const known = withMark(withMark(NO_PERSONAL_MARKS, entry("a"), { pinned_at: EARLIER }), entry("z"), { pinned_at: EARLIER });
    const next = marksFromPage(known, [entry("a"), entry("b")], [{ entry_id: "b", entry_type: "whatsapp", pinned_at: LATER }]);
    expect(isPinned(next, entry("a"))).toBe(false);
    expect(isPinned(next, entry("b"))).toBe(true);
    expect(isPinned(next, entry("z"))).toBe(true);
  });

  it("keeps what it knew when the server sends no marks at all", () => {
    const known = withMark(NO_PERSONAL_MARKS, entry("a"), { pinned_at: EARLIER });
    expect(marksFromPage(known, [entry("a")], undefined)).toBe(known);
  });
});

describe("arranging the list", () => {
  it("puts pinned rows first and keeps the order inside each group", () => {
    const marks = withMark(withMark(NO_PERSONAL_MARKS, entry("c"), { pinned_at: EARLIER }), entry("a"), { pinned_at: EARLIER });
    const { pinned, others } = pinnedFirst([entry("a"), entry("b"), entry("c"), entry("d")], marks);
    expect(pinned.map((e) => e.entry_id)).toEqual(["a", "c"]);
    expect(others.map((e) => e.entry_id)).toEqual(["b", "d"]);
  });
});

describe("optimistic marks", () => {
  it("pins keeping the first pin time and unpins keeping the rest of the mark", () => {
    expect(pinnedMark({ pinned_at: EARLIER }, true, LATER)).toEqual({ pinned_at: EARLIER });
    expect(pinnedMark({ pinned_at: EARLIER, unread_marked_at: EARLIER }, false, LATER)).toEqual({ unread_marked_at: EARLIER });
    expect(pinnedMark(null, false, LATER)).toBeNull();
  });

  it("marks unread and clears the unread mark keeping the rest", () => {
    expect(unreadMark(null, LATER)).toEqual({ unread_marked_at: LATER });
    expect(withoutUnreadMark({ unread_marked_at: LATER, pinned_at: EARLIER })).toEqual({ pinned_at: EARLIER });
  });
});

describe("a refused mark change", () => {
  it("names the refusal by its code and falls back to a generic failure", () => {
    expect(markRefusalKey("not_allowed")).toBe("not_allowed");
    expect(markRefusalKey("invalid")).toBe("invalid");
    expect(markRefusalKey("something_new")).toBe("failed");
  });
});
