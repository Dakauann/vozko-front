"use client";

import { anchorOf } from "@/lib/studio/clip-placement";
import { clipLookup } from "@/lib/studio/parenting";
import { boxStyle, visualPlan } from "@/lib/studio/playback";

import { useEditorState, useViewState } from "../editor-context";

export function NullOutlines() {
  const document = useEditorState((s) => s.document);
  const playheadMs = useViewState((s) => s.playheadMs);
  const nulls = visualPlan(document, playheadMs, 0).filter((item) => item.active && item.type === "null");
  const clips = clipLookup(document);
  return (
    <>
      {nulls.map((item) => {
        const anchor = anchorOf(clips.get(item.clipId) ?? {});
        return (
        <div key={item.clipId} aria-hidden data-null-outline={item.clipId} className="pointer-events-none absolute" style={boxStyle({ transform: item.transform, opacity: 1, trackIndex: 860 })}>
          <span className="absolute inset-0 border border-dashed border-primary/80" />
          <span className="absolute h-px w-3 -translate-x-1/2 -translate-y-1/2 bg-primary/80" style={{ left: `${anchor.x * 100}%`, top: `${anchor.y * 100}%` }} />
          <span className="absolute h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-primary/80" style={{ left: `${anchor.x * 100}%`, top: `${anchor.y * 100}%` }} />
        </div>
        );
      })}
    </>
  );
}
