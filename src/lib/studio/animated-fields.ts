import type { KeyState } from "./keyframe-edit";
import { isEasing, KEYFRAME_LIMITS, valueAt, type Keyframe } from "./keyframes";
import type { IssueCode } from "./validate";

export type Lanes<P extends string> = Partial<Record<P, Keyframe[]>>;

export interface Animated<P extends string> {
  keyframes?: Lanes<P>;
}

export interface AnimatedFields<T extends Animated<P>, P extends string> {
  staticValue(item: T, property: P): number;
  withStatic(item: T, property: P, value: number): T;
  range(property: P, item: T): readonly [number, number];
}

export function clampTo(value: number, [low, high]: readonly [number, number]): number {
  return Math.min(high, Math.max(low, value));
}

function laneOf<T extends Animated<P>, P extends string>(item: T, property: P): readonly Keyframe[] {
  return item.keyframes?.[property] ?? [];
}

function withLanes<T extends Animated<P>, P extends string>(item: T, lanes: Lanes<P>): T {
  const next = { ...item };
  if (Object.keys(lanes).length > 0) next.keyframes = lanes;
  else delete next.keyframes;
  return next;
}

export function shiftLanes<P extends string>(lanes: Lanes<P> | undefined, deltaMs: number): Lanes<P> | undefined {
  if (!lanes) return lanes;
  return Object.fromEntries(Object.entries(lanes).map(([property, frames]) => [property, (frames as Keyframe[]).map((frame) => ({ ...frame, atMs: frame.atMs + deltaMs }))])) as Lanes<P>;
}

export function fieldValue<T extends Animated<P>, P extends string>(spec: AnimatedFields<T, P>, item: T, property: P, localMs: number): number {
  const frames = laneOf(item, property);
  return clampTo(frames.length > 0 ? valueAt(frames, localMs) : spec.staticValue(item, property), spec.range(property, item));
}

export function setFieldKey<T extends Animated<P>, P extends string>(spec: AnimatedFields<T, P>, item: T, property: P, atMs: number, value: number): T {
  const frames = laneOf(item, property);
  const existing = frames.find((frame) => frame.atMs === atMs);
  const placed: Keyframe = { atMs, value: clampTo(value, spec.range(property, item)), easing: existing?.easing ?? "linear" };
  const next = [...frames.filter((frame) => frame.atMs !== atMs), placed].sort((a, b) => a.atMs - b.atMs);
  return withLanes(item, { ...item.keyframes, [property]: next });
}

function withoutLane<T extends Animated<P>, P extends string>(spec: AnimatedFields<T, P>, item: T, property: P, value: number): T {
  const lanes: Lanes<P> = { ...item.keyframes };
  delete lanes[property];
  return withLanes(spec.withStatic(item, property, value), lanes);
}

export function setFieldLane<T extends Animated<P>, P extends string>(spec: AnimatedFields<T, P>, item: T, property: P, frames: readonly Keyframe[]): T {
  if (frames.length === 0) return laneOf(item, property).length > 0 ? withoutLane(spec, item, property, fieldValue(spec, item, property, 0)) : item;
  return withLanes(item, { ...item.keyframes, [property]: [...frames].sort((a, b) => a.atMs - b.atMs) });
}

export function toggleFieldKey<T extends Animated<P>, P extends string>(spec: AnimatedFields<T, P>, item: T, property: P, atMs: number): T {
  const frames = laneOf(item, property);
  const existing = frames.find((frame) => frame.atMs === atMs);
  if (!existing) return setFieldKey(spec, item, property, atMs, fieldValue(spec, item, property, atMs));
  const remaining = frames.filter((frame) => frame !== existing);
  if (remaining.length === 0) return withoutLane(spec, item, property, existing.value);
  return withLanes(item, { ...item.keyframes, [property]: remaining });
}

export function fieldKeyState<T extends Animated<P>, P extends string>(item: T, property: P, localMs: number | null): KeyState {
  const frames = laneOf(item, property);
  if (frames.length === 0) return "static";
  return localMs !== null && frames.some((frame) => frame.atMs === localMs) ? "key" : "interpolated";
}

export function editFieldValue<T extends Animated<P>, P extends string>(spec: AnimatedFields<T, P>, item: T, property: P, value: number, localMs: number | null): T | null {
  if (laneOf(item, property).length === 0) return spec.withStatic(item, property, clampTo(value, spec.range(property, item)));
  return localMs === null ? null : setFieldKey(spec, item, property, localMs, value);
}

function laneIssue(frames: readonly Keyframe[], [low, high]: readonly [number, number]): IssueCode | null {
  for (const [i, frame] of frames.entries()) {
    if (!isEasing(frame.easing)) return "unknown";
    if (!Number.isFinite(frame.atMs) || Math.abs(frame.atMs) > KEYFRAME_LIMITS.maxAbsMs || (i > 0 && frame.atMs <= frames[i - 1].atMs)) return "out_of_range";
    if (!Number.isFinite(frame.value) || frame.value < low || frame.value > high) return "out_of_range";
  }
  return null;
}

export function lanesIssue(lanes: Readonly<Record<string, readonly Keyframe[] | undefined>>, rangeOf: (property: string) => readonly [number, number] | null): IssueCode | null {
  for (const [property, frames] of Object.entries(lanes)) {
    if (!frames || frames.length === 0) continue;
    const range = rangeOf(property);
    if (!range) return "invalid";
    const issue = laneIssue(frames, range);
    if (issue) return issue;
  }
  return null;
}
