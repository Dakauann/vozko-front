"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import type { Layer, TextAlign } from "@/lib/studio/document";
import { DEFAULT_FONT_ID, FONT_IDS, STUDIO_FONTS, nearestFontWeight, type FontId } from "@/lib/studio/fonts";
import { sharedValue, type Shared } from "@/lib/studio/selection-edit";

import { IconGrid } from "../icon-grid";
import { ColorField, FieldGrid, InspectorSection, NumberField, SelectField, ToggleField } from "./fields";

const DEFAULT_SHADOW = { color: "#000000", blur: 12, x: 0, y: 4 };

export type LayerChange = (layer: Layer) => Partial<Layer>;

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
  const text = shared((layer) => layer.text ?? "");
  const shadowed = shared((layer) => Boolean(layer.shadow));
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
        {filled ? <ColorField label={t("fill")} value={shared((layer) => layer.fill ?? "#000000")} disabled={disabled} onChange={(fill) => set({ fill })} /> : null}
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
      </FieldGrid>

      {first.type === "shape" ? <ToggleField label={t("dashed")} checked={shared((layer) => Boolean(layer.dash))} disabled={disabled} onChange={(dash) => set({ dash })} /> : null}
      {stroked ? (
        <div className="flex gap-4">
          <ToggleField label={t("arrowStart")} checked={shared((layer) => Boolean(layer.arrowStart))} disabled={disabled} onChange={(arrowStart) => set({ arrowStart })} />
          <ToggleField label={t("arrowEnd")} checked={shared((layer) => Boolean(layer.arrowEnd))} disabled={disabled} onChange={(arrowEnd) => set({ arrowEnd })} />
        </div>
      ) : null}

      <ToggleField label={t("shadow")} checked={shadowed} disabled={disabled} onChange={(on) => change((layer) => ({ shadow: on ? (layer.shadow ?? DEFAULT_SHADOW) : undefined }))} />
      {shadowed ? (
        <FieldGrid>
          <ColorField
            label={t("shadowColor")}
            value={shared((layer) => layer.shadow?.color ?? DEFAULT_SHADOW.color)}
            disabled={disabled}
            onChange={(color) => change((layer) => ({ shadow: { ...(layer.shadow ?? DEFAULT_SHADOW), color } }))}
          />
          <NumberField
            label={t("shadowBlur")}
            unit="px"
            min={0}
            max={200}
            value={shared((layer) => layer.shadow?.blur ?? DEFAULT_SHADOW.blur)}
            disabled={disabled}
            onCommit={(blur) => change((layer) => ({ shadow: { ...(layer.shadow ?? DEFAULT_SHADOW), blur } }))}
            onNudge={(delta) => change((layer) => ({ shadow: { ...(layer.shadow ?? DEFAULT_SHADOW), blur: Math.min(200, Math.max(0, (layer.shadow?.blur ?? DEFAULT_SHADOW.blur) + delta)) } }))}
          />
        </FieldGrid>
      ) : null}
    </InspectorSection>
  );
}
