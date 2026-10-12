"use client";

import { useFormatter, useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import type { Clip, VideoDocument } from "@/lib/studio/document";
import { localTime } from "@/lib/studio/keyframe-edit";
import { lumaSelectionEdit, removeClipLuma, setClipLuma, toggleClipLumaKey, type LumaEdit, type LumaPatch } from "@/lib/studio/luma-edit";
import { LUMA_KEY_MODES, LUMA_PROPERTIES, LUMA_RANGES, lumaKeyState, lumaValue, type LumaKeyMode, type LumaProperty } from "@/lib/studio/luma-key";

import { usePanelPlayhead } from "../editor-context";
import { InspectorSection, SliderField } from "./fields";
import { KeyedField } from "./key-toggle";
import { KeyViewToggle } from "./key-view-toggle";
import type { SelectionEditor } from "./use-selection-editor";

const PERCENT = 100;

interface LumaKeyFieldsProps {
  clip: Clip;
  disabled: boolean;
  editor: SelectionEditor;
}

export function LumaKeyFields({ clip, disabled, editor }: LumaKeyFieldsProps) {
  const t = useTranslations("studio.luma");
  const format = useFormatter();
  const playheadMs = usePanelPlayhead();
  const key = clip.lumaKey;
  const localMs = localTime(clip, playheadMs);
  const run = (edit: (doc: VideoDocument) => LumaEdit) => editor.run((doc) => lumaSelectionEdit(edit(doc)));
  const patch = (change: LumaPatch) => run((doc) => setClipLuma(doc, clip.id, change, localMs));

  if (!key) {
    return (
      <InspectorSection title={t("title")}>
        <p className="text-2xs text-muted-foreground">{t("intro")}</p>
        <div className="flex flex-wrap gap-2">
          {LUMA_KEY_MODES.map((mode) => (
            <Button key={mode} variant="outline" size="sm" disabled={disabled} title={t(`start.${mode}`)} onClick={() => patch({ mode })} />
          ))}
        </div>
      </InspectorSection>
    );
  }

  const slider = (property: LumaProperty) => {
    const state = lumaKeyState(key, property, localMs);
    const value = lumaValue(key, property, localMs ?? 0) * PERCENT;
    const [low, high] = LUMA_RANGES[property];
    const label = t(`fields.${property}`);
    return (
      <KeyedField
        key={property}
        toggle={{
          label: t("key", { field: label }),
          state,
          disabled: disabled || localMs === null,
          onClick: () => {
            if (localMs !== null) run((doc) => toggleClipLumaKey(doc, clip.id, property, localMs));
          },
        }}
      >
        <SliderField
          label={label}
          value={value}
          fallback={value}
          min={low * PERCENT}
          max={high * PERCENT}
          step={0.5}
          valueText={format.number(value / PERCENT, { style: "percent", maximumFractionDigits: 1 })}
          disabled={disabled}
          keyState={state}
          keyHint={state === "key" ? t("keyHint") : t("interpolatedHint")}
          onStart={editor.gesture.onStart}
          onCommit={editor.gesture.onCommit}
          onChange={(next) => patch({ [property]: next / PERCENT })}
        />
      </KeyedField>
    );
  };

  return (
    <InspectorSection title={t("title")}>
      <KeyViewToggle clipId={clip.id} label={t("view")} labels={{ composite: t("views.composite"), matte: t("views.matte"), original: t("views.original") }} />
      <div className="space-y-1">
        <span className="block text-2xs text-muted-foreground">{t("mode")}</span>
        <ElevatedPillToggle<LumaKeyMode>
          aria-label={t("mode")}
          value={key.mode}
          onChange={(mode) => {
            if (!disabled) patch({ mode });
          }}
          className="flex w-full [&>button]:flex-1"
          options={LUMA_KEY_MODES.map((mode) => ({ value: mode, label: t(`modes.${mode}`), disabled }))}
        />
      </div>
      {LUMA_PROPERTIES.map(slider)}
      {localMs === null ? <p className="text-2xs text-muted-foreground">{t("outsideHint")}</p> : null}
      <p className="text-2xs text-muted-foreground">{t("tuningHint")}</p>
      <div>
        <Button variant="ghost" size="sm" disabled={disabled} title={t("remove")} onClick={() => run((doc) => removeClipLuma(doc, clip.id))} />
      </div>
    </InspectorSection>
  );
}
