"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Table } from "@/components/icons";
import { FONT_IDS, nearestFontWeight, STUDIO_FONTS, type FontId } from "@/lib/studio/fonts";
import type { GridCell } from "@/lib/studio/data-grid";
import type { TextAlign } from "@/lib/studio/document";
import { TABLE_ALIGNS, TABLE_BORDERS, TABLE_LIMITS, type TableBorders, type TableColumn, type TableSpec, type TableStyle } from "@/lib/studio/table";

import { ColorField, InspectorSection, Notice, NumberField, PRIMARY_BUTTON_CLASS, SelectField, SwitchRow } from "../image/controls";
import { CellTextEditor } from "./cell-text-editor";
import { TableDataDialog } from "./table-data-dialog";

const PERCENT = 100;

export interface TableFieldsProps {
  spec: TableSpec;
  disabled: boolean;
  onChange: (spec: TableSpec) => boolean;
  dataOpen: boolean;
  focusCell?: GridCell;
  onDataOpenChange: (open: boolean) => void;
}

export function TableFields({ spec, disabled, onChange, dataOpen, focusCell, onDataOpenChange }: TableFieldsProps) {
  const t = useTranslations("studio.tables");
  const [refused, setRefused] = useState(false);
  const { style } = spec;
  const weights = STUDIO_FONTS[style.fontId].weights;

  const change = (next: TableSpec) => setRefused(!onChange(next));
  const restyle = (patch: Partial<TableStyle>) => change({ ...spec, style: { ...style, ...patch } });
  const recolumn = (index: number, patch: Partial<TableColumn>) => change({ ...spec, columns: spec.columns.map((column, i) => (i === index ? { ...column, ...patch } : column)) });
  const weightOptions = weights.map((weight) => ({ value: weight, label: String(weight) }));

  return (
    <InspectorSection id="table" title={t("title")} summary={t("summary", { rows: spec.rows.length, columns: spec.columns.length })}>
      <button type="button" disabled={disabled} onClick={() => onDataOpenChange(true)} className={`${PRIMARY_BUTTON_CLASS} w-full`}>
        <Table className="h-3.5 w-3.5" aria-hidden />
        {t("editCells")}
      </button>
      {refused ? <Notice tone="fault" title={t("refused")} /> : null}
      <SwitchRow label={t("header")} checked={spec.header} disabled={disabled} onChange={(header) => change({ ...spec, header })} />

      <h4 className="pt-1 text-2xs font-medium text-muted-foreground">{t("columns")}</h4>
      <ul className="space-y-1.5">
        {spec.columns.map((column, index) => (
          <li key={index} className="grid grid-cols-2 gap-1.5">
            <NumberField label={t("columnWidth", { column: index + 1 })} value={column.width} min={TABLE_LIMITS.width[0]} max={TABLE_LIMITS.width[1]} step={0.5} decimals={2} disabled={disabled} onCommit={(width) => recolumn(index, { width })} />
            <SelectField<TextAlign> label={t("columnAlign", { column: index + 1 })} value={column.align} disabled={disabled} options={TABLE_ALIGNS.map((align) => ({ value: align, label: t(`aligns.${align}`) }))} onChange={(align) => recolumn(index, { align })} />
          </li>
        ))}
      </ul>

      <h4 className="pt-1 text-2xs font-medium text-muted-foreground">{t("look")}</h4>
      <SelectField<TableBorders> label={t("borders")} value={style.borders} disabled={disabled} options={TABLE_BORDERS.map((borders) => ({ value: borders, label: t(`bordersKinds.${borders}`) }))} onChange={(borders) => restyle({ borders })} />
      {style.borders !== "none" ? (
        <>
          <NumberField label={t("borderWidth")} value={style.borderWidth * PERCENT} min={TABLE_LIMITS.borderWidth[0] * PERCENT} max={TABLE_LIMITS.borderWidth[1] * PERCENT} step={0.1} decimals={1} suffix="%" disabled={disabled} onCommit={(value) => restyle({ borderWidth: value / PERCENT })} />
          <ColorField label={t("borderColor")} value={style.borderColor} disabled={disabled} onCommit={(borderColor) => restyle({ borderColor })} />
        </>
      ) : null}
      <ColorField label={t("fill")} value={style.fill} disabled={disabled} onCommit={(fill) => restyle({ fill })} />
      {spec.header ? (
        <>
          <ColorField label={t("headerFill")} value={style.headerFill} disabled={disabled} onCommit={(headerFill) => restyle({ headerFill })} />
          <ColorField label={t("headerText")} value={style.headerText} disabled={disabled} onCommit={(headerText) => restyle({ headerText })} />
        </>
      ) : null}
      <SwitchRow label={t("banding")} checked={style.banding} disabled={disabled} onChange={(banding) => restyle({ banding })} />
      {style.banding ? <ColorField label={t("bandFill")} value={style.bandFill} disabled={disabled} onCommit={(bandFill) => restyle({ bandFill })} /> : null}

      <h4 className="pt-1 text-2xs font-medium text-muted-foreground">{t("text")}</h4>
      <SelectField<FontId> label={t("font")} value={style.fontId} disabled={disabled} options={FONT_IDS.map((id) => ({ value: id, label: STUDIO_FONTS[id].family }))} onChange={(fontId) => restyle({ fontId })} />
      <NumberField label={t("fontSize")} value={style.fontSize * PERCENT} min={TABLE_LIMITS.fontSize[0] * PERCENT} max={TABLE_LIMITS.fontSize[1] * PERCENT} step={0.5} decimals={1} suffix="%" disabled={disabled} onCommit={(value) => restyle({ fontSize: value / PERCENT })} />
      <ColorField label={t("textColor")} value={style.textColor} disabled={disabled} onCommit={(textColor) => restyle({ textColor })} />
      <SelectField<number> label={t("weight")} value={nearestFontWeight(style.fontId, style.weight)} disabled={disabled} options={weightOptions} onChange={(weight) => restyle({ weight })} />
      {spec.header ? <SelectField<number> label={t("headerWeight")} value={nearestFontWeight(style.fontId, style.headerWeight)} disabled={disabled} options={weightOptions} onChange={(headerWeight) => restyle({ headerWeight })} /> : null}
      <NumberField label={t("lineHeight")} value={style.lineHeight} min={TABLE_LIMITS.lineHeight[0]} max={TABLE_LIMITS.lineHeight[1]} step={0.05} decimals={2} disabled={disabled} onCommit={(lineHeight) => restyle({ lineHeight })} />
      <NumberField label={t("padding")} value={style.padding} min={TABLE_LIMITS.padding[0]} max={TABLE_LIMITS.padding[1]} step={0.1} decimals={1} disabled={disabled} onCommit={(padding) => restyle({ padding })} />

      <h4 className="pt-1 text-2xs font-medium text-muted-foreground">{t("cell.title")}</h4>
      <CellTextEditor spec={spec} disabled={disabled} onChange={change} />
      <TableDataDialog open={dataOpen} spec={spec} focusCell={focusCell} onOpenChange={onDataOpenChange} onApply={onChange} />
    </InspectorSection>
  );
}
