import { boxBounds } from "../arrange";
import type { CanvasSize, Transform } from "../document";
import type { LookRegion } from "./frames";
import type { MarkTarget } from "./marks";

export const LOOK_VIEWS = ["render", "wireframe", "guides", "depth"] as const;
export type LookView = (typeof LOOK_VIEWS)[number];
export const VIEW_RULE = "view vai em render, wireframe, guides ou depth";

const ALIGN_TOLERANCE = 0.003;
const UPRIGHT_DEGREES = 0.5;
const SAME_ANGLE = 1;
const NEAR_ANGLE = 3;
const FOCUS_MARGIN = 0.25;
const MIN_FOCUS = 0.08;

type GuideAxis = "x" | "y";

interface GuideLine {
  axis: GuideAxis;
  at: number;
  ids: string[];
}

export interface AngleGroup {
  degrees: number;
  ids: string[];
}

interface GuideReport {
  lines: GuideLine[];
  angles: AngleGroup[];
  notes: string[];
}

export function lookViewOf(value: string | undefined): LookView | null {
  if (value === undefined) return "render";
  return (LOOK_VIEWS as readonly string[]).includes(value) ? (value as LookView) : null;
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function signedDegrees(rotation: number): number {
  return ((((rotation + 180) % 360) + 360) % 360) - 180;
}

export function isUpright(transform: Transform): boolean {
  const turn = Math.abs(signedDegrees(transform.rotation)) % 90;
  return Math.min(turn, 90 - turn) < UPRIGHT_DEGREES;
}

function unitBounds(transform: Transform, canvas: CanvasSize) {
  const b = boxBounds(transform, canvas);
  return { left: b.left / canvas.width, right: b.right / canvas.width, top: b.top / canvas.height, bottom: b.bottom / canvas.height };
}

function clusters<T extends { value: number; id: string }>(items: readonly T[], tolerance: number): T[][] {
  const sorted = [...items].sort((a, b) => a.value - b.value);
  const groups: T[][] = [];
  for (const item of sorted) {
    const last = groups[groups.length - 1];
    if (last && item.value - last[0].value <= tolerance) last.push(item);
    else groups.push([item]);
  }
  return groups;
}

function idsOf(group: readonly { id: string }[]): string[] {
  return [...new Set(group.map((item) => item.id))].sort();
}

function mean(group: readonly { value: number }[]): number {
  return group.reduce((sum, item) => sum + item.value, 0) / group.length;
}

function axisLines(targets: readonly MarkTarget[], canvas: CanvasSize, axis: GuideAxis): GuideLine[] {
  const edges = targets.flatMap((target) => {
    const b = unitBounds(target.transform, canvas);
    const [start, end] = axis === "x" ? [b.left, b.right] : [b.top, b.bottom];
    return [start, (start + end) / 2, end].map((value) => ({ value, id: target.id }));
  });
  return clusters(edges, ALIGN_TOLERANCE)
    .map((group) => ({ axis, at: round(mean(group), 3), ids: idsOf(group) }))
    .filter((line) => line.ids.length >= 2);
}

export function nearParallel(angles: readonly AngleGroup[]): [AngleGroup, AngleGroup][] {
  return angles.flatMap((group, index) =>
    angles.slice(index + 1).flatMap((other): [AngleGroup, AngleGroup][] => {
      const apart = Math.abs(other.degrees - group.degrees);
      return apart > SAME_ANGLE && apart < NEAR_ANGLE ? [[group, other]] : [];
    }),
  );
}

function angleNotes(angles: readonly AngleGroup[]): string[] {
  return nearParallel(angles).map(([group, other]) => `${group.ids.join(", ")} a ${group.degrees}° e ${other.ids.join(", ")} a ${other.degrees}° ficam quase paralelas; iguale o ângulo ou afaste de propósito`);
}

export function guideReport(targets: readonly MarkTarget[], canvas: CanvasSize): GuideReport {
  const upright = targets.filter((target) => isUpright(target.transform));
  const tilted = targets.filter((target) => !isUpright(target.transform)).map((target) => ({ value: signedDegrees(target.transform.rotation), id: target.id }));
  const angles = clusters(tilted, SAME_ANGLE).map((group) => ({ degrees: round(mean(group), 1), ids: idsOf(group) }));
  return { lines: [...axisLines(upright, canvas, "x"), ...axisLines(upright, canvas, "y")], angles, notes: angleNotes(angles) };
}

function span(size: number): number {
  return Math.min(1, Math.max(MIN_FOCUS, size * (1 + 2 * FOCUS_MARGIN)));
}

export function focusRegion(transform: Transform, canvas: CanvasSize): LookRegion {
  const b = unitBounds(transform, canvas);
  const w = round(span(b.right - b.left), 4);
  const h = round(span(b.bottom - b.top), 4);
  const center = (low: number, high: number, size: number) => round(Math.min(Math.max((low + high) / 2, size / 2), 1 - size / 2), 4);
  return { x: center(b.left, b.right, w), y: center(b.top, b.bottom, h), w, h };
}
