"use client";

import { useTranslations } from "next-intl";

import type { Clip } from "@/lib/studio/document";
import { keyState, localTime, propertyValue, type KeyState } from "@/lib/studio/keyframe-edit";
import type { KeyframeProperty } from "@/lib/studio/keyframes";
import { clipTime, sharedValue, toggleSelectionKey } from "@/lib/studio/selection-edit";

import { usePanelPlayhead } from "../editor-context";
import { SliderField } from "./fields";
import { KeyedField } from "./key-toggle";
import type { SelectionEditor } from "./use-selection-editor";

export interface KeyedSliderProps {
  clips: readonly Clip[];
  property: KeyframeProperty;
  label: string;
  min: number;
  max: number;
  step: number;
  scale?: number;
  fallback?: number;
  format: (shown: number) => string;
  disabled: boolean;
  editor: SelectionEditor;
}

export function KeyedSlider({ clips, property, label, min, max, step, scale = 1, fallback = 0, format, disabled, editor }: KeyedSliderProps) {
  const tk = useTranslations("studio.video.keyframes");
  const ti = useTranslations("studio.video.inspector");
  const playheadMs = usePanelPlayhead();
  const shared = sharedValue(clips, (clip) => Math.round(propertyValue(clip, property, clipTime(clip, playheadMs)) * scale * 100) / 100);
  const value = shared.kind === "same" ? shared.value : null;
  const keyShared = sharedValue(clips, (clip) => keyState(clip, property, localTime(clip, playheadMs)));
  const state: KeyState = keyShared.kind === "same" ? keyShared.value : "static";
  return (
    <KeyedField toggle={{ label: tk("keyHere", { name: label }), state, disabled, onClick: () => editor.run((doc) => toggleSelectionKey(doc, editor.ids, property, editor.playheadMs())) }}>
      <SliderField
        label={label}
        value={value}
        fallback={fallback}
        min={min}
        max={max}
        step={step}
        valueText={format(value ?? fallback)}
        disabled={disabled}
        keyState={state}
        keyHint={state === "key" ? ti("keyHint") : ti("interpolatedHint")}
        onStart={editor.gesture.onStart}
        onCommit={editor.gesture.onCommit}
        onChange={(next) => editor.keyed(property, () => next / scale)}
      />
    </KeyedField>
  );
}
