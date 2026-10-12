"use client";

import { useTranslations } from "next-intl";

import { ChartFields } from "@/components/studio/chart/chart-fields";
import type { ChartSpec } from "@/lib/studio/chart";
import { CHART_ANIMATION_LIMITS, CHART_ANIMATION_ORDERS, CHART_ANIMATION_STYLES, chartInPatch, defaultChartAnimator, type ChartAnimationOrder, type ChartAnimationStyle, type ChartAnimator } from "@/lib/studio/chart-animation";
import type { Clip } from "@/lib/studio/document";
import type { SelectionEditor } from "./use-selection-editor";

import { useVideoEditor, useViewState } from "../editor-context";
import { EasingPicker } from "./easing-picker";
import { FieldGrid, InspectorSection, NumberField, SelectField } from "./fields";

const MS = 1000;
const STEP_SECONDS = 0.05;

interface ChartClipFieldsProps {
  clip: Clip;
  disabled: boolean;
  editor: SelectionEditor;
}

export function ChartClipFields({ clip, disabled, editor }: ChartClipFieldsProps) {
  const { view } = useVideoEditor();
  const dataOpen = useViewState((s) => s.dataEditorFor === clip.id);
  const spec = clip.layer?.chart;
  if (!spec) return null;
  const change = (next: ChartSpec) => editor.patch((target) => (target.layer?.type === "chart" ? { layer: { ...target.layer, chart: next } } : null));
  return <ChartFields spec={spec} disabled={disabled} onChange={change} dataOpen={dataOpen} onDataOpenChange={(open) => view.setState({ dataEditorFor: open ? clip.id : null })} />;
}

export function ChartMotionFields({ clip, disabled, editor }: ChartClipFieldsProps) {
  const t = useTranslations("studio.chart.motion");
  const spec = clip.layer?.chart;
  if (!spec) return null;
  const animator = clip.chartIn;
  const retime = (change: (current: ChartAnimator) => ChartAnimator) => editor.patch((target) => (target.chartIn ? chartInPatch(change(target.chartIn)) : null));
  const timing = (field: "durationMs" | "staggerMs") => ({
    unit: "s",
    step: STEP_SECONDS,
    decimals: 2,
    min: CHART_ANIMATION_LIMITS[field][0] / MS,
    max: CHART_ANIMATION_LIMITS[field][1] / MS,
    value: animator ? animator[field] / MS : null,
    disabled: disabled || !animator,
    onCommit: (seconds: number) => retime((current) => ({ ...current, [field]: Math.round(seconds * MS) })),
    onNudge: (delta: number) => retime((current) => ({ ...current, [field]: Math.round(current[field] + delta * MS) })),
  });
  return (
    <InspectorSection id="chartMotion" title={t("title")} summary={animator ? t(`styles.${animator.style}`) : t("styles.none")}>
      <FieldGrid>
        <SelectField<ChartAnimationStyle | "none">
          label={t("style")}
          value={animator?.style ?? "none"}
          disabled={disabled}
          options={[{ value: "none" as const, label: t("styles.none") }, ...CHART_ANIMATION_STYLES.map((value) => ({ value, label: t(`styles.${value}`) }))]}
          onChange={(style) => editor.patch(() => chartInPatch(style === "none" ? null : animator ? { ...animator, style } : defaultChartAnimator(spec.kind, style)))}
        />
        <SelectField<ChartAnimationOrder>
          label={t("order")}
          value={animator?.order ?? null}
          disabled={disabled || !animator}
          options={CHART_ANIMATION_ORDERS.map((value) => ({ value, label: t(`orders.${value}`) }))}
          onChange={(order) => retime((current) => ({ ...current, order }))}
        />
        <NumberField label={t("duration")} {...timing("durationMs")} />
        <NumberField label={t("stagger")} {...timing("staggerMs")} />
      </FieldGrid>
      {animator ? <EasingPicker label={t("easing")} value={animator.easing} disabled={disabled} onPick={(easing) => retime((current) => ({ ...current, easing }))} /> : <p className="text-2xs text-muted-foreground">{t("hint")}</p>}
    </InspectorSection>
  );
}
