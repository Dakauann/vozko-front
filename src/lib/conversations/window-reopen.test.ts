import { describe, expect, it } from "vitest";

import { applyWindowReopened, reopensWithTemplate } from "./window-reopen";
import type { ActiveConversation } from "./types";

const closed: ActiveConversation = {
  entry_id: "e1",
  entry_type: "whatsapp",
  lead_name: "Ana",
  lead_number: "5511",
  messages: [],
  has_more: false,
  unread_count: 0,
  window_open: false,
  window_expires_at: null,
  window_closed_reason: "expired",
  window_closed_detail: "customer_silent",
};

describe("window reopen", () => {
  it("opens the window until the time the server names once a template reopened it", () => {
    const reopened = applyWindowReopened(closed, {
      entry_id: "e1",
      entry_type: "whatsapp",
      template_id: "t1",
      template_name: "retomada",
      message_id: "m1",
      window_expires_at: "2026-10-19T10:00:00Z",
    });
    expect(reopened).toMatchObject({ window_open: true, window_expires_at: "2026-10-19T10:00:00Z", window_closed_reason: null, window_closed_detail: null });
  });

  it("keeps the known expiry when the server names none", () => {
    const reopened = applyWindowReopened(
      { ...closed, window_expires_at: "2026-10-19T09:00:00Z" },
      { entry_id: "e1", entry_type: "whatsapp", template_id: "t1", template_name: "retomada", message_id: "m1" },
    );
    expect(reopened.window_expires_at).toBe("2026-10-19T09:00:00Z");
  });

  it("offers sending a template now only on the official WhatsApp channel", () => {
    expect(reopensWithTemplate("whatsapp")).toBe(true);
    expect(reopensWithTemplate("instagram")).toBe(false);
  });
});
