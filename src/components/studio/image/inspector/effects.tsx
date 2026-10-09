"use client";

import { useTranslations } from "next-intl";

import { CapIcon, JoinIcon } from "@/components/studio/canvas/vector/stroke-icons";
import { LINE_CAPS, LINE_JOINS, RADIAL_RADIUS_RANGE, type Gradient, type GradientKind, type Layer, type Shadow } from "@/lib/studio/document";
import { DEFAULT_SHADOW, gradientWithKind, startGradient } from "@/lib/studio/layer-effects";
import { LAYER_RANGES } from "@/lib/studio/layer-ranges";
import type { LayerPatch } from "@/lib/studio/layers";
import { strokeStyle } from "@/lib/studio/paint";
import { DASH_PRESET_IDS, dashPresetOf, dashPresetPatch, type DashPreset } from "@/lib/studio/stroke-presets";

import { ColorField, InspectorSection, LABEL_CLASS, NumberField, SelectField, SwitchRow, SwitchToggle, ToggleButton } from "../controls";

export const DEFAULT_OUTLINE = { stroke: "#000000", strokeWidth: 4 };

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

export function StrokeStyleFields({ layer, disabled, onPatch, withCaps = true }: EffectProps & { withCaps?: boolean }) {
  const t = useTranslations("studio.vectors.stroke");
  const style = strokeStyle(layer);
  const preset = dashPresetOf(layer);
  const options = [...DASH_PRESET_IDS.map((id) => ({ value: id as DashPreset | "custom", label: t(`dashes.${id}`) })), ...(preset === "custom" ? [{ value: "custom" as const, label: t("dashes.custom") }] : [])];
  return (
    <div className="space-y-2">
      <SelectField<DashPreset | "custom"> label={t("dash")} value={preset} options={options} disabled={disabled} onChange={(id) => id !== "custom" && onPatch(dashPresetPatch(id))} />
      {preset !== "solid" ? (
        <NumberField label={t("dashOffset")} value={layer.dashOffset ?? 0} min={LAYER_RANGES.dashOffset[0]} max={LAYER_RANGES.dashOffset[1]} step={0.5} decimals={1} disabled={disabled} onCommit={(value) => onPatch({ dashOffset: value === 0 ? undefined : value })} />
      ) : null}
      {withCaps ? (
        <div role="group" aria-label={t("caps")} className="flex items-center gap-1">
          <span className={LABEL_CLASS}>{t("caps")}</span>
          {LINE_CAPS.map((cap) => (
            <ToggleButton key={cap} label={t(`cap.${cap}`)} pressed={style.lineCap === cap} disabled={disabled} onClick={() => onPatch({ lineCap: cap })}>
              <CapIcon cap={cap} className="h-4 w-4" />
            </ToggleButton>
          ))}
        </div>
      ) : null}
      <div role="group" aria-label={t("joins")} className="flex items-center gap-1">
        <span className={LABEL_CLASS}>{t("joins")}</span>
        {LINE_JOINS.map((join) => (
          <ToggleButton key={join} label={t(`join.${join}`)} pressed={style.lineJoin === join} disabled={disabled} onClick={() => onPatch({ lineJoin: join })}>
            <JoinIcon join={join} className="h-4 w-4" />
          </ToggleButton>
        ))}
      </div>
      {style.lineJoin === "miter" ? (
        <NumberField label={t("miterLimit")} value={style.miterLimit} min={LAYER_RANGES.miterLimit[0]} max={LAYER_RANGES.miterLimit[1]} step={1} disabled={disabled} onCommit={(miterLimit) => onPatch({ miterLimit })} />
      ) : null}
    </div>
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
          <StrokeStyleFields layer={layer} disabled={disabled} onPatch={onPatch} withCaps={false} />
        </div>
      ) : null}
    </InspectorSection>
  );
}

export function GradientFields({ gradient, fallback, disabled, onChange }: { gradient: Gradient | undefined; fallback: string; disabled: boolean; onChange: (gradient: Gradient | undefined) => void }) {
  const t = useTranslations("studio.image.inspector.gradient");
  return (
    <div className="space-y-2">
      <SwitchRow label={t("toggle")} checked={Boolean(gradient)} disabled={disabled} onChange={(on) => onChange(on ? startGradient(fallback) : undefined)} />
      {gradient ? (
        <>
          <SelectField<GradientKind>
            label={t("kind")}
            value={gradient.kind === "radial" ? "radial" : "linear"}
            options={[
              { value: "linear", label: t("linear") },
              { value: "radial", label: t("radial") },
            ]}
            disabled={disabled}
            onChange={(kind) => onChange(gradientWithKind(gradient, kind))}
          />
          <ColorField label={t("from")} value={gradient.from} disabled={disabled} onCommit={(from) => onChange({ ...gradient, from })} />
          <ColorField label={t("via")} value={gradient.via ?? ""} allowEmpty emptyLabel={t("viaNone")} disabled={disabled} onCommit={(via) => onChange({ ...gradient, via: via || undefined })} />
          <ColorField label={t("to")} value={gradient.to} disabled={disabled} onCommit={(to) => onChange({ ...gradient, to })} />
          {gradient.kind === "radial" ? (
            <div className="grid grid-cols-3 gap-2">
              <NumberField label={t("centerX")} short="X" value={Math.round((gradient.cx ?? 0) * 100)} min={0} max={100} suffix="%" disabled={disabled} onCommit={(x) => onChange({ ...gradient, cx: x / 100 })} />
              <NumberField label={t("centerY")} short="Y" value={Math.round((gradient.cy ?? 0) * 100)} min={0} max={100} suffix="%" disabled={disabled} onCommit={(y) => onChange({ ...gradient, cy: y / 100 })} />
              <NumberField
                label={t("radius")}
                short={t("radiusShort")}
                value={Math.round((gradient.radius ?? 0) * 100)}
                min={RADIAL_RADIUS_RANGE[0] * 100}
                max={RADIAL_RADIUS_RANGE[1] * 100}
                suffix="%"
                disabled={disabled}
                onCommit={(radius) => onChange({ ...gradient, radius: radius / 100 })}
              />
            </div>
          ) : (
            <NumberField label={t("angle")} value={gradient.angle} min={-360} max={360} suffix="°" disabled={disabled} onCommit={(angle) => onChange({ ...gradient, angle })} />
          )}
        </>
      ) : null}
    </div>
  );
}
