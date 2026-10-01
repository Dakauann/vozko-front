interface PricingItemLike {
  category: string;
  service: string;
  metric: string;
  priceMicros: number;
}

export type UsageUnit = "messages" | "minutes";

export interface UsageEstimate {
  category: string;
  service: string;
  unit: UsageUnit;
  count: number;
}

const MICROS = 1_000_000;

const UNIT_BY_METRIC: Record<string, UsageUnit> = {
  per_message: "messages",
  per_minute: "minutes",
};

export function estimateUsage(basePriceBRLCents: number, items: PricingItemLike[], exchangeRate: number): UsageEstimate[] {
  if (exchangeRate <= 0) return [];
  const basePriceUSD = basePriceBRLCents / 100 / exchangeRate;
  return items
    .filter((item) => UNIT_BY_METRIC[item.metric] && item.priceMicros > 0)
    .map((item) => ({
      category: item.category,
      service: item.service,
      unit: UNIT_BY_METRIC[item.metric],
      count: Math.round(basePriceUSD / (item.priceMicros / MICROS)),
    }))
    .sort((a, b) => b.count - a.count);
}

export function formatEstimateNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale === "pt" ? "pt-BR" : locale).format(value);
}
