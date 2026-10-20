import { describe, expect, it } from "vitest";

import { placeByRecency, placeByWaiting, placementFor } from "./inbox-placement";
import type { InboxEntry } from "./types";

function entry(id: string, lastMessageAt: string, extra: Partial<InboxEntry> = {}): InboxEntry {
  return { entry_id: id, entry_type: "unofficial_whatsapp", last_message_at: lastMessageAt, ...extra } as InboxEntry;
}

function ids(entries: InboxEntry[]): string[] {
  return entries.map((e) => e.entry_id);
}

const inbox = [
  entry("recent", "2026-10-17T12:00:00Z"),
  entry("middle", "2026-10-16T12:00:00Z"),
  entry("history", "2026-10-10T08:30:00.123456Z"),
];

describe("placeByRecency", () => {
  it("keeps an opened conversation where it was when no message arrived", () => {
    const assigned = entry("history", "2026-10-10T08:30:00.123456Z", { assigned_user_id: "user-1" });
    const out = placeByRecency(inbox, assigned);
    expect(ids(out)).toEqual(["recent", "middle", "history"]);
    expect(out[2].assigned_user_id).toBe("user-1");
  });

  it("moves a conversation to the top when a newer message arrives", () => {
    expect(ids(placeByRecency(inbox, entry("middle", "2026-10-17T12:05:00Z")))).toEqual(["middle", "recent", "history"]);
  });

  it("does not move a conversation whose update carries an older or missing timestamp", () => {
    expect(ids(placeByRecency(inbox, entry("middle", "2026-10-15T00:00:00Z")))).toEqual(["recent", "middle", "history"]);
    expect(ids(placeByRecency(inbox, entry("middle", "")))).toEqual(["recent", "middle", "history"]);
  });

  it("puts a conversation the list did not have at the top", () => {
    expect(ids(placeByRecency(inbox, entry("new", "2026-10-17T13:00:00Z")))).toEqual(["new", "recent", "middle", "history"]);
  });

  it("matches on id and type together", () => {
    const sameIdOtherChannel = { ...entry("middle", "2026-10-17T12:05:00Z"), entry_type: "instagram" } as InboxEntry;
    const out = placeByRecency(inbox, sameIdOtherChannel);
    expect(out).toHaveLength(4);
    expect(out[0]).toBe(sameIdOtherChannel);
  });
});

describe("placeByWaiting", () => {
  const waitingList = [
    entry("longest", "2026-10-18T12:00:00Z", { waiting_since: "2026-10-18T09:00:00Z" }),
    entry("shorter", "2026-10-18T11:00:00Z", { waiting_since: "2026-10-18T10:00:00Z" }),
    entry("answered", "2026-10-18T11:30:00Z"),
    entry("older answered", "2026-10-18T08:00:00Z"),
  ];

  it("keeps a waiting row in place when the customer writes again, since the wait started at the first unanswered message", () => {
    const writesAgain = entry("shorter", "2026-10-18T12:30:00Z", { waiting_since: "2026-10-18T10:00:00Z", unread_count: 2 });
    const out = placeByWaiting(waitingList, writesAgain);
    expect(ids(out)).toEqual(["longest", "shorter", "answered", "older answered"]);
    expect(out[1]).toBe(writesAgain);
  });

  it("puts a row that starts waiting after the rows waiting longer, never at the top", () => {
    const startsWaiting = entry("older answered", "2026-10-18T12:40:00Z", { waiting_since: "2026-10-18T12:40:00Z" });
    expect(ids(placeByWaiting(waitingList, startsWaiting))).toEqual(["longest", "shorter", "older answered", "answered"]);
  });

  it("moves an answered row below every waiting row, first among the answered ones by recency", () => {
    const answered = entry("longest", "2026-10-18T12:45:00Z");
    expect(ids(placeByWaiting(waitingList, answered))).toEqual(["shorter", "longest", "answered", "older answered"]);
  });

  it("orders answered rows by their latest message", () => {
    const bumped = entry("older answered", "2026-10-18T12:50:00Z");
    expect(ids(placeByWaiting(waitingList, bumped))).toEqual(["longest", "shorter", "older answered", "answered"]);
  });

  it("inserts a row the list did not have at its waiting position", () => {
    const arrives = entry("new", "2026-10-18T12:55:00Z", { waiting_since: "2026-10-18T09:30:00Z" });
    expect(ids(placeByWaiting(waitingList, arrives))).toEqual(["longest", "new", "shorter", "answered", "older answered"]);
  });

  it("treats an unreadable waiting time as not waiting", () => {
    const unreadable = entry("new", "2026-10-18T07:00:00Z", { waiting_since: "soon" });
    expect(ids(placeByWaiting(waitingList, unreadable))).toEqual(["longest", "shorter", "answered", "older answered", "new"]);
  });

  it("matches on id and type together", () => {
    const sameIdOtherChannel = { ...entry("shorter", "2026-10-18T12:30:00Z"), entry_type: "instagram" } as InboxEntry;
    expect(placeByWaiting(waitingList, sameIdOtherChannel)).toHaveLength(5);
  });
});

describe("placementFor", () => {
  it("follows the sort the list was asked for", () => {
    expect(placementFor("waiting")).toBe(placeByWaiting);
    expect(placementFor("recent")).toBe(placeByRecency);
    expect(placementFor(undefined)).toBe(placeByRecency);
  });
});
