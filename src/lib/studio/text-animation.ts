import type { Clip, Layer, TextAlign } from "./document";
import type { ClipPatch } from "./timeline";
import { ease, isEasing, type Easing } from "./keyframes";
import type { IssueCode } from "./validate";
import { animatorFrameAt, offsetLook, selectorAmounts, type AnimatorFrame, type AnimatorProperties, type OffsetLook } from "./text-selectors";
import { turned3d } from "./perspective";

export const TEXT_UNITS = ["char", "word", "line"] as const;
export type TextUnit = (typeof TEXT_UNITS)[number];

export const TEXT_STYLES = ["fade", "rise", "slide", "pop", "blur", "typewriter"] as const;
export type TextStyle = (typeof TEXT_STYLES)[number];

export interface TextAnimator {
  unit: TextUnit;
  style: TextStyle;
  durationMs: number;
  staggerMs: number;
  easing: Easing;
}

export const TEXT_ANIMATION_LIMITS = { durationMs: [0, 3000], staggerMs: [0, 2000] } as const;

const RISE_SHARE = 0.6;
const SLIDE_SHARE = 0.5;
const POP_FROM = 0.4;
const POP_FADE_SHARE = 3;
const BLUR_FROM_PX = 16;
const CURVE_EPSILON = 1e-3;

const TIMING: Record<TextUnit, { durationMs: number; staggerMs: number }> = {
  char: { durationMs: 300, staggerMs: 35 },
  word: { durationMs: 400, staggerMs: 90 },
  line: { durationMs: 500, staggerMs: 180 },
};

const TYPING_MS = 55;

const STYLE_EASING: Record<TextStyle, Easing> = {
  fade: "easeOut",
  rise: "cubic-bezier(0.05,0.7,0.1,1)",
  slide: "cubic-bezier(0.05,0.7,0.1,1)",
  pop: "backOut",
  blur: "easeOut",
  typewriter: "linear",
};

export function defaultTextAnimator(unit: TextUnit, style: TextStyle): TextAnimator {
  if (style === "typewriter") return { unit, style, durationMs: TYPING_MS, staggerMs: TYPING_MS, easing: STYLE_EASING.typewriter };
  return { unit, style, ...TIMING[unit], easing: STYLE_EASING[style] };
}

export function defaultUnitFor(style: TextStyle): TextUnit {
  return style === "typewriter" ? "char" : "word";
}

export function restyledAnimator(current: TextAnimator | undefined, style: TextStyle): TextAnimator {
  return defaultTextAnimator(current?.unit ?? defaultUnitFor(style), style);
}

export function reunitedAnimator(current: TextAnimator, unit: TextUnit): TextAnimator {
  return { ...defaultTextAnimator(unit, current.style), easing: current.easing };
}

export interface LaidChar {
  char: string;
  left: number;
  right: number;
}

export interface LaidLine {
  top: number;
  height: number;
  chars: LaidChar[];
}

export interface Tile {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Run {
  line: number;
  left: number;
  right: number;
}

function blank(char: string): boolean {
  return /\s/.test(char);
}

function runs(lines: readonly LaidLine[], unit: TextUnit): Run[] {
  return lines.flatMap((line, index): Run[] => {
    const visible = line.chars.filter((c) => !blank(c.char));
    if (visible.length === 0) return [];
    if (unit === "line") return [{ line: index, left: visible[0].left, right: visible[visible.length - 1].right }];
    if (unit === "char") return visible.map((c) => ({ line: index, left: c.left, right: c.right }));
    const words: Run[] = [];
    line.chars.forEach((c, i) => {
      if (blank(c.char)) return;
      if (i > 0 && !blank(line.chars[i - 1].char)) words[words.length - 1].right = c.right;
      else words.push({ line: index, left: c.left, right: c.right });
    });
    return words;
  });
}

export function textUnitCount(lines: readonly LaidLine[], unit: TextUnit): number {
  return runs(lines, unit).length;
}

function rowEdges(lines: readonly LaidLine[], filled: ReadonlySet<number>, height: number): Map<number, { top: number; bottom: number }> {
  const rows = lines.map((line, index) => ({ line, index })).filter((row) => filled.has(row.index));
  const tops = rows.map((row, i) => (i === 0 ? 0 : (rows[i - 1].line.top + rows[i - 1].line.height + row.line.top) / 2));
  return new Map(rows.map((row, i) => [row.index, { top: tops[i], bottom: i === rows.length - 1 ? height : tops[i + 1] }]));
}

export function textUnitTiles(lines: readonly LaidLine[], unit: TextUnit, width: number, height: number): Tile[] {
  const all = runs(lines, unit);
  const edges = rowEdges(lines, new Set(all.map((run) => run.line)), height);
  return all.map((run, i) => {
    const before = all[i - 1]?.line === run.line ? all[i - 1] : undefined;
    const after = all[i + 1]?.line === run.line ? all[i + 1] : undefined;
    const x = before ? (before.right + run.left) / 2 : 0;
    const right = after ? (run.right + after.left) / 2 : width;
    const row = edges.get(run.line)!;
    return { x, y: row.top, width: right - x, height: row.bottom - row.top };
  });
}

export interface UnitLook {
  dx: number;
  dy: number;
  scale: number;
  rotation: number;
  rotationX: number;
  rotationY: number;
  depth: number;
  opacity: number;
  blurPx: number;
  tints?: readonly number[];
}

export const SETTLED_LOOK: UnitLook = { dx: 0, dy: 0, scale: 1, rotation: 0, rotationX: 0, rotationY: 0, depth: 0, opacity: 1, blurPx: 0 };

const PERCENT = 100;

export function styleOffsets(style: TextStyle, size: { width: number; height: number }): AnimatorProperties {
  switch (style) {
    case "fade":
    case "typewriter":
      return { opacity: 0 };
    case "rise":
      return { opacity: 0, y: RISE_SHARE * size.height };
    case "slide":
      return { opacity: 0, x: -SLIDE_SHARE * size.width };
    case "pop":
      return { scale: POP_FROM * PERCENT };
    case "blur":
      return { opacity: 0, blur: BLUR_FROM_PX };
  }
}

function unitLookOf(look: OffsetLook): UnitLook {
  return { dx: look.dx, dy: look.dy, scale: look.scale, rotation: look.rotation, rotationX: look.rotationX, rotationY: look.rotationY, depth: 0, opacity: look.opacity, blurPx: look.blurPx };
}

function styled(style: TextStyle, p: number, size: { width: number; height: number }): UnitLook {
  const remaining = style === "typewriter" ? (p > 0 ? 0 : 1) : 1 - p;
  const look = unitLookOf(offsetLook(styleOffsets(style, size), () => remaining));
  return style === "pop" ? { ...look, opacity: Math.min(1, Math.min(1, Math.max(0, p)) * POP_FADE_SHARE) } : look;
}

export function playsOverTime(style: TextStyle): boolean {
  return style !== "typewriter";
}

function sideProgress(animator: TextAnimator, startMs: number, localMs: number): number {
  if (!playsOverTime(animator.style) || animator.durationMs <= 0) return localMs >= startMs ? 1 : 0;
  const t = Math.min(1, Math.max(0, (localMs - startMs) / animator.durationMs));
  return ease(animator.easing, t);
}

export function textUnitLook(motion: { in?: TextAnimator; out?: TextAnimator }, index: number, count: number, localMs: number, clipDurationMs: number, size: { width: number; height: number }): UnitLook {
  let look = SETTLED_LOOK;
  if (motion.in) look = styled(motion.in.style, sideProgress(motion.in, index * motion.in.staggerMs, localMs), size);
  if (motion.out) {
    const start = clipDurationMs - span(motion.out, count) + index * motion.out.staggerMs;
    const leaving = styled(motion.out.style, 1 - sideProgress(motion.out, start, localMs), size);
    look = { dx: look.dx + leaving.dx, dy: look.dy + leaving.dy, scale: look.scale * leaving.scale, rotation: look.rotation + leaving.rotation, rotationX: look.rotationX + leaving.rotationX, rotationY: look.rotationY + leaving.rotationY, depth: look.depth + leaving.depth, opacity: look.opacity * leaving.opacity, blurPx: look.blurPx + leaving.blurPx };
  }
  return look;
}

function within(value: number, [low, high]: readonly [number, number]): boolean {
  return Number.isFinite(value) && value >= low && value <= high;
}

export interface TextAnimatorFault {
  field: keyof TextAnimator;
  code: IssueCode;
}

function timingFault(animator: TextAnimator, field: "durationMs" | "staggerMs"): TextAnimatorFault | null {
  if (!Number.isInteger(animator[field])) return { field, code: "invalid" };
  return within(animator[field], TEXT_ANIMATION_LIMITS[field]) ? null : { field, code: "out_of_range" };
}

export function textAnimatorFault(animator: TextAnimator): TextAnimatorFault | null {
  if (!(TEXT_UNITS as readonly string[]).includes(animator.unit)) return { field: "unit", code: "unknown" };
  if (!(TEXT_STYLES as readonly string[]).includes(animator.style)) return { field: "style", code: "unknown" };
  if (!isEasing(animator.easing)) return { field: "easing", code: "unknown" };
  return timingFault(animator, "durationMs") ?? timingFault(animator, "staggerMs");
}

export function animatesText(clip: Pick<Clip, "type" | "layer">): boolean {
  return clip.type === "overlay" && clip.layer?.type === "text";
}

export function flowsInLines(layer: Layer): boolean {
  return Math.abs(layer.curve ?? 0) < CURVE_EPSILON;
}

export function textAnimationPatch(side: "in" | "out", animator: TextAnimator | null): ClipPatch {
  return side === "in" ? { textIn: animator ?? undefined } : { textOut: animator ?? undefined };
}

export function textAnimationIssue(clip: Clip): IssueCode | null {
  const animators = [clip.textIn, clip.textOut].filter((animator): animator is TextAnimator => animator !== undefined);
  if (animators.length === 0) return null;
  if (!animatesText(clip)) return "invalid";
  for (const animator of animators) {
    const fault = textAnimatorFault(animator);
    if (fault) return fault.code;
  }
  return null;
}

export interface TextMotion {
  in?: TextAnimator;
  out?: TextAnimator;
  animators?: readonly AnimatorFrame[];
  localMs: number;
  durationMs: number;
}

export interface UnitFrame {
  tile: Tile;
  look: UnitLook;
}

export function textMotionOf(clip: Clip, localMs: number): TextMotion | undefined {
  const animators = clip.textAnimators ?? [];
  if (!clip.textIn && !clip.textOut && animators.length === 0) return undefined;
  return {
    ...(clip.textIn ? { in: clip.textIn } : {}),
    ...(clip.textOut ? { out: clip.textOut } : {}),
    ...(animators.length > 0 ? { animators: animators.map((animator) => animatorFrameAt(animator, localMs)) } : {}),
    localMs,
    durationMs: clip.durationMs,
  };
}

export function span(animator: TextAnimator, count: number): number {
  return Math.max(0, count - 1) * animator.staggerMs + animator.durationMs;
}

type Sides = { unit: TextUnit; in?: TextAnimator; out?: TextAnimator };

function playingSides(motion: TextMotion, lines: readonly LaidLine[]): Sides | null {
  const { in: enter, out: leave } = motion;
  if (!enter) return leave ? { unit: leave.unit, out: leave } : null;
  if (!leave || leave.unit === enter.unit) return { unit: enter.unit, in: enter, out: leave };
  const leaving = motion.localMs >= motion.durationMs - span(leave, textUnitCount(lines, leave.unit));
  return leaving ? { unit: leave.unit, out: leave } : { unit: enter.unit, in: enter };
}

const UNIT_FINENESS: readonly TextUnit[] = ["char", "word", "line"];
const ALIGN_SHARE: Record<TextAlign, number> = { left: 0, center: 0.5, right: 1 };
const RADIANS = Math.PI / 180;

interface Grouped {
  tiles: Tile[];
  anchors: { x: number; y: number }[];
  of: number[];
}

function centerOf(tile: Tile): { x: number; y: number } {
  return { x: tile.x + tile.width / 2, y: tile.y + tile.height / 2 };
}

function nearestTile(tiles: readonly Tile[], point: { x: number; y: number }): number {
  let best = 0;
  let distance = Infinity;
  tiles.forEach((tile, index) => {
    const center = centerOf(tile);
    const d = Math.hypot(center.x - point.x, center.y - point.y);
    if (d < distance) {
      distance = d;
      best = index;
    }
  });
  return best;
}

function groupedBy(lines: readonly LaidLine[], unit: TextUnit, width: number, height: number, fine: readonly Tile[]): Grouped {
  const tiles = textUnitTiles(lines, unit, width, height);
  if (tiles.length === 0) return { tiles: [{ x: 0, y: 0, width, height }], anchors: [{ x: width / 2, y: height / 2 }], of: fine.map(() => 0) };
  const anchors = runs(lines, unit).map((run) => ({ x: (run.left + run.right) / 2, y: lines[run.line].top + lines[run.line].height / 2 }));
  const of = fine.map((tile) => {
    const c = centerOf(tile);
    const found = tiles.findIndex((t) => c.y >= t.y && c.y < t.y + t.height && c.x >= t.x && c.x < t.x + t.width);
    return found >= 0 ? found : nearestTile(tiles, c);
  });
  return { tiles, anchors, of };
}

function trackingShifts(grouped: Grouped, steps: readonly number[], align: TextAlign): number[] {
  const before = new Array<number>(grouped.tiles.length).fill(0);
  const totals = new Map<number, number>();
  grouped.tiles.forEach((tile, index) => {
    const sameRow = index > 0 && grouped.tiles[index - 1].y === tile.y;
    before[index] = sameRow ? before[index - 1] + steps[index - 1] : 0;
    totals.set(tile.y, before[index]);
  });
  return grouped.of.map((index) => before[index] - ALIGN_SHARE[align] * (totals.get(grouped.tiles[index].y) ?? 0));
}

function turned(x: number, y: number, turn: { scale: number; rotation: number }): { x: number; y: number } {
  const cos = Math.cos(turn.rotation * RADIANS);
  const sin = Math.sin(turn.rotation * RADIANS);
  return { x: turn.scale * (x * cos - y * sin), y: turn.scale * (x * sin + y * cos) };
}

export function textUnitFrames(motion: TextMotion, lines: readonly LaidLine[], width: number, height: number, align: TextAlign = "left"): UnitFrame[] {
  const sides = playingSides(motion, lines);
  const animators = motion.animators ?? [];
  const units = [...(sides ? [sides.unit] : []), ...animators.map((animator) => animator.unit)];
  const finest = UNIT_FINENESS.find((unit) => units.includes(unit)) ?? "line";
  const fineTiles = textUnitTiles(lines, finest, width, height);
  const fine = fineTiles.length > 0 ? fineTiles : [{ x: 0, y: 0, width, height }];
  const groups = new Map<TextUnit, Grouped>();
  const grouped = (unit: TextUnit): Grouped => {
    const known = groups.get(unit);
    if (known) return known;
    const made = groupedBy(lines, unit, width, height, fine);
    groups.set(unit, made);
    return made;
  };
  const sideLooks = sides ? grouped(sides.unit).tiles.map((tile, index, tiles) => textUnitLook(sides, index, tiles.length, motion.localMs, motion.durationMs, tile)) : [];
  const animatorLooks = animators.map((animator) => {
    const tiles = grouped(animator.unit).tiles;
    const amounts = selectorAmounts(animator.selector, tiles.length);
    return tiles.map((_, index) => offsetLook(animator.properties, (channel) => amounts(channel, index)));
  });
  const shifts = fine.map(() => 0);
  animators.forEach((animator, k) => {
    if (animator.properties.tracking === undefined) return;
    trackingShifts(grouped(animator.unit), animatorLooks[k].map((look) => look.tracking), align).forEach((shift, f) => (shifts[f] += shift));
  });
  return fine.map((tile, f) => {
    const center = centerOf(tile);
    const turns = new Map<TextUnit, { scale: number; rotation: number; rotationX: number; rotationY: number }>();
    const look: UnitLook = { ...SETTLED_LOOK, dx: shifts[f] };
    const apply = (unit: TextUnit, part: UnitLook) => {
      look.dx += part.dx;
      look.dy += part.dy;
      look.scale *= part.scale;
      look.rotation += part.rotation;
      look.rotationX += part.rotationX;
      look.rotationY += part.rotationY;
      look.opacity *= part.opacity;
      look.blurPx += part.blurPx;
      const turn = turns.get(unit) ?? { scale: 1, rotation: 0, rotationX: 0, rotationY: 0 };
      turns.set(unit, { scale: turn.scale * part.scale, rotation: turn.rotation + part.rotation, rotationX: turn.rotationX + part.rotationX, rotationY: turn.rotationY + part.rotationY });
    };
    if (sides) apply(sides.unit, sideLooks[grouped(sides.unit).of[f]]);
    const tints = animators.map((animator, k) => {
      const part = animatorLooks[k][grouped(animator.unit).of[f]];
      apply(animator.unit, unitLookOf(part));
      return part.tint;
    });
    for (const [unit, turn] of turns) {
      const group = grouped(unit);
      const anchor = group.anchors[group.of[f]];
      const flat = turned(center.x - anchor.x, center.y - anchor.y, turn);
      const moved = turned3d({ x: turn.rotationX, y: turn.rotationY }, { ...flat, z: 0 });
      look.dx += moved.x - (center.x - anchor.x);
      look.dy += moved.y - (center.y - anchor.y);
      look.depth += moved.z;
    }
    return { tile, look: tints.some((tint) => tint > 0) ? { ...look, tints } : look };
  });
}

export function textMotionSettled(frames: readonly UnitFrame[]): boolean {
  return frames.every(({ look }) => look.opacity === 1 && look.dx === 0 && look.dy === 0 && look.scale === 1 && look.rotation === 0 && look.rotationX === 0 && look.rotationY === 0 && look.depth === 0 && look.blurPx === 0 && !look.tints);
}
