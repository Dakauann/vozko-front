import type { VideoDocument } from "../document";
import { clipEnd } from "../timeline";

export const DEFAULT_LOOK_FRAMES = 6;
export const MAX_LOOK_FRAMES = 9;
export const SHEET_LONG_EDGE = 1536;
const MIN_GAP_MS = 100;
const EMPTY_CELL_PENALTY = 0.5;

export interface LookRequest {
  times_ms?: number[];
  count?: number;
}

function cutPoints(doc: VideoDocument): number[] {
  const points = new Set<number>([0, doc.durationMs]);
  for (const track of doc.tracks) {
    if (track.kind !== "visual" || track.hidden) continue;
    for (const clip of track.clips) {
      if (clip.disabled) continue;
      points.add(clip.startMs);
      points.add(clipEnd(clip));
    }
  }
  return [...points].filter((p) => p >= 0 && p <= doc.durationMs).sort((a, b) => a - b);
}

function spread<T>(items: readonly T[], count: number): T[] {
  if (items.length <= count) return [...items];
  return Array.from({ length: count }, (_, i) => items[Math.round((i * (items.length - 1)) / Math.max(1, count - 1))]);
}

function inside(ms: number, durationMs: number): number {
  return Math.max(0, Math.min(Math.round(ms), Math.max(0, durationMs - 1)));
}

export function lookTimes(doc: VideoDocument, request: LookRequest): number[] {
  if (request.times_ms && request.times_ms.length > 0) {
    return [...new Set(request.times_ms.slice(0, MAX_LOOK_FRAMES).map((ms) => inside(ms, doc.durationMs)))].sort((a, b) => a - b);
  }
  const count = request.count && request.count > 0 ? Math.min(request.count, MAX_LOOK_FRAMES) : DEFAULT_LOOK_FRAMES;
  if (doc.durationMs <= 0) return [0];
  const cuts = cutPoints(doc);
  const middles: number[] = [];
  for (let i = 1; i < cuts.length; i++) {
    if (cuts[i] - cuts[i - 1] >= MIN_GAP_MS) middles.push(Math.round((cuts[i - 1] + cuts[i]) / 2));
  }
  const chosen = spread(middles, count);
  for (let i = 0; chosen.length < count && i < count * 4; i++) {
    const candidate = inside(((i % count) + 0.5) * (doc.durationMs / count) + Math.floor(i / count) * MIN_GAP_MS, doc.durationMs);
    if (chosen.every((t) => Math.abs(t - candidate) >= MIN_GAP_MS)) chosen.push(candidate);
  }
  return chosen.sort((a, b) => a - b);
}

export interface SheetLayout {
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  width: number;
  height: number;
}

export function sheetLayout(count: number, frameAspect: number, longEdge: number = SHEET_LONG_EDGE): SheetLayout {
  const n = Math.max(1, count);
  const score = (cols: number) => {
    const rows = Math.ceil(n / cols);
    return Math.abs(Math.log((cols * frameAspect) / rows)) + (EMPTY_CELL_PENALTY * (cols * rows - n)) / n;
  };
  let best = 1;
  for (let cols = 2; cols <= n; cols++) if (score(cols) < score(best)) best = cols;
  const cols = best;
  const rows = Math.ceil(n / cols);
  const cellWidth = Math.floor(longEdge / Math.max(cols, rows / frameAspect));
  const cellHeight = Math.floor(cellWidth / frameAspect);
  return { cols, rows, cellWidth, cellHeight, width: cols * cellWidth, height: rows * cellHeight };
}

export interface SheetCell {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RowSheet {
  width: number;
  height: number;
  cells: SheetCell[];
}

function rowsAt(aspects: readonly number[], height: number, longEdge: number, gap: number): SheetCell[] {
  const cells: SheetCell[] = [];
  let x = 0;
  let y = 0;
  for (const aspect of aspects) {
    const width = Math.max(1, Math.round(height * aspect));
    if (x > 0 && x + width > longEdge) {
      x = 0;
      y += height + gap;
    }
    cells.push({ x, y, width, height });
    x += width + gap;
  }
  return cells;
}

const MIN_ROW_PX = 16;

export function rowSheet(aspects: readonly number[], longEdge: number = SHEET_LONG_EDGE, gap = 0): RowSheet {
  const at = (height: number): RowSheet => {
    const cells = rowsAt(aspects, height, longEdge, gap);
    return { width: Math.max(...cells.map((c) => c.x + c.width)), height: Math.max(...cells.map((c) => c.y + c.height)), cells };
  };
  const fits = (sheet: RowSheet) => sheet.width <= longEdge && sheet.height <= longEdge;
  let low = MIN_ROW_PX;
  let high = longEdge;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (fits(at(middle))) low = middle;
    else high = middle - 1;
  }
  return at(low);
}

export function timecode(ms: number): string {
  const tenths = Math.floor(Math.max(0, ms) / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = Math.floor((tenths % 600) / 10);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths % 10}`;
}
