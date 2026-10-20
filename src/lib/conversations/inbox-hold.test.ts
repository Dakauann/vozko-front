import { describe, expect, it } from "vitest";

import { holdPlacement, inboxEntryKey } from "./inbox-hold";
import { placeByRecency, placeByWaiting } from "./inbox-placement";
import type { InboxEntry } from "./types";

function entry(id: string, lastMessageAt: string, extra: Partial<InboxEntry> = {}): InboxEntry {
  return { entry_id: id, entry_type: "whatsapp", last_message_at: lastMessageAt, unread_count: 0, ...extra } as InboxEntry;
}

const listed = [
  entry("a", "2026-10-18T12:00:00Z"),
  entry("b", "2026-10-18T11:00:00Z"),
  entry("c", "2026-10-18T10:00:00Z"),
  entry("d", "2026-10-18T09:00:00Z"),
];

const held = listed.map(inboxEntryKey);

function ids(entries: InboxEntry[]): string[] {
  return entries.map((e) => e.entry_id);
}

describe("holding the inbox order under the pointer", () => {
  it("keeps the order and counts nothing when nothing moved", () => {
    expect(holdPlacement(held, listed)).toEqual({ entries: listed, pending: 0 });
  });

  it("keeps a row in place when a new message would move it to the top, and counts it", () => {
    const live = placeByRecency(listed, entry("c", "2026-10-18T12:30:00Z", { unread_count: 2 }));
    const out = holdPlacement(held, live);
    expect(ids(out.entries)).toEqual(["a", "b", "c", "d"]);
    expect(out.pending).toBe(1);
  });

  it("still shows the new content of a held row, such as its unread count", () => {
    const live = placeByRecency(listed, entry("c", "2026-10-18T12:30:00Z", { unread_count: 2 }));
    expect(holdPlacement(held, live).entries[2].unread_count).toBe(2);
  });

  it("counts every row that would move, once each", () => {
    let live = placeByRecency(listed, entry("c", "2026-10-18T12:30:00Z"));
    live = placeByRecency(live, entry("d", "2026-10-18T12:31:00Z"));
    live = placeByRecency(live, entry("c", "2026-10-18T12:32:00Z"));
    expect(holdPlacement(held, live).pending).toBe(2);
  });

  it("holds back a new conversation that would arrive at the top, and counts it", () => {
    const live = placeByRecency(listed, entry("new", "2026-10-18T12:40:00Z"));
    const out = holdPlacement(held, live);
    expect(ids(out.entries)).toEqual(["a", "b", "c", "d"]);
    expect(out.pending).toBe(1);
  });

  it("shows the next page as it loads, since rows below the pointer move nothing", () => {
    const live = [...listed, entry("e", "2026-10-18T08:00:00Z"), entry("f", "2026-10-18T07:00:00Z")];
    expect(holdPlacement(held, live)).toEqual({ entries: live, pending: 0 });
  });

  it("drops a row that left the list without counting it", () => {
    const live = listed.filter((e) => e.entry_id !== "b");
    expect(holdPlacement(held, live)).toEqual({ entries: live, pending: 0 });
  });

  it("tells channels apart when two rows share an id", () => {
    const instagram = entry("a", "2026-10-18T12:50:00Z", { entry_type: "instagram" });
    const live = [instagram, ...listed];
    const out = holdPlacement(held, live);
    expect(out.entries).toEqual(listed);
    expect(out.pending).toBe(1);
  });
});

describe("holding the inbox order in the waiting sort", () => {
  const waiting = [
    entry("a", "2026-10-18T12:00:00Z", { waiting_since: "2026-10-18T09:00:00Z" }),
    entry("b", "2026-10-18T11:00:00Z", { waiting_since: "2026-10-18T10:00:00Z" }),
    entry("c", "2026-10-18T11:30:00Z"),
  ];
  const heldWaiting = waiting.map(inboxEntryKey);

  it("counts nothing when a waiting customer writes again, since the row keeps its place", () => {
    const live = placeByWaiting(waiting, entry("b", "2026-10-18T12:30:00Z", { waiting_since: "2026-10-18T10:00:00Z", unread_count: 1 }));
    const out = holdPlacement(heldWaiting, live);
    expect(ids(out.entries)).toEqual(["a", "b", "c"]);
    expect(out.pending).toBe(0);
  });

  it("holds and counts a row that the answer moves out of the waiting group", () => {
    const live = placeByWaiting(waiting, entry("a", "2026-10-18T12:45:00Z"));
    const out = holdPlacement(heldWaiting, live);
    expect(ids(out.entries)).toEqual(["a", "b", "c"]);
    expect(out.pending).toBe(1);
  });
});
