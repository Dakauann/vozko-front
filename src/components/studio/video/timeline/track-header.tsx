"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Eye, EyeSlash, Lock, LockKey, SpeakerHigh, SpeakerSlash, Trash } from "@/components/icons";
import type { Clip, Track } from "@/lib/studio/document";
import { KEY_LANE_HEIGHT } from "@/lib/studio/focus-lanes";
import { propertyValue } from "@/lib/studio/keyframe-edit";
import { KEYFRAME_PROPERTIES, type KeyframeProperty } from "@/lib/studio/keyframes";
import { removeTrack, updateTrack, type TrackPatch } from "@/lib/studio/timeline";
import { cn } from "@/lib/utils";

import { TRACK_GLYPH, TRACK_TILE } from "../clip-tones";
import { useVideoEditor, useViewState } from "../editor-context";
import { ToolButton } from "../tool-button";

interface TrackHeaderProps {
  track: Track;
  defaultName: string;
  main: boolean;
  collapsed?: boolean;
  laneHeight?: number;
  focusClip?: Clip | null;
}

function readout(property: KeyframeProperty, value: number): string {
  if (property === "rotation") return `${value.toFixed(1)}°`;
  return `${(value * 100).toFixed(1)}%`;
}

function FocusLabels({ clip }: { clip: Clip }) {
  const t = useTranslations("studio.video.keyframes.properties");
  const local = useViewState((s) => Math.min(Math.max(0, s.playheadMs - clip.startMs), clip.durationMs));
  const keyProperty = useViewState((s) => s.keyProperty);
  return (
    <div className="border-t border-border-strong">
      {KEYFRAME_PROPERTIES.map((property) => (
        <div
          key={property}
          className={cn("flex items-center justify-between border-b border-background px-2 text-2xs", keyProperty === property ? "bg-muted text-foreground" : "text-muted-foreground")}
          style={{ height: KEY_LANE_HEIGHT }}
        >
          <span className="truncate">{t(property)}</span>
          <span className="font-mono tabular-nums">{readout(property, propertyValue(clip, property, local))}</span>
        </div>
      ))}
    </div>
  );
}

export function TrackHeader({ track, defaultName, main, collapsed = false, laneHeight, focusClip }: TrackHeaderProps) {
  const t = useTranslations("studio.video.timeline.track");
  const { store, commands } = useVideoEditor();
  const soloed = useViewState((s) => s.soloTrackIds.includes(track.id));
  const [editing, setEditing] = useState(false);
  const name = track.name || defaultName;
  const Glyph = TRACK_GLYPH[track.kind];
  const apply = (patch: TrackPatch) => store.getState().apply((doc) => updateTrack(doc, track.id, patch));

  const rename = (value: string) => {
    setEditing(false);
    const clean = value.trim().slice(0, 64);
    if (clean !== (track.name ?? "")) apply({ name: clean });
  };

  if (collapsed) {
    return (
      <div className="flex h-full items-center gap-1.5 px-2">
        <span className={cn(TRACK_TILE[track.kind], "flex h-3 w-3 shrink-0 items-center justify-center")} aria-hidden>
          <Glyph className="h-2 w-2" />
        </span>
        <span className="truncate text-2xs text-muted-foreground">{name}</span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className={cn("group/track flex items-center gap-1 pl-1.5 pr-1", track.hidden && "opacity-60")} style={{ height: laneHeight ?? "100%" }}>
        <span className={cn(TRACK_TILE[track.kind], "flex h-4 w-4 shrink-0 items-center justify-center")} aria-hidden>
          <Glyph className="h-2.5 w-2.5" />
        </span>
        {editing ? (
          <input
            autoFocus
            defaultValue={track.name ?? ""}
            placeholder={defaultName}
            aria-label={t("name")}
            onBlur={(event) => rename(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") rename(event.currentTarget.value);
              if (event.key === "Escape") setEditing(false);
            }}
            className="h-6 min-w-0 flex-1 rounded-[--radius] border border-control-edge bg-muted px-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        ) : (
          <button
            type="button"
            onDoubleClick={() => setEditing(true)}
            onKeyDown={(event) => {
              if (event.key === "F2") setEditing(true);
            }}
            title={t("renameHint")}
            className="flex min-w-0 flex-1 flex-col items-start rounded-[--radius] px-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="w-full truncate text-xs font-medium leading-tight text-foreground">{name}</span>
            {main ? <span className="text-2xs leading-tight text-muted-foreground">{t("main")}</span> : null}
          </button>
        )}
        {track.kind === "visual" ? (
          <ToolButton
            size="sm"
            label={track.hidden ? t("show", { name }) : t("hide", { name })}
            pressed={Boolean(track.hidden)}
            icon={track.hidden ? <EyeSlash className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            onClick={() => apply({ hidden: !track.hidden })}
          />
        ) : (
          <>
            <ToolButton
              size="sm"
              label={track.muted ? t("unmute", { name }) : t("mute", { name })}
              pressed={Boolean(track.muted)}
              icon={track.muted ? <SpeakerSlash className="h-3.5 w-3.5" /> : <SpeakerHigh className="h-3.5 w-3.5" />}
              onClick={() => apply({ muted: !track.muted })}
            />
            <ToolButton
              size="sm"
              label={soloed ? t("unsolo", { name }) : t("solo", { name })}
              pressed={soloed}
              icon={<span className="text-2xs font-bold leading-none">{t("soloMark")}</span>}
              onClick={() => commands.toggleSolo(track.id)}
            />
          </>
        )}
        <ToolButton
          size="sm"
          label={track.locked ? t("unlock", { name }) : t("lock", { name })}
          pressed={Boolean(track.locked)}
          icon={track.locked ? <LockKey className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
          onClick={() => apply({ locked: !track.locked })}
        />
        <ToolButton
          size="sm"
          label={t("remove", { name })}
          icon={<Trash className="h-3.5 w-3.5" />}
          disabled={Boolean(track.locked)}
          onClick={() => store.getState().apply((doc) => removeTrack(doc, track.id))}
          className="opacity-0 focus-visible:opacity-100 group-hover/track:opacity-100"
        />
      </div>
      {focusClip ? <FocusLabels clip={focusClip} /> : null}
    </div>
  );
}
