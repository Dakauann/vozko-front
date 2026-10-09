export const POSITION_SOURCES = ["manual", "lead_pin", "import", "reference", "provider"] as const;

export type PositionSource = (typeof POSITION_SOURCES)[number];

export const GEOCODING_PROVIDERS = ["opencage"] as const;

export type GeocodingProvider = (typeof GEOCODING_PROVIDERS)[number];

function oneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

export function isPositionSource(value: unknown): value is PositionSource {
  return oneOf(POSITION_SOURCES, value);
}

export function positionSourceKey(source: unknown): string | null {
  return isPositionSource(source) ? `source.${source}` : null;
}

export function positionProviderKey(provider: unknown): string | null {
  return oneOf(GEOCODING_PROVIDERS, provider) ? `providers.${provider}` : null;
}
