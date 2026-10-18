import { placementAffine, type Affine } from "./lottie-geometry";
import type { LottieGaps } from "./lottie-gaps";
import type { LottieProp, LottieTransform } from "./lottie-types";
import { readValue, stillVec, type Animated, type Vec } from "./lottie-values";

export type PositionSpec = { separated: false; value: Animated<Vec> } | { separated: true; x: Animated<Vec>; y: Animated<Vec> };

export interface TransformSpec {
  anchor: Animated<Vec>;
  position: PositionSpec;
  scale: Animated<Vec>;
  rotation: Animated<Vec>;
  opacity: Animated<Vec>;
}

const PERCENT = 100;

function nonZero(value: Animated<Vec>): boolean {
  const still = stillVec(value);
  return still === null || still.some((component) => component !== 0);
}

export function readTransform(raw: LottieTransform | undefined, gaps: LottieGaps, where: string): TransformSpec {
  const ks = raw ?? {};
  const p = ks.p as (LottieProp & { x?: LottieProp; y?: LottieProp }) | undefined;
  const separated = p?.s === true && typeof p.x === "object" && typeof p.y === "object";
  const position: PositionSpec = separated ? { separated: true, x: readValue(p.x as LottieProp, gaps, where), y: readValue(p.y as LottieProp, gaps, where) } : { separated: false, value: readValue(p, gaps, where, [0, 0]) };
  if (ks.sk && nonZero(readValue(ks.sk, gaps, where))) gaps.add("skew", where);
  if (ks.rx || ks.ry || ks.or) gaps.add("threeD", where);
  return {
    anchor: readValue(ks.a, gaps, where, [0, 0]),
    position,
    scale: readValue(ks.s, gaps, where, [PERCENT, PERCENT]),
    rotation: readValue(ks.r ?? ks.rz, gaps, where, [0]),
    opacity: readValue(ks.o, gaps, where, [PERCENT]),
  };
}

function positionValues(position: PositionSpec): Animated<Vec>[] {
  return position.separated ? [position.x, position.y] : [position.value];
}

export function transformMoves(spec: TransformSpec): boolean {
  return [spec.anchor, ...positionValues(spec.position), spec.scale, spec.rotation].some((value) => stillVec(value) === null);
}

function stillPosition(position: PositionSpec): Vec | null {
  if (!position.separated) return stillVec(position.value);
  const x = stillVec(position.x);
  const y = stillVec(position.y);
  return x && y ? [x[0], y[0]] : null;
}

export function stillAffine(spec: TransformSpec): Affine | null {
  const anchor = stillVec(spec.anchor);
  const position = stillPosition(spec.position);
  const scale = stillVec(spec.scale);
  const rotation = stillVec(spec.rotation);
  if (!anchor || !position || !scale || !rotation) return null;
  return placementAffine({ x: anchor[0] ?? 0, y: anchor[1] ?? 0 }, { x: position[0] ?? 0, y: position[1] ?? 0 }, { x: (scale[0] ?? PERCENT) / PERCENT, y: (scale[1] ?? scale[0] ?? PERCENT) / PERCENT }, rotation[0] ?? 0);
}
