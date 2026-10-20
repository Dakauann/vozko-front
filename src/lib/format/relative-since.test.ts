import { describe, expect, it } from "vitest";

import { relativeSince } from "./relative-since";

describe("relativeSince", () => {
  const now = new Date("2026-10-20T12:00:00Z");

  it("says how long ago an instant was in the reader's language", () => {
    expect(relativeSince("2026-10-20T11:59:48Z", now, "pt")).toBe("há 12 segundos");
    expect(relativeSince("2026-10-20T11:55:00Z", now, "pt-BR")).toBe("há 5 minutos");
    expect(relativeSince("2026-10-20T09:00:00Z", now, "en")).toBe("3 hours ago");
  });

  it("says now for the current instant and never a future time for clock skew", () => {
    expect(relativeSince("2026-10-20T12:00:00Z", now, "pt")).toBe("agora");
    expect(relativeSince("2026-10-20T12:00:05Z", now, "pt")).toBe("agora");
  });

  it("has nothing to say for a missing or unreadable instant", () => {
    expect(relativeSince(undefined, now, "pt")).toBeNull();
    expect(relativeSince("not a date", now, "pt")).toBeNull();
  });
});
