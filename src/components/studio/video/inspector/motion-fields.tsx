"use client";

import { useTranslations } from "next-intl";

import type { Clip } from "@/lib/studio/document";
import { DEFAULT_MOTION_MS, ENTRANCE_PRESETS, EXIT_PRESETS, motionPresetPatch, presetOf, type MotionPreset, type MotionSide } from "@/lib/studio/motion";
import { sharedValue, type PatchBuilder } from "@/lib/studio/selection-edit";

import { FieldGrid, InspectorSection, NumberField, SelectField } from "./fields";

interface MotionFieldsProps {
  clips: readonly Clip[];
  disabled: boolean;
  onPatch: (build: PatchBuilder) => boolean;
}

function sideDuration(clip: Clip, side: MotionSide): number {
  const motion = side === "in" ? clip.motionIn : clip.motionOut;
  const fade = side === "in" ? clip.fadeInMs : clip.fadeOutMs;
  return motion?.durationMs ?? (fade > 0 ? fade : DEFAULT_MOTION_MS);
}

export function MotionFields({ clips, disabled, onPatch }: MotionFieldsProps) {
  const t = useTranslations("studio.video.motion");
  const shortest = Math.min(...clips.map((clip) => clip.durationMs));

  const side = (which: MotionSide) => {
    const current = sharedValue(clips, (clip) => presetOf(clip, which));
    const preset = current.kind === "same" ? current.value : null;
    const presets = which === "in" ? ENTRANCE_PRESETS : EXIT_PRESETS;
    const options = [
      ...presets.map((value) => ({ value: value as MotionPreset | "custom", label: t(`presets.${value}`) })),
      ...(preset === "custom" ? [{ value: "custom" as const, label: t("presets.custom") }] : []),
    ];
    const duration = sharedValue(clips, (clip) => sideDuration(clip, which));
    const editable = preset !== null && preset !== "none" && preset !== "custom";
    return (
      <FieldGrid>
        <SelectField<MotionPreset | "custom">
          label={which === "in" ? t("entrance") : t("exit")}
          value={preset}
          disabled={disabled}
          options={options}
          onChange={(next) => {
            if (next !== "custom") onPatch((clip) => motionPresetPatch(which, next, sideDuration(clip, which)));
          }}
        />
        <NumberField
          label={which === "in" ? t("durationIn") : t("durationOut")}
          unit="s"
          step={0.1}
          decimals={2}
          min={0.1}
          max={shortest / 1000}
          value={duration.kind === "same" ? duration.value / 1000 : null}
          disabled={disabled || !editable}
          onCommit={(seconds) => {
            if (editable) onPatch(() => motionPresetPatch(which, preset, Math.round(seconds * 1000)));
          }}
          onNudge={(delta) => {
            if (editable) onPatch((clip) => motionPresetPatch(which, preset, Math.max(100, Math.round(sideDuration(clip, which) + delta * 1000))));
          }}
        />
      </FieldGrid>
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
