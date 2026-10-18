import type { Rgba } from "../../color";
import { area, paintOf, type SceneElement, type SceneGround } from "../scene";

export interface Lab {
  L: number;
  a: number;
  b: number;
}

interface GrayImage {
  width: number;
  height: number;
  data: Float32Array;
}

interface RgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface TextScore {
  exact: number;
  total: number;
  similarity: number;
}

export interface ReplicationScore {
  blockMatch: number;
  text: TextScore;
  positionError: number;
  sizeError: number;
  colorError: number;
  rotationError: number;
  backgroundError: number;
  matched: number;
  referenceElements: number;
  resultElements: number;
  missing: string[];
  invented: string[];
}

type ElementKind = "text" | "visual";

interface Piece {
  id: string;
  kind: ElementKind;
  family: string;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  size: number;
  color: Lab | null;
}

const TEXT_MATCH_FLOOR = 0.5;
const VISUAL_MATCH_FLOOR = 0.5;
const OTHER_FAMILY_FACTOR = 0.6;
const UNPAIRED = 1e6;
const SSIM_WINDOW = 7;
const SSIM_C1 = (0.01 * 255) ** 2;
const SSIM_C2 = (0.03 * 255) ** 2;

export function diceSimilarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const char of a) counts.set(char, (counts.get(char) ?? 0) + 1);
  let shared = 0;
  for (const char of b) {
    const left = counts.get(char) ?? 0;
    if (left > 0) {
      shared += 1;
      counts.set(char, left - 1);
    }
  }
  return (2 * shared) / ([...a].length + [...b].length);
}

function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function labPart(t: number): number {
  return t > (6 / 29) ** 3 ? Math.cbrt(t) : t / (3 * (6 / 29) ** 2) + 4 / 29;
}

export function labOf(color: Rgba): Lab {
  const r = linear(color.r);
  const g = linear(color.g);
  const b = linear(color.b);
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const fx = labPart(x);
  const fy = labPart(y);
  const fz = labPart(z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

function degrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

function radians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function hueOf(b: number, a: number): number {
  if (a === 0 && b === 0) return 0;
  const h = degrees(Math.atan2(b, a));
  return h < 0 ? h + 360 : h;
}

export function ciede2000(one: Lab, two: Lab): number {
  const c1 = Math.hypot(one.a, one.b);
  const c2 = Math.hypot(two.a, two.b);
  const cMean = (c1 + c2) / 2;
  const g = 0.5 * (1 - Math.sqrt(cMean ** 7 / (cMean ** 7 + 25 ** 7)));
  const a1 = (1 + g) * one.a;
  const a2 = (1 + g) * two.a;
  const cp1 = Math.hypot(a1, one.b);
  const cp2 = Math.hypot(a2, two.b);
  const h1 = hueOf(one.b, a1);
  const h2 = hueOf(two.b, a2);
  const dL = two.L - one.L;
  const dC = cp2 - cp1;
  let dh = 0;
  if (cp1 * cp2 !== 0) {
    dh = h2 - h1;
    if (dh > 180) dh -= 360;
    else if (dh < -180) dh += 360;
  }
  const dH = 2 * Math.sqrt(cp1 * cp2) * Math.sin(radians(dh / 2));
  const lMean = (one.L + two.L) / 2;
  const cpMean = (cp1 + cp2) / 2;
  let hMean = h1 + h2;
  if (cp1 * cp2 !== 0) {
    if (Math.abs(h1 - h2) <= 180) hMean = (h1 + h2) / 2;
    else hMean = h1 + h2 < 360 ? (h1 + h2 + 360) / 2 : (h1 + h2 - 360) / 2;
  }
  const t = 1 - 0.17 * Math.cos(radians(hMean - 30)) + 0.24 * Math.cos(radians(2 * hMean)) + 0.32 * Math.cos(radians(3 * hMean + 6)) - 0.2 * Math.cos(radians(4 * hMean - 63));
  const dTheta = 30 * Math.exp(-(((hMean - 275) / 25) ** 2));
  const rc = 2 * Math.sqrt(cpMean ** 7 / (cpMean ** 7 + 25 ** 7));
  const sl = 1 + (0.015 * (lMean - 50) ** 2) / Math.sqrt(20 + (lMean - 50) ** 2);
  const sc = 1 + 0.045 * cpMean;
  const sh = 1 + 0.015 * cpMean * t;
  const rt = -Math.sin(radians(2 * dTheta)) * rc;
  return Math.sqrt((dL / sl) ** 2 + (dC / sc) ** 2 + (dH / sh) ** 2 + rt * (dC / sc) * (dH / sh));
}

export function assignment(cost: readonly (readonly number[])[]): number[] {
  const rows = cost.length;
  const cols = rows === 0 ? 0 : cost[0].length;
  const n = Math.max(rows, cols);
  const at = (i: number, j: number) => (i < rows && j < cols ? cost[i][j] : UNPAIRED);
  const u = new Array<number>(n + 1).fill(0);
  const v = new Array<number>(n + 1).fill(0);
  const owner = new Array<number>(n + 1).fill(0);
  const way = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    owner[0] = i;
    let j0 = 0;
    const least = new Array<number>(n + 1).fill(Infinity);
    const used = new Array<boolean>(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = owner[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const reduced = at(i0 - 1, j - 1) - u[i0] - v[j];
        if (reduced < least[j]) {
          least[j] = reduced;
          way[j] = j0;
        }
        if (least[j] < delta) {
          delta = least[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[owner[j]] += delta;
          v[j] -= delta;
        } else least[j] -= delta;
      }
      j0 = j1;
    } while (owner[j0] !== 0);
    do {
      const j1 = way[j0];
      owner[j0] = owner[j1];
      j0 = j1;
    } while (j0 !== 0);
  }
  const result = new Array<number>(rows).fill(-1);
  for (let j = 1; j <= n; j++) {
    const i = owner[j] - 1;
    if (i < rows && j - 1 < cols) result[i] = j - 1;
  }
  return result;
}

function familyOf(element: SceneElement): string {
  const layer = element.layer;
  if (!layer) return "media";
  if (layer.type === "shape") return layer.shape === "line" || layer.shape === "arrow" ? "line" : "shape";
  return layer.type;
}

function pieceOf(element: SceneElement): Piece {
  const layer = element.layer;
  const isText = layer?.type === "text" && Boolean(layer.text?.trim());
  const paint = layer ? paintOf(layer) : null;
  const t = element.transform;
  return {
    id: element.id,
    kind: isText ? "text" : "visual",
    family: familyOf(element),
    text: isText ? normalizedText(layer!.text!) : "",
    x: t.x,
    y: t.y,
    w: Math.abs(t.w),
    h: Math.abs(t.h),
    rotation: t.rotation,
    size: area(element.box),
    color: paint ? labOf(paint) : null,
  };
}

function normalizedText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function positionDistance(a: Piece, b: Piece): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function colorDistance(a: Piece, b: Piece): number | null {
  return a.color && b.color ? ciede2000(a.color, b.color) : null;
}

function visualSimilarity(a: Piece, b: Piece): number {
  const position = 1 - positionDistance(a, b);
  const sizes = Math.min(a.size, b.size) / Math.max(a.size, b.size, 1e-9);
  const distance = colorDistance(a, b);
  const color = distance === null ? 0.5 : 1 - Math.min(distance, 100) / 100;
  const blended = 0.5 * position + 0.25 * Math.sqrt(sizes) + 0.25 * color;
  return a.family === b.family ? blended : blended * OTHER_FAMILY_FACTOR;
}

function similarity(a: Piece, b: Piece): number {
  if (a.kind !== b.kind) return 0;
  return a.kind === "text" ? diceSimilarity(a.text, b.text) : visualSimilarity(a, b);
}

function floorOf(kind: ElementKind): number {
  return kind === "text" ? TEXT_MATCH_FLOOR : VISUAL_MATCH_FLOOR;
}

function pairs(reference: Piece[], result: Piece[]): [number, number][] {
  if (reference.length === 0 || result.length === 0) return [];
  const sims = reference.map((a) => result.map((b) => similarity(a, b)));
  const chosen = assignment(sims.map((row) => row.map((s) => -s)));
  return chosen.flatMap((j, i) => (j >= 0 && sims[i][j] >= floorOf(reference[i].kind) ? [[i, j] as [number, number]] : []));
}

function rotationGap(a: number, b: number): number {
  return Math.abs(((((a - b) % 360) + 540) % 360) - 180);
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
}

function groundLab(scene: SceneGround): Lab | null {
  return scene.background ? labOf(scene.background) : null;
}

export function replicationScore(reference: SceneGround, result: SceneGround): ReplicationScore {
  const ref = reference.elements.map(pieceOf);
  const got = result.elements.map(pieceOf);
  const matched = pairs(ref, got);
  const pairedRef = new Set(matched.map(([i]) => i));
  const pairedGot = new Set(matched.map(([, j]) => j));
  const total = ref.reduce((sum, p) => sum + p.size, 0) + got.reduce((sum, p) => sum + p.size, 0);
  const blockMatch = total === 0 ? (ref.length === got.length ? 1 : 0) : matched.reduce((sum, [i, j]) => sum + ref[i].size + got[j].size, 0) / total;
  const refTexts = ref.filter((p) => p.kind === "text");
  const textPairs = matched.filter(([i]) => ref[i].kind === "text");
  const colors = matched.flatMap(([i, j]) => {
    const d = colorDistance(ref[i], got[j]);
    return d === null ? [] : [d];
  });
  const refGround = groundLab(reference);
  const gotGround = groundLab(result);
  return {
    blockMatch,
    text: {
      exact: textPairs.filter(([i, j]) => ref[i].text === got[j].text).length,
      total: refTexts.length,
      similarity: textPairs.length === 0 ? 0 : mean(textPairs.map(([i, j]) => diceSimilarity(ref[i].text, got[j].text))),
    },
    positionError: mean(matched.map(([i, j]) => positionDistance(ref[i], got[j]))),
    sizeError: mean(matched.map(([i, j]) => (Math.abs(ref[i].w - got[j].w) + Math.abs(ref[i].h - got[j].h)) / 2)),
    colorError: mean(colors),
    rotationError: mean(matched.map(([i, j]) => rotationGap(ref[i].rotation, got[j].rotation))),
    backgroundError: refGround && gotGround ? ciede2000(refGround, gotGround) : 0,
    matched: matched.length,
    referenceElements: ref.length,
    resultElements: got.length,
    missing: ref.filter((_, i) => !pairedRef.has(i)).map((p) => p.id),
    invented: got.filter((_, j) => !pairedGot.has(j)).map((p) => p.id),
  };
}

export function grayOf(image: RgbaImage): GrayImage {
  const data = new Float32Array(image.width * image.height);
  for (let i = 0; i < data.length; i++) data[i] = 0.299 * image.data[i * 4] + 0.587 * image.data[i * 4 + 1] + 0.114 * image.data[i * 4 + 2];
  return { width: image.width, height: image.height, data };
}

export function ssim(a: GrayImage, b: GrayImage): number {
  if (a.width !== b.width || a.height !== b.height) throw new Error("ssim compares pictures of the same size");
  const size = Math.min(SSIM_WINDOW, a.width, a.height);
  const count = size * size;
  let total = 0;
  let windows = 0;
  for (let top = 0; top + size <= a.height; top++) {
    for (let left = 0; left + size <= a.width; left++) {
      let sa = 0;
      let sb = 0;
      let saa = 0;
      let sbb = 0;
      let sab = 0;
      for (let y = top; y < top + size; y++) {
        for (let x = left; x < left + size; x++) {
          const va = a.data[y * a.width + x];
          const vb = b.data[y * b.width + x];
          sa += va;
          sb += vb;
          saa += va * va;
          sbb += vb * vb;
          sab += va * vb;
        }
      }
      const ma = sa / count;
      const mb = sb / count;
      const unbiased = count / (count - 1);
      const va = (saa / count - ma * ma) * unbiased;
      const vb = (sbb / count - mb * mb) * unbiased;
      const cov = (sab / count - ma * mb) * unbiased;
      total += ((2 * ma * mb + SSIM_C1) * (2 * cov + SSIM_C2)) / ((ma * ma + mb * mb + SSIM_C1) * (va + vb + SSIM_C2));
      windows += 1;
    }
  }
  return windows === 0 ? 0 : total / windows;
}
