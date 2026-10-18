import { describe, expect, it } from "vitest";

import {
  matchesFilter,
  pagesAfterAllRead,
  pagesAfterArrival,
  pagesAfterReadChange,
  summaryAfterAllRead,
  summaryAfterArrival,
  summaryAfterReadChange,
} from "./inbox";
import type { NotificationItem, NotificationPage, NotificationSummary } from "./types";

function notification(id: string, category: NotificationItem["category"], readAt?: string): NotificationItem {
  return { id, category, severity: "info", title: id, body: "", createdAt: "2026-10-16T12:00:00Z", ...(readAt ? { readAt } : {}) };
}

const READ_AT = "2026-10-16T15:00:00Z";

const pages: NotificationPage[] = [
  { items: [notification("a", "campaigns"), notification("b", "billing", "2026-10-16T13:00:00Z")], next: "c1" },
  { items: [notification("c", "campaigns")], next: "" },
];

const summary: NotificationSummary = { unread: 2, byCategory: { campaigns: 2 }, capped: false };

describe("matchesFilter", () => {
  it("lets everything through the open filter", () => {
    expect(matchesFilter(notification("a", "team"), { category: "all", unreadOnly: false })).toBe(true);
  });

  it("checks the category and the unread flag", () => {
    expect(matchesFilter(notification("a", "team"), { category: "billing", unreadOnly: false })).toBe(false);
    expect(matchesFilter(notification("a", "team", READ_AT), { category: "team", unreadOnly: true })).toBe(false);
    expect(matchesFilter(notification("a", "team"), { category: "team", unreadOnly: true })).toBe(true);
  });
});

describe("pagesAfterReadChange", () => {
  it("stamps the read time on the named items only", () => {
    const next = pagesAfterReadChange(pages, new Set(["a", "c"]), READ_AT);

    expect(next[0].items[0].readAt).toBe(READ_AT);
    expect(next[0].items[1].readAt).toBe("2026-10-16T13:00:00Z");
    expect(next[1].items[0].readAt).toBe(READ_AT);
  });

  it("clears the read time when marking unread", () => {
    const next = pagesAfterReadChange(pages, new Set(["b"]), null);

    expect(next[0].items[1].readAt).toBeUndefined();
  });
});

describe("pagesAfterAllRead", () => {
  it("reads every unread item of the category", () => {
    const next = pagesAfterAllRead(pages, "campaigns", READ_AT);

    expect(next.flatMap((page) => page.items).map((entry) => entry.readAt)).toEqual([READ_AT, "2026-10-16T13:00:00Z", READ_AT]);
  });

  it("reads everything without a category", () => {
    const next = pagesAfterAllRead([{ items: [notification("x", "team"), notification("y", "billing")], next: "" }], null, READ_AT);

    expect(next[0].items.every((entry) => entry.readAt === READ_AT)).toBe(true);
  });

  it("leaves other categories untouched", () => {
    const next = pagesAfterAllRead([{ items: [notification("x", "team")], next: "" }], "billing", READ_AT);

    expect(next[0].items[0].readAt).toBeUndefined();
  });
});

describe("pagesAfterArrival", () => {
  it("puts a new item at the top of the first page", () => {
    const next = pagesAfterArrival(pages, notification("z", "team"));

    expect(next[0].items.map((entry) => entry.id)).toEqual(["z", "a", "b"]);
    expect(next[1]).toBe(pages[1]);
  });

  it("ignores an item the list already holds", () => {
    expect(pagesAfterArrival(pages, notification("c", "campaigns"))).toBe(pages);
  });

  it("starts a page when the list is empty", () => {
    expect(pagesAfterArrival([], notification("z", "team"))).toEqual([{ items: [notification("z", "team")], next: "" }]);
  });
});

describe("summary arithmetic", () => {
  it("drops the counts of items that were unread", () => {
    const next = summaryAfterReadChange(summary, [notification("a", "campaigns"), notification("b", "billing", READ_AT)], "read");

    expect(next).toEqual({ unread: 1, byCategory: { campaigns: 1 }, capped: false });
  });

  it("raises the counts of items that were read when marking unread", () => {
    const next = summaryAfterReadChange(summary, [notification("b", "billing", READ_AT), notification("a", "campaigns")], "unread");

    expect(next).toEqual({ unread: 3, byCategory: { campaigns: 2, billing: 1 }, capped: false });
  });

  it("never goes below zero", () => {
    const next = summaryAfterReadChange({ unread: 0, byCategory: {}, capped: false }, [notification("a", "team")], "read");

    expect(next).toEqual({ unread: 0, byCategory: { team: 0 }, capped: false });
  });

  it("clears one category or all of them", () => {
    const mixed: NotificationSummary = { unread: 5, byCategory: { campaigns: 2, billing: 3 }, capped: true };

    expect(summaryAfterAllRead(mixed, "billing")).toEqual({ unread: 2, byCategory: { campaigns: 2, billing: 0 }, capped: true });
    expect(summaryAfterAllRead(mixed, null)).toEqual({ unread: 0, byCategory: {}, capped: false });
  });

  it("counts an unread arrival", () => {
    expect(summaryAfterArrival(summary, notification("z", "team"))).toEqual({ unread: 3, byCategory: { campaigns: 2, team: 1 }, capped: false });
    expect(summaryAfterArrival(summary, notification("z", "team", READ_AT))).toBe(summary);
  });
});
