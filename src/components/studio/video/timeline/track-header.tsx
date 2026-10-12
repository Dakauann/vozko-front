"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Eye, EyeSlash, Lock, LockKey } from "@/components/icons";
import type { Clip, Track } from "@/lib/studio/document";
import { KEY_LANE_HEIGHT } from "@/lib/studio/focus-lanes";
import { keyState, laneProperties, localTime, toggleKeyAt } from "@/lib/studio/keyframe-edit";
import { isClipPickable, updateTrack, type TrackPatch } from "@/lib/studio/timeline";
import { cn } from "@/lib/utils";

import { TRACK_GLYPH, TRACK_TILE } from "../clip-tones";
import { useVideoEditor, useViewState } from "../editor-context";
import { PropertyReadout } from "../property-readout";
import { KeyToggle } from "../inspector/key-toggle";
import { ToolButton } from "../tool-button";
import { TrackMeter } from "./level-meter";
import { TrackContextMenu, TrackMenuButton, useTrackActions, useTrackLabels } from "./track-menu";
import { labelHex } from "../label-colors";
import { TrackSound, trackSoundActive } from "./track-sound";
import { MuteButton, SoloButton, useSoloed } from "./track-sound-buttons";

interface TrackHeaderProps {
  track: Track;
  defaultName: string;
  main: boolean;
  collapsed?: boolean;
  laneHeight?: number;
  focusClip?: Clip | null;
}

function TrackControl({ pinned, always = false, children }: { pinned: boolean; always?: boolean; children: ReactNode }) {
  return (
    <span
      data-track-control
      data-pinned={pinned}
      data-always={always || undefined}
      className={cn(
        "flex shrink-0 justify-center overflow-hidden transition-[width] duration-150 motion-reduce:transition-none",
        pinned || always ? "w-6" : "w-0 group-hover/track:w-6 group-focus-within/track:w-6 has-[[data-state=open]]:w-6 [@media(hover:none)]:w-6",
      )}
    >
      {children}
    </span>
  );
}

function FocusLabels({ clip, locked }: { clip: Clip; locked: boolean }) {
  const t = useTranslations("studio.video.keyframes");
  const { commands } = useVideoEditor();
  const local = useViewState((s) => Math.min(Math.max(0, s.playheadMs - clip.startMs), clip.durationMs));
  const inside = useViewState((s) => localTime(clip, s.playheadMs));
  const keyProperty = useViewState((s) => s.keyProperty);
  return (
    <div role="group" aria-label={t("laneHeaders")} className="border-t border-border-strong">
      {laneProperties(clip).map((property) => (
        <div
          key={property}
          className={cn("flex items-center gap-1 border-b border-background pl-2 pr-1 text-2xs", keyProperty === property ? "bg-muted text-foreground" : "text-muted-foreground")}
          style={{ height: KEY_LANE_HEIGHT }}
        >
          <span className="min-w-0 flex-1 truncate">{t(`properties.${property}`)}</span>
          <PropertyReadout clip={clip} property={property} localMs={local} />
          <KeyToggle
            label={t("keyHere", { name: t(`properties.${property}`) })}
            state={keyState(clip, property, inside)}
            disabled={locked}
            onClick={() => commands.patchKeyframes(clip.id, (current, at, aspect) => toggleKeyAt(current, property, at, aspect))}
          />
        </div>
      ))}
    </div>
  );
}

export function TrackHeader({ track, defaultName, main, collapsed = false, laneHeight, focusClip }: TrackHeaderProps) {
  const t = useTranslations("studio.video.timeline.track");
  const { store } = useVideoEditor();
  const soloed = useSoloed(track.id);
  const [editing, setEditing] = useState(false);
  const name = track.name || defaultName;
  const actions = useTrackActions(track, name);
  const labels = useTrackLabels(track);
  const label = labelHex(track.labelColor);
  const Glyph = TRACK_GLYPH[track.kind];
  const apply = (patch: TrackPatch) => {
    const { document, selection } = store.getState();
    const next = updateTrack(document, track.id, patch);
    store.getState().apply(() => next, selection.filter((id) => isClipPickable(next, id)));
  };

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
      <TrackContextMenu actions={actions} labels={labels}>
        <div className={cn("group/track relative flex items-center gap-1.5 pl-2 pr-1", track.hidden && "opacity-60")} style={{ height: laneHeight ?? "100%" }}>
          {label ? <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: label }} /> : null}
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
              title={t("renameHint", { name })}
              className="flex min-w-0 flex-1 flex-col items-start rounded-[--radius] px-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="w-full truncate text-xs font-medium leading-tight text-foreground">{name}</span>
              {main ? <span className="text-2xs leading-tight text-muted-foreground">{t("main")}</span> : null}
            </button>
          )}
          {track.kind === "audio" ? <TrackMeter trackId={track.id} name={name} /> : null}
          <div className="flex shrink-0 items-center">
            {track.kind === "visual" ? (
              <TrackControl pinned={Boolean(track.hidden)} always>
                <ToolButton
                  size="sm"
                  label={track.hidden ? t("show", { name }) : t("hide", { name })}
                  pressed={Boolean(track.hidden)}
                  icon={track.hidden ? <EyeSlash className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  onClick={() => apply({ hidden: !track.hidden })}
                />
              </TrackControl>
            ) : (
              <>
                <TrackControl pinned={Boolean(track.muted)} always>
                  <MuteButton track={track} name={name} />
                </TrackControl>
                <TrackControl pinned={soloed} always>
                  <SoloButton trackId={track.id} name={name} />
                </TrackControl>
                <TrackControl pinned={trackSoundActive(track)}>
                  <TrackSound track={track} name={name} />
                </TrackControl>
              </>
            )}
            <TrackControl pinned={Boolean(track.locked)} always>
              <ToolButton
                size="sm"
                label={track.locked ? t("unlock", { name }) : t("lock", { name })}
                pressed={Boolean(track.locked)}
                icon={track.locked ? <LockKey className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                onClick={() => apply({ locked: !track.locked })}
              />
            </TrackControl>
            <TrackControl pinned={false} always>
              <TrackMenuButton label={t("options", { name })} actions={actions} labels={labels} />
            </TrackControl>
          </div>
        </div>
      </TrackContextMenu>
      {focusClip ? <FocusLabels clip={focusClip} locked={Boolean(track.locked)} /> : null}
    </div>
  );
}
