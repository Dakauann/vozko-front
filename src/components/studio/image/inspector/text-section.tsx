"use client";

import { useTranslations } from "next-intl";

import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { TextB, TextItalic } from "@/components/icons";
import type { CanvasSize, Layer, TextAlign } from "@/lib/studio/document";
import { DEFAULT_FONT_ID, DEFAULT_FONT_WEIGHT, nearestFontWeight, STUDIO_FONTS, type FontId } from "@/lib/studio/fonts";
import { DEFAULT_HIGHLIGHT } from "@/lib/studio/layer-effects";
import { clampTo, LAYER_RANGES } from "@/lib/studio/layer-ranges";
import type { LayerPatch } from "@/lib/studio/layers";
import { BOLD_WEIGHT, wholeTextField, wholeTextLayerPatch } from "@/lib/studio/text-run-editing";
import type { LayerRunKey } from "@/lib/studio/text-runs";

import { FontPicker } from "../../inspector/font-picker";
import { ColorField, InspectorSection, NumberField, SelectField, SliderField, SwitchRow, ToggleButton } from "../controls";
import { useImageEditor } from "../editor-state";
import { GradientFields, OutlineSection, ShadowSection } from "./effects";

const ALIGNS: TextAlign[] = ["left", "center", "right"];

export function TextSection({ layers, canvas }: { layers: Layer[]; canvas: CanvasSize }) {
  const t = useTranslations("studio.image.inspector.text");
  const { commands } = useImageEditor();
  const first = layers[0];
  const ids = layers.map((l) => l.id);
  const locked = layers.every((l) => l.locked);
  const runValue = <T,>(key: LayerRunKey, read: (layer: Layer) => T): T | null => wholeTextField(first, key, read);
  const fontRun = runValue("fontId", (layer): FontId => layer.fontId ?? DEFAULT_FONT_ID);
  const weightRun = runValue("fontWeight", (layer) => layer.fontWeight || DEFAULT_FONT_WEIGHT);
  const sizeRun = runValue("fontSize", (layer) => layer.fontSize ?? 0);
  const italicRun = runValue("italic", (layer) => Boolean(layer.italic));
  const fillRun = runValue("fill", (layer) => layer.fill ?? "");
  const spacingRun = runValue("letterSpacing", (layer) => layer.letterSpacing ?? 0);
  const mixed = t("mixed");
  const fontId: FontId = fontRun ?? first.fontId ?? DEFAULT_FONT_ID;
  const weight = weightRun ?? (first.fontWeight || DEFAULT_FONT_WEIGHT);
  const bold = weightRun !== null && weightRun >= BOLD_WEIGHT;
  const font = STUDIO_FONTS[fontId];
  const patch = (next: LayerPatch | ((layer: Layer) => LayerPatch)) => commands.patchLayers(ids, next);
  const restyle = (next: LayerPatch | ((layer: Layer) => LayerPatch)) => patch((layer) => wholeTextLayerPatch(layer, typeof next === "function" ? next(layer) : next));
  const curved = Math.abs(first.curve ?? 0) > 0;

  return (
    <>
      <InspectorSection title={t("title")}>
        <FontPicker
          label={t("font")}
          value={fontRun === null ? null : fontId}
          mixedLabel={mixed}
          disabled={locked}
          onChange={(next) =>
            restyle((layer) => ({
              fontId: next,
              fontWeight: nearestFontWeight(next, layer.fontWeight || DEFAULT_FONT_WEIGHT),
              italic: layer.italic && STUDIO_FONTS[next].italic ? true : undefined,
            }))
          }
        />
        <SelectField
          label={t("weight")}
          value={nearestFontWeight(fontId, weight)}
          mixed={weightRun === null ? mixed : undefined}
          disabled={locked}
          options={font.weights.map((w) => ({ value: w, label: t(`weights.${w}`) }))}
          onChange={(fontWeight) => restyle({ fontWeight })}
        />
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <NumberField
              label={t("size")}
              value={(sizeRun ?? first.fontSize ?? 0) * canvas.height}
              mixed={sizeRun === null ? mixed : undefined}
              min={LAYER_RANGES.fontSize[0] * canvas.height}
              max={LAYER_RANGES.fontSize[1] * canvas.height}
              decimals={1}
              suffix="px"
              disabled={locked}
              onCommit={(px) => restyle({ fontSize: clampTo(px / canvas.height, LAYER_RANGES.fontSize) })}
            />
          </div>
          <ToggleButton
            label={t("bold")}
            pressed={bold}
            disabled={locked}
            onClick={() => restyle((layer) => ({ fontWeight: nearestFontWeight(layer.fontId ?? DEFAULT_FONT_ID, bold ? DEFAULT_FONT_WEIGHT : BOLD_WEIGHT) }))}
          >
            <TextB className="h-4 w-4" aria-hidden />
          </ToggleButton>
          <ToggleButton label={t("italic")} pressed={Boolean(italicRun)} disabled={locked || !font.italic} onClick={() => restyle({ italic: italicRun ? undefined : true })}>
            <TextItalic className="h-4 w-4" aria-hidden />
          </ToggleButton>
        </div>
        <div className="space-y-1">
          <span className="block text-2xs text-muted-foreground">{t("align")}</span>
          <ElevatedPillToggle<TextAlign>
            className="w-full"
            aria-label={t("align")}
            value={first.align || "left"}
            onChange={(align) => patch({ align })}
            options={ALIGNS.map((align) => ({ value: align, label: t(`aligns.${align}`), disabled: locked || curved }))}
          />
        </div>
        {first.gradient || (first.fills?.length ?? 0) > 0 ? null : <ColorField label={t("color")} value={fillRun ?? first.fill ?? ""} mixed={fillRun === null ? mixed : undefined} disabled={locked} onCommit={(fill) => restyle({ fill })} />}
        {(first.fills?.length ?? 0) > 0 ? null : <GradientFields gradient={first.gradient} fallback={first.fill ?? ""} disabled={locked} onChange={(gradient) => patch({ gradient })} />}
        <SliderField
          label={t("lineHeight")}
          value={first.lineHeight || 1.2}
          min={LAYER_RANGES.lineHeight[0]}
          max={3}
          step={0.05}
          entry={{ range: LAYER_RANGES.lineHeight, decimals: 2 }}
          disabled={locked || curved}
          onStart={commands.beginLive}
          onEnd={commands.endLive}
          onChange={(lineHeight) => patch({ lineHeight })}
        />
        <SliderField
          label={t("letterSpacing")}
          value={spacingRun ?? first.letterSpacing ?? 0}
          mixed={spacingRun === null ? mixed : undefined}
          min={-0.2}
          max={1}
          step={0.01}
          entry={{ range: LAYER_RANGES.letterSpacing, scale: 100, suffix: "%" }}
          disabled={locked}
          onStart={commands.beginLive}
          onEnd={commands.endLive}
          onChange={(letterSpacing) => restyle({ letterSpacing })}
        />
      </InspectorSection>
      <InspectorSection id="text-effects" title={t("effects")} group="effects">
        <SliderField
          label={t("curve")}
          value={Math.round((first.curve ?? 0) * 100)}
          min={-100}
          max={100}
          step={1}
          format={(value) => `${value}`}
          disabled={locked}
          onStart={commands.beginLive}
          onEnd={commands.endLive}
          onChange={(value) => patch({ curve: value === 0 ? undefined : value / 100 })}
        />
        <SwitchRow label={t("highlight")} checked={Boolean(first.highlight)} disabled={locked || curved} onChange={(on) => patch({ highlight: on ? DEFAULT_HIGHLIGHT : undefined })} />
        {curved ? <p className="text-2xs text-muted-foreground">{t("highlightCurved")}</p> : null}
        {first.highlight && !curved ? (
          <>
            <ColorField label={t("highlightColor")} value={first.highlight.color} disabled={locked} onCommit={(color) => first.highlight && patch({ highlight: { ...first.highlight, color } })} />
            <SliderField
              label={t("highlightRadius")}
              value={Math.round(first.highlight.radius * 100)}
              min={0}
              max={100}
              step={1}
              format={(value) => `${value}%`}
              disabled={locked}
              onStart={commands.beginLive}
              onEnd={commands.endLive}
              onChange={(value) => first.highlight && patch({ highlight: { ...first.highlight, radius: value / 100 } })}
            />
          </>
        ) : null}
      </InspectorSection>
      <OutlineSection layer={first} disabled={locked} onPatch={patch} />
      <ShadowSection layer={first} disabled={locked} onPatch={patch} />
    </>
  );
}
