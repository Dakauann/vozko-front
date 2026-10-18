import { parseColor } from "./color";
import { BLEND_MODES, type BlendMode } from "./document";
import type { IssueCode } from "./validate";

const PATTERN_SOURCES = ["preset", "asset"] as const;

export type PatternSource = (typeof PATTERN_SOURCES)[number];

export const PATTERN_PRESETS = ["dots", "grid-lines", "stripes", "diagonal", "checker", "cross", "zigzag", "waves", "triangles", "hexagons", "confetti", "plus"] as const;

export type PatternPreset = (typeof PATTERN_PRESETS)[number];

export const PATTERN_TILES = ["grid", "brick-row", "brick-column", "hex-row", "hex-column"] as const;

export type PatternTile = (typeof PATTERN_TILES)[number];

export interface PatternPoint {
  x: number;
  y: number;
}

export interface Pattern {
  source: PatternSource;
  presetId?: PatternPreset | "";
  assetId?: string;
  color?: string;
  background?: string;
  tile?: PatternTile | "";
  size: number;
  spacing?: PatternPoint;
  offset?: number;
  angle?: number;
  origin?: PatternPoint;
  opacity: number;
  blendMode?: BlendMode | "";
}

export const PATTERN_RANGES = {
  size: [2, 4096],
  maxSpacing: 2048,
  maxOverlap: 0.9,
  offset: [0, 1],
  angle: [-180, 180],
  origin: [0, 1],
  opacity: [0, 1],
} as const;

export const DEFAULT_PATTERN: Pattern = { source: "preset", presetId: "dots", color: "#111111", background: "", tile: "grid", size: 32, opacity: 1 };

export const BRICK_OFFSET = 0.5;

const HEX_ROW_PITCH = Math.sqrt(3) / 2;

const BRICK_TILES = new Set<string>(["brick-row", "brick-column"]);
const TILE_VALUES = new Set<string>(["", ...PATTERN_TILES]);
const BLEND_VALUES = new Set<string>(["", ...BLEND_MODES]);

function within(value: number, lo: number, hi: number): boolean {
  return Number.isFinite(value) && value >= lo && value <= hi;
}

function colorValid(value: string | undefined, required: boolean): boolean {
  if (!value) return !required;
  return parseColor(value) !== null;
}

export function isBrickTile(tile: Pattern["tile"]): boolean {
  return BRICK_TILES.has(tile ?? "");
}

function sourceIssue(p: Pattern): IssueCode | null {
  if (p.source === "preset") {
    if (!(PATTERN_PRESETS as readonly string[]).includes(p.presetId ?? "")) return "unknown";
    if ((p.assetId ?? "") !== "") return "invalid";
    return colorValid(p.color, true) && colorValid(p.background, false) ? null : "invalid";
  }
  if (p.source === "asset") {
    if ((p.assetId ?? "").trim() === "" || (p.presetId ?? "") !== "") return "invalid";
    return (p.color ?? "") === "" && (p.background ?? "") === "" ? null : "invalid";
  }
  return "unknown";
}

function spacingFits(size: number, gap: number): boolean {
  return within(gap, -PATTERN_RANGES.maxOverlap * size, PATTERN_RANGES.maxSpacing) && size + gap >= 1;
}

export function patternIssue(p: Pattern): IssueCode | null {
  const source = sourceIssue(p);
  if (source) return source;
  if (!TILE_VALUES.has(p.tile ?? "") || !BLEND_VALUES.has(p.blendMode ?? "")) return "unknown";
  if (!within(p.size, ...PATTERN_RANGES.size)) return "out_of_range";
  const spacing = p.spacing ?? { x: 0, y: 0 };
  if (!spacingFits(p.size, spacing.x) || !spacingFits(p.size, spacing.y)) return "out_of_range";
  const offset = p.offset ?? 0;
  if (!within(offset, ...PATTERN_RANGES.offset)) return "out_of_range";
  if (offset !== 0 && !isBrickTile(p.tile)) return "invalid";
  const origin = p.origin ?? { x: 0, y: 0 };
  if (!within(origin.x, ...PATTERN_RANGES.origin) || !within(origin.y, ...PATTERN_RANGES.origin)) return "out_of_range";
  if (!within(p.angle ?? 0, ...PATTERN_RANGES.angle) || !within(p.opacity, ...PATTERN_RANGES.opacity)) return "out_of_range";
  return null;
}

interface TileSize {
  width: number;
  height: number;
}

export function patternTileSize(p: Pattern, natural: TileSize | null): TileSize {
  if (p.source !== "asset" || !natural || natural.width <= 0) return { width: p.size, height: p.size };
  return { width: p.size, height: (p.size * natural.height) / natural.width };
}

interface PatternLayout {
  width: number;
  height: number;
  pitchX: number;
  pitchY: number;
  placements: PatternPoint[];
}

function basePlacements(p: Pattern, pitchX: number, pitchY: number): { width: number; height: number; pitchY: number; pitchX: number; base: PatternPoint[] } {
  switch (p.tile) {
    case "brick-row":
      return { width: pitchX, height: 2 * pitchY, pitchX, pitchY, base: [{ x: 0, y: 0 }, { x: (p.offset ?? 0) * pitchX, y: pitchY }] };
    case "brick-column":
      return { width: 2 * pitchX, height: pitchY, pitchX, pitchY, base: [{ x: 0, y: 0 }, { x: pitchX, y: (p.offset ?? 0) * pitchY }] };
    case "hex-row": {
      const row = pitchY * HEX_ROW_PITCH;
      return { width: pitchX, height: 2 * row, pitchX, pitchY: row, base: [{ x: 0, y: 0 }, { x: BRICK_OFFSET * pitchX, y: row }] };
    }
    case "hex-column": {
      const column = pitchX * HEX_ROW_PITCH;
      return { width: 2 * column, height: pitchY, pitchX: column, pitchY, base: [{ x: 0, y: 0 }, { x: column, y: BRICK_OFFSET * pitchY }] };
    }
  }
  return { width: pitchX, height: pitchY, pitchX, pitchY, base: [{ x: 0, y: 0 }] };
}

export function patternLayout(p: Pattern, tileWidth: number, tileHeight: number): PatternLayout {
  const spacing = p.spacing ?? { x: 0, y: 0 };
  const { width, height, pitchX, pitchY, base } = basePlacements(p, tileWidth + spacing.x, tileHeight + spacing.y);
  const seen = new Set<string>();
  const placements: PatternPoint[] = [];
  const reachX = Math.ceil(tileWidth / width) + 1;
  const reachY = Math.ceil(tileHeight / height) + 1;
  for (const point of base) {
    for (let i = -reachX; i <= reachX; i++) {
      for (let j = -reachY; j <= reachY; j++) {
        const x = point.x + i * width;
        const y = point.y + j * height;
        const key = `${x}:${y}`;
        if (seen.has(key) || x + tileWidth <= 0 || x >= width || y + tileHeight <= 0 || y >= height) continue;
        seen.add(key);
        placements.push({ x, y });
      }
    }
  }
  return { width, height, pitchX, pitchY, placements };
}

interface PatternPlacement {
  x: number;
  y: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
}

export function patternPlacement(p: Pattern, layout: PatternLayout, box: TileSize, tile: TileSize): PatternPlacement {
  const origin = p.origin ?? { x: 0, y: 0 };
  return {
    x: box.width / 2,
    y: box.height / 2,
    rotation: p.angle ?? 0,
    offsetX: tile.width / 2 - origin.x * layout.pitchX,
    offsetY: tile.height / 2 - origin.y * layout.pitchY,
  };
}

export interface TileContext {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  fillRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, radius: number, start: number, end: number): void;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void;
  closePath(): void;
  fill(): void;
  stroke(): void;
}

const CONFETTI: readonly [number, number, number][] = [
  [0.12, 0.18, 0.07],
  [0.62, 0.1, 0.05],
  [0.38, 0.46, 0.06],
  [0.84, 0.52, 0.07],
  [0.2, 0.78, 0.05],
  [0.66, 0.84, 0.06],
];

function polygon(ctx: TileContext, points: readonly (readonly [number, number])[], s: number): void {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x * s, y * s) : ctx.lineTo(x * s, y * s)));
  ctx.closePath();
}

function line(ctx: TileContext, s: number, width: number, points: readonly (readonly [number, number])[]): void {
  ctx.lineWidth = width * s;
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x * s, y * s) : ctx.lineTo(x * s, y * s)));
  ctx.stroke();
}

const PAINTERS: Record<PatternPreset, (ctx: TileContext, s: number) => void> = {
  dots: (ctx, s) => {
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 4, 0, Math.PI * 2);
    ctx.fill();
  },
  "grid-lines": (ctx, s) => {
    ctx.fillRect(0, 0, s, s * 0.08);
    ctx.fillRect(0, 0, s * 0.08, s);
  },
  stripes: (ctx, s) => ctx.fillRect(0, 0, s, s / 2),
  diagonal: (ctx, s) => {
    ctx.lineCap = "square";
    for (const shift of [-1, 0, 1]) line(ctx, s, 0.25, [[shift, 1], [shift + 1, 0]]);
  },
  checker: (ctx, s) => {
    ctx.fillRect(0, 0, s / 2, s / 2);
    ctx.fillRect(s / 2, s / 2, s / 2, s / 2);
  },
  cross: (ctx, s) => {
    ctx.lineCap = "square";
    line(ctx, s, 0.1, [[0, 0], [1, 1]]);
    line(ctx, s, 0.1, [[1, 0], [0, 1]]);
  },
  zigzag: (ctx, s) => {
    ctx.lineJoin = "miter";
    line(ctx, s, 0.15, [[0, 0.75], [0.5, 0.25], [1, 0.75]]);
  },
  waves: (ctx, s) => {
    ctx.lineWidth = s * 0.12;
    ctx.beginPath();
    ctx.moveTo(0, s / 2);
    ctx.quadraticCurveTo(s * 0.25, s * 0.15, s / 2, s / 2);
    ctx.quadraticCurveTo(s * 0.75, s * 0.85, s, s / 2);
    ctx.stroke();
  },
  triangles: (ctx, s) => {
    polygon(ctx, [[0.5, 0.2], [0.85, 0.8], [0.15, 0.8]], s);
    ctx.fill();
  },
  hexagons: (ctx, s) => {
    ctx.lineWidth = s * 0.08;
    polygon(ctx, Array.from({ length: 6 }, (_, i) => [0.5 + 0.4 * Math.cos((Math.PI / 3) * i), 0.5 + 0.4 * Math.sin((Math.PI / 3) * i)] as const), s);
    ctx.stroke();
  },
  confetti: (ctx, s) => {
    for (const [x, y, r] of CONFETTI) {
      ctx.beginPath();
      ctx.arc(x * s, y * s, r * s, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  plus: (ctx, s) => {
    ctx.fillRect(s * 0.4, s * 0.2, s * 0.2, s * 0.6);
    ctx.fillRect(s * 0.2, s * 0.4, s * 0.6, s * 0.2);
  },
};

export function drawPresetTile(ctx: TileContext, preset: PatternPreset, size: number, color: string, background: string): void {
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, size, size);
  }
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  PAINTERS[preset](ctx, size);
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(Math.max(value, lo), hi);
}

export function scaledPattern(p: Pattern, fit: number): Pattern {
  const size = clamp(p.size * fit, ...PATTERN_RANGES.size);
  const gap = (value: number) => clamp(value * fit, -PATTERN_RANGES.maxOverlap * size, PATTERN_RANGES.maxSpacing);
  return { ...p, size, ...(p.spacing ? { spacing: { x: gap(p.spacing.x), y: gap(p.spacing.y) } } : {}) };
}
