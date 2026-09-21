function humanizeAlias(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) {
    return "";
  }
  return normalized
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatPricingServiceFallback(service: string) {
  return humanizeAlias(service);
}
