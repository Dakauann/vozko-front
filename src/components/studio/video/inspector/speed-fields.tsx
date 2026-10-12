"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { clipSpeed, hasSpeedCurve, SPEED_LIMITS } from "@/lib/studio/clip-time";
import { STUDIO_LIMITS, type Clip } from "@/lib/studio/document";
import type { Easing } from "@/lib/studio/keyframes";
import { DEFAULT_FREEZE_MS, DEFAULT_RAMP_EASING, RAMP_STEPS, type RetimeRequest } from "@/lib/studio/retime";
import { sharedValue } from "@/lib/studio/selection-edit";
import { isSmoothCurve, presetPoints, SPEED_CURVE_PRESET_IDS, speedCurvePoints, type SpeedCurvePoint } from "@/lib/studio/speed-curve";

import { useVideoEditor } from "../editor-context";
import { EasingPicker } from "./easing-picker";
import { FieldGrid, InspectorSection, NumberField, SelectField, ToggleField } from "./fields";
import { SpeedCurveEditor } from "./speed-curve-editor";

const PRESETS = [0.25, 0.5, 1, 2, 4] as const;
const NATURAL_RANGE = [0.5, 2] as const;
const DEFAULT_RAMP_TARGET = 0.3;
const DEFAULT_RAMP_MS = 600;
const MS = 1000;

function same<T>(clips: readonly Clip[], get: (clip: Clip) => T): T | null {
  const shared = sharedValue(clips, get);
  return shared.kind === "same" ? shared.value : null;
}

export function SpeedFields({ clips, disabled }: { clips: readonly Clip[]; disabled: boolean }) {
  const t = useTranslations("studio.video.speed");
  const format = useFormatter();
  const { commands } = useVideoEditor();
  const [keepDuration, setKeepDuration] = useState(false);
  const [rampTarget, setRampTarget] = useState(DEFAULT_RAMP_TARGET);
  const [rampMs, setRampMs] = useState(DEFAULT_RAMP_MS);
  const [rampSteps, setRampSteps] = useState(RAMP_STEPS);
  const [rampEasing, setRampEasing] = useState<Easing>(DEFAULT_RAMP_EASING);
  const [ripple, setRipple] = useState(true);
  const [stretchKeys, setStretchKeys] = useState(true);
  const [protectMs, setProtectMs] = useState(0);
  const [freezeMs, setFreezeMs] = useState(DEFAULT_FREEZE_MS);
  const [rampMode, setRampMode] = useState<"smooth" | "steps">("smooth");
  const [smoothCurve, setSmoothCurve] = useState(true);
  const frozen = clips.some((clip) => clip.freeze);

  if (frozen) {
    return (
      <InspectorSection title={t("title")}>
        <p className="text-2xs text-muted-foreground">{t("frozen")}</p>
      </InspectorSection>
    );
  }

  const speed = clips.some(hasSpeedCurve) ? null : same(clips, clipSpeed);
  const curved = clips.length === 1 && hasSpeedCurve(clips[0]) ? clips[0] : null;
  const curvable = clips.length === 1 && (clips[0].type === "video" || clips[0].type === "audio");
  const smooth = curved ? isSmoothCurve(curved) : smoothCurve;
  const frameMix = same(clips, (clip) => Boolean(clip.frameMix));
  const shapeCurve = (points: SpeedCurvePoint[], smoothed = smooth) => commands.setSpeedCurve(clips[0].id, { points, smooth: smoothed, keep, ripple });
  const reverse = same(clips, (clip) => Boolean(clip.reverse));
  const preservePitch = same(clips, (clip) => clip.preservePitch ?? true);
  const keep = keepDuration ? ("duration" as const) : ("source" as const);
  const stretched = preservePitch !== false && speed !== null && (speed < NATURAL_RANGE[0] || speed > NATURAL_RANGE[1]);
  const freezable = clips.length === 1 && clips[0].type === "video";
  const retime = (request: RetimeRequest) => commands.retime({ ...request, ripple, keyframes: stretchKeys ? "stretch" : "keep", ...(stretchKeys && protectMs > 0 ? { protectEdgesMs: protectMs } : {}) });

  return (
    <InspectorSection title={t("title")}>
      <NumberField
        label={t("speed")}
        unit="×"
        decimals={2}
        step={0.05}
        min={SPEED_LIMITS[0]}
        max={SPEED_LIMITS[1]}
        value={speed}
        disabled={disabled}
        onCommit={(next) => retime({ speed: next, keep })}
      />
      <div role="group" aria-label={t("presets")} className="flex flex-wrap gap-1">
        {PRESETS.map((preset) => (
          <Button
            key={preset}
            variant={speed === preset ? "secondary" : "outline"}
            aria-pressed={speed === preset}
            size="sm"
            disabled={disabled}
            title={t("preset", { speed: format.number(preset) })}
            onClick={() => retime({ speed: preset, keep })}
          />
        ))}
      </div>
      <NumberField
        label={t("targetDuration")}
        unit="s"
        decimals={2}
        step={0.1}
        min={STUDIO_LIMITS.minClipMs / MS}
        max={STUDIO_LIMITS.maxVideoMs / MS}
        value={same(clips, (clip) => clip.durationMs / MS)}
        disabled={disabled}
        onCommit={(seconds) => retime({ durationMs: Math.round(seconds * MS) })}
      />
      <p className="text-2xs text-muted-foreground">{t("targetDurationHint")}</p>
      <ToggleField label={t("keepDuration")} checked={keepDuration} disabled={disabled} onChange={setKeepDuration} />
      <ToggleField label={t("ripple")} checked={ripple} disabled={disabled} onChange={setRipple} />
      <ToggleField label={t("stretchKeys")} checked={stretchKeys} disabled={disabled} onChange={setStretchKeys} />
      {stretchKeys ? (
        <>
          <NumberField
            label={t("protectEdges")}
            unit="s"
            decimals={2}
            step={0.1}
            min={0}
            max={STUDIO_LIMITS.maxVideoMs / MS}
            value={protectMs / MS}
            disabled={disabled}
            onCommit={(seconds) => setProtectMs(Math.max(0, Math.round(seconds * MS)))}
          />
          <p className="text-2xs text-muted-foreground">{t("protectEdgesHint")}</p>
        </>
      ) : null}
      {clips.some((clip) => clip.type === "group") ? (
        <p className="text-2xs text-muted-foreground">{t("groupHint")}</p>
      ) : (
        <>
          <ToggleField label={t("reverse")} checked={reverse} disabled={disabled} onChange={(next) => retime({ reverse: next })} />
          <ToggleField label={t("preservePitch")} checked={preservePitch} disabled={disabled} onChange={(next) => retime({ preservePitch: next })} />
          {stretched ? <p className="text-2xs text-muted-foreground">{t("pitchHint")}</p> : null}
        </>
      )}
      {clips.every((clip) => clip.type === "video") ? (
        <>
          <ToggleField label={t("frameMix")} checked={frameMix} disabled={disabled} onChange={(next) => commands.setFrameMix(next)} />
          <p className="text-2xs text-muted-foreground">{t("frameMixHint")}</p>
        </>
      ) : null}
      {curvable ? (
        <div role="group" aria-label={t("curve.title")} className="space-y-2 border-t border-border pt-2">
          <p className="text-2xs font-semibold uppercase text-muted-foreground">{t("curve.title")}</p>
          <div role="group" aria-label={t("curve.presets")} className="flex flex-wrap gap-1">
            {SPEED_CURVE_PRESET_IDS.map((preset) => (
              <Button key={preset} variant="outline" size="sm" disabled={disabled} title={t(`curve.presetNames.${preset}`)} onClick={() => shapeCurve(presetPoints(preset))} />
            ))}
          </div>
          <ToggleField
            label={t("curve.smooth")}
            checked={smooth}
            disabled={disabled}
            onChange={(next) => {
              setSmoothCurve(next);
              if (curved) shapeCurve(speedCurvePoints(curved), next);
            }}
          />
          {curved ? (
            <>
              <SpeedCurveEditor key={`${curved.durationMs}:${JSON.stringify(curved.keyframes?.speed)}`} points={speedCurvePoints(curved)} durationMs={curved.durationMs} smooth={smooth} disabled={disabled} onCommit={(points) => shapeCurve(points)} />
              <Button variant="outline" size="sm" disabled={disabled} title={t("curve.clear")} onClick={() => commands.clearSpeedCurve(curved.id)} />
            </>
          ) : (
            <Button variant="outline" size="sm" disabled={disabled} title={t("curve.start")} onClick={() => shapeCurve([{ at: 0, speed: speed ?? 1 }, { at: 1, speed: speed ?? 1 }])} />
          )}
          <p className="text-2xs text-muted-foreground">{t("curve.keepHint")}</p>
        </div>
      ) : null}
      <div className="space-y-2 border-t border-border pt-2">
        <SelectField<"smooth" | "steps">
          label={t("ramp.mode")}
          value={rampMode}
          options={[
            { value: "smooth", label: t("ramp.modes.smooth") },
            { value: "steps", label: t("ramp.modes.steps") },
          ]}
          disabled={disabled}
          onChange={setRampMode}
        />
        <FieldGrid>
          <NumberField label={t("ramp.target")} unit="×" decimals={2} step={0.05} min={SPEED_LIMITS[0]} max={SPEED_LIMITS[1]} value={rampTarget} disabled={disabled} onCommit={setRampTarget} />
          <NumberField label={t("ramp.duration")} unit="s" decimals={2} step={0.1} min={0.1} max={10} value={rampMs / MS} disabled={disabled} onCommit={(seconds) => setRampMs(Math.round(seconds * MS))} />
          {rampMode === "steps" ? <NumberField label={t("ramp.steps")} min={1} value={rampSteps} disabled={disabled} onCommit={(steps) => setRampSteps(Math.max(1, Math.round(steps)))} /> : null}
        </FieldGrid>
        <EasingPicker label={t("ramp.easing")} value={rampEasing} disabled={disabled} hidden={["hold"]} onPick={setRampEasing} />
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || clips.length !== 1}
          title={t("ramp.apply")}
          onClick={() => commands.rampSpeed({ toSpeed: rampTarget, rampMs, steps: rampSteps, easing: rampEasing }, rampMode === "smooth")}
        />
        <p className="text-2xs text-muted-foreground">{rampMode === "smooth" ? t("ramp.smoothHint") : t("ramp.hint")}</p>
      </div>
      {freezable ? (
        <div className="space-y-2 border-t border-border pt-2">
          <NumberField
            label={t("freezeDuration")}
            unit="s"
            decimals={2}
            step={0.1}
            min={STUDIO_LIMITS.minClipMs / MS}
            max={STUDIO_LIMITS.maxVideoMs / MS}
            value={freezeMs / MS}
            disabled={disabled}
            onCommit={(seconds) => setFreezeMs(Math.round(seconds * MS))}
          />
          <Button variant="outline" size="sm" disabled={disabled} title={t("freeze")} onClick={() => commands.freezeFrame(freezeMs)} />
        </div>
      ) : null}
    </InspectorSection>
  );
}
