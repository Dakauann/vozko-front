import { fullFrame, newNullClip, newOverlayClip, newStudioId, NULL_BOX, STUDIO_LIMITS, type BlendMode, type CanvasSize, type Clip, type Layer, type LineCap, type LineJoin, type Track, type Transform } from "../document";
import type { GroupClip } from "../group-scope";
import { KEYFRAME_RANGES, type ColorKeyframe, type Keyframe, type Keyframes } from "../keyframes";
import { clampTo, LAYER_RANGES, normalizedRotation } from "../layer-ranges";
import type { LineAnimation } from "../line-animation";
import type { Mask, MaskKeyframes, MaskMode } from "../masks";
import type { MorphKeyframe } from "../morph-keys";
import type { PositionKeyframe } from "../path-keys";
import { boundsOf, compose, IDENTITY, isIdentity, mapBezier, strokeScale, unitPath, type Affine, type Bezier, type Box, type Point } from "./lottie-geometry";
import { LottieGaps, type LottieGap } from "./lottie-gaps";
import { combineGeometry, sampleFrames, specGeometry } from "./lottie-paths";
import { readShapes, type PaintSpec, type PathSource, type ShapeGroup, type StyleSpec, type TrimSpec } from "./lottie-shapes";
import { readTransform, stillAffine, transformMoves, type TransformSpec } from "./lottie-transform";
import type { LottieAnimation, LottieAsset, LottieLayer } from "./lottie-types";
import { readBezier, readValue, stillVec, valueAtFrame, type Animated, type Vec } from "./lottie-values";

interface LottieConvertOptions {
  canvas: CanvasSize;
  atMs: number;
  name: string;
}

export type LottieNote = "scaleClamped";

export type LottieConversion = { ok: true; clip: GroupClip; notes: LottieNote[] } | { ok: false; gaps: LottieGap[] };

const LAYER_PRECOMP = 0;
const LAYER_SOLID = 1;
const LAYER_IMAGE = 2;
const LAYER_NULL = 3;
const LAYER_SHAPE = 4;
const LAYER_TEXT = 5;
const LAYER_AUDIO = 6;
const LAYER_CAMERA = 13;
const PERCENT = 100;
const MIN_EXTENT = 1;
const MAX_NAME = 128;
const STILL_RANGE = [0, 1] as const;
const MOVING_RANGE = KEYFRAME_RANGES.x;
const ROTATION_RANGE = KEYFRAME_RANGES.rotation;
const SCALE_RANGE = KEYFRAME_RANGES.scale;
const NULL_SCALE_RANGE = [0.01, 40] as const;
const BOX_RANGE = [0.001, 4] as const;
const HANDLE_LIMIT = 2;
const MASK_EXPANSION = [-0.5, 0.5] as const;

const LOTTIE_BLENDS: readonly BlendMode[] = ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity", "add"];
const CAPS: Record<number, LineCap> = { 1: "butt", 2: "round", 3: "square" };
const JOINS: Record<number, LineJoin> = { 1: "miter", 2: "round", 3: "bevel" };
const MASK_MODES: Record<string, MaskMode> = { a: "add", s: "subtract", i: "intersect" };

interface Context {
  fr: number;
  k: number;
  width: number;
  height: number;
  gaps: LottieGaps;
  notes: Set<LottieNote>;
  assets: ReadonlyMap<string, LottieAsset>;
  visiting: Set<string>;
}

interface FrameNode {
  name: string;
  transform: TransformSpec;
  parent: FrameNode | null;
  children: FrameNode[];
  layer: LottieLayer;
  group: ShapeGroup | null;
  precomp: boolean;
  clipId?: string;
}

interface Space {
  origin: Point;
  offset: Point;
}

interface Built {
  clips: Clip[];
  endMs: number;
}

type Lane = number | Keyframe[];

function whereOf(layer: LottieLayer): string {
  return (layer.nm ?? "").trim() || `#${layer.ind ?? "?"}`;
}

function nameOf(text: string): string {
  return [...text].slice(0, MAX_NAME).join("");
}

function round(value: number): number {
  return Math.round(value);
}

function hex(color: Vec): string {
  const channel = (value: number | undefined) => Math.round(Math.min(1, Math.max(0, value ?? 0)) * 255).toString(16).padStart(2, "0");
  return `#${channel(color[0])}${channel(color[1])}${channel(color[2])}`;
}

function within(value: number, [low, high]: readonly [number, number]): boolean {
  return Number.isFinite(value) && value >= low - 1e-9 && value <= high + 1e-9;
}

function laneValues(lane: Lane): number[] {
  return typeof lane === "number" ? [lane] : lane.map((key) => key.value);
}

function firstOf(lane: Lane): number {
  return typeof lane === "number" ? lane : lane[0].value;
}

function msOf(ctx: Context, frame: number): number {
  return (frame * 1000) / ctx.fr;
}

class Converter {
  constructor(private readonly ctx: Context) {}

  private keyMs(layer: LottieLayer, clipStart: number): (frame: number) => number {
    const st = layer.st ?? 0;
    return (frame) => round(msOf(this.ctx, frame + st - clipStart));
  }

  private lane(value: Animated<Vec>, dim: number, map: (v: number) => number, at: (frame: number) => number): Lane {
    const still = stillVec(value);
    if (still) return map(still[dim] ?? still[0] ?? 0);
    if (!value.keyed) return map(value.value[dim] ?? 0);
    const component = (key: { value: Vec }) => key.value[dim] ?? key.value[0] ?? 0;
    if (value.keys.every((key) => component(key) === component(value.keys[0]))) return map(component(value.keys[0]));
    const keys: Keyframe[] = [];
    for (const key of value.keys) {
      const frame: Keyframe = { atMs: at(key.frame), value: map(key.value[dim] ?? key.value[0] ?? 0), easing: key.ease[dim] ?? key.ease[0] };
      if (keys.length > 0 && keys[keys.length - 1].atMs >= frame.atMs) keys[keys.length - 1] = frame;
      else keys.push(frame);
    }
    return keys.length === 1 ? keys[0].value : keys;
  }

  private toLocal(space: Space, q: Point): Point {
    return { x: space.offset.x + (this.ctx.k * (q.x - space.origin.x)) / this.ctx.width, y: space.offset.y + (this.ctx.k * (q.y - space.origin.y)) / this.ctx.height };
  }

  private sizeLocal(v: Point): Point {
    return { x: (this.ctx.k * v.x) / this.ctx.width, y: (this.ctx.k * v.y) / this.ctx.height };
  }

  private checkLane(lane: Lane, range: readonly [number, number], where: string): void {
    if (!laneValues(lane).every((value) => within(value, range))) this.ctx.gaps.add("outOfBounds", where);
  }

  private layerFlags(layer: LottieLayer): boolean {
    const gaps = this.ctx.gaps;
    const where = whereOf(layer);
    const kinds: Record<number, Parameters<LottieGaps["add"]>[0]> = { [LAYER_IMAGE]: "image", [LAYER_TEXT]: "text", [LAYER_AUDIO]: "audio", [LAYER_CAMERA]: "camera" };
    if (kinds[layer.ty]) gaps.add(kinds[layer.ty], where);
    else if (![LAYER_PRECOMP, LAYER_SOLID, LAYER_NULL, LAYER_SHAPE].includes(layer.ty)) gaps.add("layerKind", where);
    if (layer.ddd === 1) gaps.add("threeD", where);
    if (Array.isArray(layer.ef) && layer.ef.length > 0) gaps.add("effects", where);
    if ((layer.tt ?? 0) !== 0 || layer.td === 1) gaps.add("trackMatte", where);
    if (layer.sr !== undefined && layer.sr !== 1) gaps.add("timeStretch", where);
    if (layer.tm !== undefined) gaps.add("timeRemap", where);
    if (layer.bm !== undefined && !LOTTIE_BLENDS[layer.bm]) gaps.add("blendMode", where);
    if (!Number.isFinite(layer.ip) || !Number.isFinite(layer.op)) gaps.add("invalid", where);
    return layer.op > layer.ip;
  }

  private checkTransform(spec: TransformSpec, where: string): void {
    if (!stillVec(spec.anchor)) this.ctx.gaps.add("anchorMotion", where);
    const scales = spec.scale.keyed ? spec.scale.keys.map((key) => key.value) : [spec.scale.value];
    if (scales.some((value) => (value[0] ?? 0) < 0 || (value[1] ?? 0) < 0)) this.ctx.gaps.add("negativeScale", where);
  }

  private nodes(layers: readonly LottieLayer[]): { layerNodes: Map<LottieLayer, FrameNode>; groupNodes: Map<ShapeGroup, FrameNode>; styles: Map<LottieLayer, StyleSpec[]> } {
    const layerNodes = new Map<LottieLayer, FrameNode>();
    const groupNodes = new Map<ShapeGroup, FrameNode>();
    const styles = new Map<LottieLayer, StyleSpec[]>();
    for (const layer of layers) {
      const where = whereOf(layer);
      const transform = readTransform(layer.ks, this.ctx.gaps, where);
      this.checkTransform(transform, where);
      layerNodes.set(layer, { name: where, transform, parent: null, children: [], layer, group: null, precomp: layer.ty === LAYER_PRECOMP });
    }
    const byIndex = new Map(layers.filter((layer) => layer.ind !== undefined).map((layer) => [layer.ind, layerNodes.get(layer)!]));
    for (const layer of layers) {
      if (layer.parent === undefined) continue;
      const parent = byIndex.get(layer.parent);
      const node = layerNodes.get(layer)!;
      if (!parent || parent === node) {
        this.ctx.gaps.add("invalid", whereOf(layer));
        continue;
      }
      node.parent = parent;
      parent.children.push(node);
    }
    for (const node of layerNodes.values()) {
      const seen = new Set<FrameNode>();
      for (let at: FrameNode | null = node; at; at = at.parent) {
        if (seen.has(at)) {
          this.ctx.gaps.add("invalid", node.name);
          node.parent = null;
          break;
        }
        seen.add(at);
      }
    }
    for (const layer of layers) {
      if (layer.ty !== LAYER_SHAPE) continue;
      const where = whereOf(layer);
      const tree = readShapes(layer.shapes, this.ctx.gaps, where);
      styles.set(layer, tree.styles);
      for (const group of tree.groups) {
        this.checkTransform(group.transform, where);
        const parent = group.parent ? groupNodes.get(group.parent)! : layerNodes.get(layer)!;
        const node: FrameNode = { name: where, transform: group.transform, parent, children: [], layer, group, precomp: false };
        parent.children.push(node);
        groupNodes.set(group, node);
      }
    }
    return { layerNodes, groupNodes, styles };
  }

  private providers(all: readonly FrameNode[]): (node: FrameNode) => boolean {
    const memo = new Map<FrameNode, boolean>();
    const below = new Map<FrameNode, boolean>();
    const identity = (node: FrameNode) => {
      const affine = stillAffine(node.transform);
      return affine !== null && isIdentity(affine);
    };
    const moves = (node: FrameNode) => transformMoves(node.transform);
    const hasBelow = (node: FrameNode): boolean => {
      const known = below.get(node);
      if (known !== undefined) return known;
      const value = node.children.some((child) => provides(child) || hasBelow(child));
      below.set(node, value);
      return value;
    };
    const provides = (node: FrameNode): boolean => {
      const known = memo.get(node);
      if (known !== undefined) return known;
      const value = node.precomp || moves(node) || (!identity(node) && hasBelow(node));
      memo.set(node, value);
      return value;
    };
    for (const node of all) provides(node);
    return provides;
  }

  private frameParent(node: FrameNode | null, provides: (node: FrameNode) => boolean): FrameNode | null {
    for (let at = node; at; at = at.parent) if (provides(at)) return at;
    return null;
  }

  private fold(from: FrameNode | null, stop: FrameNode | null): Affine {
    let affine: Affine = IDENTITY;
    for (let at = from; at && at !== stop; at = at.parent) affine = compose(stillAffine(at.transform) ?? IDENTITY, affine);
    return affine;
  }

  private spaceOf(provider: FrameNode | null, root: Point): Space {
    if (!provider) return { origin: { x: 0, y: 0 }, offset: root };
    const anchor = stillVec(provider.transform.anchor) ?? [0, 0];
    return { origin: { x: anchor[0] ?? 0, y: anchor[1] ?? 0 }, offset: { x: 0.5, y: 0.5 } };
  }

  private span(node: FrameNode): [number, number] {
    let start = Math.max(0, node.layer.ip);
    let end = node.layer.op;
    if (node.group === null) {
      for (const child of node.children) {
        if (child.group !== null) continue;
        const [childStart, childEnd] = this.span(child);
        start = Math.min(start, childStart);
        end = Math.max(end, childEnd);
      }
    }
    return [start, end];
  }

  private timing(start: number, end: number): { startMs: number; durationMs: number } {
    const startMs = round(msOf(this.ctx, start));
    return { startMs, durationMs: Math.max(STUDIO_LIMITS.minClipMs, round(msOf(this.ctx, end)) - startMs) };
  }

  private position(node: FrameNode, space: Space, at: (frame: number) => number, shift: Point): { x: Lane; y: Lane; path?: PositionKeyframe[] } {
    const position = node.transform.position;
    const where = node.name;
    if (position.separated) {
      return { x: this.lane(position.x, 0, (v) => this.toLocal(space, { x: v, y: 0 }).x - shift.x, at), y: this.lane(position.y, 0, (v) => this.toLocal(space, { x: 0, y: v }).y - shift.y, at) };
    }
    const value = position.value;
    const autoOrient = node.layer.ao === 1 && node.group === null;
    const tangent = value.keyed && value.keys.some((key) => [...(key.out ?? []).slice(0, 2), ...(key.in ?? []).slice(0, 2)].some((component) => component !== 0));
    if (value.keyed && stillVec(value) === null && (tangent || autoOrient)) {
      const handle = (vector: Vec | undefined): Point => {
        const scaled = this.sizeLocal({ x: vector?.[0] ?? 0, y: vector?.[1] ?? 0 });
        if (Math.abs(scaled.x) > HANDLE_LIMIT || Math.abs(scaled.y) > HANDLE_LIMIT) this.ctx.gaps.add("outOfBounds", where);
        return scaled;
      };
      const keys: PositionKeyframe[] = value.keys.map((key, i) => {
        const local = this.toLocal(space, { x: key.value[0] ?? 0, y: key.value[1] ?? 0 });
        const base: PositionKeyframe = { atMs: at(key.frame), x: local.x - shift.x, y: local.y - shift.y, easing: key.ease[0] };
        if (!tangent) return { ...base, spatial: "linear" };
        return { ...base, spatial: "free", in: i > 0 ? handle(value.keys[i - 1].in) : { x: 0, y: 0 }, out: i < value.keys.length - 1 ? handle(key.out) : { x: 0, y: 0 } };
      });
      return { x: keys[0].x, y: keys[0].y, path: keys };
    }
    return { x: this.lane(value, 0, (v) => this.toLocal(space, { x: v, y: 0 }).x - shift.x, at), y: this.lane(value, 1, (v) => this.toLocal(space, { x: 0, y: v }).y - shift.y, at) };
  }

  private scaleLanes(spec: TransformSpec, at: (frame: number) => number, where: string): { x: Lane; y: Lane; uniform: boolean } {
    const clamp = (v: number) => {
      const scaled = v / PERCENT;
      const kept = clampTo(scaled, SCALE_RANGE);
      if (kept !== scaled) this.ctx.notes.add("scaleClamped");
      return kept;
    };
    const keyedScale = spec.scale.keyed && stillVec(spec.scale) === null;
    const x = keyedScale ? this.lane(spec.scale, 0, clamp, at) : this.lane(spec.scale, 0, (v) => v / PERCENT, at);
    const y = keyedScale ? this.lane(spec.scale, 1, clamp, at) : this.lane(spec.scale, 1, (v) => v / PERCENT, at);
    const uniform = typeof x === "number" && typeof y === "number" ? x === y : typeof x !== "number" && typeof y !== "number" && x.length === y.length && x.every((key, i) => key.atMs === y[i].atMs && key.value === y[i].value && key.easing === y[i].easing);
    if (!laneValues(x).concat(laneValues(y)).every(Number.isFinite)) this.ctx.gaps.add("invalid", where);
    return { x, y, uniform };
  }

  private placementKeys(node: FrameNode, space: Space, at: (frame: number) => number, shift: Point, parented: boolean): { transform: Transform; keyframes: Keyframes; stage: boolean } {
    const where = node.name;
    const place = this.position(node, space, at, shift);
    const rotation = this.lane(node.transform.rotation, 0, (v) => v, at);
    const keyframes: Keyframes = {};
    if (place.path) keyframes.position = place.path;
    if (typeof place.x !== "number") keyframes.x = place.x;
    if (typeof place.y !== "number") keyframes.y = place.y;
    if (typeof rotation !== "number") {
      this.checkLane(rotation, ROTATION_RANGE, where);
      keyframes.rotation = rotation;
    }
    for (const lane of [place.x, place.y]) this.checkLane(lane, MOVING_RANGE, where);
    const x = firstOf(place.x);
    const y = firstOf(place.y);
    const movingX = typeof place.x !== "number" || place.path !== undefined;
    const movingY = typeof place.y !== "number" || place.path !== undefined;
    const stage = !parented && ((!movingX && !within(x, STILL_RANGE)) || (!movingY && !within(y, STILL_RANGE)));
    const still = parented || stage ? MOVING_RANGE : STILL_RANGE;
    const transform: Transform = { x: movingX ? clampTo(x, still) : x, y: movingY ? clampTo(y, still) : y, w: 1, h: 1, rotation: typeof rotation === "number" ? normalizedRotation(rotation) : 0, opacity: 1 };
    return { transform, keyframes, stage };
  }

  private nullClip(node: FrameNode, space: Space, parentId: string | undefined): { clip: Clip; stage: boolean } {
    const [start, end] = this.span(node);
    const { startMs, durationMs } = this.timing(start, end);
    const at = this.keyMs(node.layer, start);
    const placed = this.placementKeys(node, space, at, { x: 0, y: 0 }, parentId !== undefined);
    const scale = this.scaleLanes(node.transform, at, node.name);
    const keyframes = { ...placed.keyframes };
    let w = NULL_BOX;
    let h = NULL_BOX;
    if (typeof scale.x === "number" && typeof scale.y === "number") {
      const sx = clampTo(scale.x, NULL_SCALE_RANGE);
      const sy = clampTo(scale.y, NULL_SCALE_RANGE);
      if (sx !== scale.x || sy !== scale.y) this.ctx.notes.add("scaleClamped");
      w = NULL_BOX * sx;
      h = NULL_BOX * sy;
    } else if (scale.uniform) keyframes.scale = scale.x as Keyframe[];
    else {
      keyframes.scaleX = typeof scale.x === "number" ? [{ atMs: 0, value: clampTo(scale.x, SCALE_RANGE), easing: "linear" }] : scale.x;
      keyframes.scaleY = typeof scale.y === "number" ? [{ atMs: 0, value: clampTo(scale.y, SCALE_RANGE), easing: "linear" }] : scale.y;
    }
    const base = newNullClip(startMs, durationMs, placed.transform.x, placed.transform.y);
    const clip: Clip = {
      ...base,
      id: node.clipId!,
      transform: { ...base.transform, w, h, rotation: placed.transform.rotation },
      name: nameOf(node.group ? node.group.name : node.name),
      ...(Object.keys(keyframes).length > 0 ? { keyframes } : {}),
      ...(parentId ? { parentId } : {}),
      ...(node.layer.ao === 1 && node.group === null && keyframes.position ? { autoOrient: true } : {}),
    };
    return { clip, stage: placed.stage };
  }

  private opacity(factors: readonly Animated<Vec>[], at: (frame: number) => number): { value: number; keys?: Keyframe[] } {
    const moving = factors.filter((factor) => stillVec(factor) === null);
    const stillProduct = factors.filter((factor) => stillVec(factor) !== null).reduce((product, factor) => product * ((stillVec(factor)![0] ?? PERCENT) / PERCENT), 1);
    const unit = (v: number) => clampTo(v, [0, 1]);
    if (moving.length === 0) return { value: unit(stillProduct) };
    if (moving.length === 1) {
      const lane = this.lane(moving[0], 0, (v) => unit((v / PERCENT) * stillProduct), at);
      return typeof lane === "number" ? { value: lane } : { value: lane[0].value, keys: lane };
    }
    const keys: Keyframe[] = [];
    for (const frame of sampleFrames(moving)) {
      const value = unit(factors.reduce((product, factor) => product * ((valueAtFrame(factor, frame)[0] ?? PERCENT) / PERCENT), 1));
      const key: Keyframe = { atMs: at(frame), value, easing: "linear" };
      if (keys.length > 0 && keys[keys.length - 1].atMs >= key.atMs) keys[keys.length - 1] = key;
      else keys.push(key);
    }
    return { value: keys[0].value, keys };
  }

  private colorKeys(color: Animated<Vec>, at: (frame: number) => number): { value: string; keys?: ColorKeyframe[] } {
    const still = stillVec(color);
    if (still || !color.keyed) return { value: hex(still ?? (color.keyed ? color.keys[0].value : color.value)) };
    const keys: ColorKeyframe[] = [];
    for (const key of color.keys) {
      const frame: ColorKeyframe = { atMs: at(key.frame), color: hex(key.value), easing: key.ease[0] };
      if (keys.length > 0 && keys[keys.length - 1].atMs >= frame.atMs) keys[keys.length - 1] = frame;
      else keys.push(frame);
    }
    return { value: keys[0].color, keys };
  }

  private paintLayer(paint: PaintSpec, scale: number, at: (frame: number) => number, keyframes: Keyframes): Partial<Layer> {
    const color = this.colorKeys(paint.color, at);
    if (paint.kind === "fill") {
      if (color.keys) keyframes.fill = color.keys;
      return { fill: color.value, ...(paint.evenOdd ? { fillRule: "evenodd" as const } : {}) };
    }
    if (color.keys) keyframes.stroke = color.keys;
    const factor = this.ctx.k * scale;
    const dash = paint.dash ? { dashArray: paint.dash.pattern.map((value) => clampTo(value * factor, LAYER_RANGES.dashValue)), ...(paint.dash.offset !== 0 ? { dashOffset: clampTo(paint.dash.offset * factor, LAYER_RANGES.dashOffset) } : {}) } : {};
    return {
      stroke: color.value,
      strokeWidth: clampTo(paint.width * factor, LAYER_RANGES.strokeWidth),
      lineCap: CAPS[paint.cap] ?? "round",
      lineJoin: JOINS[paint.join] ?? "round",
      miterLimit: clampTo(paint.miter, LAYER_RANGES.miterLimit),
      ...dash,
    };
  }

  private trimOf(style: StyleSpec, sources: readonly PathSource[], where: string): TrimSpec | null {
    const lists = sources.map((source) => source.trims);
    if (lists.every((list) => list.length === 0)) return null;
    if (style.paint.kind === "fill") {
      this.ctx.gaps.add("trimOnFill", where);
      return null;
    }
    const first = lists[0][0];
    if (lists.some((list) => list.length !== 1 || list[0] !== first)) {
      this.ctx.gaps.add("doubleTrim", where);
      return null;
    }
    return first;
  }

  private trimLanes(trim: TrimSpec, at: (frame: number) => number, keyframes: Keyframes): LineAnimation {
    const start = this.lane(trim.start, 0, (v) => clampTo(v / PERCENT, [0, 1]), at);
    const end = this.lane(trim.end, 0, (v) => clampTo(v / PERCENT, [0, 1]), at);
    const offset = this.lane(trim.offset, 0, (v) => v, at);
    if (typeof start !== "number") keyframes.trimStart = start;
    if (typeof end !== "number") keyframes.trimEnd = end;
    if (typeof offset !== "number") keyframes.trimOffset = offset;
    return { trim: { start: firstOf(start), end: firstOf(end), offset: firstOf(offset), ...(trim.sequential ? { sequential: true } : {}) } };
  }

  private boxOf(shapes: readonly Bezier[][]): Box | null {
    const box = boundsOf(shapes.flat());
    if (!box) return null;
    const grow = (start: number, size: number) => (size >= MIN_EXTENT ? [start, size] : [start - (MIN_EXTENT - size) / 2, MIN_EXTENT]);
    const [x, w] = grow(box.x, box.w);
    const [y, h] = grow(box.y, box.h);
    return { x, y, w, h };
  }

  private masks(layer: LottieLayer, fold: Affine, box: Box, at: (frame: number) => number): Mask[] {
    const result: Mask[] = [];
    const where = whereOf(layer);
    for (const raw of layer.masksProperties ?? []) {
      if (raw.mode === "n") continue;
      const mode = MASK_MODES[raw.mode ?? "a"];
      if (!mode) {
        this.ctx.gaps.add("maskMode", where);
        continue;
      }
      const shape = readBezier(raw.pt, this.ctx.gaps, where);
      const path = (bezier: Bezier) => unitPath([mapBezier(bezier, fold)], box, shape.keyed);
      const keyframes: MaskKeyframes = {};
      let still = "";
      if (shape.keyed) {
        const keys: MorphKeyframe[] = shape.keys.map((key) => ({ atMs: at(key.frame), path: path(key.value), easing: key.ease[0], ...this.pin(mapBezier(key.value, fold), box) }));
        keyframes.path = keys;
        still = keys[0].path;
      } else still = path(shape.value);
      const opacity = this.lane(readValue(raw.o, this.ctx.gaps, where, [PERCENT]), 0, (v) => clampTo(v / PERCENT, [0, 1]), at);
      const unit = Math.min(box.w, box.h) || 1;
      const scale = strokeScale(fold);
      const expansion = this.lane(readValue(raw.x, this.ctx.gaps, where, [0]), 0, (v) => clampTo((v * scale) / unit, MASK_EXPANSION), at);
      if (typeof opacity !== "number") keyframes.opacity = opacity;
      if (typeof expansion !== "number") keyframes.expansion = expansion;
      result.push({
        id: newStudioId("m"),
        shape: "path",
        mode,
        x: 0.5,
        y: 0.5,
        w: 1,
        h: 1,
        rotation: 0,
        path: still,
        feather: 0,
        expansion: firstOf(expansion),
        opacity: firstOf(opacity),
        ...(raw.inv ? { invert: true } : {}),
        ...(Object.keys(keyframes).length > 0 ? { keyframes } : {}),
      });
    }
    return result;
  }

  private pin(shape: Bezier, box: Box): Pick<MorphKeyframe, "firstVertex"> {
    const first = shape.points[0];
    if (!first) return {};
    const tidy = (value: number) => Math.round(value * 1e4) / 1e4 || 0;
    return { firstVertex: { x: tidy((first.x - box.x) / box.w), y: tidy((first.y - box.y) / box.h) } };
  }

  private drawable(style: StyleSpec, sources: readonly PathSource[], scope: FrameNode, provider: FrameNode | null, layerNode: FrameNode, root: Point): { clip: Clip; stage: boolean } | null {
    const layer = layerNode.layer;
    const where = whereOf(layer);
    const fold = this.fold(scope, provider);
    const geometry = combineGeometry(
      sources.map((source) => specGeometry(source.spec)),
      fold,
    );
    const shapes = geometry.keyed ? geometry.keys.map((key) => key.value) : [geometry.value];
    const box = this.boxOf(shapes);
    if (!box) return null;
    const start = Math.max(0, layer.ip);
    const at = this.keyMs(layer, start);
    const keyframes: Keyframes = {};
    let path: string;
    if (geometry.keyed) {
      const keys: MorphKeyframe[] = geometry.keys.map((key) => ({ atMs: at(key.frame), path: unitPath(key.value, box, true), easing: key.ease[0], ...this.pin(key.value[0] ?? { closed: false, points: [], ins: [], outs: [] }, box) }));
      const unique = keys.filter((key, i) => i === keys.length - 1 || key.atMs < keys[i + 1].atMs);
      keyframes.path = unique;
      path = unique[0].path;
    } else path = unitPath(geometry.value, box, false);
    const paint = this.paintLayer(style.paint, strokeScale(fold), at, keyframes);
    const trim = this.trimOf(style, sources, where);
    const line = trim ? this.trimLanes(trim, at, keyframes) : undefined;
    const groups: Animated<Vec>[] = [];
    for (let group = style.group; group; group = group.parent) groups.push(group.transform.opacity);
    const opacity = this.opacity([style.paint.opacity, ...groups, layerNode.transform.opacity], at);
    if (opacity.keys) keyframes.opacity = opacity.keys;
    const insideGroup = provider !== null && provider.layer === layer && provider.group !== null;
    if ((layer.masksProperties?.length ?? 0) > 0 && insideGroup) this.ctx.gaps.add("maskInMovingGroup", where);
    const masks = insideGroup ? [] : this.masks(layer, this.fold(layerNode, provider), box, at);
    const space = this.spaceOf(provider, root);
    const center = this.toLocal(space, { x: box.x + box.w / 2, y: box.y + box.h / 2 });
    const size = this.sizeLocal({ x: box.w, y: box.h });
    if (size.x > BOX_RANGE[1] || size.y > BOX_RANGE[1]) this.ctx.gaps.add("outOfBounds", where);
    const parented = provider !== null;
    if (parented && !(within(center.x, MOVING_RANGE) && within(center.y, MOVING_RANGE))) this.ctx.gaps.add("outOfBounds", where);
    const stage = !parented && !(within(center.x, STILL_RANGE) && within(center.y, STILL_RANGE));
    if (stage && !(within(center.x, MOVING_RANGE) && within(center.y, MOVING_RANGE))) this.ctx.gaps.add("outOfBounds", where);
    const blend = LOTTIE_BLENDS[layer.bm ?? 0];
    const shapeLayer: Layer = { id: newStudioId("l"), type: "shape", shape: "path", path, transform: fullFrame(), ...paint, ...(blend && blend !== "normal" ? { blendMode: blend } : {}) };
    const { startMs, durationMs } = this.timing(start, layer.op);
    const transform: Transform = { x: center.x, y: center.y, w: clampTo(size.x, BOX_RANGE), h: clampTo(size.y, BOX_RANGE), rotation: 0, opacity: opacity.value };
    const clip: Clip = {
      ...newOverlayClip(shapeLayer, startMs, durationMs, transform),
      name: nameOf(where),
      ...(Object.keys(keyframes).length > 0 ? { keyframes } : {}),
      ...(line ? { line } : {}),
      ...(masks.length > 0 ? { masks } : {}),
      ...(provider ? { parentId: provider.clipId } : {}),
    };
    return { clip, stage };
  }

  private precompClip(node: FrameNode, space: Space, parentId: string | undefined): { clip: GroupClip; stage: boolean } | null {
    const layer = node.layer;
    const where = whereOf(layer);
    const asset = layer.refId ? this.ctx.assets.get(layer.refId) : undefined;
    if (!asset || !Array.isArray(asset.layers)) {
      this.ctx.gaps.add("missingAsset", where);
      return null;
    }
    if (this.ctx.visiting.has(asset.id)) {
      this.ctx.gaps.add("invalid", where);
      return null;
    }
    this.ctx.visiting.add(asset.id);
    const inner = this.comp(asset.layers, { x: 0, y: 0 });
    this.ctx.visiting.delete(asset.id);
    const st = layer.st ?? 0;
    const start = Math.max(0, layer.ip, st);
    const innerEnd = st + (inner.endMs * this.ctx.fr) / 1000;
    const end = Math.min(layer.op, innerEnd);
    if (end <= start || inner.clips.length === 0) return null;
    const anchorPx = stillVec(node.transform.anchor) ?? [0, 0];
    const anchor = { x: (this.ctx.k * (anchorPx[0] ?? 0)) / this.ctx.width, y: (this.ctx.k * (anchorPx[1] ?? 0)) / this.ctx.height };
    if (!within(anchor.x, MOVING_RANGE) || !within(anchor.y, MOVING_RANGE)) this.ctx.gaps.add("outOfBounds", where);
    const at = this.keyMs(layer, start);
    const placed = this.placementKeys(node, space, at, { x: anchor.x - 0.5, y: anchor.y - 0.5 }, parentId !== undefined);
    const keyframes = { ...placed.keyframes };
    const scale = this.scaleLanes(node.transform, at, where);
    const one = (value: number): Keyframe[] => [{ atMs: 0, value: clampTo(value, SCALE_RANGE), easing: "linear" }];
    if (scale.uniform) {
      if (typeof scale.x !== "number") keyframes.scale = scale.x;
      else if (scale.x !== 1) keyframes.scale = one(scale.x);
    } else {
      keyframes.scaleX = typeof scale.x === "number" ? one(scale.x) : scale.x;
      keyframes.scaleY = typeof scale.y === "number" ? one(scale.y) : scale.y;
    }
    const opacity = this.opacity([node.transform.opacity], at);
    if (opacity.keys) keyframes.opacity = opacity.keys;
    const masks = this.masks(layer, IDENTITY, { x: 0, y: 0, w: this.ctx.width / this.ctx.k, h: this.ctx.height / this.ctx.k }, at);
    const blend = LOTTIE_BLENDS[layer.bm ?? 0];
    const { startMs, durationMs } = this.timing(start, end);
    const clip: GroupClip = {
      id: node.clipId!,
      type: "group",
      startMs,
      durationMs,
      trimInMs: round(msOf(this.ctx, start - st)),
      volume: 1,
      fadeInMs: 0,
      fadeOutMs: 0,
      transform: { ...placed.transform, opacity: opacity.value },
      tracks: inner.clips.map(trackOf),
      name: nameOf(where),
      ...(anchor.x !== 0.5 || anchor.y !== 0.5 ? { anchor } : {}),
      ...(Object.keys(keyframes).length > 0 ? { keyframes } : {}),
      ...(masks.length > 0 ? { masks } : {}),
      ...(blend && blend !== "normal" ? { blendMode: blend } : {}),
      ...(parentId ? { parentId } : {}),
      ...(layer.ao === 1 && keyframes.position ? { autoOrient: true } : {}),
    };
    return { clip, stage: placed.stage };
  }

  private scopeOf(source: PathSource, layerNode: FrameNode, groupNodes: ReadonlyMap<ShapeGroup, FrameNode>): FrameNode {
    return source.group ? groupNodes.get(source.group)! : layerNode;
  }

  comp(layers: readonly LottieLayer[], root: Point): Built {
    const live = layers.filter((layer) => layer && typeof layer === "object" && this.layerFlags(layer));
    const { layerNodes, groupNodes, styles } = this.nodes(live);
    const all = [...layerNodes.values(), ...groupNodes.values()];
    const provides = this.providers(all);
    for (const node of all) if (provides(node)) node.clipId = newStudioId("c");
    const nulls: Clip[] = [];
    const visuals: Clip[] = [];
    const staged: Clip[] = [];
    const stageId = newStudioId("c");
    const keep = (made: { clip: Clip; stage: boolean } | null, into: Clip[]) => {
      if (!made) return;
      const clip = made.stage ? { ...made.clip, parentId: stageId } : made.clip;
      if (made.stage) staged.push(clip);
      into.push(clip);
    };
    for (const node of all) {
      if (!provides(node) || node.precomp) continue;
      const parent = this.frameParent(node.parent, provides);
      keep(this.nullClip(node, this.spaceOf(parent, root), parent?.clipId), nulls);
    }
    for (const layer of [...live].reverse()) {
      const layerNode = layerNodes.get(layer)!;
      if (layer.hd === true) continue;
      const parent = this.frameParent(layerNode.parent, provides);
      if (layer.ty === LAYER_PRECOMP) {
        keep(this.precompClip(layerNode, this.spaceOf(parent, root), parent?.clipId), visuals);
        continue;
      }
      const layerStyles = layer.ty === LAYER_SOLID ? solidStyles(layer) : (styles.get(layer) ?? []);
      for (const style of [...layerStyles].reverse()) {
        const byProvider = new Map<FrameNode | null, { scope: FrameNode; sources: PathSource[] }[]>();
        for (const source of style.sources) {
          const scope = this.scopeOf(source, layerNode, groupNodes);
          const provider = this.frameParent(scope, provides);
          const list = byProvider.get(provider) ?? [];
          const sameScope = list.find((entry) => entry.scope === scope);
          if (sameScope) sameScope.sources.push(source);
          else list.push({ scope, sources: [source] });
          byProvider.set(provider, list);
        }
        for (const [provider, entries] of byProvider) {
          for (const entry of entries) keep(this.drawable(style, entry.sources, entry.scope, provider, layerNode, root), visuals);
        }
      }
    }
    const content = [...nulls, ...visuals];
    const endMs = content.reduce((end, clip) => Math.max(end, clip.startMs + clip.durationMs), 0);
    const stage = staged.length > 0 ? [{ ...newNullClip(0, Math.max(STUDIO_LIMITS.minClipMs, endMs), 0.5, 0.5), id: stageId }] : [];
    return { clips: [...stage, ...content], endMs: Math.max(endMs, stage[0] ? stage[0].durationMs : 0) };
  }
}

function solidStyles(layer: LottieLayer): StyleSpec[] {
  const width = Number(layer.sw ?? 0);
  const height = Number(layer.sh ?? 0);
  const color = /^#[0-9a-f]{6}$/i.test(layer.sc ?? "") ? layer.sc! : "#000000";
  const rgb = [1, 3, 5].map((at) => parseInt(color.slice(at, at + 2), 16) / 255);
  const still = (value: Vec): Animated<Vec> => ({ keyed: false, value });
  return [
    {
      paint: { kind: "fill", color: still(rgb), opacity: still([PERCENT]), evenOdd: false },
      group: null,
      sources: [{ spec: { kind: "rect", position: still([width / 2, height / 2]), size: still([width, height]), roundness: still([0]), reversed: false }, group: null, trims: [] }],
    },
  ];
}

function trackOf(clip: Clip): Track {
  return { id: newStudioId("t"), kind: "visual", clips: [clip] };
}

export function convertLottie(animation: LottieAnimation, options: LottieConvertOptions): LottieConversion {
  const k = Math.min(options.canvas.width / animation.w, options.canvas.height / animation.h);
  const gaps = new LottieGaps();
  const ctx: Context = {
    fr: animation.fr,
    k,
    width: options.canvas.width,
    height: options.canvas.height,
    gaps,
    notes: new Set(),
    assets: new Map((animation.assets ?? []).filter((asset) => asset && typeof asset.id === "string").map((asset) => [asset.id, asset])),
    visiting: new Set(),
  };
  const where = (animation.nm ?? "").trim() || options.name;
  if (animation.ddd === 1) gaps.add("threeD", where);
  if (msOf(ctx, animation.op - animation.ip) > STUDIO_LIMITS.maxVideoMs) gaps.add("tooLong", where);
  const offset = { x: (options.canvas.width - k * animation.w) / 2 / options.canvas.width, y: (options.canvas.height - k * animation.h) / 2 / options.canvas.height };
  const built = new Converter(ctx).comp(animation.layers, offset);
  const visible = built.clips.some((clip) => clip.type !== "null");
  if (!visible) gaps.add("empty", where);
  if (!gaps.empty) return { ok: false, gaps: gaps.list };
  const trimInMs = Math.round(msOf(ctx, Math.max(0, animation.ip)));
  const durationMs = Math.min(Math.round(msOf(ctx, animation.op)), built.endMs) - trimInMs;
  if (durationMs < STUDIO_LIMITS.minClipMs) return { ok: false, gaps: [{ code: "empty", where }] };
  const clip: GroupClip = {
    id: newStudioId("c"),
    type: "group",
    startMs: Math.round(options.atMs),
    durationMs,
    trimInMs,
    volume: 1,
    fadeInMs: 0,
    fadeOutMs: 0,
    transform: fullFrame(),
    tracks: built.clips.map(trackOf),
    name: nameOf(options.name.trim() || where),
  };
  return { ok: true, clip, notes: [...ctx.notes] };
}

