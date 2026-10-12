"use client";

import { boxStyle, visualPlan } from "@/lib/studio/playback";

import { useEditorState, useViewState } from "../editor-context";

export function SelectionOutlines({ ids }: { ids: readonly string[] }) {
  const document = useEditorState((s) => s.document);
  const playheadMs = useViewState((s) => s.playheadMs);
  const chosen = new Set(ids);
  const items = visualPlan(document, playheadMs, 0).filter((item) => item.active && item.type !== "effect" && chosen.has(item.clipId));
  return (
    <>
      {items.map((item) => (
        <div key={item.clipId} aria-hidden data-selection-outline={item.clipId} className="pointer-events-none absolute outline outline-2 outline-primary/70" style={boxStyle({ transform: item.transform, opacity: 1, trackIndex: 899 })} />
      ))}
    </>
  );
}
