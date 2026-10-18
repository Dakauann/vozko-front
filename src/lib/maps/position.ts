const POSITION_SOURCES = ["manual", "lead_pin", "import", "reference"] as const;

type PositionSource = (typeof POSITION_SOURCES)[number];

function oneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

function isPositionSource(value: unknown): value is PositionSource {
  return oneOf(POSITION_SOURCES, value);
}

export function positionSourceKey(source: unknown): string | null {
  return isPositionSource(source) ? `source.${source}` : null;
}
