"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { TextRunToolbar } from "@/components/studio/canvas/text-run-toolbar";
import { cellLayer, retextedCell, styledCell, withCell, type TableSpec } from "@/lib/studio/table";
import { codePointIndex } from "@/lib/studio/text-run-editing";
import type { TextRange } from "@/lib/studio/text-runs";
import { runes } from "@/lib/studio/tokens";

import { SelectField } from "../image/controls";

const CELL_SURFACE = 1;

export interface CellTextEditorProps {
  spec: TableSpec;
  disabled: boolean;
  onChange: (spec: TableSpec) => void;
}

export function CellTextEditor({ spec, disabled, onChange }: CellTextEditorProps) {
  const t = useTranslations("studio.tables.cell");
  const area = useRef<HTMLTextAreaElement>(null);
  const [picked, setPicked] = useState({ row: 0, column: 0 });
  const [range, setRange] = useState<TextRange | null>(null);
  const row = Math.min(picked.row, spec.rows.length - 1);
  const column = Math.min(picked.column, spec.columns.length - 1);
  const cell = spec.rows[row][column];
  const length = runes(cell.text);

  const pick = (next: { row: number; column: number }) => {
    setPicked(next);
    setRange(null);
  };
  const readRange = () => {
    const element = area.current;
    if (!element) return;
    const start = codePointIndex(cell.text, element.selectionStart);
    const end = codePointIndex(cell.text, element.selectionEnd);
    setRange(end > start ? { start, end } : null);
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5">
        <SelectField<number> label={t("row")} value={row} disabled={disabled} options={spec.rows.map((_, index) => ({ value: index, label: String(index + 1) }))} onChange={(next) => pick({ row: next, column })} />
        <SelectField<number> label={t("column")} value={column} disabled={disabled} options={spec.columns.map((_, index) => ({ value: index, label: String(index + 1) }))} onChange={(next) => pick({ row, column: next })} />
      </div>
      <textarea
        ref={area}
        aria-label={t("text", { row: row + 1, column: column + 1 })}
        value={cell.text}
        disabled={disabled}
        rows={2}
        onChange={(event) => {
          setRange(null);
          onChange(withCell(spec, row, column, retextedCell(spec, row, cell, event.target.value.replace(/[\t\r]/g, ""))));
        }}
        onSelect={readRange}
        className="w-full resize-y rounded-[--radius] border border-control-edge bg-transparent px-2 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <p className="text-2xs text-muted-foreground">{range ? t("selection", { count: range.end - range.start }) : t("whole")}</p>
      {length > 0 ? (
        <TextRunToolbar
          layer={cellLayer(spec, row, cell)}
          range={range}
          length={length}
          surfaceHeight={CELL_SURFACE}
          disabled={disabled}
          sizeless
          onPatch={(patch) => onChange(withCell(spec, row, column, styledCell(spec, row, cell, range, patch)))}
          onClear={cell.runs && cell.runs.length > 0 ? () => onChange(withCell(spec, row, column, { text: cell.text })) : undefined}
        />
      ) : null}
    </div>
  );
}
