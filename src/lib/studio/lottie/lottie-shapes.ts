import type { LottieGaps } from "./lottie-gaps";
import { readTransform, type TransformSpec } from "./lottie-transform";
import type { LottieProp, LottieShape, LottieTransform } from "./lottie-types";
import { readBezier, readValue, stillVec, type Animated, type Vec } from "./lottie-values";
import type { Bezier } from "./lottie-geometry";

export interface ShapeGroup {
  name: string;
  transform: TransformSpec;
  parent: ShapeGroup | null;
}

export interface TrimSpec {
  start: Animated<Vec>;
  end: Animated<Vec>;
  offset: Animated<Vec>;
  sequential: boolean;
}

export type PathSpec =
  | { kind: "path"; bezier: Animated<Bezier> }
  | { kind: "rect"; position: Animated<Vec>; size: Animated<Vec>; roundness: Animated<Vec>; reversed: boolean }
  | { kind: "ellipse"; position: Animated<Vec>; size: Animated<Vec>; reversed: boolean }
  | { kind: "star"; polygon: boolean; position: Animated<Vec>; points: Animated<Vec>; rotation: Animated<Vec>; outer: Animated<Vec>; inner: Animated<Vec>; reversed: boolean };

export interface PathSource {
  spec: PathSpec;
  group: ShapeGroup | null;
  trims: TrimSpec[];
}

export interface DashSpec {
  pattern: number[];
  offset: number;
}

export type PaintSpec =
  | { kind: "fill"; color: Animated<Vec>; opacity: Animated<Vec>; evenOdd: boolean }
  | { kind: "stroke"; color: Animated<Vec>; opacity: Animated<Vec>; width: number; cap: number; join: number; miter: number; dash: DashSpec | null };

export interface StyleSpec {
  paint: PaintSpec;
  group: ShapeGroup | null;
  sources: PathSource[];
}

interface ShapeTree {
  styles: StyleSpec[];
  groups: ShapeGroup[];
}

const UNSUPPORTED: Readonly<Record<string, Parameters<LottieGaps["add"]>[0]>> = {
  gf: "gradient",
  gs: "gradient",
  mm: "merge",
  rp: "repeater",
  tw: "twist",
  op: "offsetPath",
  pb: "pucker",
  zz: "zigzag",
};

function prop(item: LottieShape, field: string): LottieProp | undefined {
  const value = item[field];
  return value && typeof value === "object" ? (value as LottieProp) : undefined;
}

function stillNumber(value: Animated<Vec>, gaps: LottieGaps, code: Parameters<LottieGaps["add"]>[0], where: string): number {
  const still = stillVec(value);
  if (still === null) gaps.add(code, where);
  return (still ?? (value.keyed ? value.keys[0].value : value.value))[0] ?? 0;
}

function dashOf(item: LottieShape, gaps: LottieGaps, where: string): DashSpec | null {
  const raw = item.d;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const pattern: number[] = [];
  let offset = 0;
  for (const entry of raw as { n?: string; v?: LottieProp }[]) {
    const value = stillNumber(readValue(entry.v, gaps, where), gaps, "dashMotion", where);
    if (entry.n === "o") offset = value;
    else pattern.push(value);
  }
  return pattern.length > 0 ? { pattern, offset } : null;
}

function paintOf(item: LottieShape, gaps: LottieGaps, where: string): PaintSpec {
  const color = readValue(prop(item, "c"), gaps, where, [0, 0, 0, 1]);
  const opacity = readValue(prop(item, "o"), gaps, where, [100]);
  if (item.ty === "fl") return { kind: "fill", color, opacity, evenOdd: item.r === 2 };
  const width = stillNumber(readValue(prop(item, "w"), gaps, where, [1]), gaps, "strokeWidthMotion", where);
  return { kind: "stroke", color, opacity, width, cap: Number(item.lc ?? 2), join: Number(item.lj ?? 2), miter: Number(item.ml ?? 4), dash: dashOf(item, gaps, where) };
}

function pathOf(item: LottieShape, gaps: LottieGaps, where: string): PathSpec | null {
  const reversed = item.d === 3;
  switch (item.ty) {
    case "sh":
      return { kind: "path", bezier: readBezier(prop(item, "ks"), gaps, where) };
    case "rc":
      return { kind: "rect", position: readValue(prop(item, "p"), gaps, where, [0, 0]), size: readValue(prop(item, "s"), gaps, where, [0, 0]), roundness: readValue(prop(item, "r"), gaps, where, [0]), reversed };
    case "el":
      return { kind: "ellipse", position: readValue(prop(item, "p"), gaps, where, [0, 0]), size: readValue(prop(item, "s"), gaps, where, [0, 0]), reversed };
    case "sr": {
      const polygon = item.sy === 2;
      const outerRound = stillVec(readValue(prop(item, "os"), gaps, where, [0]));
      const innerRound = polygon ? [0] : stillVec(readValue(prop(item, "is"), gaps, where, [0]));
      if (!outerRound || !innerRound || outerRound[0] !== 0 || innerRound[0] !== 0) gaps.add("starRoundness", where);
      return {
        kind: "star",
        polygon,
        position: readValue(prop(item, "p"), gaps, where, [0, 0]),
        points: readValue(prop(item, "pt"), gaps, where, [5]),
        rotation: readValue(prop(item, "r"), gaps, where, [0]),
        outer: readValue(prop(item, "or"), gaps, where, [0]),
        inner: polygon ? { keyed: false, value: [0] } : readValue(prop(item, "ir"), gaps, where, [0]),
        reversed,
      };
    }
  }
  return null;
}

function walk(items: readonly LottieShape[], group: ShapeGroup | null, tree: ShapeTree, gaps: LottieGaps, where: string): PathSource[] {
  const collected: PathSource[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object" || item.hd === true) continue;
    if (item.ty === "tr") continue;
    if (item.ty === "gr") {
      const it = Array.isArray(item.it) ? (item.it as LottieShape[]) : [];
      const tr = it.find((child) => child?.ty === "tr") as LottieTransform | undefined;
      const child: ShapeGroup = { name: typeof item.nm === "string" ? item.nm : where, transform: readTransform(tr, gaps, where), parent: group };
      tree.groups.push(child);
      collected.push(...walk(it, child, tree, gaps, where));
      continue;
    }
    if (item.ty === "fl" || item.ty === "st") {
      tree.styles.push({ paint: paintOf(item, gaps, where), group, sources: [...collected] });
      continue;
    }
    if (item.ty === "tm") {
      const trim: TrimSpec = { start: readValue(prop(item, "s"), gaps, where, [0]), end: readValue(prop(item, "e"), gaps, where, [100]), offset: readValue(prop(item, "o"), gaps, where, [0]), sequential: item.m === 2 };
      for (const source of collected) source.trims.push(trim);
      continue;
    }
    if (item.ty === "rd") {
      const radius = stillVec(readValue(prop(item, "r"), gaps, where, [0]));
      if (!radius || radius[0] !== 0) gaps.add("roundCorners", where);
      continue;
    }
    const spec = pathOf(item, gaps, where);
    if (spec) {
      collected.push({ spec, group, trims: [] });
      continue;
    }
    gaps.add(UNSUPPORTED[item.ty] ?? "shapeKind", where);
  }
  return collected;
}

export function readShapes(items: readonly LottieShape[] | undefined, gaps: LottieGaps, where: string): ShapeTree {
  const tree: ShapeTree = { styles: [], groups: [] };
  walk(items ?? [], null, tree, gaps, where);
  return tree;
}
