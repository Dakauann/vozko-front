import { ARTBOARD_GAP, updateArtboard } from "./artboards";
import type { Artboard, ImageDocument } from "./document";

export const ARRANGE_LAYOUTS = ["row", "column", "grid"] as const;
export const ARRANGE_ORDERS = ["position", "name", "given"] as const;
export const ARRANGE_ALIGNS = ["start", "center", "end"] as const;
export const MAX_ARRANGE_GAP = 10_000;

export type ArrangeLayout = (typeof ARRANGE_LAYOUTS)[number];
export type ArrangeOrder = (typeof ARRANGE_ORDERS)[number];
export type ArrangeAlign = (typeof ARRANGE_ALIGNS)[number];
export type ArrangeIssue = "too_few" | "unknown" | "gap" | "columns";

export interface ArrangeOptions {
  layout: ArrangeLayout;
  gap?: number;
  order?: ArrangeOrder;
  align?: ArrangeAlign;
  columns?: number;
  bySize?: boolean;
}

interface Place {
  id: string;
  x: number;
  y: number;
}

interface Block {
  places: Place[];
  width: number;
  height: number;
}

const names = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

export function arrangeIssue(doc: ImageDocument, ids: readonly string[], options: ArrangeOptions): ArrangeIssue | null {
  const wanted = unique(ids);
  if (wanted.some((id) => !doc.artboards.some((a) => a.id === id))) return "unknown";
  if (wanted.length < 2) return "too_few";
  if (options.gap !== undefined && !(Number.isFinite(options.gap) && options.gap >= 0 && options.gap <= MAX_ARRANGE_GAP)) return "gap";
  if (options.columns !== undefined && !(Number.isInteger(options.columns) && options.columns >= 1)) return "columns";
  return null;
}

export function arrangeTargets(doc: ImageDocument, selection: readonly string[]): string[] {
  const wanted = new Set(selection);
  const picked = doc.artboards.filter((a) => wanted.has(a.id)).map((a) => a.id);
  return picked.length >= 2 ? picked : doc.artboards.map((a) => a.id);
}

function overlapsBand(a: Artboard, band: Artboard): boolean {
  return a.y < band.y + band.canvas.height && a.y + a.canvas.height > band.y;
}

function bandsOf(boards: readonly Artboard[]): Artboard[][] {
  const bands: Artboard[][] = [];
  for (const board of [...boards].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const band = bands.at(-1);
    if (band && overlapsBand(board, band[0])) band.push(board);
    else bands.push([board]);
  }
  return bands.map((band) => band.sort((a, b) => a.x - b.x || a.y - b.y));
}

function readingOrder(boards: readonly Artboard[]): Artboard[] {
  return bandsOf(boards).flat();
}

export function tidyArrangement(doc: ImageDocument, ids: readonly string[]): ArrangeOptions {
  const boards = doc.artboards.filter((a) => ids.includes(a.id));
  return { layout: "grid", order: "position", columns: Math.max(1, ...bandsOf(boards).map((band) => band.length)) };
}

function byName(boards: readonly Artboard[]): Artboard[] {
  const named = boards.filter((a) => a.name);
  const unnamed = boards.filter((a) => !a.name);
  return [...[...named].sort((a, b) => names.compare(a.name!, b.name!)), ...unnamed];
}

function ordered(boards: readonly Artboard[], options: ArrangeOptions): Artboard[] {
  switch (options.order ?? "position") {
    case "given":
      return [...boards];
    case "name":
      return byName(boards);
    case "position":
      if (options.layout === "row") return [...boards].sort((a, b) => a.x - b.x || a.y - b.y);
      if (options.layout === "column") return [...boards].sort((a, b) => a.y - b.y || a.x - b.x);
      return readingOrder(boards);
  }
}

function sizeGroups(boards: readonly Artboard[]): Artboard[][] {
  const groups = new Map<string, Artboard[]>();
  for (const board of boards) {
    const key = `${board.canvas.width}x${board.canvas.height}`;
    groups.set(key, [...(groups.get(key) ?? []), board]);
  }
  return [...groups.values()];
}

function offset(space: number, size: number, align: ArrangeAlign): number {
  if (align === "center") return Math.round((space - size) / 2);
  return align === "end" ? space - size : 0;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function lineBlock(boards: readonly Artboard[], gap: number, align: ArrangeAlign, across: boolean): Block {
  const depth = Math.max(...boards.map((a) => (across ? a.canvas.height : a.canvas.width)));
  let cursor = 0;
  const places = boards.map((a) => {
    const along = cursor;
    cursor += (across ? a.canvas.width : a.canvas.height) + gap;
    const side = offset(depth, across ? a.canvas.height : a.canvas.width, align);
    return across ? { id: a.id, x: along, y: side } : { id: a.id, x: side, y: along };
  });
  const length = cursor - gap;
  return across ? { places, width: length, height: depth } : { places, width: depth, height: length };
}

function gridBlock(boards: readonly Artboard[], gap: number, align: ArrangeAlign, columns: number | undefined): Block {
  const count = Math.min(Math.max(columns ?? Math.ceil(Math.sqrt(boards.length)), 1), boards.length);
  const rows = Array.from({ length: Math.ceil(boards.length / count) }, (_, r) => boards.slice(r * count, r * count + count));
  const widths = Array.from({ length: count }, (_, c) => Math.max(...rows.flatMap((row) => (row[c] ? [row[c].canvas.width] : []))));
  const heights = rows.map((row) => Math.max(...row.map((a) => a.canvas.height)));
  const places = rows.flatMap((row, r) =>
    row.map((a, c) => ({ id: a.id, x: sum(widths.slice(0, c)) + gap * c, y: sum(heights.slice(0, r)) + gap * r + offset(heights[r], a.canvas.height, align) })),
  );
  return { places, width: sum(widths) + gap * (count - 1), height: sum(heights) + gap * (rows.length - 1) };
}

function block(boards: readonly Artboard[], options: ArrangeOptions, gap: number): Block {
  const align = options.align ?? "start";
  if (options.layout === "grid") return gridBlock(boards, gap, align, options.columns);
  return lineBlock(boards, gap, align, options.layout === "row");
}

function stacked(blocks: readonly Block[], gap: number, sideways: boolean): Place[] {
  let cursor = 0;
  return blocks.flatMap((b) => {
    const at = cursor;
    cursor += (sideways ? b.width : b.height) + gap;
    return b.places.map((p) => (sideways ? { ...p, x: p.x + at } : { ...p, y: p.y + at }));
  });
}

export function arrangeArtboards(doc: ImageDocument, ids: readonly string[], options: ArrangeOptions): ImageDocument {
  if (arrangeIssue(doc, ids, options)) return doc;
  const wanted = unique(ids);
  const boards = wanted.map((id) => doc.artboards.find((a) => a.id === id)!);
  const gap = options.gap ?? ARTBOARD_GAP;
  const sequence = ordered(boards, options);
  const blocks = (options.bySize ? sizeGroups(sequence) : [sequence]).map((group) => block(group, options, gap));
  const left = Math.min(...boards.map((a) => a.x));
  const top = Math.min(...boards.map((a) => a.y));
  return stacked(blocks, gap, options.layout === "column").reduce((current, place) => {
    const board = current.artboards.find((a) => a.id === place.id)!;
    const x = left + place.x;
    const y = top + place.y;
    return board.x === x && board.y === y ? current : updateArtboard(current, place.id, { x, y });
  }, doc);
}
