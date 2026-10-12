"use client";

import { useMemo } from "react";

import { findClip } from "@/lib/studio/timeline";
import { trackerPath, trackerPointNow } from "@/lib/studio/track-edit";

import { useEditorState, useViewState } from "../editor-context";

export function TrackPaths({ clipId }: { clipId: string }) {
  const document = useEditorState((s) => s.document);
  const playheadMs = useViewState((s) => s.playheadMs);
  const clip = findClip(document, clipId)?.clip;
  const trackers = useMemo(() => clip?.trackers ?? [], [clip]);
  const paths = useMemo(() => trackers.map((tracker) => ({ id: tracker.id, points: trackerPath(document, clipId, tracker.id) })), [document, clipId, trackers]);
  if (!clip || trackers.length === 0 || playheadMs < clip.startMs || playheadMs >= clip.startMs + clip.durationMs) return null;
  return (
    <svg aria-hidden data-track-paths={clipId} className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 870 }} viewBox="0 0 1 1" preserveAspectRatio="none">
      {paths.map((path) => {
        const now = trackerPointNow(document, clipId, path.id, playheadMs);
        return (
          <g key={path.id} data-track-path={path.id}>
            <polyline points={path.points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="currentColor" className="text-primary" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeOpacity={0.8} />
            {now ? <circle cx={now.x} cy={now.y} r={0.006} className="fill-primary" stroke="white" strokeWidth={1} vectorEffect="non-scaling-stroke" /> : null}
          </g>
        );
      })}
    </svg>
  );
}
