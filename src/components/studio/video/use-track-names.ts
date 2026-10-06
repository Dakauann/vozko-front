"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import type { Track } from "@/lib/studio/document";
import { laneOrder } from "@/lib/studio/timeline-view";

export function useDefaultTrackNames(tracks: readonly Track[]): Map<string, string> {
  const t = useTranslations("studio.video.timeline.track");
  return useMemo(() => {
    const names = new Map<string, string>();
    const lanes = laneOrder(tracks);
    let visual = lanes.filter((track) => track.kind === "visual").length;
    let audio = 0;
    for (const track of lanes) names.set(track.id, track.kind === "visual" ? t("visualName", { index: visual-- }) : t("audioName", { index: ++audio }));
    return names;
  }, [tracks, t]);
}

export function useTrackNames(tracks: readonly Track[]): Map<string, string> {
  const defaults = useDefaultTrackNames(tracks);
  return useMemo(() => new Map(tracks.map((track) => [track.id, track.name || defaults.get(track.id) || ""])), [tracks, defaults]);
}
