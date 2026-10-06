"use client";

import { useTranslations } from "next-intl";

import type { Clip } from "@/lib/studio/document";
import { localTime, momentState } from "@/lib/studio/keyframe-edit";
import { selectionKeyTimes } from "@/lib/studio/selection-edit";
import { formatTimecode } from "@/lib/studio/timeline-view";
import { cn } from "@/lib/utils";

import { useVideoEditor, useViewState } from "../editor-context";
import { KeyDiamond } from "../key-diamond";

export interface ClipKeyframesProps {
  clip: Clip;
  widthPx: number;
  heightPx: number;
}

export function ClipKeyframes({ clip, widthPx }: ClipKeyframesProps) {
  const t = useTranslations("studio.video.keyframes");
  const { playback } = useVideoEditor();
  const times = selectionKeyTimes([clip]).filter((at) => at >= clip.startMs && at <= clip.startMs + clip.durationMs);
  const onKey = useViewState((s) => momentState(clip, localTime(clip, s.playheadMs)) === "key" ? Math.round(s.playheadMs) : null);
  if (times.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[4] h-3">
      {times.map((at) => {
        const current = onKey !== null && Math.abs(at - onKey) <= 17;
        return (
          <button
            key={at}
            type="button"
            aria-label={t("jump", { time: formatTimecode(at) })}
            title={t("jump", { time: formatTimecode(at) })}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              playback.seek(at);
            }}
            className={cn(
              "pointer-events-auto absolute bottom-0.5 flex h-2.5 w-2.5 -translate-x-1/2 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              current ? "text-primary" : "text-foreground",
            )}
            style={{ left: Math.min(Math.max(5, ((at - clip.startMs) / clip.durationMs) * widthPx), widthPx - 5) }}
          >
            <KeyDiamond filled />
          </button>
        );
      })}
    </div>
  );
}
