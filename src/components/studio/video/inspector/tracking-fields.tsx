"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import type { Clip } from "@/lib/studio/document";
import { TRACKER_LIMITS, trackerSummary, type PointTracker } from "@/lib/studio/point-track";
import { attachChoices, type AttachMode } from "@/lib/studio/track-edit";

import { useEditorState, useVideoEditor } from "../editor-context";
import { useClipLabeler } from "../use-clip-label";
import { InspectorSection, NumberField, SelectField, SliderField, ToggleField } from "./fields";

const NONE = "none";
const SMOOTH_MAX_MS = 5000;
const SMOOTH_STEP_MS = 100;

interface TrackingFieldsProps {
  clip: Clip;
  disabled: boolean;
}

export function trackerLabel(tracker: PointTracker, index: number, numbered: (n: number) => string): string {
  return tracker.name || numbered(index + 1);
}

export function TrackingFields({ clip, disabled }: TrackingFieldsProps) {
  const t = useTranslations("studio.video.tracking");
  const format = useFormatter();
  const { commands } = useVideoEditor();
  const label = useClipLabeler();
  const document = useEditorState((s) => s.document);
  const trackers = clip.trackers ?? [];
  const named = (n: number) => t("point", { n });
  const options = trackers.map((tracker, index) => ({ value: tracker.id, label: trackerLabel(tracker, index, named) }));
  const followers = attachChoices(document, clip.id).map((other) => ({ value: other.id, label: `${label(other)} · ${other.id.slice(-4)}` }));
  const [trackerPick, setTrackerPick] = useState<string | null>(null);
  const [followerPick, setFollowerPick] = useState<string | null>(null);
  const [mode, setMode] = useState<AttachMode>("link");
  const [keepVisual, setKeepVisual] = useState(true);
  const steady = clip.stabilize;
  const [firstPick, setFirstPick] = useState<string | null>(null);
  const [secondPick, setSecondPick] = useState<string>(steady?.secondTrackerId ?? NONE);
  const [rotation, setRotation] = useState(Boolean(steady?.rotation));
  const [scale, setScale] = useState(Boolean(steady?.scale));
  const [smoothMs, setSmoothMs] = useState(steady?.smoothMs ?? 0);
  const tracker = trackerPick && trackers.some((known) => known.id === trackerPick) ? trackerPick : (trackers[0]?.id ?? null);
  const follower = followerPick && followers.some((known) => known.value === followerPick) ? followerPick : (followers[0]?.value ?? null);
  const first = firstPick && trackers.some((known) => known.id === firstPick) ? firstPick : (steady?.trackerId ?? trackers[0]?.id ?? null);
  const second = secondPick !== NONE && secondPick !== first && trackers.some((known) => known.id === secondPick) ? secondPick : null;
  const percent = (value: number) => format.number(value, { style: "percent", maximumFractionDigits: 0 });
  const stabilizeRequest = (zoom?: number) => ({
    trackerId: first!,
    ...(second ? { secondTrackerId: second } : {}),
    rotation: Boolean(second) && rotation,
    scale: Boolean(second) && scale,
    ...(smoothMs > 0 ? { smoothMs } : {}),
    ...(zoom !== undefined ? { zoom } : {}),
  });

  return (
    <InspectorSection id="tracking" title={t("title")} summary={trackers.length > 0 ? t("summary", { count: trackers.length }) : t("summaryNone")}>
      <Button variant="outline" size="sm" disabled={disabled} title={t("trackPoint")} onClick={() => commands.startTracking(clip.id)} />
      {trackers.length === 0 ? <p className="text-2xs text-muted-foreground">{t("hint")}</p> : null}
      {trackers.map((known, index) => {
        const summary = trackerSummary(known);
        return (
          <div key={known.id} className="flex items-center gap-2 text-xs" data-tracker-id={known.id}>
            <span className="min-w-0 flex-1 truncate">{trackerLabel(known, index, named)}</span>
            <span className="text-2xs text-muted-foreground">{t("frames", { frames: summary.frames, confidence: percent(summary.meanConfidence), lowest: percent(summary.lowestConfidence) })}</span>
            <Button variant="ghost" size="sm" disabled={disabled} title={t("retrack")} onClick={() => commands.startTracking(clip.id, known.id)} />
            <Button variant="ghost" size="sm" disabled={disabled} title={t("remove")} onClick={() => commands.removeTracker(clip.id, known.id)} />
          </div>
        );
      })}
      {trackers.length > 0 ? (
        <>
          <p className="text-xs font-medium">{t("attachTitle")}</p>
          {trackers.length > 1 ? <SelectField<string> label={t("tracker")} value={tracker} options={options} disabled={disabled} onChange={setTrackerPick} /> : null}
          <SelectField<string> label={t("follower")} value={follower} options={followers} disabled={disabled || followers.length === 0} onChange={setFollowerPick} />
          <SelectField<AttachMode>
            label={t("mode")}
            value={mode}
            options={[
              { value: "link", label: t("modeLink") },
              { value: "keys", label: t("modeKeys") },
            ]}
            disabled={disabled}
            onChange={setMode}
          />
          <ToggleField label={t("keepVisual")} checked={keepVisual} disabled={disabled} onChange={setKeepVisual} />
          <Button variant="outline" size="sm" disabled={disabled || !tracker || !follower} title={t("attach")} onClick={() => tracker && follower && commands.attachToTracker([follower], clip.id, tracker, mode, keepVisual)} />
          <p className="text-xs font-medium">{t("stabilizeTitle")}</p>
          <SelectField<string> label={t("stabilizeTracker")} value={first} options={options} disabled={disabled} onChange={setFirstPick} />
          <SelectField<string> label={t("secondTracker")} value={second ?? NONE} options={[{ value: NONE, label: t("none") }, ...options.filter((option) => option.value !== first)]} disabled={disabled || trackers.length < 2} onChange={setSecondPick} />
          <ToggleField label={t("rotation")} checked={Boolean(second) && rotation} disabled={disabled || !second} onChange={setRotation} />
          <ToggleField label={t("scale")} checked={Boolean(second) && scale} disabled={disabled || !second} onChange={setScale} />
          <SliderField
            label={t("smoothing")}
            value={smoothMs}
            fallback={0}
            min={0}
            max={SMOOTH_MAX_MS}
            step={SMOOTH_STEP_MS}
            valueText={smoothMs === 0 ? t("smoothingLock") : t("seconds", { value: format.number(smoothMs / 1000, { maximumFractionDigits: 1 }) })}
            onChange={(value) => setSmoothMs(value > 0 ? Math.max(TRACKER_LIMITS.smoothMs[0], value) : 0)}
            onCommit={() => undefined}
            onStart={() => undefined}
            disabled={disabled}
          />
          <Button variant="outline" size="sm" disabled={disabled || !first} title={steady ? t("restabilize") : t("stabilize")} onClick={() => first && commands.stabilizeClip(clip.id, stabilizeRequest())} />
          {steady ? (
            <>
              <NumberField label={t("zoom")} value={steady.zoom} min={TRACKER_LIMITS.zoom[0]} max={TRACKER_LIMITS.zoom[1]} step={0.01} decimals={2} unit="x" disabled={disabled} onCommit={(zoom) => commands.stabilizeClip(clip.id, { ...steady, zoom })} />
              <Button variant="ghost" size="sm" disabled={disabled} title={t("unstabilize")} onClick={() => commands.unstabilizeClip(clip.id)} />
            </>
          ) : null}
          <p className="text-2xs text-muted-foreground">{t("stabilizeHint")}</p>
        </>
      ) : null}
    </InspectorSection>
  );
}
