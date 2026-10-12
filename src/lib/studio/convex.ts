export type Point = [number, number];

export function convexArea(points: readonly Point[]): number {
  return Math.abs(signedArea(points));
}

function signedArea(points: readonly Point[]): number {
  let twice = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    twice += x1 * y2 - x2 * y1;
  }
  return twice / 2;
}

function side(a: Point, b: Point, p: Point): number {
  return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
}

function crossing(a: Point, b: Point, p: Point, q: Point): Point {
  const sp = side(a, b, p);
  const sq = side(a, b, q);
  const t = sp / (sp - sq);
  return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
}

export function insideConvex(point: Point, polygon: readonly Point[]): boolean {
  const winding = Math.sign(signedArea(polygon)) || 1;
  return polygon.every((a, i) => side(a, polygon[(i + 1) % polygon.length], point) * winding >= 0);
}

export function convexIntersection(subject: readonly Point[], clip: readonly Point[]): Point[] {
  const winding = Math.sign(signedArea(clip)) || 1;
  let output: Point[] = [...subject];
  for (let i = 0; i < clip.length && output.length > 0; i++) {
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    const input = output;
    output = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j];
      const q = input[(j + 1) % input.length];
      const pIn = side(a, b, p) * winding >= 0;
      const qIn = side(a, b, q) * winding >= 0;
      if (pIn) output.push(p);
      if (pIn !== qIn) output.push(crossing(a, b, p, q));
    }
  }
  return convexArea(output) > 0 ? output : [];
}
