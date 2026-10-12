"use client";

import type { CanvasSize } from "@/lib/studio/document";
import type { FrameSnap } from "@/lib/studio/frame-layout";
import { SNAP_GUIDE_COLOR, type Gap } from "@/lib/studio/snapping";

function percent(value: number, side: number): string {
  return `${(value / side) * 100}%`;
}

function GapMark({ gap, size }: { gap: Gap; size: CanvasSize }) {
  const horizontal = gap.axis === "horizontal";
  const line = horizontal
    ? { left: percent(gap.from, size.width), width: percent(gap.to - gap.from, size.width), top: percent(gap.at, size.height), height: 1 }
    : { top: percent(gap.from, size.height), height: percent(gap.to - gap.from, size.height), left: percent(gap.at, size.width), width: 1 };
  const label = horizontal
    ? { left: percent((gap.from + gap.to) / 2, size.width), top: percent(gap.at, size.height) }
    : { left: percent(gap.at, size.width), top: percent((gap.from + gap.to) / 2, size.height) };
  return (
    <>
      <span data-frame-gap={gap.axis} className={horizontal ? "absolute -translate-y-1/2" : "absolute -translate-x-1/2"} style={{ ...line, backgroundColor: SNAP_GUIDE_COLOR }} />
      <span
        className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-[4px] px-1 py-px text-2xs font-semibold tabular-nums leading-4 text-white shadow-sm"
        style={{ ...label, backgroundColor: SNAP_GUIDE_COLOR }}
      >
        {Math.round(gap.to - gap.from)}
      </span>
    </>
  );
}

export function FrameGuides({ snap, size }: { snap: FrameSnap; size: CanvasSize }) {
  return (
    <div aria-hidden data-frame-guides className="pointer-events-none absolute inset-0" style={{ zIndex: 905 }}>
      {snap.guides.vertical.map((x) => (
        <span key={`v${x}`} data-frame-guide="vertical" className="absolute inset-y-0 w-px -translate-x-1/2" style={{ left: percent(x, size.width), backgroundColor: SNAP_GUIDE_COLOR }} />
      ))}
      {snap.guides.horizontal.map((y) => (
        <span key={`h${y}`} data-frame-guide="horizontal" className="absolute inset-x-0 h-px -translate-y-1/2" style={{ top: percent(y, size.height), backgroundColor: SNAP_GUIDE_COLOR }} />
      ))}
      {snap.gaps.map((gap) => (
        <GapMark key={`${gap.axis}${gap.from}${gap.at}`} gap={gap} size={size} />
      ))}
    </div>
  );
}
