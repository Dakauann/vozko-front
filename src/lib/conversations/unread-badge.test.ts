import { describe, expect, it } from "vitest";

import { faviconBadgeText, titleWithoutUnread, unreadTitle } from "./unread-badge";

describe("unread count in the tab title", () => {
  it("prefixes the count in parentheses", () => {
    expect(unreadTitle("Workspace CRM", 3)).toBe("(3) Workspace CRM");
  });

  it("leaves the title alone when nothing is unread", () => {
    expect(unreadTitle("Workspace CRM", 0)).toBe("Workspace CRM");
  });

  it("caps large counts so the title stays readable in a narrow tab", () => {
    expect(unreadTitle("Workspace CRM", 250)).toBe("(99+) Workspace CRM");
  });

  it("never stacks a second prefix on a title that already carries one", () => {
    expect(unreadTitle("(2) Workspace CRM", 5)).toBe("(5) Workspace CRM");
    expect(titleWithoutUnread("(99+) Workspace CRM")).toBe("Workspace CRM");
    expect(titleWithoutUnread("(beta) Workspace CRM")).toBe("(beta) Workspace CRM");
  });
});

describe("unread count on the favicon", () => {
  it("draws nothing when nothing is unread", () => {
    expect(faviconBadgeText(0)).toBe("");
    expect(faviconBadgeText(-1)).toBe("");
  });

  it("fits one digit, then a capped label", () => {
    expect(faviconBadgeText(7)).toBe("7");
    expect(faviconBadgeText(10)).toBe("9+");
  });
});
