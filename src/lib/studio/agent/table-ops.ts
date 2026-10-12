import { isFontId } from "../fonts";
import { cellLayer, gridOfTable, isTableAlign, isTableBorders, newTableSpec, retextedCell, tableInk, tableIssue, TABLE_ALIGNS, TABLE_BORDERS, withCell, withGrid, type TableCell, type TableColumn, type TableSpec, type TableStyle } from "../table";
import type { TextRun } from "../text-runs";
import { issueText } from "./layer-style";
import { runsOutline, styledText, type OutlineRun, type TextRunInput } from "./text-run-ops";

export const TABLE_OPERATIONS = ["add_table", "update_table"] as const;

export type TableOpName = (typeof TABLE_OPERATIONS)[number];

export interface AgentTableColumn {
  width?: number;
  align?: string;
}

export interface AgentTableStyle {
  font_id?: string;
  font_size?: number;
  line_height?: number;
  weight?: number;
  text_color?: string;
  fill?: string;
  header_fill?: string;
  header_text?: string;
  header_weight?: number;
  banding?: boolean;
  band_fill?: string;
  borders?: string;
  border_color?: string;
  border_width?: number;
  padding?: number;
}

export interface AgentTableFields {
  table_rows?: string[][];
  table_header?: boolean;
  table_columns?: AgentTableColumn[];
  table_style?: AgentTableStyle;
  table_row?: number;
  table_column?: number;
}

type Built<T> = { ok: true; value: T } | { ok: false; reason: string };

function refuse<T>(reason: string): Built<T> {
  return { ok: false, reason };
}

export function isTableOperation(op: string): op is TableOpName {
  return (TABLE_OPERATIONS as readonly string[]).includes(op);
}

function columnsOf(fields: AgentTableColumn[] | undefined, base: readonly TableColumn[]): Built<TableColumn[]> {
  if (!fields) return { ok: true, value: [...base] };
  if (fields.length > base.length) return refuse(`table_columns tem ${fields.length} colunas e a tabela tem ${base.length}; mande uma entrada por coluna, na ordem`);
  const bad = fields.find((column) => column.align !== undefined && !isTableAlign(column.align));
  if (bad) return refuse(`table_columns[].align precisa ser um de: ${TABLE_ALIGNS.join(", ")}`);
  return { ok: true, value: base.map((column, i) => ({ width: fields[i]?.width ?? column.width, align: (fields[i]?.align as TableColumn["align"] | undefined) ?? column.align })) };
}

function styleOf(fields: AgentTableStyle | undefined, base: TableStyle): Built<TableStyle> {
  if (!fields) return { ok: true, value: base };
  if (fields.font_id !== undefined && !isFontId(fields.font_id)) return refuse(`table_style.font_id ${fields.font_id} não existe`);
  if (fields.borders !== undefined && !isTableBorders(fields.borders)) return refuse(`table_style.borders precisa ser um de: ${TABLE_BORDERS.join(", ")}`);
  const pick = <K extends keyof TableStyle>(value: TableStyle[K] | undefined, key: K): Partial<TableStyle> => (value === undefined ? {} : { [key]: value });
  return {
    ok: true,
    value: {
      ...base,
      ...pick(fields.font_id as TableStyle["fontId"] | undefined, "fontId"),
      ...pick(fields.font_size, "fontSize"),
      ...pick(fields.line_height, "lineHeight"),
      ...pick(fields.weight, "weight"),
      ...pick(fields.text_color, "textColor"),
      ...pick(fields.fill, "fill"),
      ...pick(fields.header_fill, "headerFill"),
      ...pick(fields.header_text, "headerText"),
      ...pick(fields.header_weight, "headerWeight"),
      ...pick(fields.banding, "banding"),
      ...pick(fields.band_fill, "bandFill"),
      ...pick(fields.borders as TableStyle["borders"] | undefined, "borders"),
      ...pick(fields.border_color, "borderColor"),
      ...pick(fields.border_width, "borderWidth"),
      ...pick(fields.padding, "padding"),
    },
  };
}

function checked(spec: TableSpec): Built<TableSpec> {
  const code = tableIssue(spec);
  return code ? refuse(`a tabela ficaria inválida: ${issueText(code)}`) : { ok: true, value: spec };
}

export function tableSpecFrom(fields: AgentTableFields, current: TableSpec | null, ink: string): Built<TableSpec> {
  if (!current && (!fields.table_rows || fields.table_rows.length === 0)) return refuse("add_table precisa de table_rows: uma lista de linhas, cada linha uma lista com o texto de cada célula; a primeira linha é o cabeçalho quando table_header é true");
  const rows = fields.table_rows;
  const base = current ? (rows ? withGrid(current, rows) : current) : newTableSpec(rows ?? [[""]], tableInk(ink), fields.table_header ?? true);
  const columns = columnsOf(fields.table_columns, base.columns);
  if (!columns.ok) return columns;
  const style = styleOf(fields.table_style, base.style);
  if (!style.ok) return style;
  return checked({ ...base, columns: columns.value, header: fields.table_header ?? base.header, style: style.value });
}

export function tableChangeRequested(fields: AgentTableFields): boolean {
  return [fields.table_rows, fields.table_header, fields.table_columns, fields.table_style].some((value) => value !== undefined);
}

function cellOf(spec: TableSpec, fields: AgentTableFields): Built<{ row: number; column: number; cell: TableCell }> {
  const row = fields.table_row;
  const column = fields.table_column;
  if (row === undefined || column === undefined) return refuse("informe table_row e table_column, contando de 0, para escolher a célula");
  if (!Number.isInteger(row) || !Number.isInteger(column) || row < 0 || column < 0 || row >= spec.rows.length || column >= spec.columns.length) {
    return refuse(`a tabela tem ${spec.rows.length} linhas e ${spec.columns.length} colunas, contando de 0; table_row ${row} e table_column ${column} ficam fora dela`);
  }
  return { ok: true, value: { row, column, cell: spec.rows[row][column] } };
}

export function tableCellText(spec: TableSpec, fields: AgentTableFields, text: string): Built<TableSpec> {
  const found = cellOf(spec, fields);
  if (!found.ok) return found;
  return checked(withCell(spec, found.value.row, found.value.column, retextedCell(spec, found.value.row, found.value.cell, text)));
}

export function tableCellStyle(spec: TableSpec, fields: AgentTableFields & TextRunInput): Built<TableSpec> {
  if (fields.font_size !== undefined || (fields.run_clear ?? []).includes("font_size")) return refuse("o tamanho da letra é o mesmo na tabela inteira; mude com update_table e table_style.font_size");
  const found = cellOf(spec, fields);
  if (!found.ok) return found;
  const { row, column, cell } = found.value;
  if (cell.text === "") return refuse(`a célula ${row}, ${column} está vazia; escreva o texto com update_table antes`);
  const whole = fields.char_start === undefined && fields.char_end === undefined && fields.match === undefined;
  const styled = styledText(cellLayer(spec, row, cell), cell.text, whole ? { ...fields, char_start: 0, char_end: [...cell.text].length } : fields);
  if (!styled.ok) return refuse(styled.reason);
  const runs = (styled.value.patch.runs ?? []) as TextRun[];
  return checked(withCell(spec, row, column, runs.length > 0 ? { text: cell.text, runs } : { text: cell.text }));
}

export interface OutlineTable {
  rows: string[][];
  header: boolean;
  columns: { width: number; align: string }[];
  style: {
    font_id: string;
    font_size: number;
    line_height: number;
    weight: number;
    text_color: string;
    fill: string;
    header_fill: string;
    header_text: string;
    header_weight: number;
    banding: boolean;
    band_fill: string;
    borders: string;
    border_color: string;
    border_width: number;
    padding: number;
  };
  styled_cells?: { row: number; column: number; runs: OutlineRun[] }[];
}

export function tableOutline(spec: TableSpec): OutlineTable {
  const { style } = spec;
  const styled = spec.rows.flatMap((line, row) =>
    line.flatMap((cell, column) => {
      const runs = runsOutline(cellLayer(spec, row, cell), cell.text);
      return runs ? [{ row, column, runs }] : [];
    }),
  );
  return {
    rows: gridOfTable(spec),
    header: spec.header,
    columns: spec.columns.map((column) => ({ width: column.width, align: column.align })),
    style: {
      font_id: style.fontId,
      font_size: style.fontSize,
      line_height: style.lineHeight,
      weight: style.weight,
      text_color: style.textColor,
      fill: style.fill,
      header_fill: style.headerFill,
      header_text: style.headerText,
      header_weight: style.headerWeight,
      banding: style.banding,
      band_fill: style.bandFill,
      borders: style.borders,
      border_color: style.borderColor,
      border_width: style.borderWidth,
      padding: style.padding,
    },
    ...(styled.length > 0 ? { styled_cells: styled } : {}),
  };
}
