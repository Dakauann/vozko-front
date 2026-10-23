import { describe, expect, it } from "vitest";

import { MERCADOLIVRE_BLOCK_SUBSTATUSES } from "@/lib/mercadolivre/window";
import { CLOSED_DETAIL_CATALOGS, mergeWindowClosed, readWindowClosed, readWindowClosedReason, windowClosedCopyKey } from "./window-closed";

describe("readWindowClosedReason", () => {
  it("reads every reason the server sends", () => {
    for (const reason of [
      "expired",
      "no_inbound",
      "contact_blocked",
      "session_down",
      "account_restricted",
      "reply_revoked",
      "channel_unavailable",
      "provider_blocked",
      "budget_exhausted",
    ]) {
      expect(readWindowClosedReason(reason)).toBe(reason);
    }
  });

  it("names no reason for a value it does not know, so the composer shows the generic copy", () => {
    for (const value of ["reason_from_a_newer_backend", "", 3, null, undefined, { reason: "expired" }]) {
      expect(readWindowClosedReason(value)).toBeNull();
    }
  });
});

describe("readWindowClosed", () => {
  it("carries the provider's own detail next to the reason", () => {
    expect(readWindowClosed({ window_closed_reason: "provider_blocked", window_closed_detail: "blocked_by_mediation" })).toEqual({
      window_closed_reason: "provider_blocked",
      window_closed_detail: "blocked_by_mediation",
    });
  });

  it("drops a detail that is not a non-empty string", () => {
    expect(readWindowClosed({ window_closed_reason: "expired", window_closed_detail: "" })).toEqual({
      window_closed_reason: "expired",
      window_closed_detail: null,
    });
    expect(readWindowClosed({ window_closed_reason: "expired", window_closed_detail: 42 })).toEqual({
      window_closed_reason: "expired",
      window_closed_detail: null,
    });
    expect(readWindowClosed({})).toEqual({ window_closed_reason: null, window_closed_detail: null });
  });
});

describe("windowClosedCopyKey", () => {
  it("explains a Mercado Livre block by its substatus", () => {
    for (const substatus of MERCADOLIVRE_BLOCK_SUBSTATUSES) {
      expect(windowClosedCopyKey("mercadolivre", "provider_blocked", substatus)).toBe(`closedDetail.mercadolivre.${substatus}`);
    }
  });

  it("falls back to the generic provider block for a substatus it does not know, or none", () => {
    expect(windowClosedCopyKey("mercadolivre", "provider_blocked", "blocked_by_something_new")).toBe("closed.provider_blocked");
    expect(windowClosedCopyKey("mercadolivre", "provider_blocked", null)).toBe("closed.provider_blocked");
    expect(windowClosedCopyKey("mercadolivre", "provider_blocked", "toString")).toBe("closed.provider_blocked");
  });

  it("never reads a Mercado Livre detail on another channel", () => {
    expect(windowClosedCopyKey("instagram", "provider_blocked", "blocked_by_mediation")).toBe("closed.provider_blocked");
  });

  it("explains an email block by the reason the server names", () => {
    expect(CLOSED_DETAIL_CATALOGS.email).toEqual(["email_address_suppressed", "email_sender_not_provisioned", "email_sender_paused"]);
    for (const detail of ["email_address_suppressed", "email_sender_not_provisioned", "email_sender_paused"]) {
      expect(windowClosedCopyKey("email", "provider_blocked", detail)).toBe(`closedDetail.email.${detail}`);
    }
    expect(windowClosedCopyKey("email", "provider_blocked", "email_something_new")).toBe("closed.provider_blocked");
    expect(windowClosedCopyKey("email", "provider_blocked", "blocked_by_mediation")).toBe("closed.provider_blocked");
    expect(windowClosedCopyKey("mercadolivre", "provider_blocked", "email_sender_paused")).toBe("closed.provider_blocked");
  });

  it("names what disconnected on each channel, and stays neutral where nothing more is known", () => {
    expect(windowClosedCopyKey("whatsapp", "channel_unavailable", null)).toBe("closedByChannel.whatsapp.channel_unavailable");
    expect(windowClosedCopyKey("unofficial_whatsapp", "channel_unavailable", null)).toBe("closedByChannel.unofficial_whatsapp.channel_unavailable");
    expect(windowClosedCopyKey("instagram", "channel_unavailable", null)).toBe("closedByChannel.instagram.channel_unavailable");
    expect(windowClosedCopyKey("facebook", "channel_unavailable", null)).toBe("closedByChannel.facebook.channel_unavailable");
    expect(windowClosedCopyKey("telegram", "channel_unavailable", null)).toBe("closedByChannel.telegram.channel_unavailable");
    expect(windowClosedCopyKey("mercadolivre", "channel_unavailable", null)).toBe("closedByChannel.mercadolivre.channel_unavailable");
    expect(windowClosedCopyKey("tiktok", "channel_unavailable", null)).toBe("closedByChannel.tiktok.channel_unavailable");
    expect(windowClosedCopyKey("email", "channel_unavailable", null)).toBe("closedByChannel.email.channel_unavailable");
    expect(windowClosedCopyKey("webchat", "channel_unavailable", null)).toBe("closed.channel_unavailable");
  });

  it("explains the TikTok window and message budget in its own words", () => {
    expect(windowClosedCopyKey("tiktok", "expired", null)).toBe("closedByChannel.tiktok.expired");
    expect(windowClosedCopyKey("tiktok", "budget_exhausted", null)).toBe("closedByChannel.tiktok.budget_exhausted");
    expect(windowClosedCopyKey("tiktok", "no_inbound", null)).toBe("closed.no_inbound");
  });

  it("uses the shared copy for every other reason", () => {
    expect(windowClosedCopyKey("mercadolivre", "budget_exhausted", null)).toBe("closed.budget_exhausted");
    expect(windowClosedCopyKey("whatsapp", "expired", "ignored")).toBe("closed.expired");
    expect(windowClosedCopyKey("instagram", "budget_exhausted", null)).toBe("closed.budget_exhausted");
  });
});

describe("mergeWindowClosed", () => {
  const previous = { window_closed_reason: "expired" as const, window_closed_detail: "old" };

  it("keeps what it knew when the payload names no reason", () => {
    expect(mergeWindowClosed({}, previous)).toEqual(previous);
    expect(mergeWindowClosed({ window_closed_reason: "" }, previous)).toEqual(previous);
  });

  it("replaces reason and detail together, so a new reason never keeps an old detail", () => {
    expect(mergeWindowClosed({ window_closed_reason: "budget_exhausted" }, previous)).toEqual({
      window_closed_reason: "budget_exhausted",
      window_closed_detail: null,
    });
  });

  it("forgets the old reason when the payload names one it does not know", () => {
    expect(mergeWindowClosed({ window_closed_reason: "reason_from_a_newer_backend", window_closed_detail: "x" }, previous)).toEqual({
      window_closed_reason: null,
      window_closed_detail: "x",
    });
  });

  it("starts empty with nothing known before", () => {
    expect(mergeWindowClosed({}, {})).toEqual({ window_closed_reason: null, window_closed_detail: null });
  });
});
