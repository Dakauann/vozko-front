import { describe, expect, it } from "vitest";

import { runeCount } from "@/lib/rcs/limits";
import { parseRcsContentCheck, parseRcsMedia, parseRcsSender, parseRcsSenderList } from "@/lib/rcs/parse";
import { senderFixture } from "@/lib/rcs/test-fixtures";

describe("parseRcsSender", () => {
  it("reads a sender exactly as the backend writes it", () => {
    expect(parseRcsSender(senderFixture())).toEqual(senderFixture());
  });

  it("reads timestamps that are still null", () => {
    const sender = senderFixture({ submitted_at: null, launched_at: null, paused_at: null });
    expect(parseRcsSender(sender)).toEqual(sender);
  });

  it("refuses a status the UI does not know", () => {
    expect(parseRcsSender({ ...senderFixture(), status: "archived" })).toBeNull();
  });

  it("refuses a sector, use case or billing category outside the domain lists", () => {
    expect(parseRcsSender({ ...senderFixture(), sector: "crypto" })).toBeNull();
    expect(parseRcsSender({ ...senderFixture(), use_case: "news" })).toBeNull();
    expect(parseRcsSender({ ...senderFixture(), billing_category: "premium" })).toBeNull();
  });

  it("accepts blank enums on a draft that has not chosen them yet", () => {
    const draft = senderFixture({ status: "draft", sector: "", use_case: "", billing_category: "", paused_by: "", pause_reason: "" });
    expect(parseRcsSender(draft)).toEqual(draft);
  });

  it("refuses a body without the permission flags", () => {
    const withoutFlag: Partial<ReturnType<typeof senderFixture>> = senderFixture();
    delete withoutFlag.can_send;
    expect(parseRcsSender(withoutFlag)).toBeNull();
  });

  it("refuses anything that is not an object", () => {
    expect(parseRcsSender(null)).toBeNull();
    expect(parseRcsSender([])).toBeNull();
    expect(parseRcsSender("sender")).toBeNull();
  });
});

describe("parseRcsSenderList", () => {
  it("reads the senders envelope", () => {
    expect(parseRcsSenderList({ senders: [senderFixture()] })).toEqual({ senders: [senderFixture()] });
  });

  it("reads an empty list", () => {
    expect(parseRcsSenderList({ senders: [] })).toEqual({ senders: [] });
  });

  it("refuses the whole list when one sender is unreadable", () => {
    expect(parseRcsSenderList({ senders: [senderFixture(), { id: "x" }] })).toBeNull();
  });
});

describe("parseRcsContentCheck", () => {
  const check = {
    kind: "rich_card",
    billing_class: "single",
    variable_slots: 2,
    issues: [{ code: "card_title_too_long", path: "cards.0.title" }],
    price: { charge_kind: "rcs_single", unit_micros: 54000, quantity: 1, total_micros: 54000 },
  };

  it("reads the backend verdict on a message", () => {
    expect(parseRcsContentCheck(check)).toEqual(check);
  });

  it("reads a verdict with no issues written as null", () => {
    expect(parseRcsContentCheck({ ...check, issues: null })).toEqual({ ...check, issues: [] });
  });

  it("refuses an unknown kind or billing class", () => {
    expect(parseRcsContentCheck({ ...check, kind: "story" })).toBeNull();
    expect(parseRcsContentCheck({ ...check, billing_class: "premium" })).toBeNull();
  });

  it("refuses a malformed issue or price", () => {
    expect(parseRcsContentCheck({ ...check, issues: [{ code: "", path: "text" }] })).toBeNull();
    expect(parseRcsContentCheck({ ...check, price: { charge_kind: "rcs_single", unit_micros: -1, quantity: 1, total_micros: 1 } })).toBeNull();
    expect(parseRcsContentCheck({ ...check, price: { charge_kind: "gift", unit_micros: 1, quantity: 1, total_micros: 1 } })).toBeNull();
  });

  it("reads an issue that belongs to the whole message", () => {
    const whole = { ...check, issues: [{ code: "content_empty", path: "" }] };
    expect(parseRcsContentCheck(whole)).toEqual(whole);
  });
});

describe("parseRcsMedia", () => {
  it("reads a media file with its optional fields", () => {
    const media = { kind: "image", url: "https://cdn.example/a.png", mime_type: "image/png", name: "a.png", size_bytes: 1200 };
    expect(parseRcsMedia(media)).toEqual(media);
  });

  it("refuses a media kind outside the domain list", () => {
    expect(parseRcsMedia({ kind: "sticker", url: "https://cdn.example/a.webp", mime_type: "image/webp" })).toBeNull();
  });
});

describe("runeCount", () => {
  it("counts characters the way the backend counts runes", () => {
    expect(runeCount("Olá")).toBe(3);
    expect(runeCount("🎉🎉")).toBe(2);
    expect(runeCount(undefined)).toBe(0);
  });
});
