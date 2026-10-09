import { formatMicros } from "@/lib/analytics/meta-costs";
import type { MetaInvoiceCurrency } from "@/lib/analytics/types";

export interface ThreadUsage {
  available: boolean;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
}

export interface ThreadCost {
  available: boolean;
  amountMicros: number;
  currency: string;
  usage?: ThreadUsage;
}

export type ShownUsage = ThreadUsage & { totalTokens: number };

const CURRENCIES: readonly MetaInvoiceCurrency[] = ["BRL", "USD"];
const SMALLEST_SHOWN_MICROS = 10_000;

export const LIVE_COST_REFRESH_MS = 8_000;
export const LATE_DEBIT_MS = 5_000;

function isCurrency(value: string): value is MetaInvoiceCurrency {
  return (CURRENCIES as readonly string[]).includes(value);
}

export function formatThreadCost(cost: ThreadCost | null | undefined, locale: string): string | null {
  if (!cost || !cost.available || !isCurrency(cost.currency)) return null;
  const micros = cost.amountMicros;
  if (!Number.isFinite(micros) || micros < 0) return null;
  if (micros > 0 && micros < SMALLEST_SHOWN_MICROS) {
    const smallest = formatMicros(SMALLEST_SHOWN_MICROS, cost.currency, locale);
    return smallest === null ? null : `< ${smallest}`;
  }
  return formatMicros(micros, cost.currency, locale);
}

export function threadCostKey(threadId: string | null, refreshes: number): string | null {
  return threadId ? `${threadId}#${refreshes}` : null;
}

export function formatTokenCount(count: number, locale: string): string {
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(count);
}

export function threadUsage(cost: ThreadCost | null | undefined): ShownUsage | null {
  const usage = cost?.usage;
  if (!usage?.available) return null;
  return { ...usage, totalTokens: usage.inputTokens + usage.outputTokens };
}
