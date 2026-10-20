import { describe, expect, it } from "vitest";

import type { InboxEntry } from "@/lib/conversations/types";

import { customerMessageArrived, customerMessageSignal } from "./customer";

function entry(overrides: Partial<InboxEntry> = {}): InboxEntry {
  return {
    entry_id: "e-1",
    entry_type: "whatsapp",
    lead_name: "Carla",
    lead_number: "5511999990000",
    unread_count: 1,
    last_message_preview: "Oi, tudo bem?",
    last_message_at: "2026-10-19T12:00:00Z",
    last_message_sender_kind: "contact",
    ...overrides,
  } as InboxEntry;
}

describe("customerMessageArrived", () => {
  it("is true for a new message the contact sent", () => {
    expect(customerMessageArrived(entry({ last_message_at: "2026-10-19T11:00:00Z" }), entry())).toBe(true);
    expect(customerMessageArrived(undefined, entry())).toBe(true);
  });

  it("is false for our replies, repeats of the same message and other updates", () => {
    expect(customerMessageArrived(entry({ last_message_at: "2026-10-19T11:00:00Z" }), entry({ last_message_sender_kind: "human" }))).toBe(false);
    expect(customerMessageArrived(entry(), entry({ unread_count: 0 }))).toBe(false);
  });

  it("falls back to the unread count when the sender is unknown", () => {
    const before = entry({ last_message_at: "2026-10-19T11:00:00Z", unread_count: 1, last_message_sender_kind: undefined });
    expect(customerMessageArrived(before, entry({ unread_count: 2, last_message_sender_kind: undefined }))).toBe(true);
    expect(customerMessageArrived(before, entry({ unread_count: 1, last_message_sender_kind: undefined }))).toBe(false);
  });
});

describe("customerMessageSignal", () => {
  it("uses an id every tab computes the same way", () => {
    const signal = customerMessageSignal(entry());
    expect(signal).toMatchObject({
      id: "customer:whatsapp:e-1:2026-10-19T12:00:00Z",
      source: "customer_message",
      group: "e-1",
      title: "Carla",
      body: "Oi, tudo bem?",
      href: "/dashboard/live-chat?entry=e-1&type=whatsapp",
    });
    expect(customerMessageSignal(entry({ lead_name: "" })).title).toBe("5511999990000");
  });
});
