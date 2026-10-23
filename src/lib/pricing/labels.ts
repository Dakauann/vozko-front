import { formatPricingServiceFallback } from "@/lib/branding/ai-models";

type PricingTranslate = { has: (key: string) => boolean; (key: string): string };

export function pricingServiceLabel(
  t: PricingTranslate,
  prefix: string,
  item: { category: string; service: string },
): string {
  const key = `${prefix ? `${prefix}.` : ""}services.${item.category}.${item.service}`;
  return t.has(key) ? t(key) : formatPricingServiceFallback(item.service);
}
