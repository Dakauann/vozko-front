"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslations } from "next-intl";

import type { Marker, Track } from "@/lib/studio/document";
import { laneOrder, msToPx, overviewMs, overviewToMs, overviewWindow, pxToMs, scrollToCenter } from "@/lib/studio/timeline-view";
import { cn } from "@/lib/utils";

import { useViewState } from "../editor-context";
import { clipKind, kindFill } from "../clip-tones";
import type { MarkRange } from "../view-store";
import { OVERVIEW_HEIGHT } from "./timeline-geometry";

interface OverviewProps {
  tracks: readonly Track[];
  durationMs: number;
  pxPerSecond: number;
  scrollLeft: number;
  viewportPx: number;
  markers: readonly Marker[];
  range: MarkRange;
  onScroll: (scrollLeft: number) => void;
  onSeek: (ms: number) => void;
  onZoomRange: (fromMs: number, toMs: number) => void;
}

type Grip = { kind: "pan"; startLeft: number } | { kind: "from" | "to"; fromMs: number; toMs: number } | { kind: "scrub" };

export function TimelineOverview({ tracks, durationMs, pxPerSecond, scrollLeft, viewportPx, markers, range, onScroll, onSeek, onZoomRange }: OverviewProps) {
  const t = useTranslations("studio.video.timeline.overview");
  const host = useRef<HTMLDivElement>(null);
  const grip = useRef<{ grip: Grip; x: number; pointerId: number } | null>(null);
  const [width, setWidth] = useState(0);
  const lanes = laneOrder(tracks);
  const totalMs = overviewMs(durationMs, pxToMs(viewportPx, pxPerSecond));
  const scale = width / totalMs;
  const view = overviewWindow(scrollLeft, viewportPx, pxPerSecond, width, totalMs);
  const rowHeight = (OVERVIEW_HEIGHT - 6) / Math.max(1, lanes.length);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const measure = () => setWidth(element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const localX = (clientX: number) => clientX - (host.current?.getBoundingClientRect().left ?? 0);

  const start = (kind: "pan" | "from" | "to" | "scrub", event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const fromMs = overviewToMs(view.left, width, totalMs);
    const toMs = overviewToMs(view.left + view.width, width, totalMs);
    const next: Grip = kind === "pan" ? { kind, startLeft: view.left } : kind === "scrub" ? { kind } : { kind, fromMs, toMs };
    grip.current = { grip: next, x: event.clientX, pointerId: event.pointerId };
    if (kind === "scrub") scrub(event.clientX);
  };

  const scrub = (clientX: number) => {
    const ms = overviewToMs(localX(clientX), width, totalMs);
    onSeek(ms);
    onScroll(scrollToCenter(ms, viewportPx, pxPerSecond));
  };

  const move = (event: ReactPointerEvent<HTMLElement>) => {
    const current = grip.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (current.grip.kind === "scrub") {
      scrub(event.clientX);
      return;
    }
    const dx = event.clientX - current.x;
    if (current.grip.kind === "pan") {
      onScroll(Math.max(0, msToPx(overviewToMs(current.grip.startLeft + dx, width, totalMs), pxPerSecond)));
      return;
    }
    const at = overviewToMs(localX(event.clientX), width, totalMs);
    if (current.grip.kind === "from") onZoomRange(Math.min(at, current.grip.toMs - 200), current.grip.toMs);
    else onZoomRange(current.grip.fromMs, Math.max(at, current.grip.fromMs + 200));
  };

  const end = (event: ReactPointerEvent<HTMLElement>) => {
    if (grip.current?.pointerId === event.pointerId) grip.current = null;
  };

  const handlers = { onPointerMove: move, onPointerUp: end, onPointerCancel: end };
  const rangeFrom = range.inMs ?? null;
  const rangeTo = range.outMs ?? null;

  return (
    <div
      ref={host}
      role="group"
      aria-label={t("label")}
      className="relative shrink-0 cursor-pointer select-none overflow-hidden border-b border-border-strong bg-background"
      style={{ height: OVERVIEW_HEIGHT }}
      onPointerDown={(event) => start("scrub", event)}
      {...handlers}
    >
      {width > 0
        ? lanes.map((track, row) =>
            track.clips.map((clip) => (
              <span
                key={clip.id}
                aria-hidden
                className={cn("absolute rounded-[1px]", kindFill(clipKind(clip)), clip.disabled && "opacity-40")}
                style={{ left: clip.startMs * scale, width: Math.max(1, clip.durationMs * scale - 1), top: 3 + row * rowHeight, height: Math.max(1, rowHeight - 1) }}
              />
            )),
          )
        : null}
      {rangeFrom !== null && rangeTo !== null && rangeTo > rangeFrom ? (
        <span aria-hidden className="absolute inset-y-0 border-x border-foreground bg-foreground/15" style={{ left: rangeFrom * scale, width: (rangeTo - rangeFrom) * scale }} />
      ) : null}
      {markers.map((marker) => (
        <span key={marker.id} aria-hidden className="absolute top-0 h-2 w-px bg-[hsl(var(--plate-3))]" style={{ left: marker.atMs * scale }} />
      ))}
      <div
        role="slider"
        aria-label={t("window")}
        aria-valuemin={0}
        aria-valuemax={Math.round(totalMs)}
        aria-valuenow={Math.round(overviewToMs(view.left, width, totalMs))}
        tabIndex={-1}
        onPointerDown={(event) => start("pan", event)}
        {...handlers}
        className="absolute inset-y-0.5 cursor-grab rounded-[2px] border border-muted-foreground bg-foreground/10 active:cursor-grabbing"
        style={{ left: view.left, width: view.width }}
      >
        <span aria-hidden onPointerDown={(event) => start("from", event)} {...handlers} className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize" />
        <span aria-hidden onPointerDown={(event) => start("to", event)} {...handlers} className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize" />
      </div>
      <OverviewPlayhead scale={scale} />
    </div>
  );
}

function OverviewPlayhead({ scale }: { scale: number }) {
  const playheadMs = useViewState((s) => s.playheadMs);
  return <span aria-hidden className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-primary" style={{ left: playheadMs * scale }} />;
}
