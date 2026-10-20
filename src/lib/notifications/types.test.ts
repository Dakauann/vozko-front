import { describe, expect, it } from "vitest";

import {
  NOTIFICATION_CATEGORIES,
  isNotificationCreatedEvent,
  isNotificationItem,
  isNotificationPage,
  isNotificationPreferences,
  isNotificationSummary,
  unreadBadgeLabel,
} from "./types";

const item = {
  id: "n1",
  category: "campaigns",
  severity: "warning",
  title: "Campanha pausada",
  body: "A campanha parou por saldo.",
  createdAt: "2026-10-16T12:00:00Z",
};

describe("notification wire guards", () => {
  it("lists the eleven categories of the contract in the order the server declares them", () => {
    expect(NOTIFICATION_CATEGORIES).toEqual([
      "announcements",
      "campaigns",
      "conversations",
      "templates",
      "channels",
      "billing",
      "advertising",
      "team",
      "support",
      "system",
      "automations",
    ]);
  });

  it("accepts an item with and without the optional fields", () => {
    expect(isNotificationItem(item)).toBe(true);
    expect(
      isNotificationItem({ ...item, imageUrl: "https://cdn/x.png", actionUrl: "/dashboard", actionLabel: "Abrir", readAt: "2026-10-16T13:00:00Z" }),
    ).toBe(true);
    expect(isNotificationItem({ ...item, readAt: null })).toBe(true);
  });

  it("refuses an item with an unknown category or severity, or missing text", () => {
    expect(isNotificationItem({ ...item, category: "gossip" })).toBe(false);
    expect(isNotificationItem({ ...item, severity: "loud" })).toBe(false);
    expect(isNotificationItem({ ...item, title: undefined })).toBe(false);
    expect(isNotificationItem({ ...item, imageUrl: 3 })).toBe(false);
    expect(isNotificationItem(null)).toBe(false);
  });

  it("accepts a page whose cursor is empty on the last page", () => {
    expect(isNotificationPage({ items: [item], next: "" })).toBe(true);
    expect(isNotificationPage({ items: [item] })).toBe(true);
    expect(isNotificationPage({ items: [{ ...item, id: 1 }], next: "" })).toBe(false);
    expect(isNotificationPage({ next: "" })).toBe(false);
  });

  it("reads the summary with per category counts", () => {
    expect(isNotificationSummary({ unread: 3, byCategory: { campaigns: 2, billing: 1 }, capped: false })).toBe(true);
    expect(isNotificationSummary({ unread: 0, byCategory: {}, capped: false })).toBe(true);
    expect(isNotificationSummary({ unread: "3", byCategory: {}, capped: false })).toBe(false);
    expect(isNotificationSummary({ unread: 3, byCategory: { campaigns: "2" }, capped: false })).toBe(false);
  });

  it("reads preferences as category lists with the digest choice", () => {
    expect(isNotificationPreferences({ categories: ["campaigns", "billing"], emailMuted: ["billing"], emailDigest: true })).toBe(true);
    expect(isNotificationPreferences({ categories: ["campaigns"], emailMuted: [7], emailDigest: false })).toBe(false);
  });

  it("refuses preferences without a digest choice", () => {
    expect(isNotificationPreferences({ categories: ["campaigns"], emailMuted: [] })).toBe(false);
    expect(isNotificationPreferences({ categories: ["campaigns"], emailMuted: [], emailDigest: "yes" })).toBe(false);
  });

  it("recognises the socket event payload", () => {
    expect(isNotificationCreatedEvent({ workspaceId: "ws-1", item })).toBe(true);
    expect(isNotificationCreatedEvent({ workspaceId: "ws-1", item: { id: "x" } })).toBe(false);
    expect(isNotificationCreatedEvent({ item })).toBe(false);
  });
});

describe("unreadBadgeLabel", () => {
  it("hides the badge with nothing unread", () => {
    expect(unreadBadgeLabel(0, false)).toBeNull();
  });

  it("prints small counts as they are", () => {
    expect(unreadBadgeLabel(7, false)).toBe("7");
    expect(unreadBadgeLabel(99, false)).toBe("99");
  });

  it("folds anything above 99, or a capped count, into 99+", () => {
    expect(unreadBadgeLabel(100, false)).toBe("99+");
    expect(unreadBadgeLabel(1000, true)).toBe("99+");
    expect(unreadBadgeLabel(12, true)).toBe("99+");
  });
});
