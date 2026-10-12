export const TILT_PROPERTIES = ["rotationX", "rotationY"] as const;

export type TiltProperty = (typeof TILT_PROPERTIES)[number];

export const TILT_RANGE = [-3600, 3600] as const;

export const TILT_RANGES: Record<TiltProperty, readonly [number, number]> = {
  rotationX: TILT_RANGE,
  rotationY: TILT_RANGE,
};

export function isTiltProperty(property: string): property is TiltProperty {
  return (TILT_PROPERTIES as readonly string[]).includes(property);
}
