"use client";

import { useTranslations } from "next-intl";

import type { Clip } from "@/lib/studio/document";
import { keyState, localTime, propertyValue, toggleKeyAt } from "@/lib/studio/keyframe-edit";
import { lineOptionsPatch, takesLineAnimation, toggleLineGroup, WAVE_MODES } from "@/lib/studio/line-animation";
import { LINE_GROUPS, LINE_RANGES, WIGGLE_SEED_RANGE, linePropertiesOf, type LineGroup, type LineProperty } from "@/lib/studio/line-properties";

import { usePanelPlayhead, useVideoEditor } from "../editor-context";
import { LINE_UNITS } from "../line-units";
import { InspectorSection, NumberField, SelectField, ToggleField } from "./fields";
import { KeyedField } from "./key-toggle";
import type { SelectionEditor } from "./use-selection-editor";

interface LineFieldsProps {
  clip: Clip;
  disabled: boolean;
  editor: SelectionEditor;
}

export function LineFields({ clip, disabled, editor }: LineFieldsProps) {
  const t = useTranslations("studio.video.line");
  const names = useTranslations("studio.video.keyframes.properties");
  const { commands } = useVideoEditor();
  const playheadMs = usePanelPlayhead();
  const localMs = localTime(clip, playheadMs);
  const sample = localMs ?? Math.min(Math.max(0, playheadMs - clip.startMs), clip.durationMs);
  const available = clip.layer !== undefined && takesLineAnimation(clip.layer);
  const gesture = { onGestureStart: editor.gesture.onStart, onGestureEnd: editor.gesture.onCommit };

  const field = (property: LineProperty) => {
    const unit = LINE_UNITS[property];
    const [min, max] = LINE_RANGES[property];
    const state = keyState(clip, property, localMs);
    const label = names(property);
    return (
      <KeyedField
        key={property}
        toggle={{ label: t("key", { field: label }), state, disabled: disabled || localMs === null, onClick: () => commands.patchKeyframes(clip.id, (current, at, aspect) => toggleKeyAt(current, property, at, aspect)) }}
      >
        <NumberField
          label={label}
          value={propertyValue(clip, property, sample) * unit.scale}
          unit={unit.unit || undefined}
          decimals={unit.decimals}
          step={unit.step}
          min={min * unit.scale}
          max={max * unit.scale}
          disabled={disabled}
          keyState={state}
          keyHint={state === "key" ? t("keyHint") : t("interpolatedHint")}
          onCommit={(value) => editor.keyed(property, () => value / unit.scale)}
          onNudge={(delta) => editor.keyed(property, (shown) => shown + delta / unit.scale)}
          {...gesture}
        />
      </KeyedField>
    );
  };

  const group = (name: LineGroup) => {
    const on = Boolean(clip.line?.[name]);
    return (
      <div key={name} className="space-y-2 rounded-md border border-border p-2">
        <ToggleField label={t(`groups.${name}`)} checked={on} disabled={disabled || (!on && !available)} onChange={(next) => editor.patch((current) => toggleLineGroup(current, name, next))} />
        {on ? (
          <>
            {name === "wave" ? (
              <SelectField label={t("mode")} value={clip.line!.wave!.mode} disabled={disabled} options={WAVE_MODES.map((mode) => ({ value: mode, label: t(`modes.${mode}`) }))} onChange={(mode) => editor.patch((current) => lineOptionsPatch(current, { mode }))} />
            ) : null}
            <div className="grid grid-cols-2 gap-2">{linePropertiesOf(name).map(field)}</div>
            {name === "trim" ? <ToggleField label={t("sequential")} checked={Boolean(clip.line!.trim!.sequential)} disabled={disabled} onChange={(sequential) => editor.patch((current) => lineOptionsPatch(current, { sequential }))} /> : null}
            {name === "wiggle" ? (
              <NumberField label={t("seed")} value={clip.line!.wiggle!.seed} min={WIGGLE_SEED_RANGE[0]} max={WIGGLE_SEED_RANGE[1]} disabled={disabled} onCommit={(seed) => editor.patch((current) => lineOptionsPatch(current, { seed: Math.round(seed) }))} />
            ) : null}
          </>
        ) : null}
      </div>
    );
  };

  return (
    <InspectorSection title={t("title")}>
      {available ? null : <p className="text-2xs text-muted-foreground">{t("unavailable")}</p>}
      {LINE_GROUPS.map(group)}
      <p className="text-2xs text-muted-foreground">{localMs === null ? t("outsideHint") : t("hint")}</p>
    </InspectorSection>
  );
}
