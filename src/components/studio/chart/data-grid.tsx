"use client";

import { useId, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";

import { Minus, Plus, UploadSimple } from "@/components/icons";
import { gridColumns, insertColumn, insertRow, parseDelimited, pasteCells, removeColumn, removeRow, setCell, type CellGrid, type GridCell } from "@/lib/studio/data-grid";
import { cn } from "@/lib/utils";

import { IconButton, OUTLINE_BUTTON_CLASS } from "../image/controls";

const CELL_CLASS =
  "h-7 w-full min-w-[5.5rem] border-0 bg-transparent px-2 text-xs tabular-nums text-foreground placeholder:text-muted-foreground focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export type DataGridLayout = "series" | "table";

interface DataGridProps {
  grid: CellGrid;
  onChange: (grid: CellGrid) => void;
  onImportFailed?: () => void;
  disabled?: boolean;
  layout?: DataGridLayout;
  focusCell?: GridCell;
}

const FROZEN: Record<DataGridLayout, number> = { series: 1, table: 0 };

function cellId(base: string, cell: GridCell): string {
  return `${base}-${cell.row}-${cell.column}`;
}

export function DataGrid({ grid, onChange, onImportFailed, disabled, layout = "series", focusCell }: DataGridProps) {
  const series = layout === "series";
  const seriesText = useTranslations("studio.chart.data");
  const tableText = useTranslations("studio.tables.data");
  const t = (series ? seriesText : tableText) as (key: string, values?: Record<string, number>) => string;
  const frozen = FROZEN[layout];
  const file = useRef<HTMLInputElement>(null);
  const base = useId();
  const columns = gridColumns(grid);
  const rows = grid.length;

  const focus = (cell: GridCell) => {
    window.requestAnimationFrame(() => document.getElementById(cellId(base, cell))?.focus());
  };

  const paste = (event: ClipboardEvent<HTMLInputElement>, at: GridCell) => {
    const text = event.clipboardData.getData("text/plain");
    if (!/[\t\n\r]/.test(text)) return;
    event.preventDefault();
    onChange(pasteCells(grid, at, parseDelimited(text.replace(/\r?\n$/, ""), "\t")));
  };

  const keys = (event: KeyboardEvent<HTMLInputElement>, at: GridCell) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const next = { row: at.row + (event.shiftKey ? -1 : 1), column: at.column };
    if (next.row < 0) return;
    if (next.row >= rows) onChange(insertRow(grid, rows));
    focus(next);
  };

  const importFile = async (picked: File | undefined) => {
    if (!picked) return;
    try {
      const parsed = parseDelimited((await picked.text()).replace(/^﻿/, ""));
      if (parsed.length === 0) throw new Error("empty");
      onChange(parsed);
    } catch {
      onImportFailed?.();
    }
  };

  const seriesLabel = (cell: GridCell) => (cell.row === 0 ? (cell.column === 0 ? t("corner") : t("header", { column: cell.column })) : cell.column === 0 ? t("label", { row: cell.row }) : t("cell", { row: cell.row, column: cell.column }));
  const cellLabel = (cell: GridCell) => (series ? seriesLabel(cell) : t("cell", { row: cell.row + 1, column: cell.column + 1 }));
  const columnLabel = (column: number) => (series ? (column === 0 ? t("labels") : t("series", { column })) : t("column", { column: column + 1 }));

  return (
    <div className="space-y-2">
      <div className="max-h-[50vh] overflow-auto rounded-[--radius] border border-control-edge">
        <table className="border-collapse text-left">
          <thead>
            <tr>
              <th className="sticky top-0 z-20 w-8 bg-muted" aria-hidden />
              {Array.from({ length: columns }, (_, column) => (
                <th key={column} className="sticky top-0 z-20 border-l border-border bg-muted p-0">
                  <div className="flex h-6 items-center justify-between px-1 text-2xs font-medium text-muted-foreground">
                    <span className="px-1">{columnLabel(column)}</span>
                    {column >= frozen ? (
                      <IconButton label={t("removeColumn", { column: series ? column : column + 1 })} disabled={disabled || columns <= frozen + 1} onClick={() => onChange(removeColumn(grid, column, frozen))} className="h-5 min-w-5 px-0 text-muted-foreground">
                        <Minus className="h-3 w-3" aria-hidden />
                      </IconButton>
                    ) : null}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((line, row) => (
              <tr key={row} className={cn(row === 0 && "bg-muted/60")}>
                <th scope="row" className="border-t border-border bg-muted p-0 text-center">
                  {row >= frozen ? (
                    <IconButton label={t("removeRow", { row: series ? row : row + 1 })} disabled={disabled || rows <= frozen + 1} onClick={() => onChange(removeRow(grid, row, frozen))} className="h-6 min-w-6 px-0 text-muted-foreground">
                      <Minus className="h-3 w-3" aria-hidden />
                    </IconButton>
                  ) : null}
                </th>
                {Array.from({ length: columns }, (_, column) => {
                  const at = { row, column };
                  return (
                    <td key={column} className="border-l border-t border-border p-0">
                      <input
                        id={cellId(base, at)}
                        aria-label={cellLabel(at)}
                        value={line[column] ?? ""}
                        disabled={disabled || (series && row === 0 && column === 0)}
                        inputMode={series && row > 0 && column > 0 ? "decimal" : "text"}
                        autoFocus={focusCell !== undefined && focusCell.row === row && focusCell.column === column}
                        onChange={(event) => onChange(setCell(grid, at, event.target.value))}
                        onPaste={(event) => paste(event, at)}
                        onKeyDown={(event) => keys(event, at)}
                        className={cn(CELL_CLASS, (series ? row === 0 || column === 0 : row === 0) && "font-medium")}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={disabled} onClick={() => onChange(insertRow(grid, rows))} className={OUTLINE_BUTTON_CLASS}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t("addRow")}
        </button>
        <button type="button" disabled={disabled} onClick={() => onChange(insertColumn(grid, columns))} className={OUTLINE_BUTTON_CLASS}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t("addColumn")}
        </button>
        <button type="button" disabled={disabled} onClick={() => file.current?.click()} className={OUTLINE_BUTTON_CLASS}>
          <UploadSimple className="h-3.5 w-3.5" aria-hidden />
          {t("importCsv")}
        </button>
        <input
          ref={file}
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
          className="hidden"
          aria-label={t("importCsv")}
          onChange={(event) => {
            void importFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
