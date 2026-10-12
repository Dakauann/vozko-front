"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { Eyedropper } from "@/components/icons";
import { layerChroma, type ChromaPatch } from "@/lib/studio/chroma-edit";
import { CHROMA_PRESETS, CHROMA_PROPERTIES, lowChroma, type ChromaPreset, type ChromaProperty } from "@/lib/studio/chroma-key";
import type { Layer } from "@/lib/studio/document";
import { cn } from "@/lib/utils";

import { assetKeyColor, eyeDropper } from "../../canvas/key-color";
import { ColorField, ICON_BUTTON_CLASS, IconButton, InspectorSection, OUTLINE_BUTTON_CLASS, SliderField } from "../controls";
import { useImageEditor } from "../editor-state";

const PERCENT = 100;
const PRESETS = Object.keys(CHROMA_PRESETS) as ChromaPreset[];

type Detection = "idle" | "busy" | "missing";

export function ChromaKeySection({ layer }: { layer: Layer }) {
  const t = useTranslations("studio.chroma");
  const format = useFormatter();
  const { commands, store } = useImageEditor();
  const [detection, setDetection] = useState<Detection>("idle");
  const locked = Boolean(layer.locked);
  const key = layer.chromaKey;
  const patch = (change: ChromaPatch) =>
    commands.patchLayers([layer.id], (current) => {
      const next = layerChroma(current, change);
      return typeof next === "string" ? {} : { chromaKey: next };
    });

  const detect = async () => {
    if (!layer.assetId) return;
    setDetection("busy");
    const color = await assetKeyColor(layer.assetId, layer.crop);
    setDetection(color ? "idle" : "missing");
    if (color) patch({ color });
  };

  const pick = async () => {
    const dropper = eyeDropper();
    if (!dropper) return;
    commands.beginLive();
    if (key) commands.patchLayers([layer.id], { chromaKey: undefined });
    try {
      const { sRGBHex } = await dropper.open();
      commands.patchLayers([layer.id], { chromaKey: key });
      patch({ color: sRGBHex });
      commands.endLive();
    } catch {
      store.getState().cancelTransaction();
    }
  };

  const busy = locked || detection === "busy";
  const detectButton = (label: string) => (
    <button type="button" className={cn(OUTLINE_BUTTON_CLASS, "h-7")} disabled={busy} onClick={() => void detect()}>
      {label}
    </button>
  );
  const presetButtons = (labels: "start" | "presets") =>
    PRESETS.map((preset) => (
      <button key={preset} type="button" className={cn(OUTLINE_BUTTON_CLASS, "h-7")} disabled={locked} onClick={() => patch({ color: CHROMA_PRESETS[preset] })}>
        {t(`${labels}.${preset}`)}
      </button>
    ));
  const missing = detection === "missing" ? <p className="text-2xs text-muted-foreground">{t("notFound")}</p> : null;

  if (!key) {
    return (
      <div role="group" aria-label={t("title")}>
        <InspectorSection title={t("title")}>
          <p className="text-2xs text-muted-foreground">{t("introLayer")}</p>
          <div className="flex flex-wrap gap-1">
            {detectButton(t("start.auto"))}
            {presetButtons("start")}
          </div>
          {missing}
        </InspectorSection>
      </div>
    );
  }

  const slider = (property: ChromaProperty) => (
    <SliderField
      key={property}
      label={t(`fields.${property}`)}
      value={key[property] * PERCENT}
      min={0.1}
      max={PERCENT}
      step={0.5}
      format={(value) => format.number(value / PERCENT, { style: "percent", maximumFractionDigits: 1 })}
      disabled={locked}
      onStart={commands.beginLive}
      onEnd={commands.endLive}
      onChange={(value) => patch({ [property]: value / PERCENT })}
    />
  );

  return (
    <div role="group" aria-label={t("title")}>
      <InspectorSection
        title={t("title")}
        action={
          <button type="button" className={ICON_BUTTON_CLASS} disabled={locked} onClick={() => commands.patchLayers([layer.id], { chromaKey: undefined })}>
            {t("remove")}
          </button>
        }
      >
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <ColorField label={t("color")} value={key.color} disabled={locked} onCommit={(color) => patch({ color: color.slice(0, 7) })} />
          </div>
          {eyeDropper() ? (
            <IconButton label={t("pick")} disabled={locked} onClick={() => void pick()}>
              <Eyedropper className="h-3.5 w-3.5" />
            </IconButton>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1">
          {detectButton(t("detect"))}
          {presetButtons("presets")}
        </div>
        {missing}
        {lowChroma(key.color) ? <p className="text-2xs text-muted-foreground">{t("lowChroma")}</p> : null}
        {CHROMA_PROPERTIES.map(slider)}
        <p className="text-2xs text-muted-foreground">{t("holesHint")}</p>
      </InspectorSection>
    </div>
  );
}
