import { bezierEasing, BEZIER_Y_RANGE, ease, type Easing } from "../keyframes";
import type { Bezier, Point } from "./lottie-geometry";
import type { LottieGaps } from "./lottie-gaps";
import type { LottieBezier, LottieEase, LottieKey, LottieProp } from "./lottie-types";

export type Vec = number[];

export interface Key<T> {
  frame: number;
  value: T;
  ease: Easing[];
  out?: Vec;
  in?: Vec;
}

export type Animated<T> = { keyed: false; value: T } | { keyed: true; keys: Key<T>[] };

const PLACES = 1e4;

function rounded(value: number): number {
  return Math.round(value * PLACES) / PLACES || 0;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function pick(value: number | number[] | undefined, dim: number): number | undefined {
  if (Array.isArray(value)) return value[dim] ?? value[0];
  return value;
}

export function easeOf(out: LottieEase | undefined, into: LottieEase | undefined, dim: number): Easing {
  const values = [pick(out?.x, dim), pick(out?.y, dim), pick(into?.x, dim), pick(into?.y, dim)];
  if (!values.every((value): value is number => typeof value === "number" && Number.isFinite(value))) return "linear";
  const [ox, oy, ix, iy] = values;
  if (ox === oy && ix === iy) return "linear";
  return bezierEasing([rounded(clamp(ox, 0, 1)), rounded(clamp(oy, BEZIER_Y_RANGE[0], BEZIER_Y_RANGE[1])), rounded(clamp(ix, 0, 1)), rounded(clamp(iy, BEZIER_Y_RANGE[0], BEZIER_Y_RANGE[1]))]);
}

function vecOf(raw: unknown): Vec | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return [raw];
  if (Array.isArray(raw) && raw.length > 0 && raw.every((value) => typeof value === "number" && Number.isFinite(value))) return raw as number[];
  return null;
}

function isKeyList(raw: unknown): raw is LottieKey[] {
  return Array.isArray(raw) && raw.length > 0 && raw.every((key) => key !== null && typeof key === "object" && typeof (key as LottieKey).t === "number");
}

function hasExpression(prop: LottieProp | undefined): boolean {
  return typeof prop?.x === "string" && prop.x.trim() !== "";
}

function readKeys<T>(prop: LottieProp, gaps: LottieGaps, where: string, parse: (raw: unknown) => T | null, dims: (value: T) => number, fallback: T): Animated<T> {
  if (hasExpression(prop)) gaps.add("expression", where);
  const raw = prop.k;
  if (!isKeyList(raw)) {
    const value = parse(raw);
    if (value === null) gaps.add("invalid", where);
    return { keyed: false, value: value ?? fallback };
  }
  const keys: Key<T>[] = [];
  let previousEnd: unknown;
  for (const key of raw) {
    const value = parse(key.s ?? previousEnd);
    previousEnd = key.e;
    if (value === null || !Number.isFinite(key.t)) {
      gaps.add("invalid", where);
      return { keyed: false, value: fallback };
    }
    const count = dims(value);
    const easing = Array.from({ length: count }, (_, dim): Easing => (key.h === 1 ? "hold" : easeOf(key.o, key.i, dim)));
    keys.push({ frame: key.t, value, ease: easing, ...(vecOf(key.to) ? { out: vecOf(key.to)! } : {}), ...(vecOf(key.ti) ? { in: vecOf(key.ti)! } : {}) });
  }
  if (keys.some((key, index) => index > 0 && key.frame < keys[index - 1].frame)) {
    gaps.add("invalid", where);
    return { keyed: false, value: fallback };
  }
  return keys.length === 1 ? { keyed: false, value: keys[0].value } : { keyed: true, keys };
}

export function readValue(prop: LottieProp | undefined, gaps: LottieGaps, where: string, fallback: Vec = [0]): Animated<Vec> {
  if (!prop) return { keyed: false, value: fallback };
  return readKeys(prop, gaps, where, vecOf, (value) => value.length, fallback);
}

function pointsOf(raw: unknown): Point[] | null {
  if (!Array.isArray(raw)) return null;
  const points: Point[] = [];
  for (const pair of raw) {
    if (!Array.isArray(pair) || pair.length < 2 || !Number.isFinite(pair[0]) || !Number.isFinite(pair[1])) return null;
    points.push({ x: pair[0], y: pair[1] });
  }
  return points;
}

function bezierOf(raw: unknown): Bezier | null {
  const shape = (Array.isArray(raw) ? raw[0] : raw) as LottieBezier | undefined;
  if (!shape || typeof shape !== "object") return null;
  const points = pointsOf(shape.v);
  const ins = pointsOf(shape.i);
  const outs = pointsOf(shape.o);
  if (!points || !ins || !outs || ins.length !== points.length || outs.length !== points.length) return null;
  return { closed: Boolean(shape.c), points, ins: points.map((point, i) => ({ x: point.x + ins[i].x, y: point.y + ins[i].y })), outs: points.map((point, i) => ({ x: point.x + outs[i].x, y: point.y + outs[i].y })) };
}

const NO_PATH: Bezier = { closed: false, points: [], ins: [], outs: [] };

export function readBezier(prop: LottieProp | undefined, gaps: LottieGaps, where: string): Animated<Bezier> {
  if (!prop) {
    gaps.add("invalid", where);
    return { keyed: false, value: NO_PATH };
  }
  return readKeys(prop, gaps, where, bezierOf, () => 1, NO_PATH);
}

export function valueAtFrame(value: Animated<Vec>, frame: number): Vec {
  if (!value.keyed) return value.value;
  const keys = value.keys;
  if (frame <= keys[0].frame) return keys[0].value;
  for (let i = 0; i < keys.length - 1; i++) {
    const from = keys[i];
    const to = keys[i + 1];
    if (frame >= to.frame) continue;
    const progress = (frame - from.frame) / (to.frame - from.frame);
    return from.value.map((start, dim) => start + ((to.value[dim] ?? start) - start) * ease(from.ease[dim] ?? from.ease[0], progress));
  }
  return keys[keys.length - 1].value;
}

function isStill<T>(value: Animated<T>, same: (a: T, b: T) => boolean): boolean {
  return !value.keyed || value.keys.every((key) => same(key.value, value.keys[0].value));
}

function sameVec(a: Vec, b: Vec): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

export function stillVec(value: Animated<Vec>): Vec | null {
  if (!value.keyed) return value.value;
  return isStill(value, sameVec) ? value.keys[0].value : null;
}
