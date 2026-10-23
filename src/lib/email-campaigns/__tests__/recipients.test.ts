import { describe, expect, it } from "vitest";

import { recipientState } from "../recipients";
import type { Recipient } from "../types";

const base: Recipient = { id: "r1", address: "ana@loja.com", status: "sent", sent_at: "2026-10-21T10:00:00Z" };

describe("recipientState", () => {
  it("shows the recipient status before anything was sent", () => {
    expect(recipientState({ ...base, status: "pending" }).key).toBe("pending");
    expect(recipientState({ ...base, status: "skipped", skip_reason: "no_email" }).key).toBe("skipped");
    expect(recipientState({ ...base, status: "failed" })).toMatchObject({ key: "failed", tone: "fault" });
  });

  it("shows the furthest milestone of a sent message", () => {
    expect(recipientState(base)).toMatchObject({ key: "sent", at: base.sent_at });
    expect(recipientState({ ...base, delivered_at: "d" }).key).toBe("delivered");
    expect(recipientState({ ...base, delivered_at: "d", opened_at: "o" }).key).toBe("opened");
    expect(recipientState({ ...base, delivered_at: "d", opened_at: "o", clicked_at: "c" })).toMatchObject({ key: "clicked", at: "c" });
  });

  it("puts bad outcomes first", () => {
    expect(recipientState({ ...base, delivered_at: "d", opened_at: "o", unsubscribed_at: "u" }).key).toBe("unsubscribed");
    expect(recipientState({ ...base, bounced_at: "b" })).toMatchObject({ key: "bounced", tone: "fault" });
    expect(recipientState({ ...base, delivered_at: "d", complained_at: "x" }).key).toBe("complained");
  });
});
