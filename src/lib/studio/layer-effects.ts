import { hexOf, mixColors, parseColor } from "./color";
import { CENTERED_RADIAL, type Gradient, type GradientKind, type Highlight, type Shadow } from "./document";

export const DEFAULT_SHADOW: Shadow = { color: "#00000066", blur: 12, x: 0, y: 6 };

export const TEXT_SHADOW = { color: "#00000059", blurShare: 0.2, offsetShare: 0.06 } as const;

export const HEAVY_TEXT_SHADOW = { alpha: 0.75, blurShare: 0.35, offsetShare: 0.12 } as const;

export function textShadowFor(fontPx: number): Shadow {
  return { color: TEXT_SHADOW.color, blur: Math.round(TEXT_SHADOW.blurShare * fontPx), x: 0, y: Math.max(1, Math.round(TEXT_SHADOW.offsetShare * fontPx)) };
}

export function isHeavyTextShadow(shadow: Shadow, fontPx: number): boolean {
  const shade = parseColor(shadow.color);
  if (!shade || shade.a < HEAVY_TEXT_SHADOW.alpha) return false;
  return shadow.blur > HEAVY_TEXT_SHADOW.blurShare * fontPx || Math.hypot(shadow.x, shadow.y) > HEAVY_TEXT_SHADOW.offsetShare * fontPx;
}

export const DEFAULT_HIGHLIGHT: Highlight = { color: "#ffe14d", radius: 0.2 };

export const DEFAULT_GRADIENT: Gradient = { from: "#6366f1", to: "#ec4899", angle: 45 };

export function startGradient(fill: string | undefined): Gradient {
  return { from: fill || DEFAULT_GRADIENT.from, to: DEFAULT_GRADIENT.to, angle: DEFAULT_GRADIENT.angle };
}

export function gradientWithVia(gradient: Gradient, on: boolean): Gradient {
  if (!on) return { ...gradient, via: undefined };
  const from = parseColor(gradient.from);
  const to = parseColor(gradient.to);
  return { ...gradient, via: from && to ? hexOf(mixColors(from, to, 0.5)) : gradient.from };
}

export function gradientWithKind(gradient: Gradient, kind: GradientKind): Gradient {
  return kind === "radial" ? { ...gradient, ...CENTERED_RADIAL, kind } : { ...gradient, kind: "linear" };
}
