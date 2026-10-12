"use client";

import { useFormatter, useTranslations } from "next-intl";

import { cameraAt, clearCameraPatch, hasCamera } from "@/lib/studio/adjustment";
import { CAMERA_RANGES, isNeutralCamera } from "@/lib/studio/clip-camera";
import type { Clip } from "@/lib/studio/document";
import { KEYFRAME_RANGES } from "@/lib/studio/keyframes";
import { clipTime, sharedValue } from "@/lib/studio/selection-edit";

import { usePanelPlayhead } from "../editor-context";
import { InspectorSection, ToggleField } from "./fields";
import { KeyedSlider } from "./keyed-slider";
import type { SelectionEditor } from "./use-selection-editor";

const PERCENT = 100;
const TURN = 360;

export function CameraFields({ clips, disabled, editor }: { clips: readonly Clip[]; disabled: boolean; editor: SelectionEditor }) {
  const t = useTranslations("studio.video.camera");
  const format = useFormatter();
  const playheadMs = usePanelPlayhead();
  const shown = sharedValue(clips, (clip) => cameraAt(clip, clipTime(clip, playheadMs)));
  const summary = shown.kind === "same" ? (isNeutralCamera(shown.value) ? t("still") : t("summary", { zoom: format.number(shown.value.zoom, { maximumFractionDigits: 2 }), rotation: format.number(shown.value.rotation, { maximumFractionDigits: 1 }) })) : null;
  const motionBlur = sharedValue(clips, (clip) => Boolean(clip.motionBlur));
  const percent = (shown: number) => format.number(shown / PERCENT, { style: "percent", signDisplay: "exceptZero" });
  const common = { clips, disabled, editor };
  return (
    <InspectorSection id="camera" group="basic" title={t("title")} summary={summary} reset={{ label: t("reset"), disabled: disabled || !clips.some(hasCamera), onReset: () => editor.patch((clip) => clearCameraPatch(clip)) }}>
      <KeyedSlider {...common} property="cameraPanX" label={t("panX")} min={CAMERA_RANGES.cameraPanX[0] * PERCENT} max={CAMERA_RANGES.cameraPanX[1] * PERCENT} step={1} scale={PERCENT} format={percent} />
      <KeyedSlider {...common} property="cameraPanY" label={t("panY")} min={CAMERA_RANGES.cameraPanY[0] * PERCENT} max={CAMERA_RANGES.cameraPanY[1] * PERCENT} step={1} scale={PERCENT} format={percent} />
      <KeyedSlider {...common} property="cameraZoom" label={t("zoom")} min={CAMERA_RANGES.cameraZoom[0] * PERCENT} max={CAMERA_RANGES.cameraZoom[1] * PERCENT} step={1} scale={PERCENT} fallback={PERCENT} format={(shown) => format.number(shown / PERCENT, { style: "percent" })} />
      <KeyedSlider {...common} property="cameraRotation" label={t("rotation")} min={-TURN} max={TURN} step={1} format={(shown) => t("degrees", { value: format.number(shown, { maximumFractionDigits: 1 }) })} />
      <KeyedSlider {...common} property="blur" label={t("blur")} min={KEYFRAME_RANGES.blur[0]} max={KEYFRAME_RANGES.blur[1]} step={0.5} format={(shown) => t("pixels", { value: format.number(shown, { maximumFractionDigits: 1 }) })} />
      <ToggleField label={t("motionBlur")} checked={motionBlur.kind === "same" ? motionBlur.value : null} disabled={disabled} onChange={(on) => editor.patch(() => ({ motionBlur: on || undefined }))} />
      <p className="text-2xs text-muted-foreground">{t("motionBlurHint")}</p>
      <p className="text-2xs text-muted-foreground">{t("hint")}</p>
    </InspectorSection>
  );
}
