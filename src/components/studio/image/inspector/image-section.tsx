"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { ArrowsDownUp, ArrowsLeftRight } from "@/components/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FRAME_KINDS, type CanvasSize, type Filters, type FrameKind, type Layer } from "@/lib/studio/document";
import { DEFAULT_FILTERS, FILTER_PRESETS, isDefaultFilters } from "@/lib/studio/image-edits";
import { LAYER_RANGES } from "@/lib/studio/layer-ranges";
import { cn } from "@/lib/utils";

import { ICON_BUTTON_CLASS, InspectorSection, LABEL_CLASS, Notice, OUTLINE_BUTTON_CLASS, PRIMARY_BUTTON_CLASS, SelectField, SliderField, ToggleButton } from "../controls";
import { InspectorGroup } from "../../inspector/inspector-context";
import { EditWithAiForm } from "../edit-with-ai";
import { useEditorUi, useImageEditor } from "../editor-state";
import { ImageSourcePicker } from "../image-source-picker";
import { RemoveBackground } from "../remove-background";
import { ChromaKeySection } from "./chroma-key-section";
import { ColorGradeSection } from "./color-grade-section";
import { ColorFinishSections } from "./color-finish-sections";
import { TraceSection } from "./trace-section";
import { OutlineSection, ShadowSection } from "./effects";
import { StillVfxSection } from "./still-vfx-section";

const FILTER_SLIDERS: { key: keyof Filters; min: number; max: number; step: number; scale: number }[] = [
  { key: "brightness", min: LAYER_RANGES.brightness[0], max: LAYER_RANGES.brightness[1], step: 0.01, scale: 100 },
  { key: "contrast", min: LAYER_RANGES.contrast[0], max: LAYER_RANGES.contrast[1], step: 1, scale: 1 },
  { key: "saturation", min: LAYER_RANGES.saturation[0], max: 2, step: 0.05, scale: 50 },
  { key: "blur", min: LAYER_RANGES.blur[0], max: LAYER_RANGES.blur[1], step: 1, scale: 1 },
];

const BUTTON = OUTLINE_BUTTON_CLASS;

function CropControls({ layer }: { layer: Layer }) {
  const t = useTranslations("studio.image.inspector.image");
  const { commands } = useImageEditor();
  const cropping = useEditorUi((s) => s.crop?.layerId === layer.id);
  if (!cropping) {
    return (
      <button type="button" className={cn(BUTTON, "w-full")} disabled={Boolean(layer.locked)} onClick={() => commands.startCrop(layer.id)}>
        {t("crop")}
      </button>
    );
  }
  return (
    <div className="space-y-2">
      <Notice tone="brand" title={t("cropTitle")}>
        {t("cropHint")}
      </Notice>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={commands.finishCrop}>
          {t("cropDone")}
        </button>
        <button type="button" className={BUTTON} onClick={commands.resetCrop}>
          {t("cropReset")}
        </button>
        <button type="button" className={BUTTON} onClick={commands.cancelCrop}>
          {t("cropCancel")}
        </button>
      </div>
    </div>
  );
}

function FiltersControls({ layer }: { layer: Layer }) {
  const t = useTranslations("studio.image.inspector.image");
  const { commands } = useImageEditor();
  const filters = layer.filters ?? DEFAULT_FILTERS;
  const locked = Boolean(layer.locked);
  const setFilters = (next: Filters) => commands.patchLayers([layer.id], { filters: isDefaultFilters(next) ? undefined : next });
  return (
    <InspectorSection
      title={t("filters")}
      action={
        <button type="button" className={ICON_BUTTON_CLASS} disabled={locked || isDefaultFilters(layer.filters)} onClick={() => setFilters(DEFAULT_FILTERS)}>
          {t("resetFilters")}
        </button>
      }
    >
      <div role="group" aria-label={t("presets")} className="flex flex-wrap gap-1">
        {FILTER_PRESETS.map((preset) => (
          <button key={preset.id} type="button" disabled={locked} className={cn(BUTTON, "h-7")} onClick={() => setFilters(preset.filters)}>
            {t(`presetNames.${preset.id}`)}
          </button>
        ))}
      </div>
      {FILTER_SLIDERS.map((slider) => (
        <SliderField
          key={slider.key}
          label={t(`filter.${slider.key}`)}
          value={filters[slider.key]}
          min={slider.min}
          max={slider.max}
          step={slider.step}
          entry={{ range: LAYER_RANGES[slider.key], scale: slider.scale }}
          disabled={locked}
          onStart={commands.beginLive}
          onEnd={commands.endLive}
          onChange={(value) => setFilters({ ...filters, [slider.key]: value })}
        />
      ))}
    </InspectorSection>
  );
}

function ReplaceImage({ layer }: { layer: Layer }) {
  const t = useTranslations("studio.image.inspector.image");
  const { commands } = useImageEditor();
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cn(BUTTON, "w-full")} disabled={Boolean(layer.locked)}>
          {t("replace")}
        </button>
      </PopoverTrigger>
      <PopoverContent side="left" align="start" className="w-80">
        <ImageSourcePicker
          compact
          uploadLabel={t("replaceUpload")}
          onPick={async (mediaId) => {
            const ok = await commands.replaceImage(layer.id, mediaId);
            if (ok) setOpen(false);
            return ok;
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function EditWithAi({ layer, canvas }: { layer: Layer; canvas: CanvasSize }) {
  const t = useTranslations("studio.image.inspector.image");
  return (
    <InspectorSection title={t("editWithAi")}>
      <EditWithAiForm layer={layer} canvas={canvas} />
    </InspectorSection>
  );
}

export function ImageSection({ layer, canvas }: { layer: Layer; canvas: CanvasSize }) {
  const t = useTranslations("studio.image.inspector.image");
  const { commands } = useImageEditor();
  const locked = Boolean(layer.locked);
  const patch = (next: Parameters<typeof commands.patchSelection>[0]) => commands.patchLayers([layer.id], next);
  return (
    <>
      <InspectorSection title={t("title")}>
        <CropControls layer={layer} />
        <div className="flex items-center gap-1">
          <span className={LABEL_CLASS}>{t("flip")}</span>
          <ToggleButton label={t("flipX")} pressed={Boolean(layer.flipX)} disabled={locked} onClick={() => patch({ flipX: layer.flipX ? undefined : true })}>
            <ArrowsLeftRight className="h-4 w-4" aria-hidden />
          </ToggleButton>
          <ToggleButton label={t("flipY")} pressed={Boolean(layer.flipY)} disabled={locked} onClick={() => patch({ flipY: layer.flipY ? undefined : true })}>
            <ArrowsDownUp className="h-4 w-4" aria-hidden />
          </ToggleButton>
        </div>
        <SelectField<FrameKind | "none">
          label={t("frame")}
          value={layer.frame ?? "none"}
          disabled={locked}
          options={[{ value: "none", label: t("frames.none") }, ...FRAME_KINDS.map((kind) => ({ value: kind, label: t(`frames.${kind}`) }))]}
          onChange={(frame) => patch({ frame: frame === "none" ? undefined : frame })}
        />
        <SliderField
          label={t("radius")}
          value={Math.round((layer.radius ?? 0) * 100)}
          min={0}
          max={100}
          step={1}
          format={(value) => `${value}%`}
          disabled={locked}
          onStart={commands.beginLive}
          onEnd={commands.endLive}
          onChange={(value) => patch({ radius: value === 0 ? undefined : value / 100 })}
        />
        <ReplaceImage layer={layer} />
        <RemoveBackground layer={layer} />
      </InspectorSection>
      <OutlineSection layer={layer} disabled={locked} onPatch={patch} />
      <InspectorGroup id="cutout">
        <ChromaKeySection layer={layer} />
      </InspectorGroup>
      <InspectorGroup id="color">
        <ColorGradeSection layer={layer} />
        <ColorFinishSections layer={layer} />
      </InspectorGroup>
      <InspectorGroup id="effects">
        <FiltersControls layer={layer} />
        <StillVfxSection target={{ kind: "layer", layerId: layer.id }} vfx={layer.vfx} disabled={locked} />
        <ShadowSection layer={layer} disabled={locked} onPatch={patch} />
        <EditWithAi layer={layer} canvas={canvas} />
        <TraceSection layer={layer} />
      </InspectorGroup>
    </>
  );
}
