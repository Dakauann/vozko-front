import type { CellGrid } from "./data-grid";
import type { Layer, TextAlign } from "./document";
import { STUDIO_LIMITS } from "./document";
import { DEFAULT_FONT_ID, isFontId, type FontId } from "./fonts";
import { baseRunStyle, retextRuns, styleRuns, textRunsIssue, type RunStylePatch, type TextRange, type TextRun } from "./text-runs";
import { runes } from "./tokens";
import type { IssueCode } from "./validate";

export const TABLE_ALIGNS = ["left", "center", "right"] as const satisfies readonly TextAlign[];

export const TABLE_BORDERS = ["all", "rows", "outer", "none"] as const;

export type TableBorders = (typeof TABLE_BORDERS)[number];

export const TABLE_LIMITS = {
  fontSize: [0.01, 0.3],
  lineHeight: [0.8, 3],
  borderWidth: [0, 0.05],
  padding: [0, 3],
  width: [0.01, 100],
  weight: [100, 900],
} as const;

export interface TableCell {
  text: string;
  runs?: TextRun[];
}

export interface TableColumn {
  width: number;
  align: TextAlign;
}

export interface TableStyle {
  fontId: FontId;
  fontSize: number;
  lineHeight: number;
  weight: number;
  textColor: string;
  fill: string;
  headerFill: string;
  headerText: string;
  headerWeight: number;
  banding: boolean;
  bandFill: string;
  borders: TableBorders;
  borderColor: string;
  borderWidth: number;
  padding: number;
}

export interface TableSpec {
  columns: TableColumn[];
  rows: TableCell[][];
  header: boolean;
  style: TableStyle;
}

export type TableGrid = CellGrid;

interface TableInk {
  text: string;
  line: string;
  band: string;
  header: string;
  headerText: string;
}

const TABLE_LAYER_FIELDS: readonly string[] = ["id", "type", "name", "transform", "hidden", "locked", "groupId", "table", "layoutItem"];

const TRANSPARENT = "#00000000";
const HEX = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

export function isTableBorders(value: unknown): value is TableBorders {
  return typeof value === "string" && (TABLE_BORDERS as readonly string[]).includes(value);
}

export function isTableAlign(value: unknown): value is TextAlign {
  return typeof value === "string" && (TABLE_ALIGNS as readonly string[]).includes(value);
}

export function tableInk(ink: string): TableInk {
  const solid = ink.slice(0, 7);
  return { text: solid, line: `${solid}40`, band: `${solid}0f`, header: solid, headerText: solid.toLowerCase() === "#ffffff" ? "#111111" : "#ffffff" };
}

function newTableStyle(ink: TableInk): TableStyle {
  return {
    fontId: DEFAULT_FONT_ID,
    fontSize: 0.06,
    lineHeight: 1.25,
    weight: 400,
    textColor: ink.text,
    fill: TRANSPARENT,
    headerFill: ink.header,
    headerText: ink.headerText,
    headerWeight: 700,
    banding: true,
    bandFill: ink.band,
    borders: "rows",
    borderColor: ink.line,
    borderWidth: 0.004,
    padding: 0.6,
  };
}

function cellsOf(grid: TableGrid): TableCell[][] {
  const width = Math.max(1, ...grid.map((row) => row.length));
  return grid.map((row) => Array.from({ length: width }, (_, c) => ({ text: row[c] ?? "" })));
}

export function newTableSpec(grid: TableGrid, ink: TableInk, header: boolean = true): TableSpec {
  const rows = cellsOf(grid.length > 0 ? grid : [[""]]);
  return { columns: rows[0].map(() => ({ width: 1, align: "left" as const })), rows, header, style: newTableStyle(ink) };
}

export function gridOfTable(spec: Pick<TableSpec, "rows">): TableGrid {
  return spec.rows.map((row) => row.map((cell) => cell.text));
}

function cellAfter(before: TableCell | undefined, text: string): TableCell {
  if (!before || before.text !== text || !before.runs || before.runs.length === 0) return { text };
  return { text, runs: before.runs };
}

export function withGrid(spec: TableSpec, grid: TableGrid): TableSpec {
  const width = Math.max(1, ...grid.map((row) => row.length));
  const rows = (grid.length > 0 ? grid : [[""]]).map((row, r) => Array.from({ length: width }, (_, c) => cellAfter(spec.rows[r]?.[c], row[c] ?? "")));
  const columns = Array.from({ length: width }, (_, c) => spec.columns[c] ?? { width: 1, align: "left" as const });
  return { ...spec, rows, columns };
}

export function withCell(spec: TableSpec, row: number, column: number, cell: TableCell): TableSpec {
  return { ...spec, rows: spec.rows.map((line, r) => (r === row ? line.map((entry, c) => (c === column ? cell : entry)) : line)) };
}

export function columnShares(columns: readonly TableColumn[]): number[] {
  const total = columns.reduce((sum, column) => sum + column.width, 0);
  return columns.map((column) => (total > 0 ? column.width / total : 1 / columns.length));
}

function within(value: unknown, [low, high]: readonly [number, number]): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= low && value <= high;
}

function colorValid(value: unknown): boolean {
  return typeof value === "string" && HEX.test(value);
}

function weightValid(value: unknown): boolean {
  return within(value, TABLE_LIMITS.weight) && Number.isInteger(value) && (value as number) % 100 === 0;
}

function textValid(text: unknown): boolean {
  if (typeof text !== "string" || runes(text) > STUDIO_LIMITS.maxTextRunes) return false;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if ((code < 0x20 && char !== "\n") || (code >= 0x7f && code <= 0x9f)) return false;
  }
  return true;
}

function cellIssue(cell: TableCell): IssueCode | null {
  if (!cell || !textValid(cell.text)) return "invalid";
  const runs = cell.runs ?? [];
  if (runs.some((run) => run.fontSize !== undefined && run.fontSize !== 0)) return "invalid";
  return textRunsIssue({ type: "text", runs }, runes(cell.text));
}

function styleIssue(style: TableStyle): IssueCode | null {
  if (!isFontId(style.fontId)) return "unknown";
  if (!isTableBorders(style.borders)) return "unknown";
  if (![style.textColor, style.fill, style.headerFill, style.headerText, style.bandFill, style.borderColor].every(colorValid)) return "invalid";
  if (!weightValid(style.weight) || !weightValid(style.headerWeight)) return "out_of_range";
  const ranged = within(style.fontSize, TABLE_LIMITS.fontSize) && within(style.lineHeight, TABLE_LIMITS.lineHeight) && within(style.borderWidth, TABLE_LIMITS.borderWidth) && within(style.padding, TABLE_LIMITS.padding);
  return ranged ? null : "out_of_range";
}

export function tableIssue(spec: TableSpec | undefined): IssueCode | null {
  if (!spec) return "required";
  if (spec.columns.length === 0 || spec.rows.length === 0) return "required";
  for (const column of spec.columns) {
    if (!isTableAlign(column.align)) return "unknown";
    if (!within(column.width, TABLE_LIMITS.width)) return "out_of_range";
  }
  for (const row of spec.rows) {
    if (row.length !== spec.columns.length) return "invalid";
    for (const cell of row) {
      const code = cellIssue(cell);
      if (code) return code;
    }
  }
  return styleIssue(spec.style);
}

function isZero(value: unknown): boolean {
  return value === undefined || value === "" || value === false || value === 0 || (Array.isArray(value) && value.length === 0);
}

export function tableLayerIssue(layer: Layer): IssueCode | null {
  if (Object.entries(layer).some(([key, value]) => !TABLE_LAYER_FIELDS.includes(key) && !isZero(value))) return "invalid";
  return tableIssue(layer.table);
}

export function cellLayer(spec: TableSpec, row: number, cell: TableCell): Layer {
  const header = spec.header && row === 0;
  return {
    id: "cell",
    type: "text",
    transform: { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 },
    text: cell.text,
    ...(cell.runs && cell.runs.length > 0 ? { runs: cell.runs } : {}),
    fontId: spec.style.fontId,
    fontWeight: header ? spec.style.headerWeight : spec.style.weight,
    fill: header ? spec.style.headerText : spec.style.textColor,
    fontSize: spec.style.fontSize,
  };
}

export function retextedCell(spec: TableSpec, row: number, cell: TableCell, text: string): TableCell {
  const runs = cell.runs && cell.runs.length > 0 ? retextRuns(cell.runs, cell.text, text, baseRunStyle(cellLayer(spec, row, cell))) : [];
  return runs.length > 0 ? { text, runs } : { text };
}

export function styledCell(spec: TableSpec, row: number, cell: TableCell, range: TextRange | null, patch: RunStylePatch): TableCell {
  const length = runes(cell.text);
  if (length === 0) return cell;
  const runs = styleRuns(cell.runs ?? [], length, baseRunStyle(cellLayer(spec, row, cell)), range ?? { start: 0, end: length }, patch);
  return runs.length > 0 ? { text: cell.text, runs } : { text: cell.text };
}
