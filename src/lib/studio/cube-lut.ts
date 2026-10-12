import type { IssueCode } from "./validate";

export const LUT_SIZE_RANGE = [2, 65] as const;
export const CUBE_EXTENSION = ".cube";
export const LUT_MEDIA_TYPE = "lut";

export type Triple = [number, number, number];

export interface CubeLut {
  size: number;
  domainMin: Triple;
  domainMax: Triple;
  table: Float32Array;
  title?: string;
}

export type CubeFault = "empty" | "size" | "oneDimensional" | "rows" | "number" | "domain" | "keyword";

export type CubeParse = { ok: true; lut: CubeLut } | { ok: false; fault: CubeFault };

export interface GradeLut {
  assetId: string;
  intensity?: number;
}

const TOKEN = /\s+/;

function numbers(parts: readonly string[], count: number): number[] | null {
  if (parts.length !== count) return null;
  const values = parts.map(Number);
  return values.every(Number.isFinite) ? values : null;
}

function triple(parts: readonly string[]): Triple | null {
  const values = numbers(parts, 3);
  return values ? [values[0], values[1], values[2]] : null;
}

export function parseCube(text: string): CubeParse {
  let size = 0;
  let title: string | undefined;
  let domainMin: Triple = [0, 0, 0];
  let domainMax: Triple = [1, 1, 1];
  const rows: number[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (line === "") continue;
    const [head, ...rest] = line.split(TOKEN);
    if (/^[A-Za-z_]/.test(head)) {
      if (rows.length > 0) return { ok: false, fault: "keyword" };
      switch (head) {
        case "TITLE":
          title = line.slice(head.length).trim().replace(/^"|"$/g, "");
          break;
        case "LUT_1D_SIZE":
        case "LUT_1D_INPUT_RANGE":
          return { ok: false, fault: "oneDimensional" };
        case "LUT_3D_SIZE": {
          const value = numbers(rest, 1);
          if (!value || !Number.isInteger(value[0]) || value[0] < LUT_SIZE_RANGE[0] || value[0] > LUT_SIZE_RANGE[1]) return { ok: false, fault: "size" };
          size = value[0];
          break;
        }
        case "DOMAIN_MIN":
        case "DOMAIN_MAX": {
          const value = triple(rest);
          if (!value) return { ok: false, fault: "domain" };
          if (head === "DOMAIN_MIN") domainMin = value;
          else domainMax = value;
          break;
        }
        case "LUT_3D_INPUT_RANGE": {
          const value = numbers(rest, 2);
          if (!value) return { ok: false, fault: "domain" };
          domainMin = [value[0], value[0], value[0]];
          domainMax = [value[1], value[1], value[1]];
          break;
        }
        default:
          return { ok: false, fault: "keyword" };
      }
      continue;
    }
    const value = triple([head, ...rest]);
    if (!value) return { ok: false, fault: "number" };
    rows.push(...value);
  }
  if (size === 0) return { ok: false, fault: rows.length === 0 ? "empty" : "size" };
  if (rows.length !== size ** 3 * 3) return { ok: false, fault: "rows" };
  if (domainMin.some((low, c) => !(low < domainMax[c]))) return { ok: false, fault: "domain" };
  return { ok: true, lut: { size, domainMin, domainMax, table: Float32Array.from(rows), ...(title ? { title } : {}) } };
}

export function isCubeName(name: string): boolean {
  return name.toLowerCase().endsWith(CUBE_EXTENSION);
}

export function lutRefIssue(lut: GradeLut): IssueCode | null {
  if (typeof lut.assetId !== "string" || lut.assetId.trim() === "") return "required";
  if (lut.intensity !== undefined && !(Number.isFinite(lut.intensity) && lut.intensity >= 0 && lut.intensity <= 1)) return "out_of_range";
  return null;
}

export function lutIntensity(lut: GradeLut): number {
  return lut.intensity ?? 1;
}

export function isNeutralLut(lut: GradeLut | undefined): boolean {
  return !lut || lutIntensity(lut) === 0;
}

export interface LutAtlas {
  size: number;
  columns: number;
  width: number;
  height: number;
  data: Uint8Array;
  domainMin: Triple;
  domainMax: Triple;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function lutAtlas(lut: CubeLut): LutAtlas {
  const n = lut.size;
  const columns = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / columns);
  const width = columns * n;
  const height = rows * n;
  const data = new Uint8Array(width * height * 4);
  for (let b = 0; b < n; b++) {
    for (let g = 0; g < n; g++) {
      for (let r = 0; r < n; r++) {
        const source = (r + g * n + b * n * n) * 3;
        const x = (b % columns) * n + r;
        const y = Math.floor(b / columns) * n + g;
        const target = (y * width + x) * 4;
        data[target] = Math.round(clamp01(lut.table[source]) * 255);
        data[target + 1] = Math.round(clamp01(lut.table[source + 1]) * 255);
        data[target + 2] = Math.round(clamp01(lut.table[source + 2]) * 255);
        data[target + 3] = 255;
      }
    }
  }
  return { size: n, columns, width, height, data, domainMin: lut.domainMin, domainMax: lut.domainMax };
}

function texel(atlas: LutAtlas, r: number, g: number, b: number, channel: number): number {
  const x = (b % atlas.columns) * atlas.size + r;
  const y = Math.floor(b / atlas.columns) * atlas.size + g;
  return atlas.data[(y * atlas.width + x) * 4 + channel] / 255;
}

export function lutPixel(rgb: readonly number[], atlas: LutAtlas): number[] {
  const top = atlas.size - 1;
  const p = rgb.slice(0, 3).map((v, c) => clamp01((v - atlas.domainMin[c]) / (atlas.domainMax[c] - atlas.domainMin[c])) * top);
  const i0 = p.map((v) => Math.min(Math.floor(v), top));
  const i1 = i0.map((v) => Math.min(v + 1, top));
  const f = p.map((v, c) => v - i0[c]);
  return [0, 1, 2].map((channel) => {
    const at = (r: number, g: number, b: number) => texel(atlas, r, g, b, channel);
    const c00 = at(i0[0], i0[1], i0[2]) * (1 - f[0]) + at(i1[0], i0[1], i0[2]) * f[0];
    const c10 = at(i0[0], i1[1], i0[2]) * (1 - f[0]) + at(i1[0], i1[1], i0[2]) * f[0];
    const c01 = at(i0[0], i0[1], i1[2]) * (1 - f[0]) + at(i1[0], i0[1], i1[2]) * f[0];
    const c11 = at(i0[0], i1[1], i1[2]) * (1 - f[0]) + at(i1[0], i1[1], i1[2]) * f[0];
    const c0 = c00 * (1 - f[1]) + c10 * f[1];
    const c1 = c01 * (1 - f[1]) + c11 * f[1];
    return c0 * (1 - f[2]) + c1 * f[2];
  });
}

export function lutMixPixel(rgb: readonly number[], atlas: LutAtlas, intensity: number): number[] {
  const looked = lutPixel(rgb, atlas);
  return looked.map((v, c) => rgb[c] + (v - rgb[c]) * intensity);
}

export function applyLutPixels(data: Uint8ClampedArray, atlas: LutAtlas, intensity: number): void {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const [r, g, b] = lutMixPixel([data[i] / 255, data[i + 1] / 255, data[i + 2] / 255], atlas, intensity);
    data[i] = Math.round(r * 255);
    data[i + 1] = Math.round(g * 255);
    data[i + 2] = Math.round(b * 255);
  }
}

export const LUT_WARNING = { color: [1, 0, 0.8] as Triple, bandPx: 12, strength: 0.6 } as const;

export function lutWarningWeight(x: number, y: number): number {
  return Math.floor((x + y) / LUT_WARNING.bandPx) % 2 === 0 ? LUT_WARNING.strength : 0;
}

export function applyLutWarningPixels(data: Uint8ClampedArray, width: number): void {
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha === 0) continue;
    const pixel = i / 4;
    const weight = lutWarningWeight(pixel % width, Math.floor(pixel / width));
    if (weight === 0) continue;
    for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] + (LUT_WARNING.color[c] * alpha - data[i + c]) * weight);
  }
}

export function cubeText(size: number, color: (r: number, g: number, b: number) => Triple, title = "Vozko"): string {
  const lines = [`TITLE "${title}"`, `LUT_3D_SIZE ${size}`];
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) lines.push(color(r / (size - 1), g / (size - 1), b / (size - 1)).map((v) => v.toFixed(6)).join(" "));
    }
  }
  return `${lines.join("\n")}\n`;
}
