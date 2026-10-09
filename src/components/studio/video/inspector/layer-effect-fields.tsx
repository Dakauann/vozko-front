"use client";

import { useTranslations } from "next-intl";

import { BLEND_MODES, RADIAL_RADIUS_RANGE, type BlendMode, type Gradient, type GradientKind, type Layer } from "@/lib/studio/document";
import { clampTo, type Range } from "@/lib/studio/layer-ranges";
import { DEFAULT_HIGHLIGHT, gradientWithKind, gradientWithVia, startGradient } from "@/lib/studio/layer-effects";
import { sharedValue } from "@/lib/studio/selection-edit";

import { ColorField, FieldGrid, NumberField, SelectField, ToggleField } from "./fields";

export type LayerChange = (layer: Layer) => Partial<Layer>;

interface EffectFieldsProps {
  layers: readonly Layer[];
  disabled?: boolean;
  change: (build: LayerChange) => boolean;
}

const CURVE_RANGE: Range = [-100, 100];
const PERCENT: Range = [0, 100];
const ANGLE_RANGE: Range = [-360, 360];
const RADIAL_RANGE: Range = [RADIAL_RADIUS_RANGE[0] * 100, RADIAL_RADIUS_RANGE[1] * 100];

function sharedOf(layers: readonly Layer[]) {
  return <T,>(get: (layer: Layer) => T): T | null => {
    const value = sharedValue(layers, get);
    return value.kind === "same" ? value.value : null;
  };
}

export function takesGradient(layer: Layer): boolean {
  return layer.type === "text" || (layer.type === "shape" && layer.shape !== "line" && layer.shape !== "arrow");
}

export function isGradiented(layers: readonly Layer[]): boolean {
  return layers.every((layer) => Boolean(layer.gradient));
}

function GradientNumber({ label, value, range, unit, change, disabled }: { label: string; value: number | null; range: Range; unit: string; change: (value: number) => void; disabled?: boolean }) {
  return <NumberField label={label} unit={unit} min={range[0]} max={range[1]} value={value} disabled={disabled} onCommit={change} />;
}

export function GradientFields({ layers, disabled, change }: EffectFieldsProps) {
  const t = useTranslations("studio.image.inspector.gradient");
  const tl = useTranslations("studio.video.layer");
  const shared = sharedOf(layers);
  const on = shared((layer) => Boolean(layer.gradient));
  const edit = (build: (gradient: Gradient) => Gradient) => change((layer) => (layer.gradient ? { gradient: build(layer.gradient) } : {}));
  const radial = shared((layer) => layer.gradient?.kind === "radial");
  const via = shared((layer) => Boolean(layer.gradient?.via));
  const percent = (get: (gradient: Gradient) => number | undefined) => shared((layer) => Math.round((get(layer.gradient!) ?? 0) * 100));

  return (
    <div className="space-y-2">
      <ToggleField label={t("toggle")} checked={on} disabled={disabled} onChange={(next) => change((layer) => ({ gradient: next ? (layer.gradient ?? startGradient(layer.fill)) : undefined }))} />
      {on ? (
        <>
          <FieldGrid>
            <SelectField<GradientKind>
              label={t("kind")}
              value={radial === null ? null : radial ? "radial" : "linear"}
              options={[
                { value: "linear", label: t("linear") },
                { value: "radial", label: t("radial") },
              ]}
              disabled={disabled}
              onChange={(kind) => edit((gradient) => gradientWithKind(gradient, kind))}
            />
            {radial === false ? (
              <GradientNumber label={t("angle")} unit="°" range={ANGLE_RANGE} value={shared((layer) => layer.gradient!.angle)} disabled={disabled} change={(angle) => edit((gradient) => ({ ...gradient, angle }))} />
            ) : null}
            <ColorField label={t("from")} value={shared((layer) => layer.gradient!.from)} disabled={disabled} onChange={(from) => edit((gradient) => ({ ...gradient, from }))} />
            <ColorField label={t("to")} value={shared((layer) => layer.gradient!.to)} disabled={disabled} onChange={(to) => edit((gradient) => ({ ...gradient, to }))} />
          </FieldGrid>
          <ToggleField label={tl("gradientVia")} checked={via} disabled={disabled} onChange={(next) => edit((gradient) => gradientWithVia(gradient, next))} />
          {via ? <ColorField label={t("via")} value={shared((layer) => layer.gradient!.via ?? "")} disabled={disabled} onChange={(color) => edit((gradient) => ({ ...gradient, via: color }))} /> : null}
          {radial ? (
            <FieldGrid>
              <GradientNumber label={t("centerX")} unit="%" range={PERCENT} value={percent((g) => g.cx)} disabled={disabled} change={(x) => edit((gradient) => ({ ...gradient, cx: x / 100 }))} />
              <GradientNumber label={t("centerY")} unit="%" range={PERCENT} value={percent((g) => g.cy)} disabled={disabled} change={(y) => edit((gradient) => ({ ...gradient, cy: y / 100 }))} />
              <GradientNumber label={t("radius")} unit="%" range={RADIAL_RANGE} value={percent((g) => g.radius)} disabled={disabled} change={(radius) => edit((gradient) => ({ ...gradient, radius: radius / 100 }))} />
            </FieldGrid>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function TextEffectFields({ layers, disabled, change }: EffectFieldsProps) {
  const t = useTranslations("studio.image.inspector.text");
  const shared = sharedOf(layers);
  const set = (patch: Partial<Layer>) => change(() => patch);
  const curved = layers.some((layer) => Math.abs(layer.curve ?? 0) > 0);
  const highlighted = shared((layer) => Boolean(layer.highlight));
  const editHighlight = (patch: Partial<NonNullable<Layer["highlight"]>>) => change((layer) => (layer.highlight ? { highlight: { ...layer.highlight, ...patch } } : {}));

  return (
    <div className="space-y-2">
      <NumberField
        label={t("curve")}
        unit="%"
        min={CURVE_RANGE[0]}
        max={CURVE_RANGE[1]}
        value={shared((layer) => Math.round((layer.curve ?? 0) * 100))}
        disabled={disabled}
        onCommit={(value) => set({ curve: value === 0 ? undefined : value / 100 })}
        onNudge={(delta) =>
          change((layer) => {
            const next = clampTo(Math.round((layer.curve ?? 0) * 100) + delta, CURVE_RANGE);
            return { curve: next === 0 ? undefined : next / 100 };
          })
        }
      />
      <ToggleField label={t("highlight")} checked={highlighted} disabled={disabled || curved} onChange={(on) => change((layer) => ({ highlight: on ? (layer.highlight ?? DEFAULT_HIGHLIGHT) : undefined }))} />
      {curved ? <p className="text-2xs text-muted-foreground">{t("highlightCurved")}</p> : null}
      {highlighted && !curved ? (
        <FieldGrid>
          <ColorField label={t("highlightColor")} value={shared((layer) => layer.highlight!.color)} disabled={disabled} onChange={(color) => editHighlight({ color })} />
          <NumberField
            label={t("highlightRadius")}
            unit="%"
            min={PERCENT[0]}
            max={PERCENT[1]}
            value={shared((layer) => Math.round(layer.highlight!.radius * 100))}
            disabled={disabled}
            onCommit={(value) => editHighlight({ radius: value / 100 })}
          />
        </FieldGrid>
      ) : null}
    </div>
  );
}

export function BlendField({ layers, disabled, change }: EffectFieldsProps) {
  const t = useTranslations("studio.image.panels.layers");
  const tb = useTranslations("studio.image.blend");
  const shared = sharedOf(layers);
  return (
    <SelectField<BlendMode>
      label={t("blendMode")}
      value={shared((layer): BlendMode => layer.blendMode ?? "normal")}
      options={BLEND_MODES.map((mode) => ({ value: mode, label: tb(mode) }))}
      disabled={disabled}
      onChange={(mode) => change(() => ({ blendMode: mode === "normal" ? undefined : mode }))}
    />
  );
}
