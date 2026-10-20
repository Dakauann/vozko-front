export type CubicBezier = readonly [number, number, number, number];

export const durationMs = {
  state: 150,
  panel: 200,
  dotPulse: 1200,
} as const;

export const easing = {
  state: [0.33, 0, 0.67, 1],
  panel: [0.1, 0.9, 0.2, 1],
  exit: [0.9, 0.1, 1, 0.2],
} as const satisfies Record<string, CubicBezier>;

export function cssCubicBezier(curve: CubicBezier): string {
  return `cubic-bezier(${curve.join(",")})`;
}

function seconds(ms: number): number {
  return ms / 1000;
}

export const stateTransition = {
  duration: seconds(durationMs.state),
  ease: easing.state,
};

export const arrivalTransition = {
  duration: seconds(durationMs.state),
  ease: easing.panel,
};

export const panelSettleTransition = {
  duration: seconds(durationMs.panel),
  ease: easing.panel,
};

export const tailwindTimingFunctions = {
  DEFAULT: cssCubicBezier(easing.state),
  panel: cssCubicBezier(easing.panel),
  exit: cssCubicBezier(easing.exit),
};

export const tailwindDurations = {
  DEFAULT: `${durationMs.state}ms`,
};

export const tailwindAnimations = {
  "accordion-down": `accordion-down ${durationMs.panel}ms ${cssCubicBezier(easing.panel)}`,
  "accordion-up": `accordion-up ${durationMs.panel}ms ${cssCubicBezier(easing.panel)}`,
  "dot-pulse": `dot-pulse ${durationMs.dotPulse}ms ${cssCubicBezier(easing.state)} infinite`,
};
