import type { LineFrame, LinePoint, LineRun } from "./line-geometry";
import type { Point } from "./viewport";

export type LinePen = Pick<
  CanvasRenderingContext2D,
  "beginPath" | "moveTo" | "lineTo" | "closePath" | "arc" | "stroke" | "fill" | "setLineDash" | "lineWidth" | "lineCap" | "lineJoin" | "miterLimit" | "strokeStyle" | "fillStyle"
>;

const EPSILON = 1e-9;
const SHARP_TURN_COS = Math.cos(Math.PI / 6);

function strokeRuns(pen: LinePen, frame: LineFrame): void {
  if (frame.width <= 0 || frame.runs.length === 0) return;
  pen.lineWidth = frame.width;
  pen.lineCap = frame.cap;
  pen.lineJoin = frame.join;
  pen.miterLimit = frame.miterLimit;
  pen.beginPath();
  for (const run of frame.runs) {
    run.points.forEach((point, i) => (i === 0 ? pen.moveTo(point.x, point.y) : pen.lineTo(point.x, point.y)));
    if (run.closed) pen.closePath();
  }
  pen.stroke();
}

function shape(pen: LinePen, corners: readonly Point[]): void {
  let doubled = 0;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    doubled += a.x * b.y - b.x * a.y;
  }
  if (Math.abs(doubled) <= EPSILON) return;
  const ordered = doubled > 0 ? corners : [...corners].reverse();
  ordered.forEach((corner, i) => (i === 0 ? pen.moveTo(corner.x, corner.y) : pen.lineTo(corner.x, corner.y)));
  pen.closePath();
}

function dot(pen: LinePen, point: LinePoint): void {
  const radius = point.width / 2;
  if (radius <= EPSILON) return;
  pen.moveTo(point.x + radius, point.y);
  pen.arc(point.x, point.y, radius, 0, Math.PI * 2, false);
  pen.closePath();
}

function edgeNormal(a: Point, b: Point): Point | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  return length > EPSILON ? { x: -dy / length, y: dx / length } : null;
}

function offset(point: LinePoint, normal: Point, side: 1 | -1): Point {
  const radius = point.width / 2;
  return { x: point.x + normal.x * radius * side, y: point.y + normal.y * radius * side };
}

function squareCap(pen: LinePen, point: LinePoint, normal: Point, outward: 1 | -1): void {
  const radius = point.width / 2;
  const along = { x: normal.y * outward * radius, y: -normal.x * outward * radius };
  const a = offset(point, normal, 1);
  const b = offset(point, normal, -1);
  shape(pen, [a, { x: a.x + along.x, y: a.y + along.y }, { x: b.x + along.x, y: b.y + along.y }, b]);
}

function unionRun(pen: LinePen, run: LineRun, cap: LineFrame["cap"]): void {
  const points = run.points.filter((point, i, all) => i === 0 || Math.hypot(point.x - all[i - 1].x, point.y - all[i - 1].y) > EPSILON);
  const count = points.length;
  if (count < 2) {
    if (count === 1 && cap === "round") dot(pen, points[0]);
    return;
  }
  const closed = run.closed && count > 2;
  const edges = closed ? count : count - 1;
  const normals = Array.from({ length: edges }, (_, i) => edgeNormal(points[i], points[(i + 1) % count])!);
  const sides: { into: Point; out: Point; sharp: boolean }[] = points.map((_, i) => {
    const before = closed ? normals[(i - 1 + edges) % edges] : normals[Math.max(0, i - 1)];
    const after = closed ? normals[i % edges] : normals[Math.min(edges - 1, i)];
    const turn = before.x * after.x + before.y * after.y;
    if (turn < SHARP_TURN_COS) return { into: before, out: after, sharp: true };
    const size = Math.hypot(before.x + after.x, before.y + after.y);
    const bisector = { x: (before.x + after.x) / size, y: (before.y + after.y) / size };
    return { into: bisector, out: bisector, sharp: false };
  });
  for (let i = 0; i < edges; i++) {
    const j = (i + 1) % count;
    if (points[i].width <= EPSILON && points[j].width <= EPSILON) continue;
    shape(pen, [offset(points[i], sides[i].out, 1), offset(points[j], sides[j].into, 1), offset(points[j], sides[j].into, -1), offset(points[i], sides[i].out, -1)]);
  }
  points.forEach((point, i) => {
    const end = !closed && (i === 0 || i === count - 1);
    if (end ? cap === "round" : sides[i].sharp) dot(pen, point);
  });
  if (!closed && cap === "square") {
    squareCap(pen, points[0], normals[0], -1);
    squareCap(pen, points[count - 1], normals[edges - 1], 1);
  }
}

function fillRuns(pen: LinePen, frame: LineFrame): void {
  if (frame.runs.length === 0) return;
  pen.beginPath();
  for (const run of frame.runs) unionRun(pen, run, frame.cap);
  pen.fill("nonzero");
}

function drawHeads(pen: LinePen, frame: LineFrame): void {
  for (const head of frame.heads) {
    pen.beginPath();
    pen.moveTo(head.points[0], head.points[1]);
    for (let i = 2; i < head.points.length; i += 2) pen.lineTo(head.points[i], head.points[i + 1]);
    pen.closePath();
    pen.fill();
    if (!head.stroked || frame.width <= 0) continue;
    pen.lineWidth = frame.width;
    pen.lineJoin = frame.join;
    pen.miterLimit = frame.miterLimit;
    pen.stroke();
  }
}

export function drawLineFrame(pen: LinePen, frame: LineFrame): void {
  pen.setLineDash([]);
  pen.strokeStyle = frame.color;
  pen.fillStyle = frame.color;
  if (frame.uniform) strokeRuns(pen, frame);
  else fillRuns(pen, frame);
  drawHeads(pen, frame);
}
