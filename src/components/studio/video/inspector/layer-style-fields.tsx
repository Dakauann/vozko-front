"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { takesArrowheads } from "@/lib/studio/arrowheads";
import { STAR_DEFAULTS, type Layer, type Shadow, type TextAlign } from "@/lib/studio/document";
import { DEFAULT_SHADOW } from "@/lib/studio/layer-effects";
import { clampTo, LAYER_RANGES, type Range } from "@/lib/studio/layer-ranges";
import { DEFAULT_FONT_ID, FONT_IDS, STUDIO_FONTS, nearestFontWeight, type FontId } from "@/lib/studio/fonts";
import { sharedValue, type Shared } from "@/lib/studio/selection-edit";

import { IconGrid } from "../icon-grid";
import { ColorField, FieldGrid, InspectorSection, NumberField, SelectField, ToggleField } from "./fields";
import { BlendField, GradientFields, isGradiented, takesGradient, TextEffectFields, type LayerChange } from "./layer-effect-fields";
import { StrokeStyleFields } from "./stroke-style-fields";

export type { LayerChange } from "./layer-effect-fields";

const SHADOW_NUMBERS: { key: "blur" | "x" | "y"; label: "shadowBlur" | "shadowX" | "shadowY"; range: Range }[] = [
  { key: "blur", label: "shadowBlur", range: LAYER_RANGES.shadowBlur },
  { key: "x", label: "shadowX", range: LAYER_RANGES.shadowOffset },
  { key: "y", label: "shadowY", range: LAYER_RANGES.shadowOffset },
];

function shadowOf(layer: Layer): Shadow {
  return layer.shadow ?? DEFAULT_SHADOW;
}

interface LayerStyleFieldsProps {
  layers: readonly Layer[];
  disabled?: boolean;
  onChange: (change: LayerChange) => boolean;
}

function valueOf<T>(shared: Shared<T>): T | null {
  return shared.kind === "same" ? shared.value : null;
}

function isStroked(layer: Layer): boolean {
  return layer.shape === "line" || layer.shape === "arrow";
}

export function LayerStyleFields({ layers, disabled, onChange }: LayerStyleFieldsProps) {
  const t = useTranslations("studio.video.layer");
  const ti = useTranslations("studio.video.inspector");
  const [textDraft, setTextDraft] = useState<string | null>(null);
  const [rejected, setRejected] = useState(false);
  const first = layers[0];

  const change = (build: LayerChange): boolean => {
    const accepted = onChange(build);
    setRejected(!accepted);
    return accepted;
  };
  const set = (patch: Partial<Layer>) => change(() => patch);
  const shared = <T,>(get: (layer: Layer) => T) => valueOf(sharedValue(layers, get));
  const all = (test: (layer: Layer) => boolean) => layers.every(test);

  const fontId = shared((layer): FontId => layer.fontId ?? DEFAULT_FONT_ID);
  const fontFamily: FontId = fontId ?? DEFAULT_FONT_ID;
  const stroked = all(isStroked);
  const filled = all((layer) => !isStroked(layer));
  const outlined = first.type !== "icon" && (stroked || all((layer) => (layer.strokeWidth ?? 0) > 0));
  const headed = outlined && all(takesArrowheads);
  const gradientable = all(takesGradient);
  const solid = filled && !(gradientable && isGradiented(layers));
  const text = shared((layer) => layer.text ?? "");
  const shadowed = shared((layer) => Boolean(layer.shadow));
  const setShadow = (build: (shadow: Shadow) => Partial<Shadow>) => change((layer) => ({ shadow: { ...shadowOf(layer), ...build(shadowOf(layer)) } }));
  const textId = `text-${first.id}`;

  return (
    <InspectorSection title={t(`title.${first.type}`)}>
      {first.type === "text" ? (
        <>
          <div className="space-y-1">
            <label htmlFor={textId} className="block text-2xs text-muted-foreground">
              {t("text")}
            </label>
            <textarea
              id={textId}
              rows={3}
              disabled={disabled}
              value={textDraft ?? text ?? ""}
              placeholder={text === null ? ti("mixed") : undefined}
              onChange={(event) => setTextDraft(event.target.value)}
              onBlur={() => {
                if (textDraft !== null && (textDraft === text || set({ text: textDraft }))) setTextDraft(null);
              }}
              aria-invalid={rejected || undefined}
              className="w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:italic placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive"
            />
          </div>
          <FieldGrid>
            <SelectField<FontId>
              label={t("font")}
              value={fontId}
              disabled={disabled}
              options={FONT_IDS.map((id) => ({ value: id, label: STUDIO_FONTS[id].family }))}
              onChange={(id) => change((layer) => ({ fontId: id, fontWeight: nearestFontWeight(id, layer.fontWeight || 400) }))}
            />
            <SelectField<string>
              label={t("weight")}
              value={fontId === null ? null : shared((layer) => String(nearestFontWeight(fontFamily, layer.fontWeight || 400)))}
              disabled={disabled || fontId === null}
              options={STUDIO_FONTS[fontFamily].weights.map((weight) => ({ value: String(weight), label: String(weight) }))}
              onChange={(weight) => set({ fontWeight: Number(weight) })}
            />
            <NumberField
              label={t("size")}
              unit="%"
              decimals={1}
              step={0.5}
              min={0.5}
              max={50}
              value={shared((layer) => (layer.fontSize ?? 0) * 100)}
              disabled={disabled}
              onCommit={(v) => set({ fontSize: v / 100 })}
              onNudge={(delta) => change((layer) => ({ fontSize: Math.min(0.5, Math.max(0.005, (layer.fontSize ?? 0) + delta / 100)) }))}
            />
            <SelectField<TextAlign>
              label={t("align")}
              value={shared((layer) => layer.align || "left")}
              disabled={disabled}
              options={(["left", "center", "right"] as const).map((value) => ({ value, label: t(`aligns.${value}`) }))}
              onChange={(align) => set({ align })}
            />
            <NumberField
              label={t("lineHeight")}
              decimals={2}
              step={0.05}
              min={0.5}
              max={4}
              value={shared((layer) => layer.lineHeight || 1.2)}
              disabled={disabled}
              onCommit={(v) => set({ lineHeight: v })}
              onNudge={(delta) => change((layer) => ({ lineHeight: Math.min(4, Math.max(0.5, (layer.lineHeight || 1.2) + delta)) }))}
            />
            <NumberField
              label={t("letterSpacing")}
              unit="%"
              decimals={1}
              step={0.5}
              min={-50}
              max={200}
              value={shared((layer) => (layer.letterSpacing ?? 0) * 100)}
              disabled={disabled}
              onCommit={(v) => set({ letterSpacing: v / 100 })}
              onNudge={(delta) => change((layer) => ({ letterSpacing: Math.min(2, Math.max(-0.5, (layer.letterSpacing ?? 0) + delta / 100)) }))}
            />
          </FieldGrid>
          <ToggleField
            label={t("italic")}
            checked={shared((layer) => Boolean(layer.italic))}
            disabled={disabled || !all((layer) => STUDIO_FONTS[layer.fontId ?? DEFAULT_FONT_ID].italic)}
            onChange={(italic) => set({ italic })}
          />
        </>
      ) : null}

      {first.type === "icon" ? <IconGrid label={t("icon")} value={shared((layer) => layer.iconId) ?? undefined} disabled={disabled} onPick={(iconId) => set({ iconId })} /> : null}

      <FieldGrid>
        {solid ? <ColorField label={t("fill")} value={shared((layer) => layer.fill ?? "#000000")} disabled={disabled} onChange={(fill) => set({ fill })} /> : null}
        {first.type !== "icon" && (stroked || filled) ? (
          <>
            <ColorField label={stroked ? t("lineColor") : t("outline")} value={shared((layer) => layer.stroke ?? "#000000")} disabled={disabled} onChange={(stroke) => set({ stroke })} />
            <NumberField
              label={stroked ? t("lineWidth") : t("outlineWidth")}
              unit="px"
              min={0}
              max={200}
              value={shared((layer) => layer.strokeWidth ?? 0)}
              disabled={disabled}
              onCommit={(v) => change((layer) => ({ strokeWidth: v, stroke: layer.stroke || "#000000" }))}
              onNudge={(delta) => change((layer) => ({ strokeWidth: Math.min(200, Math.max(0, (layer.strokeWidth ?? 0) + delta)), stroke: layer.stroke || "#000000" }))}
            />
          </>
        ) : null}
        {first.type === "shape" && all((layer) => layer.shape === "rect") ? (
          <NumberField
            label={t("radius")}
            unit="%"
            min={0}
            max={100}
            value={shared((layer) => (layer.radius ?? 0) * 100)}
            disabled={disabled}
            onCommit={(v) => set({ radius: v / 100 })}
            onNudge={(delta) => change((layer) => ({ radius: Math.min(1, Math.max(0, (layer.radius ?? 0) + delta / 100)) }))}
          />
        ) : null}
        {first.type === "shape" && all((layer) => layer.shape === "star") ? (
          <>
            <NumberField
              label={t("points")}
              min={LAYER_RANGES.starPoints[0]}
              max={LAYER_RANGES.starPoints[1]}
              value={shared((layer) => layer.points || STAR_DEFAULTS.points)}
              disabled={disabled}
              onCommit={(v) => set({ points: Math.round(v) })}
              onNudge={(delta) => change((layer) => ({ points: Math.min(LAYER_RANGES.starPoints[1], Math.max(LAYER_RANGES.starPoints[0], (layer.points || STAR_DEFAULTS.points) + delta)) }))}
            />
            <NumberField
              label={t("inner")}
              unit="%"
              min={LAYER_RANGES.starInner[0] * 100}
              max={LAYER_RANGES.starInner[1] * 100}
              value={shared((layer) => Math.round((layer.inner || STAR_DEFAULTS.inner) * 100))}
              disabled={disabled}
              onCommit={(v) => set({ inner: v / 100 })}
              onNudge={(delta) => change((layer) => ({ inner: Math.min(LAYER_RANGES.starInner[1], Math.max(LAYER_RANGES.starInner[0], (layer.inner || STAR_DEFAULTS.inner) + delta / 100)) }))}
            />
          </>
        ) : null}
      </FieldGrid>

      {gradientable ? <GradientFields layers={layers} disabled={disabled} change={change} /> : null}
      {first.type === "text" ? <TextEffectFields layers={layers} disabled={disabled} change={change} /> : null}

      {outlined ? <StrokeStyleFields layers={layers} withCaps={first.type === "shape"} disabled={disabled} onPatch={set} /> : null}
      {headed ? (
        <div className="flex gap-4">
          <ToggleField label={t("arrowStart")} checked={shared((layer) => Boolean(layer.arrowStart))} disabled={disabled} onChange={(arrowStart) => set({ arrowStart })} />
          <ToggleField label={t("arrowEnd")} checked={shared((layer) => Boolean(layer.arrowEnd))} disabled={disabled} onChange={(arrowEnd) => set({ arrowEnd })} />
        </div>
      ) : null}

      <ToggleField label={t("shadow")} checked={shadowed} disabled={disabled} onChange={(on) => change((layer) => ({ shadow: on ? shadowOf(layer) : undefined }))} />
      {shadowed ? (
        <FieldGrid>
          <ColorField label={t("shadowColor")} value={shared((layer) => shadowOf(layer).color)} disabled={disabled} onChange={(color) => setShadow(() => ({ color }))} />
          {SHADOW_NUMBERS.map(({ key, label, range }) => (
            <NumberField
              key={key}
              label={t(label)}
              unit="px"
              min={range[0]}
              max={range[1]}
              value={shared((layer) => shadowOf(layer)[key])}
              disabled={disabled}
              onCommit={(value) => setShadow(() => ({ [key]: value }))}
              onNudge={(delta) => setShadow((shadow) => ({ [key]: clampTo(shadow[key] + delta, range) }))}
            />
          ))}
        </FieldGrid>
      ) : null}

      <BlendField layers={layers} disabled={disabled} change={change} />
    </InspectorSection>
  );
}
