"use client";

import { useEffect, useId, useMemo } from "react";
import { useTranslations } from "next-intl";

import type { Clip, Track } from "@/lib/studio/document";
import { clipEnd } from "@/lib/studio/timeline";
import { formatTimecode } from "@/lib/studio/timeline-view";

import { useEditorState } from "../editor-context";
import { useTrackNames } from "../use-track-names";

export interface PickedClip {
  clip: Clip;
  track: Track;
}

interface ClipPickerProps {
  label: string;
  accepts: (clip: Clip, track: Track) => boolean;
  value: string | null;
  onChange: (clipId: string | null) => void;
  disabled?: boolean;
}

export function useEligibleClips(accepts: (clip: Clip, track: Track) => boolean): PickedClip[] {
  const tracks = useEditorState((s) => s.document.tracks);
  return useMemo(() => tracks.flatMap((track) => track.clips.filter((clip) => accepts(clip, track)).map((clip) => ({ clip, track }))), [tracks, accepts]);
}

export function ClipPicker({ label, accepts, value, onChange, disabled }: ClipPickerProps) {
  const t = useTranslations("studio.video.picker");
  const id = useId();
  const selection = useEditorState((s) => s.selection);
  const tracks = useEditorState((s) => s.document.tracks);
  const names = useTrackNames(tracks);
  const eligible = useEligibleClips(accepts);
  const selectedEligible = eligible.find((entry) => selection.includes(entry.clip.id));
  const current = eligible.find((entry) => entry.clip.id === value);

  const fallback = selectedEligible?.clip.id ?? eligible[0]?.clip.id ?? null;

  useEffect(() => {
    if (!current && fallback !== value) onChange(fallback);
  }, [current, fallback, value, onChange]);

  if (eligible.length === 0) return <p className="text-xs text-muted-foreground">{t("none")}</p>;

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-2xs text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value || null)}
        className="h-7 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {eligible.map(({ clip, track }) => (
          <option key={clip.id} value={clip.id}>
            {t("option", { track: names.get(track.id) ?? "", start: formatTimecode(clip.startMs), end: formatTimecode(clipEnd(clip)) })}
          </option>
        ))}
      </select>
    </div>
  );
}
