"use client";

import { useTranslations } from "next-intl";

import type { Gradient, Layer, Shadow } from "@/lib/studio/document";
import { LAYER_RANGES } from "@/lib/studio/layer-ranges";
import type { LayerPatch } from "@/lib/studio/layers";

import { ColorField, InspectorSection, NumberField, SwitchRow, SwitchToggle } from "../controls";

export const DEFAULT_SHADOW: Shadow = { color: "#00000066", blur: 12, x: 0, y: 6 };
export const DEFAULT_OUTLINE = { stroke: "#000000", strokeWidth: 4 };
export const DEFAULT_GRADIENT: Gradient = { from: "#6366f1", to: "#ec4899", angle: 45 };

interface EffectProps {
  layer: Layer;
  disabled: boolean;
  onPatch: (patch: LayerPatch) => void;
}

export function ShadowSection({ layer, disabled, onPatch }: EffectProps) {
  const t = useTranslations("studio.image.inspector.shadow");
  const shadow = layer.shadow;
  const set = (patch: Partial<Shadow>) => shadow && onPatch({ shadow: { ...shadow, ...patch } });
  return (
    <InspectorSection
      title={t("title")}
      action={<SwitchToggle label={t("toggle")} checked={Boolean(shadow)} disabled={disabled} onChange={(on) => onPatch({ shadow: on ? DEFAULT_SHADOW : undefined })} />}
    >
      {shadow ? (
        <div className="space-y-2">
          <ColorField label={t("color")} value={shadow.color} disabled={disabled} onCommit={(color) => set({ color })} />
          <div className="grid grid-cols-3 gap-2">
            <NumberField label={t("blur")} short={t("blurShort")} value={shadow.blur} min={LAYER_RANGES.shadowBlur[0]} max={LAYER_RANGES.shadowBlur[1]} disabled={disabled} onCommit={(blur) => set({ blur })} />
            <NumberField label={t("x")} short="X" value={shadow.x} min={LAYER_RANGES.shadowOffset[0]} max={LAYER_RANGES.shadowOffset[1]} disabled={disabled} onCommit={(x) => set({ x })} />
            <NumberField label={t("y")} short="Y" value={shadow.y} min={LAYER_RANGES.shadowOffset[0]} max={LAYER_RANGES.shadowOffset[1]} disabled={disabled} onCommit={(y) => set({ y })} />
          </div>
        </div>
      ) : null}
    </InspectorSection>
  );
}

export function OutlineSection({ layer, disabled, onPatch }: EffectProps) {
  const t = useTranslations("studio.image.inspector.outline");
  const on = (layer.strokeWidth ?? 0) > 0;
  return (
    <InspectorSection
      title={t("title")}
      action={
        <SwitchToggle
          label={t("toggle")}
          checked={on}
          disabled={disabled}
          onChange={(next) => onPatch(next ? { stroke: layer.stroke || DEFAULT_OUTLINE.stroke, strokeWidth: DEFAULT_OUTLINE.strokeWidth } : { strokeWidth: 0 })}
        />
      }
    >
      {on ? (
        <div className="space-y-2">
          <ColorField label={t("color")} value={layer.stroke ?? ""} disabled={disabled} onCommit={(stroke) => onPatch({ stroke })} />
          <NumberField
            label={t("width")}
            value={layer.strokeWidth ?? 0}
            min={0}
            max={LAYER_RANGES.strokeWidth[1]}
            suffix="px"
            disabled={disabled}
            onCommit={(strokeWidth) => onPatch({ strokeWidth })}
          />
        </div>
      ) : null}
    </InspectorSection>
  );
}

export function GradientFields({ gradient, fallback, disabled, onChange }: { gradient: Gradient | undefined; fallback: string; disabled: boolean; onChange: (gradient: Gradient | undefined) => void }) {
  const t = useTranslations("studio.image.inspector.gradient");
  return (
    <div className="space-y-2">
      <SwitchRow label={t("toggle")} checked={Boolean(gradient)} disabled={disabled} onChange={(on) => onChange(on ? { from: fallback || DEFAULT_GRADIENT.from, to: DEFAULT_GRADIENT.to, angle: DEFAULT_GRADIENT.angle } : undefined)} />
      {gradient ? (
        <>
          <ColorField label={t("from")} value={gradient.from} disabled={disabled} onCommit={(from) => onChange({ ...gradient, from })} />
          <ColorField label={t("to")} value={gradient.to} disabled={disabled} onCommit={(to) => onChange({ ...gradient, to })} />
          <NumberField label={t("angle")} value={gradient.angle} min={-360} max={360} suffix="°" disabled={disabled} onCommit={(angle) => onChange({ ...gradient, angle })} />
        </>
      ) : null}
    </div>
  );
}
