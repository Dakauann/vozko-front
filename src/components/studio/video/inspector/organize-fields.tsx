"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { addClipMarker, beatSource, markBeats, type BeatMarkRefusal, type ClipMarkerRefusal } from "@/lib/studio/clip-marker-edits";
import { placedClipMarkers } from "@/lib/studio/clip-markers";
import { STUDIO_LIMITS, type Clip } from "@/lib/studio/document";
import type { LabelColor } from "@/lib/studio/labels";
import { cleanClipName } from "@/lib/studio/organize";
import { sharedValue } from "@/lib/studio/selection-edit";
import { formatTimecode } from "@/lib/studio/timeline-view";

import { useVideoEditor } from "../editor-context";
import { LabelColorPicker, LabelSwatch } from "../label-colors";
import { InspectorSection, SelectField, TextField, ToggleField } from "./fields";
import type { SelectionEditor } from "./use-selection-editor";

const BEAT_STEPS = ["1", "2", "4", "8"] as const;

type BeatStep = (typeof BEAT_STEPS)[number];

interface OrganizeFieldsProps {
  clips: readonly Clip[];
  disabled: boolean;
  editor: SelectionEditor;
}

function ClipMarkers({ clip, disabled }: { clip: Clip; disabled: boolean }) {
  const t = useTranslations("studio.video.organize");
  const tm = useTranslations("studio.video.timeline.markers");
  const { store, view, playback } = useVideoEditor();
  const [refusal, setRefusal] = useState<ClipMarkerRefusal | null>(null);
  const placed = placedClipMarkers(clip);
  const beats = placed.filter((entry) => entry.marker.beat).length;
  const add = () => {
    const result = addClipMarker(store.getState().document, clip.id, view.getState().playheadMs, {});
    setRefusal(result.ok ? null : result.reason);
    if (result.ok) store.getState().apply(() => result.document);
  };
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs text-muted-foreground">{t("markers", { count: placed.length - beats })}</span>
        <Button variant="outline" size="sm" title={t("addMarker")} disabled={disabled} onClick={add} />
      </div>
      {refusal ? (
        <p role="alert" className="text-2xs text-destructive">
          {tm(refusal)}
        </p>
      ) : null}
      <ul className="space-y-0.5">
        {placed
          .filter((entry) => !entry.marker.beat)
          .map((entry) => (
            <li key={entry.marker.id}>
              <button
                type="button"
                onClick={() => playback.seek(entry.startMs)}
                className="flex w-full items-center gap-1.5 rounded-[--radius] px-1 py-0.5 text-left text-2xs text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <LabelSwatch color={entry.marker.color} />
                <span className="font-mono tabular-nums text-muted-foreground">{formatTimecode(entry.startMs)}</span>
                <span className="min-w-0 flex-1 truncate">{entry.marker.label ?? tm("noName")}</span>
              </button>
            </li>
          ))}
      </ul>
      {beats > 0 ? <p className="text-2xs text-muted-foreground">{t("beatCount", { count: beats })}</p> : null}
      <p className="text-2xs text-muted-foreground">{t("markersHint")}</p>
    </div>
  );
}

function BeatFields({ clip, disabled }: { clip: Clip; disabled: boolean }) {
  const t = useTranslations("studio.video.organize");
  const { store, audio } = useVideoEditor();
  const [every, setEvery] = useState<BeatStep>("1");
  const [color, setColor] = useState<LabelColor | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{ placed: number; bpm: number } | BeatMarkRefusal | "unread" | null>(null);
  const mark = async () => {
    const source = beatSource(store.getState().document, clip.id);
    if (!source.ok) return setOutcome(source.reason);
    setBusy(true);
    const profile = await audio.loudness(source.assetId);
    setBusy(false);
    if (!profile) return setOutcome("unread");
    const result = markBeats(store.getState().document, clip.id, profile, { every: Number(every), ...(color ? { color } : {}) });
    if (!result.ok) return setOutcome(result.reason);
    store.getState().apply(() => result.document);
    setOutcome({ placed: result.placed, bpm: result.bpm });
  };
  return (
    <div className="space-y-1.5 border-t border-border pt-2">
      <SelectField<BeatStep> label={t("beatEvery")} value={every} options={BEAT_STEPS.map((step) => ({ value: step, label: t(`beatSteps.${step}`) }))} disabled={disabled} onChange={setEvery} />
      <LabelColorPicker label={t("beatColor")} value={color} disabled={disabled} onChange={setColor} />
      <Button variant="outline" size="sm" title={busy ? t("beatsReading") : t("markBeats")} disabled={disabled || busy} onClick={() => void mark()} />
      {outcome !== null ? (
        <p role={typeof outcome === "string" ? "alert" : "status"} className={typeof outcome === "string" ? "text-2xs text-destructive" : "text-2xs text-muted-foreground"}>
          {typeof outcome === "string" ? t(`beatRefusals.${outcome}`) : t("beatsPlaced", { count: outcome.placed, bpm: outcome.bpm })}
        </p>
      ) : null}
      <p className="text-2xs text-muted-foreground">{t("beatsHint")}</p>
    </div>
  );
}

export function OrganizeFields({ clips, disabled, editor }: OrganizeFieldsProps) {
  const t = useTranslations("studio.video.organize");
  const single = clips.length === 1 ? clips[0] : null;
  const label = sharedValue(clips, (clip) => clip.labelColor);
  const guide = sharedValue(clips, (clip) => Boolean(clip.guide));
  const guidable = clips.every((clip) => clip.type !== "null");
  return (
    <InspectorSection id="organize" title={t("title")}>
      {single ? (
        <TextField
          label={t("name")}
          value={single.name ?? ""}
          maxLength={STUDIO_LIMITS.maxLayerNameRunes}
          disabled={disabled}
          onCommit={(value) => editor.patch(() => ({ name: cleanClipName(value) }))}
        />
      ) : null}
      <LabelColorPicker label={t("label")} value={label.kind === "same" ? label.value : null} disabled={disabled} onChange={(color) => editor.patch(() => ({ labelColor: color }))} />
      {guidable ? (
        <>
          <ToggleField label={t("guide")} checked={guide.kind === "same" ? guide.value : null} disabled={disabled} onChange={(on) => editor.patch(() => ({ guide: on || undefined }))} />
          <p className="text-2xs text-muted-foreground">{t("guideHint")}</p>
        </>
      ) : null}
      {single ? <ClipMarkers clip={single} disabled={disabled} /> : null}
      {single?.type === "audio" ? <BeatFields clip={single} disabled={disabled} /> : null}
    </InspectorSection>
  );
}
