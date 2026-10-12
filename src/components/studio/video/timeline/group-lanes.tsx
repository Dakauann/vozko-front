"use client";

import { clipSpeed } from "@/lib/studio/clip-time";
import type { GroupClip } from "@/lib/studio/group-scope";
import { cn } from "@/lib/utils";

import { clipKind, kindFill } from "../clip-tones";

interface GroupLanesProps {
  clip: GroupClip;
  widthPx: number;
  heightPx: number;
}

const LANE_GAP = 1;
const TOP_PAD = 20;

export function GroupLanes({ clip, widthPx, heightPx }: GroupLanesProps) {
  const lanes = [...clip.tracks].reverse().filter((track) => track.clips.length > 0);
  const room = Math.max(0, heightPx - TOP_PAD - 2);
  if (lanes.length === 0 || room < 2) return null;
  const laneHeight = Math.max(1, (room - LANE_GAP * (lanes.length - 1)) / lanes.length);
  const pxPerInnerMs = widthPx / (clip.durationMs * clipSpeed(clip));
  return (
    <div aria-hidden data-group-lanes className="pointer-events-none absolute inset-x-0 bottom-0.5" style={{ top: TOP_PAD }}>
      {lanes.map((track, row) =>
        track.clips.map((inner) => {
          const left = (inner.startMs - clip.trimInMs) * pxPerInnerMs;
          const width = inner.durationMs * pxPerInnerMs;
          if (left + width <= 0 || left >= widthPx) return null;
          return (
            <span
              key={inner.id}
              className={cn("absolute rounded-[2px] opacity-80", kindFill(clipKind(inner)), track.hidden && "opacity-30")}
              style={{ left: Math.max(0, left), width: Math.max(1, Math.min(widthPx, left + width) - Math.max(0, left)), top: row * (laneHeight + LANE_GAP), height: laneHeight }}
            />
          );
        }),
      )}
    </div>
  );
}
