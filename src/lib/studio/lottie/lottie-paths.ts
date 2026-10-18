import { ease, type Easing } from "../keyframes";
import { ellipseBezier, mapBezier, rectBezier, starBezier, type Affine, type Bezier, type Point } from "./lottie-geometry";
import type { PathSpec } from "./lottie-shapes";
import { valueAtFrame, type Animated, type Key, type Vec } from "./lottie-values";

interface Param {
  value: Animated<Vec>;
  affine: boolean;
}

function point(value: Vec): Point {
  return { x: value[0] ?? 0, y: value[1] ?? value[0] ?? 0 };
}

function keyedParams(params: readonly Param[]): Param[] {
  return params.filter((param) => param.value.keyed);
}

export function sampleFrames(values: readonly Animated<unknown>[]): number[] {
  const frames = values.flatMap((value) => (value.keyed ? value.keys.map((key) => key.frame) : []));
  if (frames.length === 0) return [];
  const first = Math.min(...frames);
  const last = Math.max(...frames);
  const out = [first];
  for (let frame = Math.floor(first) + 1; frame < last; frame++) out.push(frame);
  if (last > first) out.push(last);
  return out;
}

function sameEase(key: Key<Vec>): boolean {
  return key.ease.every((easing) => easing === key.ease[0]);
}

function parametric(params: readonly Param[], build: (values: Vec[]) => Bezier): Animated<Bezier> {
  const moving = keyedParams(params);
  const at = (frame: number) => build(params.map((param) => valueAtFrame(param.value, frame)));
  if (moving.length === 0) return { keyed: false, value: build(params.map((param) => valueAtFrame(param.value, 0))) };
  const only = moving[0];
  if (moving.length === 1 && only.affine && only.value.keyed && only.value.keys.every(sameEase)) {
    return { keyed: true, keys: only.value.keys.map((key) => ({ frame: key.frame, value: at(key.frame), ease: [key.ease[0]] })) };
  }
  return { keyed: true, keys: sampleFrames(moving.map((param) => param.value)).map((frame) => ({ frame, value: at(frame), ease: ["linear" as Easing] })) };
}

export function specGeometry(spec: PathSpec): Animated<Bezier> {
  switch (spec.kind) {
    case "path":
      return spec.bezier;
    case "rect":
      return parametric(
        [
          { value: spec.position, affine: true },
          { value: spec.size, affine: !spec.roundness.keyed && valueAtFrame(spec.roundness, 0)[0] === 0 },
          { value: spec.roundness, affine: false },
        ],
        ([p, s, r]) => rectBezier(point(p), point(s), r[0] ?? 0, spec.reversed),
      );
    case "ellipse":
      return parametric(
        [
          { value: spec.position, affine: true },
          { value: spec.size, affine: true },
        ],
        ([p, s]) => ellipseBezier(point(p), point(s), spec.reversed),
      );
    case "star":
      return parametric(
        [
          { value: spec.position, affine: true },
          { value: spec.outer, affine: true },
          { value: spec.inner, affine: true },
          { value: spec.points, affine: false },
          { value: spec.rotation, affine: false },
        ],
        ([p, outer, inner, points, rotation]) => starBezier({ center: point(p), outer: outer[0] ?? 0, inner: inner[0] ?? 0, points: points[0] ?? 0, rotation: rotation[0] ?? 0, polygon: spec.polygon, reversed: spec.reversed }),
      );
  }
}

function lerp(a: Point, b: Point, w: number): Point {
  return { x: a.x + (b.x - a.x) * w, y: a.y + (b.y - a.y) * w };
}

function blend(a: Bezier, b: Bezier, w: number): Bezier {
  if (a.points.length !== b.points.length) return w < 1 ? a : b;
  return { closed: a.closed, points: a.points.map((p, i) => lerp(p, b.points[i], w)), ins: a.ins.map((p, i) => lerp(p, b.ins[i], w)), outs: a.outs.map((p, i) => lerp(p, b.outs[i], w)) };
}

function bezierAtFrame(value: Animated<Bezier>, frame: number): Bezier {
  if (!value.keyed) return value.value;
  const keys = value.keys;
  if (frame <= keys[0].frame) return keys[0].value;
  for (let i = 0; i < keys.length - 1; i++) {
    const from = keys[i];
    const to = keys[i + 1];
    if (frame >= to.frame) continue;
    return blend(from.value, to.value, ease(from.ease[0], (frame - from.frame) / (to.frame - from.frame)));
  }
  return keys[keys.length - 1].value;
}

function sameTiming(a: Key<unknown>[], b: Key<unknown>[]): boolean {
  return a.length === b.length && a.every((key, i) => key.frame === b[i].frame && key.ease[0] === b[i].ease[0]);
}

export function combineGeometry(sources: readonly Animated<Bezier>[], fold: Affine): Animated<Bezier[]> {
  const folded = (frame: number) => sources.map((source) => mapBezier(bezierAtFrame(source, frame), fold));
  const moving = sources.filter((source): source is Extract<Animated<Bezier>, { keyed: true }> => source.keyed);
  if (moving.length === 0) return { keyed: false, value: folded(0) };
  const lead = moving[0].keys;
  if (moving.every((source) => sameTiming(source.keys, lead))) return { keyed: true, keys: lead.map((key) => ({ frame: key.frame, value: folded(key.frame), ease: [key.ease[0]] })) };
  return { keyed: true, keys: sampleFrames(moving).map((frame) => ({ frame, value: folded(frame), ease: ["linear" as Easing] })) };
}
