import { describe, expect, it } from "vitest";

import { isMarkedUnread, isPinned } from "./personal-marks";
import {
  EMPTY_PERSONAL_MARKS_STATE,
  beginMarkChange,
  receiveMark,
  receivePage,
  refuseMarkChange,
} from "./personal-marks-state";
import type { InboxEntry } from "./types";

const AT = "2026-10-18T11:00:00Z";
const LATER = "2026-10-18T15:00:00Z";
const ana = { entry_id: "a", entry_type: "whatsapp" } as InboxEntry;

describe("a personal mark command", () => {
  it("shows the change at once and restores the previous mark when the server refuses that request", () => {
    const started = beginMarkChange(EMPTY_PERSONAL_MARKS_STATE, "req-1", ana, { pinned_at: AT });
    expect(isPinned(started.marks, ana)).toBe(true);
    const { state, owned } = refuseMarkChange(started, "req-1");
    expect(owned).toBe(true);
    expect(isPinned(state.marks, ana)).toBe(false);
  });

  it("takes the server's mark as the truth and settles the pending change", () => {
    const started = beginMarkChange(EMPTY_PERSONAL_MARKS_STATE, "req-1", ana, { unread_marked_at: LATER });
    const confirmed = receiveMark(started, { entry_id: "a", entry_type: "whatsapp", mark: { unread_marked_at: LATER } });
    expect(isMarkedUnread(confirmed.marks, ana)).toBe(true);
    const { state, owned } = refuseMarkChange(confirmed, "req-1");
    expect(owned).toBe(true);
    expect(isMarkedUnread(state.marks, ana)).toBe(true);
  });

  it("restores the mark from before the first of two quick changes when the second is refused", () => {
    const first = beginMarkChange(EMPTY_PERSONAL_MARKS_STATE, "req-1", ana, { pinned_at: AT });
    const second = beginMarkChange(first, "req-2", ana, { pinned_at: AT, unread_marked_at: LATER });
    const { state } = refuseMarkChange(second, "req-2");
    expect(state.marks.size).toBe(0);
  });

  it("does not roll back over a newer change when an older superseded request is refused", () => {
    const first = beginMarkChange(EMPTY_PERSONAL_MARKS_STATE, "req-1", ana, { pinned_at: AT });
    const second = beginMarkChange(first, "req-2", ana, null);
    const { state, owned } = refuseMarkChange(second, "req-1");
    expect(owned).toBe(true);
    expect(isPinned(state.marks, ana)).toBe(false);
  });

  it("leaves refusals of requests it never sent to the other handlers", () => {
    expect(refuseMarkChange(EMPTY_PERSONAL_MARKS_STATE, "someone-else").owned).toBe(false);
    expect(refuseMarkChange(EMPTY_PERSONAL_MARKS_STATE, undefined).owned).toBe(false);
  });

  it("applies marks that change by themselves, like opening the conversation clearing the unread mark", () => {
    const marked = receiveMark(EMPTY_PERSONAL_MARKS_STATE, { entry_id: "a", entry_type: "whatsapp", mark: { unread_marked_at: LATER } });
    const opened = receiveMark(marked, { entry_id: "a", entry_type: "whatsapp", mark: null });
    expect(opened.marks.size).toBe(0);
  });

  it("reads the marks a page brings", () => {
    const state = receivePage(EMPTY_PERSONAL_MARKS_STATE, [ana], [{ entry_id: "a", entry_type: "whatsapp", pinned_at: AT }]);
    expect(isPinned(state.marks, ana)).toBe(true);
  });
});
