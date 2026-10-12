import { hash01 } from "../../vfx";

export interface Spot {
  x: number;
  y: number;
}

export function num(value: number): string {
  return String(Math.round(value * 100) / 100 || 0);
}

function pair(point: Spot): string {
  return `${num(point.x)} ${num(point.y)}`;
}

export function chance(seed: number, channel: number, index: number): number {
  return hash01(seed, channel, index);
}

export function between(seed: number, channel: number, index: number, low: number, high: number): number {
  return low + (high - low) * chance(seed, channel, index);
}

function controls(previous: Spot, from: Spot, to: Spot, next: Spot, tension: number): [Spot, Spot] {
  return [
    { x: from.x + ((to.x - previous.x) / 6) * tension, y: from.y + ((to.y - previous.y) / 6) * tension },
    { x: to.x - ((next.x - from.x) / 6) * tension, y: to.y - ((next.y - from.y) / 6) * tension },
  ];
}

export function closedCurve(points: readonly Spot[], tension = 1): string {
  const count = points.length;
  const at = (index: number) => points[(index + count) % count];
  const segments = points.map((from, i) => {
    const [a, b] = controls(at(i - 1), from, at(i + 1), at(i + 2), tension);
    return `C${pair(a)} ${pair(b)} ${pair(at(i + 1))}`;
  });
  return `M${pair(points[0])} ${segments.join(" ")} Z`;
}

export function openCurve(points: readonly Spot[], tension = 1): string {
  const last = points.length - 1;
  const at = (index: number) => points[Math.max(0, Math.min(last, index))];
  const segments = points.slice(0, last).map((from, i) => {
    const [a, b] = controls(at(i - 1), from, at(i + 1), at(i + 2), tension);
    return `C${pair(a)} ${pair(b)} ${pair(at(i + 1))}`;
  });
  return `M${pair(points[0])} ${segments.join(" ")}`;
}

export function polyline(points: readonly Spot[], closed = false): string {
  return `${points.map((point, i) => `${i === 0 ? "M" : "L"}${pair(point)}`).join(" ")}${closed ? " Z" : ""}`;
}

export function circle(cx: number, cy: number, r: number): string {
  return `M${num(cx - r)} ${num(cy)} A${num(r)} ${num(r)} 0 1 0 ${num(cx + r)} ${num(cy)} A${num(r)} ${num(r)} 0 1 0 ${num(cx - r)} ${num(cy)} Z`;
}

export function ring(cx: number, cy: number, outer: number, inner: number): string {
  return `${circle(cx, cy, outer)} ${circle(cx, cy, inner)}`;
}

export function roundedRect(x: number, y: number, width: number, height: number, radius: number): string {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  if (r === 0) return polyline([{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }], true);
  const arc = (toX: number, toY: number) => `A${num(r)} ${num(r)} 0 0 1 ${num(toX)} ${num(toY)}`;
  return [
    `M${num(x + r)} ${num(y)}`,
    `L${num(x + width - r)} ${num(y)}`,
    arc(x + width, y + r),
    `L${num(x + width)} ${num(y + height - r)}`,
    arc(x + width - r, y + height),
    `L${num(x + r)} ${num(y + height)}`,
    arc(x, y + height - r),
    `L${num(x)} ${num(y + r)}`,
    arc(x + r, y),
    "Z",
  ].join(" ");
}

export function rect(cx: number, cy: number, width: number, height: number, turn = 0): string {
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const corner = (dx: number, dy: number): Spot => ({ x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos });
  return polyline([corner(-width / 2, -height / 2), corner(width / 2, -height / 2), corner(width / 2, height / 2), corner(-width / 2, height / 2)], true);
}

export function radial(cx: number, cy: number, count: number, radius: (index: number) => number, turn = -Math.PI / 2): Spot[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = turn + (i * 2 * Math.PI) / count;
    const r = radius(i);
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  });
}

export function star(cx: number, cy: number, points: number, outer: number, inner: number, turn = -Math.PI / 2): string {
  return polyline(radial(cx, cy, points * 2, (i) => (i % 2 === 0 ? outer : inner), turn), true);
}

export function sparkle(cx: number, cy: number, r: number, waist: number, turn = 0): string {
  const tips = radial(cx, cy, 4, () => r, turn - Math.PI / 2);
  const pinch = radial(cx, cy, 4, () => r * waist, turn - Math.PI / 4);
  return `M${pair(tips[0])} ${tips.map((_, i) => `Q${pair(pinch[i])} ${pair(tips[(i + 1) % 4])}`).join(" ")} Z`;
}

export function blobPoints(cx: number, cy: number, rx: number, ry: number, seed: number, count = 8, wobble = 0.22): Spot[] {
  return radial(cx, cy, count, () => 1, 0).map((unit, i) => {
    const scale = 1 - wobble + 2 * wobble * chance(seed, 1, i);
    return { x: cx + (unit.x - cx) * rx * scale, y: cy + (unit.y - cy) * ry * scale };
  });
}

export function blob(cx: number, cy: number, rx: number, ry: number, seed: number, count = 8, wobble = 0.22): string {
  return closedCurve(blobPoints(cx, cy, rx, ry, seed, count, wobble));
}

export function sine(from: number, to: number, baseline: number, amplitude: number, waves: number, phase = 0, step = 24): Spot[] {
  const count = Math.max(2, Math.round(waves * step));
  return Array.from({ length: count + 1 }, (_, i) => {
    const t = i / count;
    return { x: from + (to - from) * t, y: baseline + Math.sin(phase + t * waves * 2 * Math.PI) * amplitude };
  });
}

export function jitter(points: readonly Spot[], amount: number, seed: number): Spot[] {
  return points.map((point, i) => ({ x: point.x + between(seed, 2, i, -amount, amount), y: point.y + between(seed, 3, i, -amount, amount) }));
}

function normals(points: readonly Spot[]): Spot[] {
  return points.map((point, i) => {
    const before = points[Math.max(0, i - 1)];
    const after = points[Math.min(points.length - 1, i + 1)];
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const length = Math.hypot(dx, dy) || 1;
    return { x: -dy / length, y: dx / length };
  });
}

export function taperedStroke(points: readonly Spot[], width: number, rough: number, seed: number, samples = 40): string {
  const centre = samplePolyline(points, samples);
  const sides = normals(centre);
  const half = centre.map((_, i) => {
    const t = i / (centre.length - 1);
    return (width / 2) * Math.pow(Math.sin(Math.PI * t), 0.55);
  });
  const edge = (sign: 1 | -1, channel: number) => centre.map((point, i) => {
    const r = half[i] + (half[i] > 0 ? between(seed, channel, i, -rough, rough) : 0);
    return { x: point.x + sides[i].x * r * sign, y: point.y + sides[i].y * r * sign };
  });
  return closedCurve([...edge(1, 5), ...edge(-1, 6).reverse()], 0.6);
}

export function samplePolyline(points: readonly Spot[], samples: number): Spot[] {
  const lengths = points.slice(1).map((point, i) => Math.hypot(point.x - points[i].x, point.y - points[i].y));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (total === 0) return [points[0], points[0]];
  return Array.from({ length: samples + 1 }, (_, i) => {
    let left = (i / samples) * total;
    for (let segment = 0; segment < lengths.length; segment++) {
      if (left <= lengths[segment] || segment === lengths.length - 1) {
        const t = lengths[segment] === 0 ? 0 : Math.min(1, left / lengths[segment]);
        return { x: points[segment].x + (points[segment + 1].x - points[segment].x) * t, y: points[segment].y + (points[segment + 1].y - points[segment].y) * t };
      }
      left -= lengths[segment];
    }
    return points[points.length - 1];
  });
}

export function curvePoints(points: readonly Spot[], perSegment = 8): Spot[] {
  const last = points.length - 1;
  const at = (index: number) => points[Math.max(0, Math.min(last, index))];
  const out: Spot[] = [points[0]];
  for (let i = 0; i < last; i++) {
    const [a, b] = controls(at(i - 1), at(i), at(i + 1), at(i + 2), 1);
    const from = at(i);
    const to = at(i + 1);
    for (let s = 1; s <= perSegment; s++) {
      const t = s / perSegment;
      const u = 1 - t;
      out.push({ x: u * u * u * from.x + 3 * u * u * t * a.x + 3 * u * t * t * b.x + t * t * t * to.x, y: u * u * u * from.y + 3 * u * u * t * a.y + 3 * u * t * t * b.y + t * t * t * to.y });
    }
  }
  return out;
}
