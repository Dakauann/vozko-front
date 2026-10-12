"use client";

import { useTranslations } from "next-intl";

import { gainToDb } from "@/lib/studio/audio-gain";
import { STUDIO_LIMITS, type Clip } from "@/lib/studio/document";
import { keyState, localTime, propertyValue } from "@/lib/studio/keyframe-edit";
import { formatLevel } from "@/lib/studio/live-meter";
import { clipTime, sharedValue, toggleSelectionKey } from "@/lib/studio/selection-edit";

import { usePanelPlayhead } from "../editor-context";
import { InspectorSection, SliderField } from "./fields";
import { KeyedField } from "./key-toggle";
import { NormalizeFields } from "./normalize-fields";
import { PanField } from "./pan-field";
import type { SelectionEditor } from "./use-selection-editor";

const PERCENT = 100;

interface SoundFieldsProps {
  clips: readonly Clip[];
  disabled: boolean;
  editor: SelectionEditor;
}

export function VolumeField({ clips, disabled, editor }: SoundFieldsProps) {
  const t = useTranslations("studio.video.inspector");
  const volume = sharedValue(clips, (clip) => Math.round(clip.volume * PERCENT));
  const shownVolume = volume.kind === "same" ? volume.value : null;
  return (
    <SliderField
      label={t("volume")}
      min={0}
      max={STUDIO_LIMITS.maxVolume * PERCENT}
      step={1}
      value={shownVolume}
      fallback={PERCENT}
      valueText={shownVolume === null ? "" : `${shownVolume}% (${formatLevel(gainToDb(shownVolume / PERCENT))} dB)`}
      disabled={disabled}
      onChange={(v) => editor.patch(() => ({ volume: v / PERCENT }))}
      onStart={editor.gesture.onStart}
      onCommit={editor.gesture.onCommit}
    />
  );
}

export function SoundFields({ clips, disabled, editor }: SoundFieldsProps) {
  const t = useTranslations("studio.video.inspector");
  const ts = useTranslations("studio.video.sound");
  const playheadMs = usePanelPlayhead();
  const pan = sharedValue(clips, (clip) => Math.round(propertyValue(clip, "pan", clipTime(clip, playheadMs)) * PERCENT) / PERCENT);
  const keyed = sharedValue(clips, (clip) => keyState(clip, "pan", localTime(clip, playheadMs)));
  const panState = keyed.kind === "same" ? keyed.value : "static";
  const outside = clips.some((clip) => localTime(clip, playheadMs) === null);

  return (
    <InspectorSection title={t("sound")}>
      <VolumeField clips={clips} disabled={disabled} editor={editor} />
      <KeyedField
        toggle={{
          label: ts("panKey"),
          state: panState,
          disabled: disabled || outside,
          onClick: () => editor.run((doc) => toggleSelectionKey(doc, editor.ids, "pan", editor.playheadMs())),
        }}
      >
        <PanField
          label={ts("pan")}
          value={pan.kind === "same" ? pan.value : null}
          disabled={disabled}
          onChange={(value) => editor.keyed("pan", () => value)}
          onStart={editor.gesture.onStart}
          onCommit={editor.gesture.onCommit}
          keyState={panState}
          keyHint={panState === "key" ? t("keyHint") : t("interpolatedHint")}
        />
      </KeyedField>
      <NormalizeFields target={{ clipIds: editor.ids }} disabled={disabled} />
    </InspectorSection>
  );
}
