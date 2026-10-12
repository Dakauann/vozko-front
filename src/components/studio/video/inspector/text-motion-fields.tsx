"use client";

import { useTranslations } from "next-intl";

import type { Clip } from "@/lib/studio/document";
import { sharedValue, type PatchBuilder } from "@/lib/studio/selection-edit";
import {
  playsOverTime,
  restyledAnimator,
  reunitedAnimator,
  TEXT_ANIMATION_LIMITS,
  TEXT_STYLES,
  TEXT_UNITS,
  textAnimationPatch,
  type TextAnimator,
  type TextStyle,
} from "@/lib/studio/text-animation";

import { EasingPicker } from "./easing-picker";
import { FieldGrid, InspectorSection, NumberField, SelectField } from "./fields";

const MS = 1000;
const STEP_SECONDS = 0.01;

type Side = "in" | "out";

interface TextMotionFieldsProps {
  clips: readonly Clip[];
  disabled: boolean;
  onPatch: (build: PatchBuilder) => boolean;
}

function animatorOf(clip: Clip, side: Side): TextAnimator | undefined {
  return side === "in" ? clip.textIn : clip.textOut;
}

export function TextMotionFields({ clips, disabled, onPatch }: TextMotionFieldsProps) {
  const t = useTranslations("studio.video.textMotion");

  const side = (which: Side) => {
    const labels = (key: "style" | "unit" | "duration" | "stagger" | "easing") => t(`sides.${which}.${key}`);
    const style = sharedValue(clips, (clip) => animatorOf(clip, which)?.style ?? "none");
    const shared = sharedValue(clips, (clip) => animatorOf(clip, which));
    const animator = shared.kind === "same" ? shared.value : undefined;
    const retime = (change: (current: TextAnimator) => TextAnimator) =>
      onPatch((clip) => {
        const current = animatorOf(clip, which);
        return current ? textAnimationPatch(which, change(current)) : null;
      });
    const timing = (field: "durationMs" | "staggerMs") => ({
      unit: "s",
      step: STEP_SECONDS,
      decimals: 2,
      min: TEXT_ANIMATION_LIMITS[field][0] / MS,
      max: TEXT_ANIMATION_LIMITS[field][1] / MS,
      value: animator ? animator[field] / MS : null,
      disabled: disabled || !animator,
      onCommit: (seconds: number) => retime((current) => ({ ...current, [field]: Math.round(seconds * MS) })),
      onNudge: (delta: number) => retime((current) => ({ ...current, [field]: Math.round(current[field] + delta * MS) })),
    });
    return (
      <div className="space-y-2">
        <FieldGrid>
          <SelectField<TextStyle | "none">
            label={labels("style")}
            value={style.kind === "same" ? style.value : null}
            disabled={disabled}
            options={[{ value: "none" as const, label: t("styles.none") }, ...TEXT_STYLES.map((value) => ({ value, label: t(`styles.${value}`) }))]}
            onChange={(next) => onPatch((clip) => textAnimationPatch(which, next === "none" ? null : restyledAnimator(animatorOf(clip, which), next)))}
          />
          <SelectField
            label={labels("unit")}
            value={animator?.unit ?? null}
            disabled={disabled || !animator}
            options={TEXT_UNITS.map((value) => ({ value, label: t(`units.${value}`) }))}
            onChange={(unit) => retime((current) => reunitedAnimator(current, unit))}
          />
        </FieldGrid>
        {animator ? (
          <>
            <FieldGrid>
              {playsOverTime(animator.style) ? <NumberField label={labels("duration")} {...timing("durationMs")} /> : null}
              <NumberField label={labels("stagger")} {...timing("staggerMs")} />
            </FieldGrid>
            {playsOverTime(animator.style) ? <EasingPicker label={labels("easing")} value={animator.easing} disabled={disabled} onPick={(easing) => retime((current) => ({ ...current, easing }))} /> : null}
          </>
        ) : null}
      </div>
    );
  };

  return (
    <InspectorSection title={t("title")}>
      {side("in")}
      {side("out")}
      <p className="text-2xs text-muted-foreground">{t("hint")}</p>
    </InspectorSection>
  );
}
