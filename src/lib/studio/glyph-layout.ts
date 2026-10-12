import type { CounterToken } from "./counter";
import type { Layer, TextAlign, Transform } from "./document";
import { basePath, sampleAt, type BasePath } from "./line-geometry";
import { pathToSubpaths } from "./path-nodes";
import { textUnitFrames, type LaidChar, type TextMotion, type Tile, type UnitFrame, type UnitLook } from "./text-animation";
import { turned3d } from "./perspective";
import type { TextPathAlign } from "./text-path";

export const SHEET_ROW_PX = 2048;

const PATH_STEP_PX = 2;
const LINE_SLACK_PX = 1;
const PATH_CACHE_LIMIT = 32;
const DEGREES = 180 / Math.PI;
const ALIGN_SHARE: Record<TextPathAlign, number> = { start: 0, center: 0.5, end: 1 };
const paths = new Map<string, BasePath | null>();

export interface MeasuredCell {
  text: string;
  advance: number;
  chars: LaidChar[];
  paint?: Partial<Layer>;
  dropPx?: number;
}

export interface SheetCell extends MeasuredCell {
  x: number;
  y: number;
  width: number;
  height: number;
  penX: number;
  penY: number;
}

export interface GlyphSheet {
  width: number;
  height: number;
  lineHeightPx: number;
  padPx: number;
  cells: SheetCell[];
  backdrop?: Tile;
}

export type GlyphContent = { kind: "counter"; tokens: readonly CounterToken[]; slotCells: readonly number[] } | { kind: "text"; cells: readonly number[] };

export interface GlyphPathRun {
  data: string;
  offset: number;
  align: TextPathAlign;
  upright: boolean;
  reverse: boolean;
}

export interface GlyphRun {
  box: Tile;
  align: TextAlign;
  content: GlyphContent;
  backdrop: boolean;
  path?: GlyphPathRun;
  motion?: TextMotion;
}

export interface TilePiece {
  tile: Tile;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  rotationX?: number;
  rotationY?: number;
  depth?: number;
  opacity: number;
  blurPx: number;
  tints?: readonly number[];
}

type PieceDepth = Pick<TilePiece, "rotationX" | "rotationY" | "depth">;

function pieceDepth(look: Pick<UnitLook, "rotationX" | "rotationY">, depth: number): PieceDepth {
  return { ...(look.rotationX ? { rotationX: look.rotationX } : {}), ...(look.rotationY ? { rotationY: look.rotationY } : {}), ...(depth ? { depth } : {}) };
}

interface StraightChar {
  char: string;
  left: number;
  right: number;
  tile: Tile | null;
  dest: Tile | null;
}

function blank(char: string): boolean {
  return /\s/.test(char);
}

export function measureCell(text: string, measure: (text: string) => number, letterSpacing: number): MeasuredCell {
  const letters = [...text];
  if (letterSpacing === 0) {
    const chars = letters.map((char, i) => {
      const left = measure(letters.slice(0, i).join(""));
      return { char, left, right: left + measure(char) };
    });
    return { text, advance: measure(text), chars };
  }
  let pen = 0;
  const chars = letters.map((char) => {
    const width = measure(char);
    const placed = { char, left: pen, right: pen + width };
    pen += width + letterSpacing;
    return placed;
  });
  return { text, advance: pen, chars };
}

export function sheetLayout(cells: readonly MeasuredCell[], lineHeightPx: number, padPx: number, backdrop?: { width: number; height: number }): GlyphSheet {
  const height = Math.ceil(lineHeightPx) + 2 * padPx;
  let x = 0;
  let y = 0;
  let widest = 0;
  const placed = cells.map((cell) => {
    const width = Math.ceil(cell.advance) + 2 * padPx;
    if (x > 0 && x + width > SHEET_ROW_PX) {
      x = 0;
      y += height;
    }
    const at: SheetCell = { ...cell, x, y, width, height, penX: padPx, penY: padPx };
    x += width;
    widest = Math.max(widest, x);
    return at;
  });
  const bottom = cells.length > 0 ? y + height : 0;
  const box = backdrop ? { x: 0, y: bottom, width: Math.ceil(backdrop.width) + 2 * padPx, height: Math.ceil(backdrop.height) + 2 * padPx } : undefined;
  return { width: Math.max(1, widest, box?.width ?? 0), height: Math.max(1, bottom + (box?.height ?? 0)), lineHeightPx, padPx, cells: placed, ...(box ? { backdrop: box } : {}) };
}

export function cellCharTiles(cell: SheetCell): (Tile | null)[] {
  const origin = cell.x + cell.penX;
  const visible = cell.chars.flatMap((char, index) => (blank(char.char) ? [] : [{ char, index }]));
  const tiles: (Tile | null)[] = cell.chars.map(() => null);
  visible.forEach(({ char, index }, k) => {
    const before = visible[k - 1];
    const after = visible[k + 1];
    const left = before ? origin + (before.char.right + char.left) / 2 : cell.x;
    const right = after ? origin + (char.right + after.char.left) / 2 : cell.x + cell.width;
    tiles[index] = { x: left, y: cell.y, width: right - left, height: cell.height };
  });
  return tiles;
}

function placeCell(cell: SheetCell, penLeft: number, lineTop: number): StraightChar[] {
  const tiles = cellCharTiles(cell);
  return cell.chars.map((char, i) => {
    const tile = tiles[i];
    const dest = tile ? { x: penLeft + tile.x - cell.x - cell.penX, y: lineTop + tile.y - cell.y - cell.penY, width: tile.width, height: tile.height } : null;
    return { char: char.char, left: penLeft + char.left, right: penLeft + char.right, tile, dest };
  });
}

interface Laid {
  chars: StraightChar[];
  width: number;
}

function laidCounter(sheet: GlyphSheet, content: Extract<GlyphContent, { kind: "counter" }>, lineTop: number): Laid {
  const slot = Math.max(0, ...content.slotCells.map((index) => sheet.cells[index]?.advance ?? 0));
  let pen = 0;
  const chars: StraightChar[] = [];
  for (const token of content.tokens) {
    const cell = sheet.cells[token.cell];
    if (!cell) continue;
    const advance = token.digit ? slot : cell.advance;
    chars.push(...placeCell(cell, pen + (advance - cell.advance) / 2, lineTop));
    pen += advance;
  }
  return { chars, width: pen };
}

function laidContent(sheet: GlyphSheet, content: GlyphContent, lineTop: number): Laid {
  if (content.kind === "counter") return laidCounter(sheet, content, lineTop);
  let pen = 0;
  const chars: StraightChar[] = [];
  for (const index of content.cells) {
    const cell = sheet.cells[index];
    if (!cell) continue;
    chars.push(...placeCell(cell, pen, lineTop));
    pen += cell.advance;
  }
  return { chars, width: pen };
}

function lineStart(align: TextAlign, boxWidth: number, width: number): number {
  if (align === "center") return (boxWidth - width) / 2;
  if (align === "right") return boxWidth - width;
  return 0;
}

function shifted(chars: readonly StraightChar[], dx: number): StraightChar[] {
  return chars.map((char) => ({ ...char, left: char.left + dx, right: char.right + dx, dest: char.dest ? { ...char.dest, x: char.dest.x + dx } : null }));
}

function unitFrames(motion: TextMotion, chars: readonly StraightChar[], lineTop: number, lineHeight: number, box: Tile, align: TextAlign): UnitFrame[] {
  const from = Math.min(0, ...chars.map((char) => char.left));
  const to = Math.max(box.width, ...chars.map((char) => char.right));
  const line = { top: lineTop, height: lineHeight, chars: chars.map(({ char, left, right }) => ({ char, left: left - from, right: right - from })) };
  return textUnitFrames(motion, [line], to - from, box.height, align).map((frame) => ({ ...frame, tile: { ...frame.tile, x: frame.tile.x + from } }));
}

function unitOf(frames: readonly UnitFrame[], center: number): UnitFrame | null {
  return frames.find((frame) => center < frame.tile.x + frame.tile.width) ?? frames[frames.length - 1] ?? null;
}

function looked(dest: Tile, frame: UnitFrame | null): { x: number; y: number; width: number; height: number; depth: PieceDepth; look: UnitLook | null } {
  const cx = dest.x + dest.width / 2;
  const cy = dest.y + dest.height / 2;
  if (!frame) return { x: cx, y: cy, width: dest.width, height: dest.height, depth: {}, look: null };
  const { tile, look } = frame;
  const ux = tile.x + tile.width / 2;
  const uy = tile.y + tile.height / 2;
  const angle = (look.rotation * Math.PI) / 180;
  const ox = (cx - ux) * look.scale;
  const oy = (cy - uy) * look.scale;
  const moved = turned3d({ x: look.rotationX, y: look.rotationY }, { x: ox * Math.cos(angle) - oy * Math.sin(angle), y: ox * Math.sin(angle) + oy * Math.cos(angle), z: 0 });
  return { x: ux + moved.x + look.dx, y: uy + moved.y + look.dy, width: dest.width * look.scale, height: dest.height * look.scale, depth: pieceDepth(look, look.depth + moved.z), look };
}

const PATH_ALIGN: Record<TextPathAlign, TextAlign> = { start: "left", center: "center", end: "right" };

export function cachedPath(data: string): BasePath | null {
  if (paths.has(data)) return paths.get(data)!;
  const first = pathToSubpaths(data)[0];
  const built = first ? basePath(first, PATH_STEP_PX) : null;
  if (paths.size >= PATH_CACHE_LIMIT) paths.delete(paths.keys().next().value!);
  paths.set(data, built);
  return built;
}

interface Placement {
  x: number;
  y: number;
  rotation: number;
  shown: boolean;
}

function onPath(base: BasePath | null, run: GlyphPathRun, along: number, across: number): Placement {
  if (!base) return { x: 0, y: 0, rotation: 0, shown: false };
  const length = base.length;
  if (!base.closed && (along < 0 || along > length)) return { x: 0, y: 0, rotation: 0, shown: false };
  const sample = sampleAt(base, run.reverse ? length - along : along);
  const turn = run.reverse ? -1 : 1;
  const nx = sample.nx * turn;
  const ny = sample.ny * turn;
  if (run.upright) return { x: sample.x, y: sample.y + across, rotation: 0, shown: true };
  return { x: sample.x + nx * across, y: sample.y + ny * across, rotation: Math.atan2(-nx, ny) * DEGREES, shown: true };
}

export function composeGlyphs(run: GlyphRun, sheet: GlyphSheet): TilePiece[] {
  const lineTop = (run.box.height - sheet.lineHeightPx) / 2;
  const laid = laidContent(sheet, run.content, lineTop);
  const chars = run.path ? laid.chars : shifted(laid.chars, lineStart(run.align, run.box.width, laid.width));
  const frames = run.motion ? unitFrames(run.motion, chars, lineTop, sheet.lineHeightPx, run.box, run.path ? PATH_ALIGN[run.path.align] : run.align) : [];
  const base = run.path ? cachedPath(run.path.data) : null;
  const start = run.path && base ? run.path.offset * base.length - ALIGN_SHARE[run.path.align] * laid.width : 0;
  const middle = lineTop + sheet.lineHeightPx / 2;
  const pieces: TilePiece[] = [];
  if (run.backdrop && sheet.backdrop && !run.path) {
    pieces.push({ tile: sheet.backdrop, x: run.box.x + run.box.width / 2, y: run.box.y + run.box.height / 2, width: sheet.backdrop.width, height: sheet.backdrop.height, rotation: 0, opacity: 1, blurPx: 0 });
  }
  for (const char of chars) {
    if (!char.tile || !char.dest) continue;
    const placed = looked(char.dest, run.motion ? unitOf(frames, (char.left + char.right) / 2) : null);
    const opacity = placed.look?.opacity ?? 1;
    const blurPx = placed.look?.blurPx ?? 0;
    const turn = placed.look?.rotation ?? 0;
    const tints = placed.look?.tints ? { tints: placed.look.tints } : {};
    if (!run.path) {
      pieces.push({ tile: char.tile, x: run.box.x + placed.x, y: run.box.y + placed.y, width: placed.width, height: placed.height, rotation: turn, ...placed.depth, opacity, blurPx, ...tints });
      continue;
    }
    const spot = onPath(base, run.path, start + placed.x, placed.y - middle);
    pieces.push({ tile: char.tile, x: run.box.x + spot.x, y: run.box.y + spot.y, width: placed.width, height: placed.height, rotation: spot.rotation + turn, ...placed.depth, opacity: spot.shown ? opacity : 0, blurPx, ...tints });
  }
  return pieces;
}

export function centerPieces(pieces: readonly TilePiece[], width: number, height: number): TilePiece[] {
  return pieces.map((piece) => ({ ...piece, x: piece.x - width / 2, y: piece.y - height / 2 }));
}

export function unitPieces(units: readonly UnitFrame[], width: number, height: number): TilePiece[] {
  return units.map(({ tile, look }) => ({
    tile,
    x: tile.x + tile.width / 2 - width / 2 + look.dx,
    y: tile.y + tile.height / 2 - height / 2 + look.dy,
    width: tile.width * look.scale,
    height: tile.height * look.scale,
    rotation: look.rotation,
    ...pieceDepth(look, look.depth),
    opacity: look.opacity,
    blurPx: look.blurPx,
    ...(look.tints ? { tints: look.tints } : {}),
  }));
}

export function sheetLayers(style: Layer, sheet: GlyphSheet, fontSizePx: number): Layer[] {
  const placed = (box: Tile): Transform => ({ x: (box.x + box.width / 2) / sheet.width, y: (box.y + box.height / 2) / sheet.height, w: box.width / sheet.width, h: box.height / sheet.height, rotation: 0, opacity: 1 });
  const backdrop = sheet.backdrop;
  const behind: Layer[] = backdrop
    ? [{ ...style, id: "glyph-backdrop", text: "", transform: placed({ x: backdrop.x + sheet.padPx, y: backdrop.y + sheet.padPx, width: backdrop.width - 2 * sheet.padPx, height: backdrop.height - 2 * sheet.padPx }) }]
    : [];
  const cells = sheet.cells.map((cell, index): Layer => ({
    ...style,
    ...cell.paint,
    id: `glyph-${index}`,
    text: cell.text,
    align: "left",
    curve: undefined,
    highlight: undefined,
    transform: placed({ x: cell.x + cell.penX, y: cell.y + cell.penY + (cell.dropPx ?? 0) - LINE_SLACK_PX, width: cell.advance + fontSizePx, height: sheet.lineHeightPx + 2 * LINE_SLACK_PX }),
  }));
  return [...behind, ...cells];
}
