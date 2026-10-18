"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Minus, Palette, Plus, Table, TreeStructure } from "@/components/icons";
import {
  CHART_KINDS,
  CHART_LEGENDS,
  CHART_LIMITS,
  isBarChart,
  isRoundChart,
  drawsLines,
  minimumSeries,
  nextPaletteColor,
  stylePalette,
  withKind,
  type ChartData,
  type ChartFormat,
  type ChartKind,
  type ChartLegend,
  type ChartSpec,
  type ChartStyle,
} from "@/lib/studio/chart";
import { COUNTER_LOCALES, type CounterLocale } from "@/lib/studio/locale-numbers";
import { FONT_IDS, STUDIO_FONTS, type FontId } from "@/lib/studio/fonts";
import type { StudioStyle } from "@/lib/studio/shared-styles";

import { ColorField, IconButton, InspectorSection, Notice, NumberField, OUTLINE_BUTTON_CLASS, PRIMARY_BUTTON_CLASS, SelectField, SwitchRow, TextField } from "../image/controls";
import { ChartDataDialog } from "./chart-data-dialog";

const PERCENT = 100;

interface ChartFieldsProps {
  spec: ChartSpec;
  disabled: boolean;
  onChange: (spec: ChartSpec) => boolean;
  dataOpen: boolean;
  onDataOpenChange: (open: boolean) => void;
  styles?: readonly StudioStyle[];
  onExpand?: () => void;
}

export function ChartFields({ spec, disabled, onChange, dataOpen, onDataOpenChange, styles, onExpand }: ChartFieldsProps) {
  const t = useTranslations("studio.chart");
  const [refused, setRefused] = useState<ChartSpec | null>(null);
  const { style, format } = spec;
  const round = isRoundChart(spec.kind);
  const lines = drawsLines(spec.kind);
  const projectColors = (styles ?? []).some((entry) => entry.kind === "color" && entry.color);

  const change = (next: ChartSpec) => setRefused(onChange(next) ? null : next);
  const restyle = (patch: Partial<ChartStyle>) => change({ ...spec, style: { ...style, ...patch } });
  const reformat = (patch: Partial<ChartFormat>) => change({ ...spec, format: { ...format, ...patch } });
  const repaint = (index: number, color: string) => restyle({ palette: style.palette.map((entry, i) => (i === index ? color : entry)) });
  const applyData = (data: ChartData) => onChange({ ...spec, data });

  return (
    <InspectorSection id="chart" title={t("title")} summary={t(`kinds.${spec.kind}`)}>
      <SelectField<ChartKind> label={t("kind")} value={spec.kind} disabled={disabled} options={CHART_KINDS.map((kind) => ({ value: kind, label: t(`kinds.${kind}`) }))} onChange={(kind) => change(withKind(spec, kind))} />
      <button type="button" disabled={disabled} onClick={() => onDataOpenChange(true)} className={`${PRIMARY_BUTTON_CLASS} w-full`}>
        <Table className="h-3.5 w-3.5" aria-hidden />
        {t("editData")}
      </button>
      {refused ? <Notice tone="fault" title={refused.data.series.length < minimumSeries(refused.kind) ? t("data.scatterNeedsTwo") : t("refused")} /> : null}

      <h4 className="pt-1 text-2xs font-medium text-muted-foreground">{t("look")}</h4>
      <SelectField<ChartLegend> label={t("legend")} value={style.legend} disabled={disabled} options={CHART_LEGENDS.map((legend) => ({ value: legend, label: t(`legends.${legend}`) }))} onChange={(legend) => restyle({ legend })} />
      {round ? null : <SwitchRow label={t("axes")} checked={style.axes} disabled={disabled} onChange={(axes) => restyle({ axes })} />}
      {round ? null : <SwitchRow label={t("gridlines")} checked={style.gridlines} disabled={disabled} onChange={(gridlines) => restyle({ gridlines })} />}
      <SwitchRow label={t("valueLabels")} checked={style.valueLabels} disabled={disabled} onChange={(valueLabels) => restyle({ valueLabels })} />
      {round ? <SwitchRow label={t("percent")} checked={format.percent} disabled={disabled} onChange={(percent) => reformat({ percent })} /> : null}
      {lines && spec.kind !== "scatter" ? <SwitchRow label={t("points")} checked={style.points} disabled={disabled} onChange={(points) => restyle({ points })} /> : null}
      {spec.kind === "line" || spec.kind === "lineMulti" ? <SwitchRow label={t("smooth")} checked={style.smooth} disabled={disabled} onChange={(smooth) => restyle({ smooth })} /> : null}
      {isBarChart(spec.kind) ? (
        <>
          <NumberField label={t("barGap")} value={style.barGap * PERCENT} min={CHART_LIMITS.barGap[0] * PERCENT} max={CHART_LIMITS.barGap[1] * PERCENT} suffix="%" disabled={disabled} onCommit={(value) => restyle({ barGap: value / PERCENT })} />
          <NumberField label={t("barRadius")} value={style.barRadius * PERCENT} min={0} max={PERCENT} suffix="%" disabled={disabled} onCommit={(value) => restyle({ barRadius: value / PERCENT })} />
        </>
      ) : null}
      {lines ? <NumberField label={t("lineWidth")} value={style.lineWidth * PERCENT} min={CHART_LIMITS.lineWidth[0] * PERCENT} max={CHART_LIMITS.lineWidth[1] * PERCENT} step={0.1} decimals={1} suffix="%" disabled={disabled} onCommit={(value) => restyle({ lineWidth: value / PERCENT })} /> : null}
      {spec.kind === "donut" ? <NumberField label={t("hole")} value={style.hole * PERCENT} min={CHART_LIMITS.hole[0] * PERCENT} max={CHART_LIMITS.hole[1] * PERCENT} suffix="%" disabled={disabled} onCommit={(value) => restyle({ hole: value / PERCENT })} /> : null}

      <h4 className="pt-1 text-2xs font-medium text-muted-foreground">{t("text")}</h4>
      <SelectField<FontId> label={t("font")} value={style.fontId} disabled={disabled} options={FONT_IDS.map((id) => ({ value: id, label: STUDIO_FONTS[id].family }))} onChange={(fontId) => restyle({ fontId })} />
      <NumberField label={t("fontSize")} value={style.fontSize * PERCENT} min={CHART_LIMITS.fontSize[0] * PERCENT} max={CHART_LIMITS.fontSize[1] * PERCENT} step={0.5} decimals={1} suffix="%" disabled={disabled} onCommit={(value) => restyle({ fontSize: value / PERCENT })} />
      <ColorField label={t("textColor")} value={style.textColor} disabled={disabled} onCommit={(textColor) => restyle({ textColor })} />
      {round ? null : <ColorField label={t("gridColor")} value={style.gridColor} disabled={disabled} onCommit={(gridColor) => restyle({ gridColor })} />}

      <h4 className="pt-1 text-2xs font-medium text-muted-foreground">{t("palette")}</h4>
      <ul className="space-y-1.5">
        {style.palette.map((color, index) => (
          <li key={index} className="flex items-center gap-1">
            <div className="min-w-0 flex-1">
              <ColorField label={t("color", { index: index + 1 })} value={color} disabled={disabled} onCommit={(next) => repaint(index, next)} />
            </div>
            <IconButton label={t("removeColor", { index: index + 1 })} disabled={disabled || style.palette.length <= 1} onClick={() => restyle({ palette: style.palette.filter((_, i) => i !== index) })} className="h-7 min-w-7 text-muted-foreground">
              <Minus className="h-3.5 w-3.5" aria-hidden />
            </IconButton>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={disabled} onClick={() => restyle({ palette: [...style.palette, nextPaletteColor(style.palette)] })} className={OUTLINE_BUTTON_CLASS}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t("addColor")}
        </button>
        {projectColors ? (
          <button type="button" disabled={disabled} onClick={() => restyle({ palette: stylePalette(styles) })} className={OUTLINE_BUTTON_CLASS}>
            <Palette className="h-3.5 w-3.5" aria-hidden />
            {t("useStyles")}
          </button>
        ) : null}
      </div>

      <h4 className="pt-1 text-2xs font-medium text-muted-foreground">{t("numbers")}</h4>
      <SelectField<CounterLocale> label={t("locale")} value={format.locale} disabled={disabled} options={COUNTER_LOCALES.map((locale) => ({ value: locale, label: t(`locales.${locale}`) }))} onChange={(locale) => reformat({ locale })} />
      <NumberField label={t("decimals")} value={format.decimals} min={CHART_LIMITS.decimals[0]} max={CHART_LIMITS.decimals[1]} disabled={disabled} onCommit={(decimals) => reformat({ decimals: Math.round(decimals) })} />
      <TextField label={t("prefix")} value={format.prefix ?? ""} maxLength={CHART_LIMITS.affixRunes} disabled={disabled} onCommit={(prefix) => reformat({ prefix: prefix === "" ? undefined : prefix })} />
      <TextField label={t("suffix")} value={format.suffix ?? ""} maxLength={CHART_LIMITS.affixRunes} disabled={disabled} onCommit={(suffix) => reformat({ suffix: suffix === "" ? undefined : suffix })} />

      {onExpand ? (
        <>
          <button type="button" disabled={disabled} onClick={onExpand} className={`${OUTLINE_BUTTON_CLASS} w-full`}>
            <TreeStructure className="h-3.5 w-3.5" aria-hidden />
            {t("expand")}
          </button>
          <p className="text-2xs text-muted-foreground">{t("expandHint")}</p>
        </>
      ) : null}
      <ChartDataDialog open={dataOpen} spec={spec} onOpenChange={onDataOpenChange} onApply={applyData} />
    </InspectorSection>
  );
}
