"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { Waveform } from "@/components/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Track } from "@/lib/studio/document";
import { DUCKING_DEFAULTS, DUCKING_RANGES, TRACK_GAIN_RANGE } from "@/lib/studio/ducking";

import { useEditorState, useVideoEditor } from "../editor-context";
import { NumberField, ToggleField } from "../inspector/fields";
import { NormalizeFields } from "../inspector/normalize-fields";
import { PanField } from "../inspector/pan-field";
import { ToolButton } from "../tool-button";

const PERCENT = 100;

export function trackSoundActive(track: Pick<Track, "ducking" | "gainDb" | "pan">): boolean {
  return Boolean(track.ducking) || track.gainDb !== undefined || (track.pan ?? 0) !== 0;
}

export function TrackSound({ track, name }: { track: Track; name: string }) {
  const t = useTranslations("studio.video.trackSound");
  const ts = useTranslations("studio.video.sound");
  const { commands, store } = useVideoEditor();
  const tracks = useEditorState((s) => s.document.tracks);
  const others = tracks.filter((other) => other.kind === "audio" && other.id !== track.id);
  const rule = track.ducking;
  const locked = Boolean(track.locked);
  const settings = rule ?? { triggerTrackIds: [], ...DUCKING_DEFAULTS };

  const toggleTrigger = (id: string, on: boolean) => {
    const triggerTrackIds = on ? [...settings.triggerTrackIds, id] : settings.triggerTrackIds.filter((other) => other !== id);
    if (triggerTrackIds.length === 0) commands.setDucking(track.id, null);
    else commands.setDucking(track.id, { triggerTrackIds });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <ToolButton size="sm" label={t("open", { name })} pressed={trackSoundActive(track)} icon={<Waveform className="h-3.5 w-3.5" />} />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3">
        <fieldset disabled={locked} className="space-y-3">
          <NumberField label={t("level")} unit="dB" decimals={1} step={0.5} min={TRACK_GAIN_RANGE[0]} max={TRACK_GAIN_RANGE[1]} value={track.gainDb ?? 0} onCommit={(gainDb) => commands.setTrackGain(track.id, gainDb)} />
          <PanField
            label={ts("trackPan")}
            value={track.pan ?? 0}
            onChange={(pan) => commands.setTrackPan(track.id, pan)}
            onStart={() => store.getState().beginTransaction()}
            onCommit={() => store.getState().commitTransaction()}
          />
          <NormalizeFields target={{ trackId: track.id }} disabled={locked} />
          <div className="space-y-2 border-t border-border pt-2">
            <p className="text-xs font-medium text-foreground">{t("ducking")}</p>
            {others.length === 0 ? (
              <p className="text-2xs text-muted-foreground">{t("noOtherTracks")}</p>
            ) : (
              <div role="group" aria-label={t("triggers")} className="space-y-1">
                <p className="text-2xs text-muted-foreground">{t("triggers")}</p>
                {others.map((other, index) => (
                  <ToggleField key={other.id} label={other.name || t("audioTrack", { number: index + 1 })} checked={settings.triggerTrackIds.includes(other.id)} onChange={(on) => toggleTrigger(other.id, on)} />
                ))}
              </div>
            )}
            {rule ? (
              <>
                <NumberField label={t("reduce")} unit="dB" decimals={0} min={DUCKING_RANGES.reduceDb[0]} max={DUCKING_RANGES.reduceDb[1]} value={rule.reduceDb} onCommit={(reduceDb) => commands.setDucking(track.id, { reduceDb })} />
                <NumberField label={t("attack")} unit="ms" decimals={0} step={50} min={DUCKING_RANGES.attackMs[0]} max={DUCKING_RANGES.attackMs[1]} value={rule.attackMs} onCommit={(attackMs) => commands.setDucking(track.id, { attackMs: Math.round(attackMs) })} />
                <NumberField label={t("release")} unit="ms" decimals={0} step={50} min={DUCKING_RANGES.releaseMs[0]} max={DUCKING_RANGES.releaseMs[1]} value={rule.releaseMs} onCommit={(releaseMs) => commands.setDucking(track.id, { releaseMs: Math.round(releaseMs) })} />
                <NumberField label={t("hold")} unit="ms" decimals={0} step={50} min={DUCKING_RANGES.holdMs[0]} max={DUCKING_RANGES.holdMs[1]} value={rule.holdMs} onCommit={(holdMs) => commands.setDucking(track.id, { holdMs: Math.round(holdMs) })} />
                <NumberField label={t("sensitivity")} unit="%" decimals={0} step={5} min={0} max={PERCENT} value={Math.round(rule.sensitivity * PERCENT)} onCommit={(value) => commands.setDucking(track.id, { sensitivity: value / PERCENT })} />
                <p className="text-2xs text-muted-foreground">{t("hint")}</p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" title={t("bake")} onClick={() => void commands.bakeDucking(track.id)} />
                  <Button variant="ghost" size="sm" title={t("clear")} onClick={() => commands.setDucking(track.id, null)} />
                </div>
              </>
            ) : null}
          </div>
        </fieldset>
      </PopoverContent>
    </Popover>
  );
}
