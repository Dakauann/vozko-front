"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { GRADE_GROUPS, GRADE_RANGES, GRADE_STEPS, isNeutralPrimary, LOOK_IDS, type GradeField } from "@/lib/studio/color-grade";
import { keyedGradeFields, lookPatch, primaryResetPatch } from "@/lib/studio/grade-keys";
import type { Clip } from "@/lib/studio/document";
import { sharedValue } from "@/lib/studio/selection-edit";

import { useGradeSummary } from "../../inspector/use-grade-summary";
import { InspectorSection, SliderField } from "./fields";
import { KeyedSlider } from "./keyed-slider";
import type { SelectionEditor } from "./use-selection-editor";

const PERCENT = 100;

export function ColorGradeFields({ clips, disabled, editor }: { clips: readonly Clip[]; disabled: boolean; editor: SelectionEditor }) {
  const t = useTranslations("studio.grade");
  const format = useFormatter();
  const [intensity, setIntensity] = useState(PERCENT);
  const graded = clips.some((clip) => !isNeutralPrimary(clip.color) || keyedGradeFields(clip).length > 0);
  const summarize = useGradeSummary();
  const summary = sharedValue(clips, (clip) => summarize(clip.color));

  const slider = (field: GradeField) => {
    const [min, max] = GRADE_RANGES[field];
    return (
      <KeyedSlider
        key={field}
        clips={clips}
        property={field}
        label={t(`fields.${field}`)}
        min={min}
        max={max}
        step={GRADE_STEPS[field]}
        format={(shown) => (field === "exposure" ? t("stops", { value: format.number(shown, { maximumFractionDigits: 2, signDisplay: "exceptZero" }) }) : format.number(shown, { signDisplay: "exceptZero" }))}
        disabled={disabled}
        editor={editor}
      />
    );
  };

  return (
    <div role="group" aria-label={t("title")}>
      <InspectorSection
        id="grade"
        title={t("title")}
        summary={summary.kind === "same" ? summary.value : null}
        reset={{ label: t("reset"), disabled: disabled || !graded, onReset: () => editor.patch((clip) => primaryResetPatch(clip)) }}
      >
        <p className="text-2xs font-semibold uppercase text-muted-foreground">{t("light")}</p>
        {GRADE_GROUPS.light.map(slider)}
        <p className="text-2xs font-semibold uppercase text-muted-foreground">{t("color")}</p>
        {GRADE_GROUPS.color.map(slider)}
        <p className="text-2xs font-semibold uppercase text-muted-foreground">{t("look")}</p>
        <SliderField
          label={t("intensity")}
          value={intensity}
          fallback={PERCENT}
          min={0}
          max={PERCENT}
          step={5}
          valueText={format.number(intensity / PERCENT, { style: "percent" })}
          disabled={disabled}
          onStart={() => undefined}
          onCommit={() => undefined}
          onChange={setIntensity}
        />
        <div role="group" aria-label={t("looks")} className="flex flex-wrap gap-1">
          {LOOK_IDS.map((look) => (
            <Button key={look} variant="outline" size="sm" disabled={disabled} title={t(`lookNames.${look}`)} onClick={() => editor.patch((clip) => lookPatch(clip, look, intensity / PERCENT))} />
          ))}
        </div>
      </InspectorSection>
    </div>
  );
}
