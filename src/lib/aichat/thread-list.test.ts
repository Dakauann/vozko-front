import { describe, expect, it } from "vitest";

import { appendThreads, freshFirst, matchesTitle, threadActivity, threadPlace } from "./thread-list";
import type { ChatThread } from "./types";

function thread(id: string, title = id, extra: Partial<ChatThread> = {}): ChatThread {
  return { id, title, model: "m", createdAt: "2026-10-01T12:00:00Z", ...extra };
}

describe("appendThreads", () => {
  it("adds the next page after the loaded ones without repeating a session", () => {
    const loaded = [thread("a"), thread("b")];
    expect(appendThreads(loaded, [thread("b", "moved"), thread("c")]).map((t) => t.id)).toEqual(["a", "b", "c"]);
  });
});

describe("freshFirst", () => {
  it("puts the refreshed first page on top and keeps older pages below", () => {
    const loaded = [thread("a"), thread("b"), thread("c")];
    const fresh = [thread("c", "renamed", { running: true }), thread("a")];
    expect(freshFirst(fresh, loaded)).toEqual([fresh[0], fresh[1], loaded[1]]);
  });
});

describe("matchesTitle", () => {
  it("matches any part of the title ignoring case, and untitled sessions by their shown name", () => {
    expect(matchesTitle(thread("a", "Relatório da Equipe"), "equipe", "Nova conversa")).toBe(true);
    expect(matchesTitle(thread("a", "Relatório"), "agente", "Nova conversa")).toBe(false);
    expect(matchesTitle(thread("a", ""), "nova", "Nova conversa")).toBe(true);
    expect(matchesTitle(thread("a", "Qualquer"), "  ", "Nova conversa")).toBe(true);
  });
});

describe("threadPlace", () => {
  it("tells the open studio project apart from another one", () => {
    expect(threadPlace("p1", "p1")).toBe("here");
    expect(threadPlace("p2", "p1")).toBe("other_project");
    expect(threadPlace(undefined, "p1")).toBe("general");
  });

  it("marks studio sessions outside the studio and leaves plain sessions unmarked", () => {
    expect(threadPlace("p1", undefined)).toBe("studio");
    expect(threadPlace(undefined, undefined)).toBe("general");
    expect(threadPlace(null, undefined)).toBe("general");
  });
});

describe("threadActivity", () => {
  const now = new Date("2026-10-11T15:00:00Z");

  it("shows the time for today, a day name for yesterday and a date before that", () => {
    expect(threadActivity(thread("a", "a", { lastMessageAt: "2026-10-11T13:05:00Z" }), now, "pt", "UTC")).toEqual({ day: "today", text: "13:05" });
    expect(threadActivity(thread("a", "a", { lastMessageAt: "2026-10-10T09:00:00Z" }), now, "pt", "UTC")).toMatchObject({ day: "yesterday" });
    expect(threadActivity(thread("a", "a", { lastMessageAt: "2026-03-02T09:00:00Z" }), now, "en", "UTC")).toEqual({ day: "thisYear", text: "Mar 2" });
    expect(threadActivity(thread("a", "a", { lastMessageAt: "2025-03-02T09:00:00Z" }), now, "en", "UTC")).toEqual({ day: "older", text: "3/2/2025" });
  });

  it("falls back to the creation time and gives nothing for a missing or broken date", () => {
    expect(threadActivity(thread("a", "a", { lastMessageAt: null, createdAt: "2026-10-11T08:00:00Z" }), now, "pt", "UTC")).toEqual({ day: "today", text: "08:00" });
    expect(threadActivity({ id: "a", title: "a", model: "m", createdAt: "" }, now, "pt", "UTC")).toBeNull();
    expect(threadActivity({ id: "a", title: "a", model: "m", createdAt: "not a date" }, now, "pt", "UTC")).toBeNull();
  });
});
