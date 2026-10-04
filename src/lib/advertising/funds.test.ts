import { describe, expect, it } from "vitest";

import { fundsNotice } from "./funds";
import type { AdFunds } from "./types";

const portal = "https://business.facebook.com/billing_hub/payment_settings?asset_id=1";

function funds(partial: Partial<AdFunds>): AdFunds {
  return { kind: "prepaid", level: "ok", limit: 2635, spent: 125, room: 2510, dailySpend: 130_000, daysLeft: 193, portalUrl: portal, ...partial };
}

describe("fundsNotice", () => {
  it("stays quiet while the account is funded", () => {
    expect(fundsNotice({ canManage: true, funds: funds({}) })).toBeNull();
  });

  it("warns before prepaid funds end and stops the account when they do, both fixed at Meta", () => {
    expect(fundsNotice({ canManage: true, funds: funds({ level: "low", reason: "funds_low" }) })).toEqual({
      reason: "funds_low",
      tone: "warning",
      action: "addFunds",
    });
    expect(fundsNotice({ canManage: true, funds: funds({ level: "out", reason: "funds_out", room: 0 }) })).toEqual({
      reason: "funds_out",
      tone: "destructive",
      action: "addFunds",
    });
  });

  it("sends a spending limit to the limit control and a failed payment to Meta billing", () => {
    expect(fundsNotice({ canManage: true, funds: funds({ kind: "postpaid", level: "out", reason: "spend_limit_reached" }) })?.action).toBe("adjustLimit");
    expect(fundsNotice({ canManage: true, funds: funds({ kind: "postpaid", level: "low", reason: "spend_limit_low" }) })?.action).toBe("adjustLimit");
    expect(fundsNotice({ canManage: true, funds: funds({ level: "payment_failed", reason: "payment_failed" }) })).toEqual({
      reason: "payment_failed",
      tone: "destructive",
      action: "pay",
    });
    expect(fundsNotice({ canManage: true, funds: funds({ level: "payment_failed", reason: "grace_period" }) })?.tone).toBe("warning");
  });

  it("says the funds could not be read only to people whose profile reads billing", () => {
    const unknown = funds({ kind: "unknown", level: "unknown", reason: "billing_unreadable" });
    expect(fundsNotice({ canManage: true, funds: unknown })).toEqual({ reason: "billing_unreadable", tone: "info", action: "openBilling" });
    expect(fundsNotice({ canManage: false, funds: unknown })).toBeNull();
  });

  it("never guesses on a level or reason this build does not know", () => {
    expect(fundsNotice({ canManage: true, funds: funds({ level: "low", reason: "something_new" }) })).toEqual({
      reason: "unknown",
      tone: "warning",
      action: "openBilling",
    });
    expect(fundsNotice({ canManage: true, funds: undefined })).toBeNull();
  });
});
