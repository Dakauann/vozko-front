import { contrastRatio, mixColors, parseColor, type Rgba } from "../color";
import type { CanvasSize, Layer } from "../document";
import { layerEffects } from "../layer-paint";

export type CastKind = "drop" | "glow";

export interface ShadowCast {
  layerId: string;
  effectId: string;
  kind: CastKind;
  dx: number;
  dy: number;
  distance: number;
  angle: number;
  blur: number;
  spread: number;
  alpha: number;
  color: Rgba;
  side: number;
}

interface LightOutlier {
  cast: ShadowCast;
  light: number;
  apart: number;
}

const MIN_DISTANCE = 2;
const OUTLIER_DEGREES = 40;
const MIN_AGREEMENT = 0.8;
const SHOWS_RATIO = 1.1;

function degrees(dx: number, dy: number): number {
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

export function angleApart(a: number, b: number): number {
  const turn = Math.abs(((a - b) % 360) + 360) % 360;
  return Math.min(turn, 360 - turn);
}

function worldOffset(layer: Layer, x: number, y: number, styled: boolean): [number, number] {
  if (!styled) return [x, y];
  const mirroredX = layer.flipX && layer.type !== "image" ? -x : x;
  const mirroredY = layer.flipY && layer.type !== "image" ? -y : y;
  const radians = (layer.transform.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return [mirroredX * cos - mirroredY * sin, mirroredX * sin + mirroredY * cos];
}

export function shadowCasts(layer: Layer, canvas: CanvasSize): ShadowCast[] {
  const styled = (layer.effects ?? []).length > 0;
  const side = Math.min(layer.transform.w * canvas.width, layer.transform.h * canvas.height);
  return layerEffects(layer).flatMap((effect) => {
    if (effect.type !== "drop-shadow" && effect.type !== "outer-glow") return [];
    const color = parseColor(effect.color);
    if (!color) return [];
    const [dx, dy] = worldOffset(layer, effect.x, effect.y, styled);
    const distance = Math.hypot(dx, dy);
    return [
      {
        layerId: layer.id,
        effectId: effect.id,
        kind: effect.type === "drop-shadow" ? "drop" : "glow",
        dx,
        dy,
        distance,
        angle: degrees(dx, dy),
        blur: effect.blur,
        spread: effect.spread,
        alpha: color.a * effect.opacity * layer.transform.opacity,
        color: { ...color, a: 1 },
        side,
      },
    ];
  });
}

function directed(casts: readonly ShadowCast[]): ShadowCast[] {
  return casts.filter((cast) => cast.kind === "drop" && cast.distance >= MIN_DISTANCE);
}

function meanDirection(casts: readonly ShadowCast[]): { angle: number; agreement: number } {
  const x = casts.reduce((sum, cast) => sum + cast.dx / cast.distance, 0) / casts.length;
  const y = casts.reduce((sum, cast) => sum + cast.dy / cast.distance, 0) / casts.length;
  return { angle: degrees(x, y), agreement: Math.hypot(x, y) };
}

export function lightDirection(casts: readonly ShadowCast[]): { angle: number; agreement: number; count: number } | null {
  const usable = directed(casts);
  return usable.length === 0 ? null : { ...meanDirection(usable), count: usable.length };
}

export function lightOutliers(casts: readonly ShadowCast[]): LightOutlier[] {
  const usable = directed(casts);
  if (usable.length < 3) return [];
  return usable.flatMap((cast) => {
    const others = meanDirection(usable.filter((other) => other !== cast));
    const apart = angleApart(cast.angle, others.angle);
    return others.agreement >= MIN_AGREEMENT && apart > OUTLIER_DEGREES ? [{ cast, light: others.angle, apart }] : [];
  });
}

export function shadowShows(shade: Rgba, alpha: number, ground: Rgba): boolean {
  return contrastRatio(mixColors(ground, shade, alpha), ground) >= SHOWS_RATIO;
}
