import type { AdAccount } from "@/lib/advertising/types";

export type FundsReason = "funds_low" | "funds_out" | "spend_limit_low" | "spend_limit_reached" | "payment_failed" | "grace_period" | "billing_unreadable" | "unknown";

export type FundsAction = "addFunds" | "pay" | "adjustLimit" | "openBilling";

export type FundsTone = "info" | "warning" | "destructive";

export interface FundsNotice {
  reason: FundsReason;
  tone: FundsTone;
  action: FundsAction;
}

const NOTICES: Record<Exclude<FundsReason, "unknown">, Omit<FundsNotice, "reason">> = {
  funds_low: { tone: "warning", action: "addFunds" },
  funds_out: { tone: "destructive", action: "addFunds" },
  spend_limit_low: { tone: "warning", action: "adjustLimit" },
  spend_limit_reached: { tone: "destructive", action: "adjustLimit" },
  payment_failed: { tone: "destructive", action: "pay" },
  grace_period: { tone: "warning", action: "pay" },
  billing_unreadable: { tone: "info", action: "openBilling" },
};

const ATTENTION_TONES: Record<string, FundsTone> = { low: "warning", out: "destructive", payment_failed: "destructive" };

function isKnownReason(reason: string | undefined): reason is Exclude<FundsReason, "unknown"> {
  return !!reason && Object.hasOwn(NOTICES, reason);
}

export function fundsNotice(account: Pick<AdAccount, "funds" | "canManage">): FundsNotice | null {
  const funds = account.funds;
  if (!funds || funds.level === "ok") return null;
  if (funds.level === "unknown") {
    return account.canManage ? { reason: "billing_unreadable", ...NOTICES.billing_unreadable } : null;
  }
  const tone = ATTENTION_TONES[funds.level];
  if (!tone) return null;
  if (!isKnownReason(funds.reason)) return { reason: "unknown", tone, action: "openBilling" };
  return { reason: funds.reason, ...NOTICES[funds.reason] };
}
