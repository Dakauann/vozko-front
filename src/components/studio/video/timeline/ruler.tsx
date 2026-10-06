"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslations } from "next-intl";

import type { Marker } from "@/lib/studio/document";
import { formatSmpte, formatTimecode, msToPx, rulerTicks } from "@/lib/studio/timeline-view";

import { useViewState } from "../editor-context";

import type { MarkRange } from "../view-store";
import { MarkerFlag } from "./marker-flag";

const LABEL_SPACING_PX = 104;

interface RulerProps {
  width: number;
  pxPerSecond: number;
  scrollLeft: number;
  viewportWidth: number;
  durationMs: number;
  markers: readonly Marker[];
  range: MarkRange;
  onSeek: (ms: number) => void;
  onScrubStart: () => void;
  timeAt: (clientX: number) => number;
}

export function Ruler({ width, pxPerSecond, scrollLeft, viewportWidth, durationMs, markers, range, onSeek, onScrubStart, timeAt }: RulerProps) {
  const scrubbing = useRef<number | null>(null);
  const fromMs = Math.max(0, (scrollLeft / pxPerSecond) * 1000 - 2000);
  const toMs = ((scrollLeft + viewportWidth) / pxPerSecond) * 1000 + 2000;
  const ticks = rulerTicks(pxPerSecond, fromMs, toMs, LABEL_SPACING_PX);

  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    scrubbing.current = event.pointerId;
    onScrubStart();
    onSeek(timeAt(event.clientX));
  };

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (scrubbing.current !== event.pointerId) return;
    onSeek(timeAt(event.clientX));
  };

  const up = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (scrubbing.current === event.pointerId) scrubbing.current = null;
  };


  return (
    <div className="relative shrink-0 cursor-col-resize select-none bg-card" style={{ width }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      {ticks.map((tick) => (
        <span key={tick.ms} aria-hidden className="pointer-events-none absolute bottom-0" style={{ left: msToPx(tick.ms, pxPerSecond) }}>
          <span className={tick.major ? "block h-2.5 w-px bg-muted-foreground" : "block h-1.5 w-px bg-border-strong"} />
          {tick.major ? <span className="absolute bottom-2.5 left-1 whitespace-nowrap font-mono text-2xs tabular-nums text-muted-foreground">{formatSmpte(tick.ms)}</span> : null}
        </span>
      ))}
      {range.inMs !== null && range.outMs !== null && range.outMs > range.inMs ? (
        <span aria-hidden className="pointer-events-none absolute inset-y-0 border-x border-foreground bg-foreground/15" style={{ left: msToPx(range.inMs, pxPerSecond), width: msToPx(range.outMs - range.inMs, pxPerSecond) }} />
      ) : null}
      {range.inMs !== null ? <span aria-hidden className="pointer-events-none absolute bottom-0 h-full w-0.5 bg-foreground" style={{ left: msToPx(range.inMs, pxPerSecond) }} /> : null}
      {range.outMs !== null ? <span aria-hidden className="pointer-events-none absolute bottom-0 h-full w-0.5 bg-foreground" style={{ left: msToPx(range.outMs, pxPerSecond) }} /> : null}
      {markers.map((marker) => (
        <MarkerFlag key={marker.id} marker={marker} pxPerSecond={pxPerSecond} />
      ))}
      <RulerPlayhead durationMs={durationMs} pxPerSecond={pxPerSecond} />
    </div>
  );
}

function RulerPlayhead({ durationMs, pxPerSecond }: { durationMs: number; pxPerSecond: number }) {
  const t = useTranslations("studio.video.timeline");
  const playheadMs = useViewState((s) => s.playheadMs);
  const playheadX = msToPx(playheadMs, pxPerSecond);
  return (
      <div
        role="slider"
        tabIndex={0}
        aria-label={t("playhead")}
        aria-valuemin={0}
        aria-valuemax={durationMs}
        aria-valuenow={Math.round(playheadMs)}
        aria-valuetext={formatTimecode(playheadMs)}
        aria-orientation="horizontal"
        className="absolute bottom-0 top-0 z-[31] w-3 -translate-x-1/2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ left: playheadX }}
      >
        <span aria-hidden className="absolute bottom-0 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-[2px] border-2 border-primary-edge bg-primary" />
        <span aria-hidden className="absolute bottom-2 left-1/2 top-0 w-0.5 -translate-x-1/2 bg-primary" />
      </div>
  );
}
