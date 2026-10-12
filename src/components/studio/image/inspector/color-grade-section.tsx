"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { changedGrade, extrasOf, GRADE_GROUPS, GRADE_RANGES, GRADE_STEPS, isNeutralPrimary, LOOK_IDS, mergeGrade, storedGrade, type GradeField } from "@/lib/studio/color-grade";
import type { Layer } from "@/lib/studio/document";
import { cn } from "@/lib/utils";

import { useGradeSummary } from "../../inspector/use-grade-summary";
import { InspectorSection, OUTLINE_BUTTON_CLASS, SliderField } from "../controls";
import { useImageEditor } from "../editor-state";

const PERCENT = 100;

export function ColorGradeSection({ layer }: { layer: Layer }) {
  const t = useTranslations("studio.grade");
  const format = useFormatter();
  const { commands } = useImageEditor();
  const [intensity, setIntensity] = useState(PERCENT);
  const summarize = useGradeSummary();
  const locked = Boolean(layer.locked);
  const grade = layer.color ?? {};
  const patch = (next: typeof grade | undefined) => commands.patchLayers([layer.id], { color: next && storedGrade(next) });

  const slider = (field: GradeField) => {
    const [min, max] = GRADE_RANGES[field];
    return (
      <SliderField
        key={field}
        label={t(`fields.${field}`)}
        value={grade[field] ?? 0}
        min={min}
        max={max}
        step={GRADE_STEPS[field]}
        format={(value) => (field === "exposure" ? t("stops", { value: format.number(value, { maximumFractionDigits: 2, signDisplay: "exceptZero" }) }) : format.number(value, { signDisplay: "exceptZero" }))}
        disabled={locked}
        onStart={commands.beginLive}
        onEnd={commands.endLive}
        onChange={(value) => patch(mergeGrade(layer.color, { [field]: value }))}
      />
    );
  };

  return (
    <div role="group" aria-label={t("title")}>
      <InspectorSection id="grade" title={t("title")} summary={summarize(layer.color)} reset={{ label: t("reset"), disabled: locked || isNeutralPrimary(grade), onReset: () => patch(extrasOf(layer.color)) }}>
        <p className="text-2xs font-semibold uppercase text-muted-foreground">{t("light")}</p>
        {GRADE_GROUPS.light.map(slider)}
        <p className="text-2xs font-semibold uppercase text-muted-foreground">{t("color")}</p>
        {GRADE_GROUPS.color.map(slider)}
        <p className="text-2xs font-semibold uppercase text-muted-foreground">{t("look")}</p>
        <SliderField label={t("intensity")} value={intensity} min={0} max={PERCENT} step={5} format={(value) => format.number(value / PERCENT, { style: "percent" })} disabled={locked} onChange={setIntensity} />
        <div role="group" aria-label={t("looks")} className="flex flex-wrap gap-1">
          {LOOK_IDS.map((look) => (
            <button key={look} type="button" disabled={locked} className={cn(OUTLINE_BUTTON_CLASS, "h-7")} onClick={() => patch(changedGrade(layer.color, { look, intensity: intensity / PERCENT }))}>
              {t(`lookNames.${look}`)}
            </button>
          ))}
        </div>
      </InspectorSection>
    </div>
  );
}
