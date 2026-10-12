"use client";

import { useContext, useState } from "react";
import { useTranslations } from "next-intl";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BLEND_MODES, type BlendMode, type Layer } from "@/lib/studio/document";
import type { LayerPatch } from "@/lib/studio/layers";
import { BRICK_OFFSET, DEFAULT_PATTERN, isBrickTile, PATTERN_PRESETS, PATTERN_RANGES, PATTERN_TILES, type Pattern, type PatternPreset, type PatternTile } from "@/lib/studio/pattern";
import { fillsPatch, listedFills } from "@/lib/studio/paint-edits";
import { cn } from "@/lib/utils";

import { ColorField, InspectorSection, NumberField, OUTLINE_BUTTON_CLASS, SelectField, SliderField, SwitchToggle } from "../controls";
import { ImageEditorContext } from "../editor-state";
import { useLiveEdit } from "../../inspector/live-edit";
import { ImageSourcePicker } from "../image-source-picker";

const ASSET_CHOICE = "asset";
const ASSET_TILE_SIZE = 120;

type PresetChoice = PatternPreset | typeof ASSET_CHOICE;

export function OpacityField({ value, disabled, onChange }: { value: number; disabled: boolean; onChange: (value: number) => void }) {
  const t = useTranslations("studio.image.paint");
  const image = useContext(ImageEditorContext);
  const live = useLiveEdit();
  return (
    <SliderField
      label={t("opacity")}
      value={Math.round(value * 100)}
      min={0}
      max={100}
      step={1}
      format={(v) => `${v}%`}
      entry={{ range: [0, 1], scale: 100, suffix: "%" }}
      disabled={disabled}
      onStart={live?.start ?? image?.commands.beginLive}
      onEnd={live?.end ?? image?.commands.endLive}
      onChange={(v) => onChange(v / 100)}
    />
  );
}

export function BlendField({ value, disabled, onChange }: { value: BlendMode | "" | undefined; disabled: boolean; onChange: (value: BlendMode | undefined) => void }) {
  const t = useTranslations("studio.image.paint");
  const tb = useTranslations("studio.image.blend");
  return (
    <SelectField<BlendMode>
      label={t("blend")}
      value={value || "normal"}
      options={BLEND_MODES.map((mode) => ({ value: mode, label: tb(mode) }))}
      disabled={disabled}
      onChange={(mode) => onChange(mode === "normal" ? undefined : mode)}
    />
  );
}

function PatternImage({ disabled, onPick }: { disabled: boolean; onPick: (mediaId: string) => void }) {
  const t = useTranslations("studio.image.paint.pattern");
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cn(OUTLINE_BUTTON_CLASS, "w-full")} disabled={disabled}>
          {t("image")}
        </button>
      </PopoverTrigger>
      <PopoverContent side="left" align="start" className="w-80">
        <ImageSourcePicker
          compact
          uploadLabel={t("imageUpload")}
          onPick={async (mediaId) => {
            onPick(mediaId);
            setOpen(false);
            return true;
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function withPreset(pattern: Pattern, preset: PatternPreset): Pattern {
  return { ...pattern, source: "preset", presetId: preset, assetId: undefined, color: pattern.color || DEFAULT_PATTERN.color };
}

function withAsset(pattern: Pattern, assetId: string): Pattern {
  return { ...pattern, source: "asset", assetId, presetId: undefined, color: undefined, background: undefined, size: Math.max(pattern.size, ASSET_TILE_SIZE) };
}

function withTile(pattern: Pattern, tile: PatternTile): Pattern {
  if (!isBrickTile(tile)) return { ...pattern, tile, offset: undefined };
  return { ...pattern, tile, offset: pattern.offset || BRICK_OFFSET };
}

export function PatternFields({ pattern, disabled, withMix, onChange }: { pattern: Pattern; disabled: boolean; withMix: boolean; onChange: (pattern: Pattern) => void }) {
  const t = useTranslations("studio.image.paint.pattern");
  const spacing = pattern.spacing ?? { x: 0, y: 0 };
  const origin = pattern.origin ?? { x: 0, y: 0 };
  const choice: PresetChoice = pattern.source === "asset" ? ASSET_CHOICE : pattern.presetId || DEFAULT_PATTERN.presetId || "dots";
  const presetOptions = [...PATTERN_PRESETS.map((id) => ({ value: id as PresetChoice, label: t(`presets.${id}`) })), ...(choice === ASSET_CHOICE ? [{ value: ASSET_CHOICE as PresetChoice, label: t("uploaded") }] : [])];
  const gapRange = [Math.ceil(-PATTERN_RANGES.maxOverlap * pattern.size), PATTERN_RANGES.maxSpacing] as const;
  return (
    <div className="space-y-2">
      <SelectField<PresetChoice> label={t("preset")} value={choice} options={presetOptions} disabled={disabled} onChange={(id) => id !== ASSET_CHOICE && onChange(withPreset(pattern, id))} />
      <PatternImage disabled={disabled} onPick={(mediaId) => onChange(withAsset(pattern, mediaId))} />
      {pattern.source === "preset" ? (
        <>
          <ColorField label={t("ink")} value={pattern.color ?? ""} disabled={disabled} onCommit={(color) => onChange({ ...pattern, color })} />
          <ColorField label={t("paper")} value={pattern.background ?? ""} allowEmpty emptyLabel={t("paperNone")} disabled={disabled} onCommit={(background) => onChange({ ...pattern, background: background || undefined })} />
        </>
      ) : null}
      <SelectField<PatternTile> label={t("tile")} value={pattern.tile || "grid"} options={PATTERN_TILES.map((tile) => ({ value: tile, label: t(`tiles.${tile}`) }))} disabled={disabled} onChange={(tile) => onChange(withTile(pattern, tile))} />
      <NumberField label={t("size")} value={Math.round(pattern.size)} min={PATTERN_RANGES.size[0]} max={PATTERN_RANGES.size[1]} suffix="px" disabled={disabled} onCommit={(size) => onChange({ ...pattern, size })} />
      <div className="grid grid-cols-2 gap-2">
        <NumberField label={t("spacingX")} short="X" value={Math.round(spacing.x)} min={gapRange[0]} max={gapRange[1]} suffix="px" disabled={disabled} onCommit={(x) => onChange({ ...pattern, spacing: { ...spacing, x } })} />
        <NumberField label={t("spacingY")} short="Y" value={Math.round(spacing.y)} min={gapRange[0]} max={gapRange[1]} suffix="px" disabled={disabled} onCommit={(y) => onChange({ ...pattern, spacing: { ...spacing, y } })} />
      </div>
      {isBrickTile(pattern.tile) ? (
        <NumberField label={t("offset")} value={Math.round((pattern.offset ?? 0) * 100)} min={0} max={100} suffix="%" disabled={disabled} onCommit={(offset) => onChange({ ...pattern, offset: offset / 100 })} />
      ) : null}
      <NumberField label={t("angle")} value={Math.round(pattern.angle ?? 0)} min={PATTERN_RANGES.angle[0]} max={PATTERN_RANGES.angle[1]} suffix="°" disabled={disabled} onCommit={(angle) => onChange({ ...pattern, angle: angle || undefined })} />
      <div className="grid grid-cols-2 gap-2">
        <NumberField label={t("originX")} short="X" value={Math.round(origin.x * 100)} min={0} max={100} suffix="%" disabled={disabled} onCommit={(x) => onChange({ ...pattern, origin: { ...origin, x: x / 100 } })} />
        <NumberField label={t("originY")} short="Y" value={Math.round(origin.y * 100)} min={0} max={100} suffix="%" disabled={disabled} onCommit={(y) => onChange({ ...pattern, origin: { ...origin, y: y / 100 } })} />
      </div>
      <button type="button" className={cn(OUTLINE_BUTTON_CLASS, "w-full")} disabled={disabled || (origin.x === 0 && origin.y === 0)} onClick={() => onChange({ ...pattern, origin: undefined })}>
        {t("resetOrigin")}
      </button>
      {withMix ? (
        <>
          <OpacityField value={pattern.opacity} disabled={disabled} onChange={(opacity) => onChange({ ...pattern, opacity })} />
          <BlendField value={pattern.blendMode} disabled={disabled} onChange={(blendMode) => onChange({ ...pattern, blendMode })} />
        </>
      ) : null}
    </div>
  );
}

export function PatternSection({ layer, disabled, onPatch }: { layer: Layer; disabled: boolean; onPatch: (patch: LayerPatch) => void }) {
  const t = useTranslations("studio.image.paint.pattern");
  const turnOn = () => (layer.gradient ? onPatch(fillsPatch([...listedFills(layer), { type: "pattern", pattern: DEFAULT_PATTERN, opacity: 1 }])) : onPatch({ pattern: DEFAULT_PATTERN }));
  return (
    <InspectorSection title={t("title")} action={<SwitchToggle label={t("toggle")} checked={Boolean(layer.pattern)} disabled={disabled} onChange={(on) => (on ? turnOn() : onPatch({ pattern: undefined }))} />}>
      {layer.pattern ? <PatternFields pattern={layer.pattern} disabled={disabled} withMix onChange={(pattern) => onPatch({ pattern })} /> : null}
    </InspectorSection>
  );
}
