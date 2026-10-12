"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { Eyedropper } from "@/components/icons";
import { clipKeySample, keyMoment } from "@/lib/studio/chroma-detect";
import { chromaSelectionEdit, removeClipChroma, setClipChroma, toggleClipChromaKey, type ChromaEdit, type ChromaPatch } from "@/lib/studio/chroma-edit";
import { CHROMA_PRESETS, CHROMA_PROPERTIES, chromaKeyState, chromaValue, lowChroma, type ChromaPreset, type ChromaProperty } from "@/lib/studio/chroma-key";
import type { Clip, VideoDocument } from "@/lib/studio/document";
import { localTime } from "@/lib/studio/keyframe-edit";

import { eyeDropper } from "../../canvas/key-color";
import { sampleKeyColor } from "../clip-key-color";
import { usePanelPlayhead, useVideoEditor } from "../editor-context";
import { ToolButton } from "../tool-button";
import { ColorField, InspectorSection, SliderField } from "./fields";
import { KeyToggle } from "./key-toggle";
import { KeyViewToggle } from "./key-view-toggle";
import type { SelectionEditor } from "./use-selection-editor";

const PERCENT = 100;
const PRESETS = Object.keys(CHROMA_PRESETS) as ChromaPreset[];

type Detection = "idle" | "busy" | "missing";

interface ChromaKeyFieldsProps {
  clip: Clip;
  disabled: boolean;
  editor: SelectionEditor;
}

export function ChromaKeyFields({ clip, disabled, editor }: ChromaKeyFieldsProps) {
  const t = useTranslations("studio.chroma");
  const format = useFormatter();
  const { view, frames } = useVideoEditor();
  const [detection, setDetection] = useState<Detection>("idle");
  const playheadMs = usePanelPlayhead();
  const key = clip.chromaKey;
  const localMs = localTime(clip, playheadMs);
  const run = (edit: (doc: VideoDocument) => ChromaEdit) => editor.run((doc) => chromaSelectionEdit(edit(doc)));
  const patch = (change: ChromaPatch) => run((doc) => setClipChroma(doc, clip.id, change, localMs));

  const pick = async () => {
    const dropper = eyeDropper();
    if (!dropper) return;
    const previous = view.getState().chromaView;
    view.setState({ chromaView: { clipId: clip.id, mode: "original" } });
    try {
      const { sRGBHex } = await dropper.open();
      patch({ color: sRGBHex });
    } catch {
      return;
    } finally {
      view.setState({ chromaView: previous });
    }
  };

  const detect = async () => {
    const sample = clipKeySample(clip, keyMoment(clip, undefined, playheadMs));
    if (!sample) return;
    setDetection("busy");
    const color = await sampleKeyColor(sample, frames, new AbortController().signal);
    setDetection(color ? "idle" : "missing");
    if (color) patch({ color });
  };

  const detectButton = (title: string, variant: "outline" | "ghost") => <Button variant={variant} size="sm" disabled={disabled || detection === "busy"} title={title} onClick={() => void detect()} />;
  const missing = detection === "missing" ? <p className="text-2xs text-muted-foreground">{t("notFound")}</p> : null;

  if (!key) {
    return (
      <InspectorSection title={t("title")}>
        <p className="text-2xs text-muted-foreground">{t("intro")}</p>
        <div className="flex flex-wrap gap-2">
          {detectButton(t("start.auto"), "outline")}
          {PRESETS.map((preset) => (
            <Button key={preset} variant="outline" size="sm" disabled={disabled} title={t(`start.${preset}`)} onClick={() => patch({ color: CHROMA_PRESETS[preset] })} />
          ))}
        </div>
        {missing}
      </InspectorSection>
    );
  }

  const slider = (property: ChromaProperty) => {
    const state = chromaKeyState(key, property, localMs);
    const value = chromaValue(key, property, localMs ?? 0) * PERCENT;
    const label = t(`fields.${property}`);
    return (
      <div key={property} className="flex items-end gap-1">
        <div className="min-w-0 flex-1">
          <SliderField
            label={label}
            value={value}
            fallback={value}
            min={0.1}
            max={PERCENT}
            step={0.5}
            valueText={format.number(value / PERCENT, { style: "percent", maximumFractionDigits: 1 })}
            disabled={disabled}
            keyState={state}
            keyHint={state === "key" ? t("keyHint") : t("interpolatedHint")}
            onStart={editor.gesture.onStart}
            onCommit={editor.gesture.onCommit}
            onChange={(next) => patch({ [property]: next / PERCENT })}
          />
        </div>
        <KeyToggle
          label={t("key", { field: label })}
          state={state}
          disabled={disabled || localMs === null}
          onClick={() => {
            if (localMs !== null) run((doc) => toggleClipChromaKey(doc, clip.id, property, localMs));
          }}
        />
      </div>
    );
  };

  return (
    <InspectorSection title={t("title")}>
      <KeyViewToggle clipId={clip.id} label={t("view")} labels={{ composite: t("views.composite"), matte: t("views.matte"), original: t("views.original") }} />
      <div className="flex items-end gap-1">
        <div className="min-w-0 flex-1">
          <ColorField label={t("color")} value={key.color} opaque disabled={disabled} onChange={(color) => patch({ color })} />
        </div>
        {eyeDropper() ? <ToolButton size="sm" label={t("pick")} icon={<Eyedropper className="h-3.5 w-3.5" />} disabled={disabled} onClick={() => void pick()} /> : null}
      </div>
      <div className="flex flex-wrap gap-1">
        {detectButton(t("detect"), "ghost")}
        {PRESETS.map((preset) => (
          <Button key={preset} variant="ghost" size="sm" disabled={disabled} title={t(`presets.${preset}`)} onClick={() => patch({ color: CHROMA_PRESETS[preset] })} />
        ))}
      </div>
      {missing}
      {lowChroma(key.color) ? <p className="text-2xs text-muted-foreground">{t("lowChroma")}</p> : null}
      {CHROMA_PROPERTIES.map(slider)}
      {localMs === null ? <p className="text-2xs text-muted-foreground">{t("outsideHint")}</p> : null}
      <p className="text-2xs text-muted-foreground">{t("holesHint")}</p>
      <div>
        <Button variant="ghost" size="sm" disabled={disabled} title={t("remove")} onClick={() => run((doc) => removeClipChroma(doc, clip.id))} />
      </div>
    </InspectorSection>
  );
}

