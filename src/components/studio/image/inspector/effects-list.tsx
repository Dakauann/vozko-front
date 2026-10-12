"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import type { Layer } from "@/lib/studio/document";
import type { EffectProperty } from "@/lib/studio/effect-keys";
import { EFFECT_RANGES, EFFECT_TYPES, GLOW_SOURCES, isOuterEffect, type Effect, type EffectType, type GlowSource } from "@/lib/studio/layer-paint";
import type { LayerPatch } from "@/lib/studio/layers";
import { addedEffect, effectsPatch, moved, removed, replaced } from "@/lib/studio/paint-edits";
import { cn } from "@/lib/utils";

import { ColorField, InspectorSection, NumberField, OUTLINE_BUTTON_CLASS, SelectField, SwitchRow } from "../controls";
import { ListRow } from "./paint-lists";
import { BlendField, OpacityField } from "./pattern-fields";

interface EffectsProps {
  layer: Layer;
  disabled: boolean;
  onPatch: (patch: LayerPatch) => void;
  types?: readonly EffectType[];
  shown?: (effect: Effect) => Effect;
  edit?: (stored: Effect, shown: Effect, next: Effect) => Effect | null;
  fieldKey?: (effect: Effect, property: EffectProperty) => ReactNode;
}

type FieldKey = (property: EffectProperty) => ReactNode;

function Keyed({ property, fieldKey, children }: { property: EffectProperty; fieldKey?: FieldKey; children: ReactNode }) {
  if (!fieldKey) return <>{children}</>;
  return (
    <div className="flex items-end gap-1">
      <div className="min-w-0 flex-1">{children}</div>
      {fieldKey(property)}
    </div>
  );
}

const SHADOWS = new Set<EffectType>(["drop-shadow", "inner-shadow"]);

function EffectFields({ effect, disabled, onChange, fieldKey }: { effect: Effect; disabled: boolean; onChange: (effect: Effect) => void; fieldKey?: FieldKey }) {
  const t = useTranslations("studio.image.paint.effects");
  return (
    <>
      <ColorField label={t("color")} value={effect.color} disabled={disabled} onCommit={(color) => onChange({ ...effect, color })} />
      <Keyed property="opacity" fieldKey={fieldKey}>
        <OpacityField value={effect.opacity} disabled={disabled} onChange={(opacity) => onChange({ ...effect, opacity })} />
      </Keyed>
      {SHADOWS.has(effect.type) ? (
        <div className="grid grid-cols-2 gap-2">
          <Keyed property="x" fieldKey={fieldKey}>
            <NumberField label={t("x")} short="X" value={effect.x} min={EFFECT_RANGES.offset[0]} max={EFFECT_RANGES.offset[1]} suffix="px" disabled={disabled} onCommit={(x) => onChange({ ...effect, x })} />
          </Keyed>
          <Keyed property="y" fieldKey={fieldKey}>
            <NumberField label={t("y")} short="Y" value={effect.y} min={EFFECT_RANGES.offset[0]} max={EFFECT_RANGES.offset[1]} suffix="px" disabled={disabled} onCommit={(y) => onChange({ ...effect, y })} />
          </Keyed>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Keyed property="blur" fieldKey={fieldKey}>
          <NumberField label={t("blur")} short={t("blurShort")} value={effect.blur} min={EFFECT_RANGES.blur[0]} max={EFFECT_RANGES.blur[1]} suffix="px" disabled={disabled} onCommit={(blur) => onChange({ ...effect, blur })} />
        </Keyed>
        <Keyed property="spread" fieldKey={fieldKey}>
          <NumberField label={t("spread")} short={t("spreadShort")} value={effect.spread} min={EFFECT_RANGES.spread[0]} max={EFFECT_RANGES.spread[1]} suffix="px" disabled={disabled} onCommit={(spread) => onChange({ ...effect, spread })} />
        </Keyed>
      </div>
      {isOuterEffect(effect.type) ? null : <BlendField value={effect.blendMode} disabled={disabled} onChange={(blendMode) => onChange({ ...effect, blendMode })} />}
      {effect.type === "inner-glow" ? (
        <SelectField<GlowSource> label={t("source")} value={effect.source || "edge"} options={GLOW_SOURCES.map((source) => ({ value: source, label: t(`sources.${source}`) }))} disabled={disabled} onChange={(source) => onChange({ ...effect, source })} />
      ) : null}
      {effect.type === "drop-shadow" ? <SwitchRow label={t("showBehind")} checked={Boolean(effect.showBehind)} disabled={disabled} onChange={(on) => onChange({ ...effect, showBehind: on || undefined })} /> : null}
    </>
  );
}

export function EffectsSection({ layer, disabled, onPatch, types = EFFECT_TYPES, shown, edit, fieldKey }: EffectsProps) {
  const t = useTranslations("studio.image.paint.effects");
  const effects = layer.effects ?? [];
  const set = (next: readonly Effect[]) => onPatch(effectsPatch(next));
  return (
    <InspectorSection title={t("title")}>
      <div role="group" aria-label={t("add")} className="flex flex-wrap gap-1">
        {types.map((type) => (
          <button key={type} type="button" className={cn(OUTLINE_BUTTON_CLASS, "h-7")} disabled={disabled} onClick={() => onPatch(addedEffect(layer, type))}>
            {t(`types.${type}`)}
          </button>
        ))}
      </div>
      {effects.map((effect, index) => (
        <ListRow
          key={effect.id}
          title={t(`types.${effect.type}`)}
          hidden={Boolean(effect.hidden)}
          disabled={disabled}
          first={index === 0}
          last={index === effects.length - 1}
          onHidden={(hidden) => set(replaced(effects, index, { ...effect, hidden: hidden || undefined }))}
          onMove={(delta) => set(moved(effects, index, -delta))}
          onRemove={() => set(removed(effects, index))}
        >
          <EffectFields
            effect={shown ? shown(effect) : effect}
            disabled={disabled}
            fieldKey={fieldKey ? (property) => fieldKey(effect, property) : undefined}
            onChange={(next) => {
              const result = edit ? edit(effect, shown ? shown(effect) : effect, next) : next;
              if (result) set(replaced(effects, index, result));
            }}
          />
        </ListRow>
      ))}
    </InspectorSection>
  );
}
