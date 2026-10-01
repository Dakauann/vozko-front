import { describe, expect, it } from "vitest";

import { callListQuery, contactLabel, outcomeTone, periodBounds, timelineKind } from "./format";

describe("call list query", () => {
  it("sends only the filters that are set", () => {
    expect(callListQuery({ page: 1, pageSize: 25 })).toBe("page=1&pageSize=25");
    expect(
      callListQuery({ page: 2, pageSize: 50, direction: "inbound", channel: "whatsapp", result: "unanswered", memberId: "u1", from: "2026-09-01", to: "2026-09-30", number: " 8499 " }),
    ).toBe("page=2&pageSize=50&direction=inbound&channel=whatsapp&result=unanswered&memberId=u1&from=2026-09-01&to=2026-09-30&number=8499");
  });

  it("drops a number search without digits", () => {
    expect(callListQuery({ page: 1, pageSize: 25, number: "abc" })).toBe("page=1&pageSize=25");
  });
});

describe("period bounds", () => {
  const today = new Date(2026, 8, 30, 15, 0, 0);

  it("turns a preset into whole local days", () => {
    expect(periodBounds("today", today)).toEqual({ from: "2026-09-30", to: "2026-09-30" });
    expect(periodBounds("7d", today)).toEqual({ from: "2026-09-24", to: "2026-09-30" });
    expect(periodBounds("30d", today)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(periodBounds("all", today)).toEqual({});
  });
});

describe("outcome tone", () => {
  it("colours what happened to the call", () => {
    expect(outcomeTone("answered")).toBe("healthy");
    expect(outcomeTone("in_progress")).toBe("live");
    expect(outcomeTone("missed")).toBe("warning");
    expect(outcomeTone("failed")).toBe("destructive");
    expect(outcomeTone("busy")).toBe("muted");
  });
});

describe("contact label", () => {
  it("prefers the contact's name and falls back to the number", () => {
    expect(contactLabel({ number: "5584994409684", name: "Maria" })).toEqual({ title: "Maria", subtitle: "5584994409684" });
    expect(contactLabel({ number: "5584994409684" })).toEqual({ title: "5584994409684", subtitle: null });
  });
});

describe("timeline kind", () => {
  it("accepts what the server sends and ignores what this version does not know", () => {
    expect(timelineKind("transfer_connected")).toBe("transfer_connected");
    expect(timelineKind("transcript_ready")).toBeNull();
  });
});
