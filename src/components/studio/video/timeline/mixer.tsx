"use client";

import { useTranslations } from "next-intl";

import type { Track } from "@/lib/studio/document";
import { TRACK_GAIN_RANGE } from "@/lib/studio/ducking";
import { formatLevel } from "@/lib/studio/live-meter";
import { laneOrder } from "@/lib/studio/timeline-view";

import { useEditorState, useVideoEditor } from "../editor-context";
import { PanField } from "../inspector/pan-field";
import { useTrackNames } from "../use-track-names";
import { MasterMeter, TrackMeter } from "./level-meter";
import { MuteButton, SoloButton } from "./track-sound-buttons";

const FADER_STEP_DB = 0.5;

function GainFader({ track, name }: { track: Track; name: string }) {
  const t = useTranslations("studio.video.mixer");
  const { commands, store } = useVideoEditor();
  const gainDb = track.gainDb ?? 0;
  return (
    <input
      type="range"
      min={TRACK_GAIN_RANGE[0]}
      max={TRACK_GAIN_RANGE[1]}
      step={FADER_STEP_DB}
      value={gainDb}
      aria-label={t("fader", { name })}
      aria-valuetext={`${formatLevel(gainDb)} dB`}
      title={t("faderHint")}
      disabled={Boolean(track.locked)}
      onPointerDown={() => store.getState().beginTransaction()}
      onPointerUp={() => store.getState().commitTransaction()}
      onBlur={() => store.getState().commitTransaction()}
      onKeyDown={(event) => event.stopPropagation()}
      onChange={(event) => commands.setTrackGain(track.id, Number(event.target.value))}
      onDoubleClick={() => commands.setTrackGain(track.id, 0)}
      className="h-full w-4 cursor-pointer accent-primary [direction:rtl] [writing-mode:vertical-lr] disabled:cursor-not-allowed"
    />
  );
}

function MixerStrip({ track, name }: { track: Track; name: string }) {
  const t = useTranslations("studio.video.mixer");
  const { commands, store } = useVideoEditor();
  return (
    <div role="group" aria-label={t("strip", { name })} className="flex w-32 shrink-0 flex-col gap-1.5 border-r border-border px-2 py-2">
      <span className="truncate text-xs font-medium text-foreground" title={name}>
        {name}
      </span>
      <div className="flex h-24 items-stretch justify-center gap-2">
        <GainFader track={track} name={name} />
        <TrackMeter trackId={track.id} name={name} />
      </div>
      <span className="text-center font-mono text-2xs tabular-nums text-muted-foreground">{`${formatLevel(track.gainDb ?? 0)} dB`}</span>
      <PanField
        label={t("pan", { name })}
        value={track.pan ?? 0}
        disabled={Boolean(track.locked)}
        onChange={(pan) => commands.setTrackPan(track.id, pan)}
        onStart={() => store.getState().beginTransaction()}
        onCommit={() => store.getState().commitTransaction()}
      />
      <div className="flex justify-center gap-1">
        <MuteButton track={track} name={name} />
        <SoloButton trackId={track.id} name={name} />
      </div>
    </div>
  );
}

export function Mixer() {
  const t = useTranslations("studio.video.mixer");
  const tracks = useEditorState((s) => s.document.tracks);
  const names = useTrackNames(tracks);
  const audio = laneOrder(tracks).filter((track) => track.kind === "audio");
  return (
    <div role="region" aria-label={t("label")} className="flex h-48 shrink-0 overflow-x-auto border-t border-border-strong bg-card">
      {audio.length === 0 ? <p className="self-center px-3 text-xs text-muted-foreground">{t("empty")}</p> : null}
      {audio.map((track) => (
        <MixerStrip key={track.id} track={track} name={names.get(track.id) ?? ""} />
      ))}
      <div className="flex shrink-0 flex-col justify-center gap-1.5 px-3 py-2">
        <span className="text-xs font-medium text-foreground">{t("master")}</span>
        <MasterMeter />
      </div>
    </div>
  );
}
