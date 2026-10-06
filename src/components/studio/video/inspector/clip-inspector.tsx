"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { LinkSimple } from "@/components/icons";
import { STUDIO_LIMITS, type Clip, type Fit, type Transform } from "@/lib/studio/document";
import { keyState, localTime, type KeyState } from "@/lib/studio/keyframe-edit";
import type { KeyframeProperty } from "@/lib/studio/keyframes";
import {
  commonFields,
  editSelection,
  editSourced,
  moveSelectionBy,
  moveSelectionTo,
  selectionStart,
  sharedValue,
  shownTransform,
  trimSelectionEnd,
  type Shared,
} from "@/lib/studio/selection-edit";
import { setClipTrimIn, type ClipLocation } from "@/lib/studio/timeline";

import { useVideoEditor, useViewState } from "../editor-context";
import { AnimationFields } from "./animation-fields";
import { FieldGrid, InspectorSection, NumberField, SliderField } from "./fields";
import { LayerStyleFields } from "./layer-style-fields";
import { MotionFields } from "./motion-fields";
import { useSelectionEditor, useSourceDurations } from "./use-selection-editor";

const MS = 1000;

function seconds(ms: number): number {
  return ms / MS;
}

function toMs(value: number): number {
  return Math.round(value * MS);
}

function valueOf<T>(shared: Shared<T>): T | null {
  return shared.kind === "same" ? shared.value : null;
}

interface ClipInspectorProps {
  locations: readonly ClipLocation[];
}

export function ClipInspector({ locations }: ClipInspectorProps) {
  const t = useTranslations("studio.video.inspector");
  const { commands } = useVideoEditor();
  const playheadMs = useViewState((s) => s.playheadMs);
  const clips = useMemo(() => locations.map((location) => location.clip), [locations]);
  const ids = useMemo(() => clips.map((clip) => clip.id), [clips]);
  const editor = useSelectionEditor(ids);
  const durations = useSourceDurations(clips);
  const fields = commonFields(clips);
  const lockedCount = locations.filter((location) => Boolean(location.track.locked)).length;
  const locked = lockedCount === locations.length;
  const single = clips.length === 1 ? clips[0] : null;
  const shortest = Math.min(...clips.map((clip) => clip.durationMs));

  const shown = (get: (transform: Transform) => number) => valueOf(sharedValue(clips, (clip) => get(shownTransform(clip, playheadMs))));
  const marker = (property: KeyframeProperty): { keyState: KeyState; keyHint: string } => {
    const shared = sharedValue(clips, (clip) => keyState(clip, property, localTime(clip, playheadMs)));
    const state = shared.kind === "same" ? shared.value : "static";
    return { keyState: state, keyHint: state === "key" ? t("keyHint") : t("interpolatedHint") };
  };
  const transformField = (key: keyof Transform, scale: number) => ({
    value: shown((transform) => transform[key] * scale),
    disabled: locked,
    onCommit: (v: number) => editor.transform(() => ({ [key]: v / scale })),
    onNudge: (delta: number) => editor.transform((current) => ({ [key]: current[key] + delta / scale })),
    onGestureStart: editor.gesture.onStart,
    onGestureEnd: editor.gesture.onCommit,
  });
  const patchGesture = { onGestureStart: editor.gesture.onStart, onGestureEnd: editor.gesture.onCommit };
  const fit = valueOf(sharedValue(clips, (clip) => clip.fit ?? "cover"));
  const opacity = shown((transform) => Math.round(transform.opacity * 100));
  const volume = valueOf(sharedValue(clips, (clip) => Math.round(clip.volume * 100)));
  const start = selectionStart(clips);

  return (
    <div>
      {clips.length > 1 ? (
        <InspectorSection title={t("multiple", { count: clips.length })}>
          <p className="text-xs text-muted-foreground">{t("multipleEditHint")}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" title={t("duplicate")} onClick={commands.duplicate} />
            <Button variant="outline" size="sm" title={t("delete")} onClick={() => commands.remove(false)} />
          </div>
        </InspectorSection>
      ) : null}
      {lockedCount > 0 ? (
        <p role="status" className="notice notice-warning m-3 px-2 py-1.5 text-xs">
          <span className="notice-ink font-medium">{locked ? t("locked") : t("lockedSome")}</span>
        </p>
      ) : null}
      {single?.linkId ? (
        <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground">
          <LinkSimple className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">{t("linked")}</span>
          <Button variant="ghost" size="sm" title={t("unlink")} disabled={locked} onClick={commands.unlink} />
        </div>
      ) : null}

      <InspectorSection title={t("timing")}>
        <FieldGrid>
          <NumberField
            label={clips.length > 1 ? t("groupStart") : t("start")}
            unit="s"
            step={0.1}
            decimals={2}
            min={0}
            max={seconds(STUDIO_LIMITS.maxVideoMs)}
            value={seconds(start)}
            disabled={locked}
            onCommit={(value) => editor.run((doc) => moveSelectionTo(doc, ids, toMs(value)))}
            onNudge={(delta) => editor.run((doc) => moveSelectionBy(doc, ids, toMs(delta)))}
            {...patchGesture}
          />
          <NumberField
            label={t("duration")}
            unit="s"
            step={0.1}
            decimals={2}
            min={seconds(STUDIO_LIMITS.minClipMs)}
            value={valueOf(sharedValue(clips, (clip) => seconds(clip.durationMs)))}
            disabled={locked}
            onCommit={(value) => editor.run((doc) => trimSelectionEnd(doc, ids, () => toMs(value), durations))}
            onNudge={(delta) => editor.run((doc) => trimSelectionEnd(doc, ids, (clip) => clip.durationMs + toMs(delta), durations))}
            {...patchGesture}
          />
          {fields.has("trimIn") ? (
            <NumberField
              label={t("trimIn")}
              unit="s"
              step={0.1}
              decimals={2}
              min={0}
              value={valueOf(sharedValue(clips, (clip) => seconds(clip.trimInMs)))}
              disabled={locked}
              onCommit={(value) => editor.run((doc) => editSelection(doc, ids, editSourced(durations, (current, clip, source) => setClipTrimIn(current, clip.id, toMs(value), source))))}
              onNudge={(delta) =>
                editor.run((doc) => editSelection(doc, ids, editSourced(durations, (current, clip, source) => setClipTrimIn(current, clip.id, clip.trimInMs + toMs(delta), source))))
              }
              {...patchGesture}
            />
          ) : null}
          {single?.assetId && durations[single.assetId] !== undefined ? (
            <div className="space-y-1">
              <span className="block text-2xs text-muted-foreground">{t("sourceLength")}</span>
              <span className="block pt-1 text-xs tabular-nums text-foreground">{`${seconds(durations[single.assetId]!).toFixed(2)} s`}</span>
            </div>
          ) : null}
        </FieldGrid>
      </InspectorSection>

      {fields.has("transform") ? (
        <InspectorSection title={t("frame")}>
          {fields.has("fit") ? (
            <div className="space-y-1">
              <span className="block text-2xs text-muted-foreground">{fit === null ? `${t("fit")} (${t("mixed")})` : t("fit")}</span>
              <ElevatedPillToggle<Fit | "mixed">
                aria-label={t("fit")}
                value={fit ?? "mixed"}
                onChange={(next) => {
                  if (!locked && next !== "mixed") editor.patch(() => ({ fit: next }));
                }}
                className="flex w-full [&>button]:flex-1"
                options={[
                  { value: "cover", label: t("fits.cover"), disabled: locked },
                  { value: "contain", label: t("fits.contain"), disabled: locked },
                ]}
              />
            </div>
          ) : null}
          <FieldGrid>
            <NumberField label={t("x")} unit="%" decimals={1} min={0} max={100} {...transformField("x", 100)} {...marker("x")} />
            <NumberField label={t("y")} unit="%" decimals={1} min={0} max={100} {...transformField("y", 100)} {...marker("y")} />
            <NumberField label={t("width")} unit="%" decimals={1} min={1} max={400} {...transformField("w", 100)} {...marker("scale")} />
            <NumberField label={t("height")} unit="%" decimals={1} min={1} max={400} {...transformField("h", 100)} {...marker("scale")} />
            <NumberField label={t("rotation")} unit="°" decimals={1} min={-360} max={360} {...transformField("rotation", 1)} {...marker("rotation")} />
          </FieldGrid>
          <SliderField
            label={t("opacity")}
            min={0}
            max={100}
            step={1}
            value={opacity}
            fallback={100}
            valueText={`${opacity ?? 0}%`}
            disabled={locked}
            onChange={(v) => editor.transform(() => ({ opacity: v / 100 }))}
            onStart={editor.gesture.onStart}
            onCommit={editor.gesture.onCommit}
            {...marker("opacity")}
          />
          <p className="text-2xs text-muted-foreground">{t("scrubTip")}</p>
        </InspectorSection>
      ) : null}

      {fields.has("volume") ? (
        <InspectorSection title={t("sound")}>
          <SliderField
            label={t("volume")}
            min={0}
            max={STUDIO_LIMITS.maxVolume * 100}
            step={1}
            value={volume}
            fallback={100}
            valueText={`${volume ?? 0}%`}
            disabled={locked}
            onChange={(v) => editor.patch(() => ({ volume: v / 100 }))}
            onStart={editor.gesture.onStart}
            onCommit={editor.gesture.onCommit}
          />
        </InspectorSection>
      ) : null}

      <InspectorSection title={t("fades")}>
        <FieldGrid>
          <NumberField
            label={t("fadeIn")}
            unit="s"
            step={0.1}
            decimals={2}
            min={0}
            max={seconds(shortest)}
            value={valueOf(sharedValue(clips, (clip) => seconds(clip.fadeInMs)))}
            disabled={locked}
            onCommit={(v) => editor.patch(() => ({ fadeInMs: toMs(v) }))}
            onNudge={(delta) => editor.patch((clip: Clip) => ({ fadeInMs: Math.max(0, clip.fadeInMs + toMs(delta)) }))}
            {...patchGesture}
          />
          <NumberField
            label={t("fadeOut")}
            unit="s"
            step={0.1}
            decimals={2}
            min={0}
            max={seconds(shortest)}
            value={valueOf(sharedValue(clips, (clip) => seconds(clip.fadeOutMs)))}
            disabled={locked}
            onCommit={(v) => editor.patch(() => ({ fadeOutMs: toMs(v) }))}
            onNudge={(delta) => editor.patch((clip: Clip) => ({ fadeOutMs: Math.max(0, clip.fadeOutMs + toMs(delta)) }))}
            {...patchGesture}
          />
        </FieldGrid>
        <p className="text-2xs text-muted-foreground">{fields.has("transform") ? t("fadesVisualHint") : fields.has("volume") ? t("fadesAudioHint") : t("fadesMixedHint")}</p>
      </InspectorSection>

      {fields.has("motion") ? <MotionFields clips={clips} disabled={locked} onPatch={editor.patch} /> : null}
      {fields.has("keyframes") ? <AnimationFields clips={clips} disabled={locked} editor={editor} /> : null}

      {fields.has("layer") ? (
        <LayerStyleFields
          layers={clips.flatMap((clip) => (clip.layer ? [clip.layer] : []))}
          disabled={locked}
          onChange={(change) => editor.patch((clip) => (clip.layer ? { layer: { ...clip.layer, ...change(clip.layer) } } : null))}
        />
      ) : null}
    </div>
  );
}
