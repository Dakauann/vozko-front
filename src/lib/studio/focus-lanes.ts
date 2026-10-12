import { ANIMATED_PROPERTIES, colorAt, isMorphKey, isPositionKey, KEYFRAME_RANGES, removeKeyframe, setKeyEasingAt, timedFramesOf, valueAt, type AnimatedProperty, type ColorKeyframe, type Easing, type Keyframe, type KeyframeProperty, type Keyframes, type TimedKey } from "./keyframes";

export const KEY_LANE_HEIGHT = 26;
export const KEY_HIT_PX = 6;
export const CURVE_SAMPLES = 48;
export const COLOR_STOPS = 16;

export interface KeySpot {
  property: AnimatedProperty;
  atMs: number;
}

export interface ColorStop {
  offset: number;
  color: string;
}

export function keyLaneTop(properties: readonly AnimatedProperty[], property: AnimatedProperty, laneHeight: number = KEY_LANE_HEIGHT): number {
  return properties.indexOf(property) * laneHeight;
}

export function keyLanesHeight(count: number, laneHeight: number = KEY_LANE_HEIGHT): number {
  return count * laneHeight;
}

export function colorStops(frames: readonly ColorKeyframe[], durationMs: number, samples: number = COLOR_STOPS): ColorStop[] {
  if (frames.length === 0) return [];
  return Array.from({ length: samples + 1 }, (_, i) => ({ offset: i / samples, color: colorAt(frames, (i / samples) * durationMs) }));
}

export function keyX(atMs: number, durationMs: number, widthPx: number): number {
  return durationMs > 0 ? (atMs / durationMs) * widthPx : 0;
}

export function keyTimeAt(x: number, durationMs: number, widthPx: number): number {
  return widthPx > 0 ? Math.round((x / widthPx) * durationMs) : 0;
}

export function keyAtPoint(keyframes: Keyframes | undefined, property: AnimatedProperty, x: number, durationMs: number, widthPx: number, hitPx: number = KEY_HIT_PX): KeySpot | null {
  let best: KeySpot | null = null;
  let distance = Infinity;
  for (const frame of timedFramesOf(keyframes, property)) {
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
  properties: readonly AnimatedProperty[],
  box: { left: number; right: number; top: number; bottom: number },
  durationMs: number,
  widthPx: number,
  laneHeight: number = KEY_LANE_HEIGHT,
): KeySpot[] {
  const spots: KeySpot[] = [];
  for (const property of properties) {
    const middle = keyLaneTop(properties, property, laneHeight) + laneHeight / 2;
    if (middle < box.top || middle > box.bottom) continue;
    for (const frame of timedFramesOf(keyframes, property)) {
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

export function lanePoints(values: readonly number[], widthPx: number, heightPx: number, bounds: readonly [number, number] = [-Infinity, Infinity]): [number, number][] {
  if (values.length < 2 || widthPx <= 0) return [];
  const low = Math.max(bounds[0], Math.min(...values));
  const high = Math.min(bounds[1], Math.max(...values));
  const span = high - low;
  const pad = 3;
  const last = values.length - 1;
  return values.map((value, i) => [
    (i / last) * widthPx,
    span <= 1e-9 ? heightPx / 2 : pad + (1 - (value - low) / span) * (heightPx - pad * 2),
  ]);
}

export function curvePoints(frames: readonly Keyframe[], property: KeyframeProperty, durationMs: number, widthPx: number, heightPx: number, samples: number = CURVE_SAMPLES): [number, number][] {
  if (frames.length === 0 || widthPx <= 0) return [];
  return lanePoints(Array.from({ length: samples + 1 }, (_, i) => valueAt(frames, (i / samples) * durationMs)), widthPx, heightPx, KEYFRAME_RANGES[property]);
}

export function removeKeys(keyframes: Keyframes | undefined, keys: readonly KeySpot[]): Keyframes | undefined {
  return keys.reduce((current, key) => removeKeyframe(current, key.property, key.atMs), keyframes);
}

export function easeKeys(keyframes: Keyframes | undefined, keys: readonly KeySpot[], easing: Easing): Keyframes | undefined {
  return keys.reduce((current, key) => setKeyEasingAt(current, key.property, key.atMs, easing), keyframes);
}

export function keysEasing(keyframes: Keyframes | undefined, keys: readonly KeySpot[]): Easing | null {
  const easings = new Set(keys.map((key) => timedFramesOf(keyframes, key.property).find((frame) => frame.atMs === key.atMs)?.easing ?? null));
  return easings.size === 1 ? [...easings][0] : null;
}

export function propertyKeys(keyframes: Keyframes | undefined, property: AnimatedProperty): KeySpot[] {
  return timedFramesOf(keyframes, property).map((frame) => ({ property, atMs: frame.atMs }));
}

export function shiftedKeys(keys: readonly KeySpot[], deltaMs: number): KeySpot[] {
  return keys.map((key) => ({ ...key, atMs: key.atMs + deltaMs }));
}

export type RelatedKeys = "previous" | "following" | "equal";

function keyValue(frame: TimedKey): string {
  if (isPositionKey(frame)) return `${frame.x},${frame.y}`;
  if (isMorphKey(frame)) return frame.path;
  return "color" in frame ? frame.color.toLowerCase() : String(frame.value);
}

export function relatedKeys(keyframes: Keyframes | undefined, selection: readonly KeySpot[], mode: RelatedKeys): KeySpot[] {
  return ANIMATED_PROPERTIES.flatMap((property) => {
    const picked = selection.filter((key) => key.property === property).map((key) => key.atMs);
    if (picked.length === 0) return [];
    const frames = timedFramesOf(keyframes, property);
    const values = new Set(frames.filter((frame) => picked.includes(frame.atMs)).map(keyValue));
    const keep = (frame: TimedKey) => (mode === "previous" ? frame.atMs < Math.min(...picked) : mode === "following" ? frame.atMs > Math.max(...picked) : values.has(keyValue(frame)));
    return frames.filter(keep).map((frame) => ({ property, atMs: frame.atMs }));
  });
}
