import type { AdAccount } from "@/lib/advertising/types";

export type SpendCapProblem = "invalid" | "notAboveSpent";

export function activeSpendCap(account: Pick<AdAccount, "spendCap">): number | null {
  return account.spendCap && account.spendCap > 0 ? account.spendCap : null;
}

export function spendCapProblem(amount: number | null, amountSpent: number | null | undefined): SpendCapProblem | null {
  if (amount === null || amount <= 0) return "invalid";
  if (amountSpent !== null && amountSpent !== undefined && amount <= amountSpent) return "notAboveSpent";
  return null;
}

export function spendCapUsage(account: Pick<AdAccount, "spendCap" | "amountSpent">): number | null {
  const cap = activeSpendCap(account);
  if (cap === null || account.amountSpent === null || account.amountSpent === undefined) return null;
  return Math.min(1, Math.max(0, account.amountSpent / cap));
}
