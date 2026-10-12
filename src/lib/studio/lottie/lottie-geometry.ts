export interface Point {
  x: number;
  y: number;
}

export interface Bezier {
  closed: boolean;
  points: Point[];
  ins: Point[];
  outs: Point[];
}

export type Affine = readonly [number, number, number, number, number, number];

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];

const ROUND_CORNER = 0.5519;
const PLACES = 1e4;

export function apply(m: Affine, p: Point): Point {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}

export function compose(outer: Affine, inner: Affine): Affine {
  return [
    outer[0] * inner[0] + outer[2] * inner[1],
    outer[1] * inner[0] + outer[3] * inner[1],
    outer[0] * inner[2] + outer[2] * inner[3],
    outer[1] * inner[2] + outer[3] * inner[3],
    outer[0] * inner[4] + outer[2] * inner[5] + outer[4],
    outer[1] * inner[4] + outer[3] * inner[5] + outer[5],
  ];
}

export function placementAffine(anchor: Point, position: Point, scale: Point, degrees: number): Affine {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const a = cos * scale.x;
  const b = sin * scale.x;
  const c = -sin * scale.y;
  const d = cos * scale.y;
  return [a, b, c, d, position.x - (a * anchor.x + c * anchor.y), position.y - (b * anchor.x + d * anchor.y)];
}

export function isIdentity(m: Affine): boolean {
  return m.every((value, i) => Math.abs(value - IDENTITY[i]) < 1e-12);
}

export function strokeScale(m: Affine): number {
  return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
}

export function mapBezier(bezier: Bezier, m: Affine): Bezier {
  return { closed: bezier.closed, points: bezier.points.map((p) => apply(m, p)), ins: bezier.ins.map((p) => apply(m, p)), outs: bezier.outs.map((p) => apply(m, p)) };
}

export function reversed(bezier: Bezier): Bezier {
  const n = bezier.points.length;
  const order = n === 0 ? [] : [0, ...Array.from({ length: n - 1 }, (_, i) => n - 1 - i)];
  return { closed: bezier.closed, points: order.map((i) => bezier.points[i]), ins: order.map((i) => bezier.outs[i]), outs: order.map((i) => bezier.ins[i]) };
}

function triple(points: Point[], ins: Point[], outs: Point[], v: Point, o: Point, i: Point): void {
  points.push(v);
  outs.push(o);
  ins.push(i);
}

export function rectBezier(center: Point, size: Point, roundness: number, reverse: boolean): Bezier {
  const hw = size.x / 2;
  const hh = size.y / 2;
  const round = Math.max(0, Math.min(hw, hh, roundness));
  const c = round * (1 - ROUND_CORNER);
  const [l, r, t, b] = [center.x - hw, center.x + hw, center.y - hh, center.y + hh];
  const points: Point[] = [];
  const ins: Point[] = [];
  const outs: Point[] = [];
  triple(points, ins, outs, { x: r, y: t + round }, { x: r, y: t + round }, { x: r, y: t + c });
  triple(points, ins, outs, { x: r, y: b - round }, { x: r, y: b - c }, { x: r, y: b - round });
  if (round > 0) {
    triple(points, ins, outs, { x: r - round, y: b }, { x: r - round, y: b }, { x: r - c, y: b });
    triple(points, ins, outs, { x: l + round, y: b }, { x: l + c, y: b }, { x: l + round, y: b });
    triple(points, ins, outs, { x: l, y: b - round }, { x: l, y: b - round }, { x: l, y: b - c });
    triple(points, ins, outs, { x: l, y: t + round }, { x: l, y: t + c }, { x: l, y: t + round });
    triple(points, ins, outs, { x: l + round, y: t }, { x: l + round, y: t }, { x: l + c, y: t });
    triple(points, ins, outs, { x: r - round, y: t }, { x: r - c, y: t }, { x: r - round, y: t });
  } else {
    triple(points, ins, outs, { x: l, y: b }, { x: l, y: b }, { x: l, y: b });
    triple(points, ins, outs, { x: l, y: t }, { x: l, y: t }, { x: l, y: t });
  }
  const rect = { closed: true, points, ins, outs };
  return reverse ? reversed(rect) : rect;
}

export function ellipseBezier(center: Point, size: Point, reverse: boolean): Bezier {
  const sx = size.x / 2;
  const sy = size.y / 2;
  const k = ROUND_CORNER;
  const { x, y } = center;
  const dir = reverse ? -1 : 1;
  return {
    closed: true,
    points: [{ x, y: y - sy }, { x: x + dir * sx, y }, { x, y: y + sy }, { x: x - dir * sx, y }],
    ins: [{ x: x - dir * sx * k, y: y - sy }, { x: x + dir * sx, y: y - sy * k }, { x: x + dir * sx * k, y: y + sy }, { x: x - dir * sx, y: y + sy * k }],
    outs: [{ x: x + dir * sx * k, y: y - sy }, { x: x + dir * sx, y: y + sy * k }, { x: x - dir * sx * k, y: y + sy }, { x: x - dir * sx, y: y - sy * k }],
  };
}

export interface StarSpec {
  center: Point;
  points: number;
  outer: number;
  inner: number;
  rotation: number;
  polygon: boolean;
  reversed: boolean;
}

export function starBezier(spec: StarSpec): Bezier {
  const count = spec.polygon ? Math.floor(spec.points) : Math.floor(spec.points) * 2;
  const step = (Math.PI * 2) / Math.max(1, count);
  const dir = spec.reversed ? -1 : 1;
  let angle = -Math.PI / 2 + (spec.rotation * Math.PI) / 180;
  const points: Point[] = [];
  for (let i = 0; i < count; i++) {
    const radius = spec.polygon || i % 2 === 0 ? spec.outer : spec.inner;
    points.push({ x: spec.center.x + radius * Math.cos(angle), y: spec.center.y + radius * Math.sin(angle) });
    angle += step * dir;
  }
  return { closed: true, points, ins: points.map((p) => ({ ...p })), outs: points.map((p) => ({ ...p })) };
}

export function boundsOf(beziers: readonly Bezier[]): Box | null {
  const all = beziers.flatMap((bezier) => [...bezier.points, ...bezier.ins, ...bezier.outs]);
  if (all.length === 0) return null;
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
}

function tidy(value: number): string {
  return String(Math.round(value * PLACES) / PLACES || 0);
}

function same(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

export function unitPath(beziers: readonly Bezier[], box: Box, curves: boolean): string {
  const unit = (p: Point) => `${tidy(box.w > 0 ? (p.x - box.x) / box.w : 0)} ${tidy(box.h > 0 ? (p.y - box.y) / box.h : 0)}`;
  const parts: string[] = [];
  for (const bezier of beziers) {
    const n = bezier.points.length;
    if (n === 0) continue;
    parts.push(`M${unit(bezier.points[0])}`);
    const straight = (from: number, to: number) => !curves && same(bezier.outs[from], bezier.points[from]) && same(bezier.ins[to], bezier.points[to]);
    const curve = (from: number, to: number) => `C${unit(bezier.outs[from])} ${unit(bezier.ins[to])} ${unit(bezier.points[to])}`;
    for (let i = 0; i < n - 1; i++) parts.push(straight(i, i + 1) ? `L${unit(bezier.points[i + 1])}` : curve(i, i + 1));
    if (bezier.closed && n > 1) {
      if (!straight(n - 1, 0)) parts.push(curve(n - 1, 0));
      parts.push("Z");
    }
  }
  return parts.join(" ");
}
