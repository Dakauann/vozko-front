"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { ArrowsClockwise, Shuffle, Trash } from "@/components/icons";
import { randomBehaviorSeed, type BehaviorSettings } from "@/lib/studio/behavior-edit";
import { BEHAVIOR_KINDS, BEHAVIOR_LIMITS, BEHAVIOR_SPANS, behaviorProperties, KEY_READING_KINDS, LOOP_MODES, LOOP_SIDES, type Behavior, type BehaviorKind, type BehaviorProperty, type LoopMode, type LoopSide } from "@/lib/studio/behaviors";
import type { Clip } from "@/lib/studio/document";

import { BehaviorGlyph } from "../behavior-glyph";
import { useEditorState, useVideoEditor } from "../editor-context";
import { ToolButton } from "../tool-button";
import { useTrackNames } from "../use-track-names";
import { FieldGrid, InspectorSection, NumberField, SelectField } from "./fields";
import type { SelectionEditor } from "./use-selection-editor";

const DISPLAY: Record<BehaviorProperty, { scale: number; unit: string; decimals: number }> = {
  x: { scale: 100, unit: "%", decimals: 1 },
  y: { scale: 100, unit: "%", decimals: 1 },
  scale: { scale: 100, unit: "%", decimals: 1 },
  scaleX: { scale: 100, unit: "%", decimals: 1 },
  scaleY: { scale: 100, unit: "%", decimals: 1 },
  rotation: { scale: 1, unit: "°", decimals: 1 },
  opacity: { scale: 100, unit: "%", decimals: 0 },
  blur: { scale: 1, unit: "px", decimals: 1 },
};

const SPIN_PROPERTY: BehaviorProperty = "rotation";

interface BehaviorFieldsProps {
  clip: Clip;
  disabled: boolean;
  editor: SelectionEditor;
}

export function BehaviorFields({ clip, disabled, editor }: BehaviorFieldsProps) {
  const t = useTranslations("studio.video.behaviors");
  const tp = useTranslations("studio.video.keyframes.properties");
  const { commands } = useVideoEditor();
  const allowed = behaviorProperties(clip.type);
  const [chosen, setChosen] = useState<BehaviorProperty>(allowed[0] ?? "x");
  const property = allowed.includes(chosen) ? chosen : allowed[0];
  const list = clip.behaviors ?? [];
  const taken = (kind: BehaviorKind, on: BehaviorProperty) => list.some((behavior) => behavior.kind === kind && behavior.property === on);

  if (!property) return null;

  return (
    <InspectorSection id="behaviors" group="animation" title={t("title")} summary={list.length > 0 ? t("summary", { count: list.length }) : t("none")}>
      <SelectField<BehaviorProperty> label={t("property")} value={property} options={allowed.map((option) => ({ value: option, label: tp(option) }))} disabled={disabled} onChange={setChosen} />
      <div role="group" aria-label={t("add")} className="flex flex-wrap items-center gap-0.5">
        {BEHAVIOR_KINDS.map((kind) => (
          <ToolButton key={kind} size="sm" showLabel label={t(`kinds.${kind}`)} icon={<BehaviorGlyph kind={kind} className="h-3.5 w-4" />} disabled={disabled || taken(kind, property)} onClick={() => commands.addBehavior(clip.id, kind, property)} />
        ))}
        {allowed.includes(SPIN_PROPERTY) ? (
          <ToolButton size="sm" showLabel label={t("spin")} icon={<ArrowsClockwise className="h-3.5 w-3.5" />} disabled={disabled || taken("drift", SPIN_PROPERTY)} onClick={() => commands.addBehavior(clip.id, "drift", SPIN_PROPERTY)} />
        ) : null}
      </div>
      {list.length === 0 ? (
        <p className="text-2xs text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="space-y-2" aria-label={t("list")}>
          {list.map((behavior) => (
            <li key={behavior.id}>
              <BehaviorCard clip={clip} behavior={behavior} disabled={disabled} editor={editor} />
            </li>
          ))}
        </ul>
      )}
      <p className="text-2xs text-muted-foreground">{t("hint")}</p>
    </InspectorSection>
  );
}

interface BehaviorCardProps {
  clip: Clip;
  behavior: Behavior;
  disabled: boolean;
  editor: SelectionEditor;
}

function BehaviorCard({ clip, behavior, disabled, editor }: BehaviorCardProps) {
  const t = useTranslations("studio.video.behaviors");
  const tp = useTranslations("studio.video.keyframes.properties");
  const { commands } = useVideoEditor();
  const tracks = useEditorState((s) => s.document.tracks);
  const names = useTrackNames(tracks);
  const display = DISPLAY[behavior.property];
  const span = BEHAVIOR_SPANS[behavior.property];
  const update = (settings: BehaviorSettings) => commands.updateBehavior(clip.id, behavior.id, settings);
  const gesture = { onGestureStart: editor.gesture.onStart, onGestureEnd: editor.gesture.onCommit };
  const keyCount = clip.keyframes?.[behavior.property]?.length ?? 0;
  const shown = (key: keyof BehaviorSettings, value: number, low: number, high: number, label: string, unit: string, step: number, decimals: number, scale = 1) => (
    <NumberField
      label={label}
      unit={unit}
      step={step}
      decimals={decimals}
      min={low * scale}
      max={high * scale}
      value={value * scale}
      disabled={disabled}
      onCommit={(next) => update({ [key]: Math.min(high, Math.max(low, next / scale)) })}
      onNudge={(delta) => update({ [key]: Math.min(high, Math.max(low, value + delta / scale)) })}
      {...gesture}
    />
  );
  const amount = (value: number, low: number) => shown("amount", value, low, span, t("fields.amount"), display.unit, 0.1, display.decimals, display.scale);

  return (
    <div className="space-y-2 rounded-[--radius] border border-border p-2" data-behavior={behavior.kind}>
      <div className="flex items-center gap-1.5">
        <BehaviorGlyph kind={behavior.kind} className="h-3.5 w-4 text-primary-ink" />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{t("item", { kind: t(`kinds.${behavior.kind}`), property: tp(behavior.property) })}</span>
        <ToolButton size="sm" showLabel label={t("bake")} icon={null} disabled={disabled} onClick={() => void commands.bakeBehavior(clip.id, behavior.id)} />
        <ToolButton size="sm" label={t("remove")} icon={<Trash className="h-3.5 w-3.5" />} disabled={disabled} onClick={() => commands.removeBehavior(clip.id, behavior.id)} />
      </div>
      {behavior.kind === "wiggle" ? (
        <FieldGrid>
          {shown("frequency", behavior.frequency, BEHAVIOR_LIMITS.frequency[0], BEHAVIOR_LIMITS.frequency[1], t("fields.frequency"), "Hz", 0.1, 1)}
          {amount(behavior.amount, 0)}
          <div className="flex items-end gap-1">
            <div className="min-w-0 flex-1">{shown("seed", behavior.seed, BEHAVIOR_LIMITS.seed[0], BEHAVIOR_LIMITS.seed[1], t("fields.seed"), "", 1, 0)}</div>
            <ToolButton size="sm" label={t("fields.newSeed")} icon={<Shuffle className="h-3.5 w-3.5" />} disabled={disabled} onClick={() => update({ seed: randomBehaviorSeed() })} />
          </div>
        </FieldGrid>
      ) : null}
      {behavior.kind === "loop" ? (
        <FieldGrid>
          <SelectField<LoopMode> label={t("fields.mode")} value={behavior.mode} options={LOOP_MODES.map((mode) => ({ value: mode, label: t(`modes.${mode}`) }))} disabled={disabled} onChange={(mode) => update({ mode })} />
          <SelectField<LoopSide> label={t("fields.side")} value={behavior.side} options={LOOP_SIDES.map((side) => ({ value: side, label: t(`sides.${side}`) }))} disabled={disabled} onChange={(side) => update({ side })} />
        </FieldGrid>
      ) : null}
      {behavior.kind === "drift" ? <FieldGrid>{shown("rate", behavior.rate, -span, span, t("fields.rate"), `${display.unit}/s`, 1, display.decimals, display.scale)}</FieldGrid> : null}
      {behavior.kind === "overshoot" ? (
        <FieldGrid>
          {shown("amplitude", behavior.amplitude, BEHAVIOR_LIMITS.amplitude[0], BEHAVIOR_LIMITS.amplitude[1], t("fields.amplitude"), "", 0.01, 2)}
          {shown("frequency", behavior.frequency, BEHAVIOR_LIMITS.frequency[0], BEHAVIOR_LIMITS.frequency[1], t("fields.frequency"), "Hz", 0.1, 1)}
          {shown("decay", behavior.decay, BEHAVIOR_LIMITS.decay[0], BEHAVIOR_LIMITS.decay[1], t("fields.decay"), "", 0.1, 1)}
        </FieldGrid>
      ) : null}
      {behavior.kind === "audioReact" ? (
        <>
          <SelectField<string>
            label={t("fields.track")}
            value={behavior.trackId}
            options={tracks.filter((track) => track.kind === "audio").map((track) => ({ value: track.id, label: names.get(track.id) ?? track.id }))}
            disabled={disabled}
            onChange={(trackId) => update({ trackId })}
          />
          <FieldGrid>
            {amount(behavior.amount, -span)}
            {shown("floorDb", behavior.floorDb, BEHAVIOR_LIMITS.db[0], behavior.ceilingDb - 1, t("fields.floorDb"), "dB", 1, 0)}
            {shown("ceilingDb", behavior.ceilingDb, behavior.floorDb + 1, BEHAVIOR_LIMITS.db[1], t("fields.ceilingDb"), "dB", 1, 0)}
          </FieldGrid>
        </>
      ) : null}
      {KEY_READING_KINDS.has(behavior.kind) && keyCount < 2 ? <p className="text-2xs text-muted-foreground">{t("needsKeys")}</p> : null}
    </div>
  );
}
