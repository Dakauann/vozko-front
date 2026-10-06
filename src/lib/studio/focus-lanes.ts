import { KEYFRAME_PROPERTIES, KEYFRAME_RANGES, removeKeyframe, valueAt, type Keyframe, type KeyframeProperty, type Keyframes } from "./keyframes";

export const KEY_LANE_HEIGHT = 26;
export const KEY_HIT_PX = 6;
export const CURVE_SAMPLES = 48;

export interface KeySpot {
  property: KeyframeProperty;
  atMs: number;
}

export function keyLaneTop(property: KeyframeProperty, laneHeight: number = KEY_LANE_HEIGHT): number {
  return KEYFRAME_PROPERTIES.indexOf(property) * laneHeight;
}

export function keyLanesHeight(laneHeight: number = KEY_LANE_HEIGHT): number {
  return KEYFRAME_PROPERTIES.length * laneHeight;
}

export function keyX(atMs: number, durationMs: number, widthPx: number): number {
  return durationMs > 0 ? (atMs / durationMs) * widthPx : 0;
}

export function keyTimeAt(x: number, durationMs: number, widthPx: number): number {
  return widthPx > 0 ? Math.round((x / widthPx) * durationMs) : 0;
}

export function keyAtPoint(keyframes: Keyframes | undefined, property: KeyframeProperty, x: number, durationMs: number, widthPx: number, hitPx: number = KEY_HIT_PX): KeySpot | null {
  let best: KeySpot | null = null;
  let distance = Infinity;
  for (const frame of keyframes?.[property] ?? []) {
    const d = Math.abs(keyX(frame.atMs, durationMs, widthPx) - x);
    if (d <= hitPx && d < distance) {
      distance = d;
      best = { property, atMs: frame.atMs };
    }
  }
  return best;
}

export function keysInBox(
  keyframes: Keyframes | undefined,
  box: { left: number; right: number; top: number; bottom: number },
  durationMs: number,
  widthPx: number,
  laneHeight: number = KEY_LANE_HEIGHT,
): KeySpot[] {
  const spots: KeySpot[] = [];
  for (const property of KEYFRAME_PROPERTIES) {
    const middle = keyLaneTop(property, laneHeight) + laneHeight / 2;
    if (middle < box.top || middle > box.bottom) continue;
    for (const frame of keyframes?.[property] ?? []) {
      const x = keyX(frame.atMs, durationMs, widthPx);
      if (x >= box.left && x <= box.right) spots.push({ property, atMs: frame.atMs });
    }
  }
  return spots;
}

export function toggledKeys(selection: readonly KeySpot[], spot: KeySpot, additive: boolean): KeySpot[] {
  const same = (k: KeySpot) => k.property === spot.property && k.atMs === spot.atMs;
  if (!additive) return [spot];
  return selection.some(same) ? selection.filter((k) => !same(k)) : [...selection, spot];
}

export function curvePoints(frames: readonly Keyframe[], property: KeyframeProperty, durationMs: number, widthPx: number, heightPx: number, samples: number = CURVE_SAMPLES): [number, number][] {
  if (frames.length === 0 || widthPx <= 0) return [];
  const values = Array.from({ length: samples + 1 }, (_, i) => valueAt(frames, (i / samples) * durationMs));
  const [rangeLow, rangeHigh] = KEYFRAME_RANGES[property];
  const low = Math.max(rangeLow, Math.min(...values));
  const high = Math.min(rangeHigh, Math.max(...values));
  const span = high - low;
  const pad = 3;
  return values.map((value, i) => [
    (i / samples) * widthPx,
    span <= 1e-9 ? heightPx / 2 : pad + (1 - (value - low) / span) * (heightPx - pad * 2),
  ]);
}

export function removeKeys(keyframes: Keyframes | undefined, keys: readonly KeySpot[]): Keyframes | undefined {
  return keys.reduce((current, key) => removeKeyframe(current, key.property, key.atMs), keyframes);
}

export function shiftedKeys(keys: readonly KeySpot[], deltaMs: number): KeySpot[] {
  return keys.map((key) => ({ ...key, atMs: key.atMs + deltaMs }));
}
