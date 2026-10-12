"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { FontPicker } from "@/components/studio/inspector/font-picker";
import { ColorField, NumberField, SelectField, ToggleField } from "@/components/studio/video/inspector/fields";
import { DEFAULT_FONT_ID, nearestFontWeight, STUDIO_FONTS, type FontId } from "@/lib/studio/fonts";
import { clampTo, LAYER_RANGES } from "@/lib/studio/layer-ranges";
import { fontPatch } from "@/lib/studio/text-run-editing";
import { rangeValue, type RunStyle, type RunStyleKey, type RunStylePatch, type TextRange } from "@/lib/studio/text-runs";

type Styled = Parameters<typeof rangeValue>[0];

export interface TextRunToolbarProps {
  layer: Styled;
  range: TextRange | null;
  length: number;
  surfaceHeight: number;
  disabled?: boolean;
  sizeless?: boolean;
  onPatch: (patch: RunStylePatch, refocus: boolean) => void;
  onClear?: () => void;
}

const PERCENT = 100;

export function TextRunToolbar({ layer, range, length, surfaceHeight, disabled, sizeless, onPatch, onClear }: TextRunToolbarProps) {
  const t = useTranslations("studio.textRuns");
  const tm = useTranslations("studio.video.inspector");
  const valueOf = <K extends RunStyleKey>(key: K): RunStyle[K] | null => {
    const read = rangeValue(layer, range, key, length);
    return read.mixed ? null : read.value;
  };
  const fill = valueOf("fill");
  const fontId = valueOf("fontId");
  const weight = valueOf("fontWeight");
  const size = valueOf("fontSize");
  const spacing = valueOf("letterSpacing");
  const family: FontId = fontId ?? DEFAULT_FONT_ID;
  const italicless = fontId !== null && !STUDIO_FONTS[fontId].italic;

  return (
    <div role="toolbar" aria-label={t("label")} className="pointer-events-auto w-max max-w-[min(36rem,calc(100vw-2rem))] space-y-2 rounded-lg border border-border bg-card p-2 shadow-lg">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-28">
          <ColorField label={t("color")} value={fill === null ? null : fill || "#000000"} disabled={disabled} onChange={(next) => onPatch({ fill: next }, false)} />
        </div>
        <div className="w-36">
          <FontPicker
            layout="stacked"
            label={t("font")}
            value={fontId}
            mixedLabel={tm("mixed")}
            disabled={disabled}
            onChange={(id) => onPatch(fontPatch(layer, range, id, length), true)}
          />
        </div>
        <div className="w-20">
          <SelectField<string>
            label={t("weight")}
            value={fontId === null || weight === null ? null : String(nearestFontWeight(fontId, weight))}
            disabled={disabled || fontId === null}
            options={STUDIO_FONTS[family].weights.map((option) => ({ value: String(option), label: String(option) }))}
            onChange={(next) => onPatch({ fontWeight: Number(next) }, true)}
          />
        </div>
        {sizeless ? null : (
          <div className="w-20">
            <NumberField
              label={t("size")}
              unit="px"
              decimals={1}
              min={LAYER_RANGES.fontSize[0] * surfaceHeight}
              max={LAYER_RANGES.fontSize[1] * surfaceHeight}
              value={size === null ? null : size * surfaceHeight}
              disabled={disabled}
              onCommit={(px) => onPatch({ fontSize: clampTo(px / surfaceHeight, LAYER_RANGES.fontSize) }, false)}
            />
          </div>
        )}
        <div className="w-20">
          <NumberField
            label={t("letterSpacing")}
            unit="%"
            decimals={1}
            step={0.5}
            min={LAYER_RANGES.letterSpacing[0] * PERCENT}
            max={LAYER_RANGES.letterSpacing[1] * PERCENT}
            value={spacing === null ? null : spacing * PERCENT}
            disabled={disabled}
            onCommit={(value) => onPatch({ letterSpacing: clampTo(value / PERCENT, LAYER_RANGES.letterSpacing) }, false)}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <ToggleField label={t("italic")} checked={valueOf("italic")} disabled={disabled || italicless} onChange={(on) => onPatch({ italic: on }, true)} />
        <ToggleField label={t("underline")} checked={valueOf("underline")} disabled={disabled} onChange={(on) => onPatch({ underline: on }, true)} />
        <ToggleField label={t("caps")} checked={valueOf("caps")} disabled={disabled} onChange={(on) => onPatch({ caps: on }, true)} />
        {onClear ? <Button variant="ghost" size="sm" title={t("clear")} disabled={disabled} onClick={onClear} /> : null}
      </div>
    </div>
  );
}
