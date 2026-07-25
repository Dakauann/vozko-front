function humanizeAlias(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) {
    return "";
  }
  return normalized
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

// Human-readable label for a pricing catalog service id when no i18n key exists.
export function formatPricingServiceFallback(service: string) {
  return humanizeAlias(service);
}
