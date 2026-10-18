import { describe, expect, it } from "vitest";

import { placeUpdatedEntry } from "./inbox-placement";
import type { InboxEntry } from "./types";

function entry(id: string, lastMessageAt: string, extra: Partial<InboxEntry> = {}): InboxEntry {
  return { entry_id: id, entry_type: "unofficial_whatsapp", last_message_at: lastMessageAt, ...extra } as InboxEntry;
}

const inbox = [
  entry("recent", "2026-10-17T12:00:00Z"),
  entry("middle", "2026-10-16T12:00:00Z"),
  entry("history", "2026-10-10T08:30:00.123456Z"),
];

describe("placeUpdatedEntry", () => {
  it("keeps an opened conversation where it was when no message arrived", () => {
    const assigned = entry("history", "2026-10-10T08:30:00.123456Z", { assigned_user_id: "user-1" });
    const out = placeUpdatedEntry(inbox, assigned);
    expect(out.map((e) => e.entry_id)).toEqual(["recent", "middle", "history"]);
    expect(out[2].assigned_user_id).toBe("user-1");
  });

  it("moves a conversation to the top when a newer message arrives", () => {
    const out = placeUpdatedEntry(inbox, entry("middle", "2026-10-17T12:05:00Z"));
    expect(out.map((e) => e.entry_id)).toEqual(["middle", "recent", "history"]);
  });

  it("does not move a conversation whose update carries an older or missing timestamp", () => {
    expect(placeUpdatedEntry(inbox, entry("middle", "2026-10-15T00:00:00Z")).map((e) => e.entry_id)).toEqual([
      "recent",
      "middle",
      "history",
    ]);
    expect(placeUpdatedEntry(inbox, entry("middle", "")).map((e) => e.entry_id)).toEqual([
      "recent",
      "middle",
      "history",
    ]);
  });

  it("puts a conversation the list did not have at the top", () => {
    const out = placeUpdatedEntry(inbox, entry("new", "2026-10-17T13:00:00Z"));
    expect(out.map((e) => e.entry_id)).toEqual(["new", "recent", "middle", "history"]);
  });

  it("matches on id and type together", () => {
    const sameIdOtherChannel = { ...entry("middle", "2026-10-17T12:05:00Z"), entry_type: "instagram" } as InboxEntry;
    const out = placeUpdatedEntry(inbox, sameIdOtherChannel);
    expect(out).toHaveLength(4);
    expect(out[0]).toBe(sameIdOtherChannel);
  });
});
