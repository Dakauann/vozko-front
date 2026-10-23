import { newIdempotencyKey } from "@/lib/api/idempotency-key";

import type { BillingType } from "./types";

export interface RechargeDraft {
  amountBrl: number;
  billingType: BillingType;
}

export interface RechargeKey {
  key: string;
  draft: string;
}

function draftOf(draft: RechargeDraft): string {
  return `${draft.billingType}:${draft.amountBrl}`;
}

export function rechargeKeyFor(
  previous: RechargeKey | null,
  draft: RechargeDraft,
  makeKey: () => string = newIdempotencyKey,
): RechargeKey {
  const current = draftOf(draft);
  if (previous && previous.draft === current) {
    return previous;
  }
  return { key: makeKey(), draft: current };
}

export function keepsRechargeKey(result: {
  error: string | null;
  errorStatus: number | null;
}): boolean {
  return result.error !== null && result.errorStatus === null;
}
