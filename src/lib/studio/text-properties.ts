export const TEXT_KEY_PROPERTIES = ["counter", "pathOffset"] as const;

export type TextKeyProperty = (typeof TEXT_KEY_PROPERTIES)[number];

export const COUNTER_RANGE = [-1_000_000_000_000, 1_000_000_000_000] as const;

export const PATH_OFFSET_RANGE = [-4, 4] as const;

export const TEXT_KEY_RANGES: Record<TextKeyProperty, readonly [number, number]> = {
  counter: COUNTER_RANGE,
  pathOffset: PATH_OFFSET_RANGE,
};

export function isTextKeyProperty(property: string): property is TextKeyProperty {
  return (TEXT_KEY_PROPERTIES as readonly string[]).includes(property);
}
