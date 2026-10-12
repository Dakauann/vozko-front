"use client";

import { useMemo } from "react";
import { useFormatter, useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { LinkSimple } from "@/components/icons";
import { BLEND_MODES, canvasAspect, STUDIO_LIMITS, type BlendMode, type Clip, type Fit, type Transform } from "@/lib/studio/document";
import { clipBlend, clipBlendPatch } from "@/lib/studio/clip-blend";
import { axisScaled, keyState, localTime, onPath, propertyValue, type KeyState } from "@/lib/studio/keyframe-edit";
import { KEYFRAME_RANGES, type AnimatedProperty, type ColorProperty } from "@/lib/studio/keyframes";
import {
  checkedDocument,
  commonFields,
  editSelection,
  editSourced,
  moveSelectionBy,
  moveSelectionTo,
  selectionStart,
  sharedValue,
  shownBlur,
  shownPaint,
  shownTransform,
  toggleSelectionKey,
  trimSelectionEnd,
  type Shared,
} from "@/lib/studio/selection-edit";
import { setClipTrimIn, type ClipLocation } from "@/lib/studio/timeline";
import { setClipsDisabled } from "@/lib/studio/tools";

import { InspectorGroup } from "../../inspector/inspector-context";
import { useEditorState, usePanelPlayhead, useVideoEditor } from "../editor-context";
import { AnimationFields } from "./animation-fields";
import { FieldGrid, InspectorSection, NumberField, SelectField, SliderField, ToggleField } from "./fields";
import { KeyedField } from "./key-toggle";
import { LayerStyleFields, type PaintField } from "./layer-style-fields";
import { MotionFields } from "./motion-fields";
import { fadePatch } from "@/lib/studio/edge-transitions";
import { ColorGradeFields } from "./color-grade-fields";
import { ColorFinishFields } from "./color-finish-fields";
import { ChromaKeyFields } from "./chroma-key-fields";
import { LumaKeyFields } from "./luma-key-fields";
import { MaskFields } from "./mask-fields";
import { EffectStrengthFields, VfxFields } from "./vfx-fields";
import { CameraFields } from "./camera-fields";
import { PlacementFields } from "./placement-fields";
import { ParentFields } from "./parent-fields";
import { TrackingFields } from "./tracking-fields";
import { BehaviorFields } from "./behavior-fields";
import { PARENTED_POSITION, STILL_POSITION } from "@/lib/studio/parenting";
import { LineFields } from "./line-fields";
import { VideoPathOpFields } from "./path-op-fields";
import { RepeatFields } from "./repeat-fields";
import { takesPathOps } from "@/lib/studio/path-ops";
import { MorphFields } from "./morph-fields";
import { ClipStyleFields } from "./clip-style-fields";
import { takesMorph } from "@/lib/studio/morph-edit";
import { SpeedFields } from "./speed-fields";
import { TextMotionFields } from "./text-motion-fields";
import { TextAnimatorFields } from "./text-animator-fields";
import { CounterFields } from "./counter-fields";
import { TextPathFields } from "./text-path-fields";
import { ChartClipFields, ChartMotionFields } from "./chart-clip-fields";
import { QrClipFields, TableClipFields } from "./generated-clip-fields";
import { SoundFields } from "./sound-fields";
import { GroupFields, GroupSoundFields } from "./group-fields";
import { OrganizeFields } from "./organize-fields";
import { PresetFields } from "./preset-fields";
import { takesMotionBlur } from "@/lib/studio/motion-blur";
import { takesTilt } from "@/lib/studio/clip-tilt";
import { TILT_PROPERTIES, TILT_RANGE, type TiltProperty } from "@/lib/studio/tilt-properties";
import { clipTime } from "@/lib/studio/clip-time";
import { FrameLayoutFields } from "./frame-layout-fields";
import { hasFrame } from "@/lib/studio/frame-layout";
import { SequenceFields } from "./sequence-fields";
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
  const tk = useTranslations("studio.video.keyframes");
  const tb = useTranslations("studio.image.blend");
  const format = useFormatter();
  const { commands } = useVideoEditor();
  const playheadMs = usePanelPlayhead();
  const clips = useMemo(() => locations.map((location) => location.clip), [locations]);
  const ids = useMemo(() => clips.map((clip) => clip.id), [clips]);
  const editor = useSelectionEditor(ids);
  const durations = useSourceDurations(clips);
  const fields = commonFields(clips);
  const lockedCount = locations.filter((location) => Boolean(location.track.locked)).length;
  const locked = lockedCount === locations.length;
  const single = clips.length === 1 ? clips[0] : null;
  const shortest = Math.min(...clips.map((clip) => clip.durationMs));

  const aspect = useEditorState((s) => canvasAspect(s.document));
  const [positionLow, positionHigh] = clips.some((clip) => clip.parentId) ? PARENTED_POSITION : STILL_POSITION;
  const positionLane = (axis: "x" | "y"): AnimatedProperty => (clips.every(onPath) ? "position" : axis);
  const sizeLane = (axis: "x" | "y"): AnimatedProperty => (clips.every(axisScaled) ? (axis === "x" ? "scaleX" : "scaleY") : "scale");
  const shown = (get: (transform: Transform) => number) => valueOf(sharedValue(clips, (clip) => get(shownTransform(clip, playheadMs, aspect))));
  const marker = (property: AnimatedProperty): { keyState: KeyState; keyHint: string } => {
    const shared = sharedValue(clips, (clip) => keyState(clip, property, localTime(clip, playheadMs)));
    const state = shared.kind === "same" ? shared.value : "static";
    return { keyState: state, keyHint: state === "key" ? t("keyHint") : t("interpolatedHint") };
  };
  const toggleKey = (property: AnimatedProperty) => editor.run((doc) => toggleSelectionKey(doc, editor.ids, property, editor.playheadMs()));
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
  const paintField = (property: ColorProperty): PaintField => ({
    value: valueOf(sharedValue(clips, (clip) => shownPaint(clip, property, playheadMs))),
    ...marker(property),
    onToggleKey: () => toggleKey(property),
    onChange: (color) => editor.paint(property, color),
  });
  const blur = valueOf(sharedValue(clips, (clip) => Math.round(shownBlur(clip, playheadMs) * 10) / 10));
  const tiltShown = (property: TiltProperty) => valueOf(sharedValue(clips, (clip) => Math.round(propertyValue(clip, property, clipTime(clip, playheadMs)) * 10) / 10));
  const tiltX = tiltShown("rotationX");
  const tiltY = tiltShown("rotationY");
  const degrees = (value: number | null) => (value === null ? t("mixed") : format.number(value, { maximumFractionDigits: 1 }));
  const tiltSummary = tiltX === 0 && tiltY === 0 ? t("tiltFlat") : t("tiltSummary", { x: degrees(tiltX), y: degrees(tiltY) });
  const start = selectionStart(clips);
  const secondsText = (value: number | null) => (value === null ? t("mixed") : format.number(value, { maximumFractionDigits: 2 }));
  const duration = valueOf(sharedValue(clips, (clip) => seconds(clip.durationMs)));
  const fadeIn = valueOf(sharedValue(clips, (clip) => seconds(clip.fadeInMs)));
  const fadeOut = valueOf(sharedValue(clips, (clip) => seconds(clip.fadeOutMs)));

  return (
    <div>
      {clips.length > 1 ? (
        <div className="space-y-2 border-b border-border px-3 py-3">
          <p className="text-xs font-semibold text-foreground">{t("multiple", { count: clips.length })}</p>
          <p className="text-xs text-muted-foreground">{t("multipleEditHint")}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" title={t("duplicate")} onClick={commands.duplicate} />
            <Button variant="outline" size="sm" title={t("delete")} onClick={() => commands.remove(false)} />
          </div>
        </div>
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

      {fields.has("group") && single ? <GroupFields clip={single} disabled={locked} /> : null}
      {fields.has("layer") ? (
        <LayerStyleFields
          layers={clips.flatMap((clip) => (clip.layer ? [clip.layer] : []))}
          paints={{ fill: paintField("fill"), stroke: paintField("stroke") }}
          disabled={locked}
          onChange={(change) => editor.patch((clip) => (clip.layer ? { layer: { ...clip.layer, ...change(clip.layer) } } : null))}
          onEditText={single?.layer?.type === "text" && !locked ? () => commands.startTextEdit(single.id) : undefined}
          stillPath={!single?.keyframes?.path?.length}
        />
      ) : null}
      {fields.has("line") && single ? <LineFields clip={single} disabled={locked} editor={editor} /> : null}
      {fields.has("chart") && single ? <ChartClipFields clip={single} disabled={locked} editor={editor} /> : null}
      {fields.has("table") && single ? <TableClipFields clip={single} disabled={locked} editor={editor} /> : null}
      {fields.has("qr") && single ? <QrClipFields clip={single} disabled={locked} editor={editor} /> : null}
      {single?.type === "overlay" && single.layer && takesPathOps(single.layer) ? <VideoPathOpFields clip={single} disabled={locked} editor={editor} /> : null}
      {single?.type === "overlay" ? <RepeatFields clip={single} disabled={locked} editor={editor} /> : null}

      <InspectorSection id="timing" title={t("timing")} summary={t("timingSummary", { start: secondsText(seconds(start)), duration: secondsText(duration) })}>
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
            value={duration}
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
        <ToggleField
          label={t("disabled")}
          checked={valueOf(sharedValue(clips, (clip) => Boolean(clip.disabled)))}
          disabled={locked}
          onChange={(off) => editor.run((doc) => checkedDocument(doc, setClipsDisabled(doc, ids, off)))}
        />
        <p className="text-2xs text-muted-foreground">{t("disabledHint")}</p>
      </InspectorSection>
      <OrganizeFields clips={clips} disabled={locked} editor={editor} />
      {fields.has("camera") ? <CameraFields clips={clips} disabled={locked} editor={editor} /> : null}

      {fields.has("transform") ? (
        <InspectorSection id="frame" title={t("frame")}>
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
            <NumberField label={t("x")} unit="%" decimals={1} min={positionLow * 100} max={positionHigh * 100} {...transformField("x", 100)} {...marker(positionLane("x"))} />
            <NumberField label={t("y")} unit="%" decimals={1} min={positionLow * 100} max={positionHigh * 100} {...transformField("y", 100)} {...marker(positionLane("y"))} />
            <NumberField label={t("width")} unit="%" decimals={1} min={1} max={400} {...transformField("w", 100)} {...marker(sizeLane("x"))} />
            <NumberField label={t("height")} unit="%" decimals={1} min={1} max={400} {...transformField("h", 100)} {...marker(sizeLane("y"))} />
            <NumberField label={t("rotation")} unit="°" decimals={1} min={-360} max={360} {...transformField("rotation", 1)} {...marker("rotation")} />
          </FieldGrid>
          <PlacementFields clips={clips} disabled={locked} editor={editor} />
          {fields.has("look") ? (
          <>
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
          {fields.has("blend") ? (
            <>
              <SelectField<BlendMode>
                label={t("blendMode")}
                value={valueOf(sharedValue(clips, clipBlend))}
                options={BLEND_MODES.map((mode) => ({ value: mode, label: tb(mode) }))}
                disabled={locked}
                onChange={(mode) => editor.patch((clip) => clipBlendPatch(clip, mode))}
              />
              <p className="text-2xs text-muted-foreground">{t("blendHint")}</p>
            </>
          ) : null}
          <KeyedField toggle={{ label: tk("keyHere", { name: t("blur") }), state: marker("blur").keyState, disabled: locked, onClick: () => toggleKey("blur") }}>
            <NumberField
              label={t("blur")}
              unit="px"
              decimals={1}
              step={0.5}
              min={KEYFRAME_RANGES.blur[0]}
              max={KEYFRAME_RANGES.blur[1]}
              value={blur}
              disabled={locked}
              onCommit={(v) => editor.blur(() => v)}
              onNudge={(delta) => editor.blur((current) => current + delta)}
              onGestureStart={editor.gesture.onStart}
              onGestureEnd={editor.gesture.onCommit}
              {...marker("blur")}
            />
          </KeyedField>
          {clips.every((clip) => takesMotionBlur(clip.type)) ? (
            <>
              <ToggleField
                label={t("motionBlur")}
                checked={valueOf(sharedValue(clips, (clip) => Boolean(clip.motionBlur)))}
                disabled={locked}
                onChange={(on) => editor.patch(() => ({ motionBlur: on || undefined }))}
              />
              <p className="text-2xs text-muted-foreground">{t("motionBlurHint")}</p>
            </>
          ) : null}
          </>
          ) : null}
          <p className="text-2xs text-muted-foreground">{t("scrubTip")}</p>
        </InspectorSection>
      ) : null}
      {clips.every((clip) => takesTilt(clip.type)) ? (
        <InspectorSection id="tilt" title={t("tilt")} summary={tiltSummary}>
          <FieldGrid>
            {TILT_PROPERTIES.map((property) => (
              <KeyedField key={property} toggle={{ label: tk("keyHere", { name: t(property) }), state: marker(property).keyState, disabled: locked, onClick: () => toggleKey(property) }}>
                <NumberField
                  label={t(property)}
                  unit="°"
                  decimals={1}
                  min={TILT_RANGE[0]}
                  max={TILT_RANGE[1]}
                  value={tiltShown(property)}
                  disabled={locked}
                  onCommit={(v) => editor.keyed(property, () => v)}
                  onNudge={(delta) => editor.keyed(property, (current) => current + delta)}
                  {...patchGesture}
                  {...marker(property)}
                />
              </KeyedField>
            ))}
          </FieldGrid>
          <p className="text-2xs text-muted-foreground">{t("tiltHint")}</p>
        </InspectorSection>
      ) : null}
      {fields.has("parent") ? <ParentFields clips={clips} disabled={locked} /> : null}

      {clips.some((clip) => hasFrame(clip.type)) ? <FrameLayoutFields clips={clips} disabled={locked} /> : null}
      {clips.length > 1 ? <SequenceFields clips={clips} disabled={locked} /> : null}
      {fields.has("volume") ? <SoundFields clips={clips} disabled={locked} editor={editor} /> : null}
      {fields.has("groupSound") ? <GroupSoundFields clips={clips} disabled={locked} editor={editor} /> : null}

      {fields.has("fades") ? (
      <InspectorSection
        id="fades"
        title={t("fades")}
        summary={fadeIn === 0 && fadeOut === 0 ? t("noFades") : t("fadesSummary", { fadeIn: secondsText(fadeIn), fadeOut: secondsText(fadeOut) })}
      >
        <FieldGrid>
          <NumberField
            label={t("fadeIn")}
            unit="s"
            step={0.1}
            decimals={2}
            min={0}
            max={seconds(shortest)}
            value={fadeIn}
            disabled={locked}
            onCommit={(v) => editor.patch(() => fadePatch("in", toMs(v)))}
            onNudge={(delta) => editor.patch((clip: Clip) => fadePatch("in", clip.fadeInMs + toMs(delta)))}
            {...patchGesture}
          />
          <NumberField
            label={t("fadeOut")}
            unit="s"
            step={0.1}
            decimals={2}
            min={0}
            max={seconds(shortest)}
            value={fadeOut}
            disabled={locked}
            onCommit={(v) => editor.patch(() => fadePatch("out", toMs(v)))}
            onNudge={(delta) => editor.patch((clip: Clip) => fadePatch("out", clip.fadeOutMs + toMs(delta)))}
            {...patchGesture}
          />
        </FieldGrid>
        <p className="text-2xs text-muted-foreground">{fields.has("transform") ? t("fadesVisualHint") : fields.has("volume") ? t("fadesAudioHint") : t("fadesMixedHint")}</p>
      </InspectorSection>
      ) : null}

      <InspectorGroup id="animation">
        {fields.has("motion") ? <MotionFields clips={clips} disabled={locked} onPatch={editor.patch} /> : null}
        {fields.has("textMotion") ? <TextMotionFields clips={clips} disabled={locked} onPatch={editor.patch} /> : null}
        {fields.has("textMotion") && single ? <TextAnimatorFields clip={single} disabled={locked} editor={editor} /> : null}
        {fields.has("counter") && single ? <CounterFields clip={single} disabled={locked} editor={editor} /> : null}
        {fields.has("textPath") && single ? <TextPathFields clip={single} disabled={locked} editor={editor} /> : null}
        {fields.has("chart") && single ? <ChartMotionFields clip={single} disabled={locked} editor={editor} /> : null}
        {fields.has("keyframes") ? <AnimationFields clips={clips} disabled={locked} editor={editor} /> : null}
        {clips.every((clip) => clip.type !== "audio" && clip.type !== "effect") ? <PresetFields clips={clips} disabled={locked} /> : null}
        {single?.type === "overlay" && takesMorph(single.layer) ? <MorphFields clip={single} disabled={locked} editor={editor} /> : null}
        {fields.has("tracking") && single ? <TrackingFields clip={single} disabled={locked} /> : null}
        {fields.has("behaviors") && single ? <BehaviorFields clip={single} disabled={locked} editor={editor} /> : null}
      </InspectorGroup>
      <InspectorGroup id="speed">{fields.has("speed") ? <SpeedFields clips={clips} disabled={locked} /> : null}</InspectorGroup>
      <InspectorGroup id="color">
        {fields.has("grade") ? <ColorGradeFields clips={clips} disabled={locked} editor={editor} /> : null}
        {fields.has("grade") && single && (single.type === "video" || single.type === "image" || single.type === "effect") ? <ColorFinishFields clip={single} disabled={locked} editor={editor} /> : null}
      </InspectorGroup>
      <InspectorGroup id="effects">
        {single && (single.type === "overlay" || single.type === "video" || single.type === "image") ? <ClipStyleFields clip={single} disabled={locked} editor={editor} /> : null}
        {fields.has("strength") ? <EffectStrengthFields clips={clips} disabled={locked} editor={editor} /> : null}
        {fields.has("vfx") && single ? <VfxFields clip={single} disabled={locked} editor={editor} /> : null}
      </InspectorGroup>
      <InspectorGroup id="cutout">
        {fields.has("chroma") && single ? <ChromaKeyFields clip={single} disabled={locked} editor={editor} /> : null}
        {fields.has("chroma") && single ? <LumaKeyFields clip={single} disabled={locked} editor={editor} /> : null}
        {fields.has("masks") && single ? <MaskFields clip={single} disabled={locked} editor={editor} /> : null}
      </InspectorGroup>

    </div>
  );
}
