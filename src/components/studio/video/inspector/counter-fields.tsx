"use client";

import { useLocale, useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import {
  COUNTER_LIMITS,
  COUNTER_LOCALES,
  counterLocaleFor,
  counterPatch,
  counterRange,
  counterText,
  counterValueAt,
  countEndsPatch,
  countPatch,
  finalCounterValue,
  startCounterPatch,
  type Counter,
  type CountRange,
} from "@/lib/studio/counter";
import type { Clip } from "@/lib/studio/document";
import { keyState, localTime, toggleKeyAt } from "@/lib/studio/keyframe-edit";
import { COUNTER_RANGE } from "@/lib/studio/text-properties";

import { usePanelPlayhead, useVideoEditor } from "../editor-context";
import { EasingPicker } from "./easing-picker";
import { FieldGrid, InspectorSection, NumberField, SelectField, TextField, ToggleField } from "./fields";
import { KeyedField } from "./key-toggle";
import type { SelectionEditor } from "./use-selection-editor";

const MS = 1000;

interface CounterFieldsProps {
  clip: Clip;
  disabled: boolean;
  editor: SelectionEditor;
}

export function CounterFields({ clip, disabled, editor }: CounterFieldsProps) {
  const t = useTranslations("studio.video.counter");
  const appLocale = useLocale();
  const { commands } = useVideoEditor();
  const playheadMs = usePanelPlayhead();
  const localMs = localTime(clip, playheadMs);
  const sample = localMs ?? Math.min(Math.max(0, playheadMs - clip.startMs), clip.durationMs);
  const counter = clip.counter;
  const gesture = { onGestureStart: editor.gesture.onStart, onGestureEnd: editor.gesture.onCommit };

  if (!counter) {
    return (
      <InspectorSection title={t("title")}>
        <Button variant="outline" size="sm" title={t("add")} disabled={disabled} onClick={() => editor.patch((current) => startCounterPatch(current, counterLocaleFor(appLocale)))} />
        <p className="text-2xs text-muted-foreground">{t("hint")}</p>
      </InspectorSection>
    );
  }

  const range = counterRange(clip);
  const restyle = (change: Partial<Counter>) => editor.patch((current) => (current.counter ? counterPatch(current, { ...current.counter, ...change }) : null));
  const recount = (change: Partial<CountRange>) => editor.patch((current) => {
    const now = counterRange(current);
    return now ? countPatch(current, { ...now, ...change }) : null;
  });
  const affix = (field: "prefix" | "suffix") => (value: string) => restyle({ [field]: value === "" ? undefined : value });
  const valueField = { min: COUNTER_RANGE[0], max: COUNTER_RANGE[1], decimals: counter.decimals, step: 1, disabled };
  const state = keyState(clip, "counter", localMs);

  return (
    <InspectorSection title={t("title")}>
      {range ? (
        <>
          <FieldGrid>
            <NumberField label={t("from")} value={range.from} {...valueField} onCommit={(from) => editor.patch((current) => countEndsPatch(current, { from }))} {...gesture} />
            <NumberField label={t("to")} value={range.to} {...valueField} onCommit={(to) => editor.patch((current) => countEndsPatch(current, { to }))} {...gesture} />
            <NumberField label={t("start")} unit="s" step={0.1} decimals={2} min={0} max={clip.durationMs / MS} value={range.startMs / MS} disabled={disabled} onCommit={(seconds) => recount({ startMs: Math.round(seconds * MS) })} {...gesture} />
            <NumberField label={t("length")} unit="s" step={0.1} decimals={2} min={0} max={clip.durationMs / MS} value={range.durationMs / MS} disabled={disabled} onCommit={(seconds) => recount({ durationMs: Math.round(seconds * MS) })} {...gesture} />
          </FieldGrid>
          <EasingPicker label={t("curve")} value={range.easing} disabled={disabled} onPick={(easing) => recount({ easing })} />
          <Button variant="ghost" size="sm" title={t("hold")} disabled={disabled} onClick={() => editor.patch((current) => countPatch(current, { from: finalCounterValue(current), to: finalCounterValue(current), startMs: 0, durationMs: 0, easing: "linear" }))} />
        </>
      ) : (
        <>
          <KeyedField toggle={{ label: t("key"), state, disabled: disabled || localMs === null, onClick: () => commands.patchKeyframes(clip.id, (current, at, aspect) => toggleKeyAt(current, "counter", at, aspect)) }}>
            <NumberField label={t("value")} value={counterValueAt(clip, sample)} {...valueField} keyState={state} keyHint={state === "key" ? t("keyHint") : t("interpolatedHint")} onCommit={(value) => editor.keyed("counter", () => value)} {...gesture} />
          </KeyedField>
          <Button variant="outline" size="sm" title={t("count")} disabled={disabled} onClick={() => editor.patch((current) => countPatch(current, { from: 0, to: finalCounterValue(current), startMs: 0, durationMs: current.durationMs, easing: "easeOut" }))} />
        </>
      )}
      <FieldGrid>
        <NumberField label={t("decimals")} value={counter.decimals} step={1} decimals={0} min={COUNTER_LIMITS.decimals[0]} max={COUNTER_LIMITS.decimals[1]} disabled={disabled} onCommit={(decimals) => restyle({ decimals: Math.round(decimals) })} />
        <SelectField label={t("separators")} value={counter.locale} disabled={disabled} options={COUNTER_LOCALES.map((value) => ({ value, label: t(`locales.${value}`) }))} onChange={(locale) => restyle({ locale })} />
        <TextField label={t("prefix")} value={counter.prefix ?? ""} maxLength={COUNTER_LIMITS.affixRunes} disabled={disabled} onCommit={affix("prefix")} />
        <TextField label={t("suffix")} value={counter.suffix ?? ""} maxLength={COUNTER_LIMITS.affixRunes} disabled={disabled} onCommit={affix("suffix")} />
      </FieldGrid>
      <ToggleField label={t("grouping")} checked={counter.grouping} disabled={disabled} onChange={(grouping) => restyle({ grouping })} />
      <p className="text-2xs text-muted-foreground">{t("shows", { text: counterText(counter, counterValueAt(clip, sample)) })}</p>
      <Button variant="ghost" size="sm" title={t("remove")} disabled={disabled} onClick={() => editor.patch((current) => counterPatch(current, null))} />
    </InspectorSection>
  );
}
