export interface Point {
  x: number;
  y: number;
}

interface Point3 extends Point {
  z: number;
}

export interface Tilt {
  x: number;
  y: number;
}

export interface Lens {
  center: Point;
  distance: number;
}

export type Homography = readonly [number, number, number, number, number, number, number, number, number];

export type Affine = readonly [number, number, number, number, number, number];

interface TiltedPiece {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  rotationX?: number;
  rotationY?: number;
  depth?: number;
}

export type Quad = readonly [Point, Point, Point, Point];

export const PERSPECTIVE_RANGE = [0, 120] as const;
export const DEFAULT_PERSPECTIVE = 40;

const NEAR = 1e-6;
const DEGREES = Math.PI / 180;
const PIECE_CORNERS = [
  [-0.5, -0.5],
  [0.5, -0.5],
  [0.5, 0.5],
  [-0.5, 0.5],
] as const;

export function lensOf(perspective: number, width: number, height: number): Lens {
  const half = (perspective * DEGREES) / 2;
  return { center: { x: width / 2, y: height / 2 }, distance: perspective > 0 ? height / 2 / Math.tan(half) : Infinity };
}

function nearness(lens: Lens): number {
  return Number.isFinite(lens.distance) ? 1 / lens.distance : 0;
}

export function turned3d(tilt: Tilt, point: Point3): Point3 {
  const ay = tilt.y * DEGREES;
  const ax = tilt.x * DEGREES;
  const x = point.x * Math.cos(ay) - point.z * Math.sin(ay);
  const z = point.x * Math.sin(ay) + point.z * Math.cos(ay);
  return { x, y: point.y * Math.cos(ax) + z * Math.sin(ax), z: -point.y * Math.sin(ax) + z * Math.cos(ax) };
}

export function projectPoint(lens: Lens, point: Point3): Point | null {
  const w = 1 + nearness(lens) * point.z;
  if (!(w > NEAR)) return null;
  return { x: lens.center.x + (point.x - lens.center.x) / w, y: lens.center.y + (point.y - lens.center.y) / w };
}

export function multiplyHomography(a: Homography, b: Homography): Homography {
  const at = (row: number, col: number) => a[row * 3] * b[col] + a[row * 3 + 1] * b[3 + col] + a[row * 3 + 2] * b[6 + col];
  return [at(0, 0), at(0, 1), at(0, 2), at(1, 0), at(1, 1), at(1, 2), at(2, 0), at(2, 1), at(2, 2)];
}

export function invertHomography(h: Homography): Homography | null {
  const [a, b, c, d, e, f, g, k, i] = h;
  const A = e * i - f * k;
  const B = -(d * i - f * g);
  const C = d * k - e * g;
  const det = a * A + b * B + c * C;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
  return [A / det, -(b * i - c * k) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * k - b * g) / det, (a * e - b * d) / det];
}

export function projectHomography(h: Homography, point: Point): Point | null {
  const w = h[6] * point.x + h[7] * point.y + h[8];
  if (!(w > NEAR)) return null;
  return { x: (h[0] * point.x + h[1] * point.y + h[2]) / w, y: (h[3] * point.x + h[4] * point.y + h[5]) / w };
}

export function tiltHomography(lens: Lens, pivot: Point, tilt: Tilt): Homography {
  const k = nearness(lens);
  const across = turned3d(tilt, { x: 1, y: 0, z: 0 });
  const down = turned3d(tilt, { x: 0, y: 1, z: 0 });
  const local: Homography = [
    across.x + lens.center.x * k * across.z,
    down.x + lens.center.x * k * down.z,
    pivot.x,
    across.y + lens.center.y * k * across.z,
    down.y + lens.center.y * k * down.z,
    pivot.y,
    k * across.z,
    k * down.z,
    1,
  ];
  return multiplyHomography(local, [1, 0, -pivot.x, 0, 1, -pivot.y, 0, 0, 1]);
}

export function scaledHomography(h: Homography, width: number, height: number): Homography {
  return multiplyHomography(multiplyHomography([1 / width, 0, 0, 0, 1 / height, 0, 0, 0, 1], h), [width, 0, 0, 0, height, 0, 0, 0, 1]);
}

export function cssMatrix3d(h: Homography): string {
  return `matrix3d(${[h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, h[8]].join(",")})`;
}

export function quadReach(box: readonly Point[], shown: readonly (Point | null)[]): number {
  if (shown.some((point) => point === null)) return Infinity;
  const placed = shown as readonly Point[];
  const xs = box.map((point) => point.x);
  const ys = box.map((point) => point.y);
  const sx = placed.map((point) => point.x);
  const sy = placed.map((point) => point.y);
  return Math.max(0, Math.min(...xs) - Math.min(...sx), Math.max(...sx) - Math.max(...xs), Math.min(...ys) - Math.min(...sy), Math.max(...sy) - Math.max(...ys));
}

export function affineOf(place: { x: number; y: number; rotation: number; scaleX: number; scaleY: number }): Affine {
  const turn = place.rotation * DEGREES;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  return [cos * place.scaleX, sin * place.scaleX, -sin * place.scaleY, cos * place.scaleY, place.x, place.y];
}

export function applyAffine(m: Affine, point: Point): Point {
  return { x: m[0] * point.x + m[2] * point.y + m[4], y: m[1] * point.x + m[3] * point.y + m[5] };
}

export function invertAffine(m: Affine): Affine | null {
  const [a, b, c, d, tx, ty] = m;
  const det = a * d - b * c;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
  return [d / det, -b / det, -c / det, a / det, (c * ty - d * tx) / det, (b * tx - a * ty) / det];
}

export function pieceTilted(piece: Pick<TiltedPiece, "rotationX" | "rotationY" | "depth">): boolean {
  return Boolean(piece.rotationX || piece.rotationY || piece.depth);
}

export function pieceQuad(piece: TiltedPiece, frame: Affine, lens: Lens): Quad | null {
  const turn = piece.rotation * DEGREES;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const tilt = { x: piece.rotationX ?? 0, y: piece.rotationY ?? 0 };
  const depthScale = Math.sqrt(Math.abs(frame[0] * frame[3] - frame[1] * frame[2]));
  const corners: Point[] = [];
  for (const [u, v] of PIECE_CORNERS) {
    const ox = u * piece.width;
    const oy = v * piece.height;
    const q = turned3d(tilt, { x: ox * cos - oy * sin, y: ox * sin + oy * cos, z: 0 });
    const placed = applyAffine(frame, { x: piece.x + q.x, y: piece.y + q.y });
    const shown = projectPoint(lens, { ...placed, z: ((piece.depth ?? 0) + q.z) * depthScale });
    if (!shown) return null;
    corners.push(shown);
  }
  return corners as unknown as Quad;
}
