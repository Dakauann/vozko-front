export const SPEED_LIMITS = [0.1, 16] as const;

export const SPEED_PROPERTY = "speed";

type SpeedProperty = typeof SPEED_PROPERTY;

export function isSpeedProperty(property: string): property is SpeedProperty {
  return property === SPEED_PROPERTY;
}
