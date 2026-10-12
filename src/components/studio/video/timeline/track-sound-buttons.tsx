"use client";

import { useTranslations } from "next-intl";

import { SpeakerHigh, SpeakerSlash } from "@/components/icons";
import type { Track } from "@/lib/studio/document";

import { useVideoEditor, useViewState } from "../editor-context";
import { ToolButton } from "../tool-button";

export function useSoloed(trackId: string): boolean {
  return useViewState((s) => s.soloTrackIds.includes(trackId));
}

export function MuteButton({ track, name }: { track: Pick<Track, "id" | "muted">; name: string }) {
  const t = useTranslations("studio.video.timeline.track");
  const { commands } = useVideoEditor();
  return (
    <ToolButton
      size="sm"
      label={track.muted ? t("unmute", { name }) : t("mute", { name })}
      pressed={Boolean(track.muted)}
      icon={track.muted ? <SpeakerSlash className="h-3.5 w-3.5" /> : <SpeakerHigh className="h-3.5 w-3.5" />}
      onClick={() => commands.setTrackMuted(track.id, !track.muted)}
    />
  );
}

export function SoloButton({ trackId, name }: { trackId: string; name: string }) {
  const t = useTranslations("studio.video.timeline.track");
  const { commands } = useVideoEditor();
  const soloed = useSoloed(trackId);
  return (
    <ToolButton
      size="sm"
      label={soloed ? t("unsolo", { name }) : t("solo", { name })}
      pressed={soloed}
      icon={<span className="text-2xs font-bold leading-none">{t("soloMark")}</span>}
      onClick={() => commands.toggleSolo(trackId)}
    />
  );
}
