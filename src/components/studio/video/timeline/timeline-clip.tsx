"use client";

import { memo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslations } from "next-intl";

import { LinkSimple } from "@/components/icons";
import { STUDIO_LIMITS, type Clip, type Track } from "@/lib/studio/document";
import { mainTrackId, placeGroup, placementMode, rippleTrim, trimLinked } from "@/lib/studio/edits";
import { clipEnd, findClip, hasSourceTime, snapCandidates, snapMs, snapRangeStart, trimClipEnd, trimClipStart, updateClip } from "@/lib/studio/timeline";
import { envelopePoints, formatTimecode, levelFromY, msToPx, pxToMs, snapThresholdMs } from "@/lib/studio/timeline-view";
import { rollEdit, slideClip, slipClip } from "@/lib/studio/tools";
import { cn } from "@/lib/utils";

import { CLIP_KIND_TONES, clipKind, kindFill, kindPlateVar, kindTile } from "../clip-tones";
import { useVideoEditor, useViewState } from "../editor-context";
import { useSourceDuration } from "../use-asset";
import type { DragMode } from "../view-store";
import { ClipKeyframes } from "./clip-keyframes";
import { BLADE_CURSOR } from "./cursors";
import { ImageFilmstrip, VideoFilmstrip } from "./filmstrip";
import { CLIP_INSET, DRAG_SLOP_PX, useOnScreen, useTimelineGeometry, useVisibleSpan } from "./timeline-geometry";
import { Waveform } from "./waveform";

type Gesture = "move" | "start" | "end" | "fadeIn" | "fadeOut" | "volume" | "slip" | "slide";

interface DragState {
  gesture: Gesture;
  pointerId: number;
  x: number;
  y: number;
  top: number;
  base: Clip;
  ids: string[];
  blockStart: number;
  blockSpan: number;
  started: boolean;
}

const OVERSCAN_PX = 200;
const HEADER_PX = 16;
const WELL_INSET = 4;

function useClipLabel(clip: Clip): string {
  const t = useTranslations("studio.video.timeline.clipTypes");
  if (clip.type === "overlay" && clip.layer) {
    if (clip.layer.type === "text") return clip.layer.text ?? t("text");
    if (clip.layer.type === "shape") return t(`shapes.${clip.layer.shape ?? "rect"}`);
    return t(clip.layer.type);
  }
  return t(clip.type);
}

interface TimelineClipProps {
  clip: Clip;
  track: Track;
  selected: boolean;
}

export const TimelineClip = memo(function TimelineClip({ clip, track, selected }: TimelineClipProps) {
  const t = useTranslations("studio.video.timeline");
  const { store, view, commands, assets } = useVideoEditor();
  const geometry = useTimelineGeometry();
  const tool = useViewState((s) => s.tool);
  const sourceDurationMs = useSourceDuration(hasSourceTime(clip.type) ? clip.assetId : undefined);
  const drag = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState(false);
  const label = useClipLabel(clip);
  const left = msToPx(clip.startMs, geometry.pxPerSecond);
  const width = Math.max(2, msToPx(clip.durationMs, geometry.pxPerSecond));
  const height = geometry.heightOf(track.kind) - CLIP_INSET * 2;
  const locked = Boolean(track.locked);
  const kind = clipKind(clip);
  const Glyph = CLIP_KIND_TONES[kind].glyph;
  const audio = clip.type === "audio";
  const level = audio ? clip.volume / STUDIO_LIMITS.maxVolume : clip.transform.opacity;
  const wellWidth = Math.max(1, width - WELL_INSET * 2);
  const wellHeight = Math.max(0, height - HEADER_PX - WELL_INSET);
  const span = useVisibleSpan(geometry.scroll, left + WELL_INSET, wellWidth, OVERSCAN_PX);
  const onScreen = useOnScreen(geometry.scroll, left, width, OVERSCAN_PX);
  const envelope = envelopePoints(clip, wellWidth, wellHeight, level)
    .map(([x, y]) => `${x},${y}`)
    .join(" ");

  const sourceOf = (id: string) => {
    const assetId = findClip(store.getState().document, id)?.clip.assetId;
    return assetId ? assets.store.getState().assets[assetId]?.durationMs : undefined;
  };

  const begin = (requested: Gesture, event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || locked) return;
    event.stopPropagation();
    const state = store.getState();
    const current = view.getState();
    if (current.tool === "blade") {
      commands.blade(track.id, bladeTime(event.clientX), event.shiftKey);
      return;
    }
    if (requested === "move" && event.altKey) commands.selectForward(clip.id, event.shiftKey);
    else if (requested === "move" && event.shiftKey && !state.selection.includes(clip.id)) {
      commands.selectClip(clip.id, true);
      return;
    } else if (!state.selection.includes(clip.id)) commands.selectClip(clip.id, false);
    if (current.selectedGap) view.setState({ selectedGap: null });
    const gesture: Gesture = requested === "move" && (current.tool === "slip" || current.tool === "slide") ? current.tool : requested;
    const ids = store.getState().selection;
    const doc = store.getState().document;
    const group = ids.map((id) => findClip(doc, id)?.clip).filter((c): c is Clip => Boolean(c));
    const blockStart = Math.min(...group.map((c) => c.startMs), clip.startMs);
    const blockEnd = Math.max(...group.map((c) => clipEnd(c)), clipEnd(clip));
    const rect = event.currentTarget.closest("[data-clip-id]")?.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      gesture,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      top: (rect?.top ?? 0) + HEADER_PX,
      base: clip,
      ids,
      blockStart,
      blockSpan: blockEnd - blockStart,
      started: false,
    };
    setDragging(true);
  };

  const bladeTime = (clientX: number) => {
    const raw = geometry.timeAt(clientX);
    const { snapping, playheadMs } = view.getState();
    return snapping ? snapMs(raw, snapCandidates(store.getState().document, { playheadMs }), snapThresholdMs(geometry.pxPerSecond)).ms : raw;
  };

  const restart = (current: DragState) => {
    const state = store.getState();
    if (current.started) state.cancelTransaction();
    current.started = true;
    state.beginTransaction();
  };

  const feedback = (event: ReactPointerEvent<HTMLElement>, deltaMs: number, mode: DragMode | null, guide: number | null) =>
    view.setState({ feedback: { deltaMs, x: event.clientX, y: event.clientY }, dragMode: mode, snapGuideMs: guide });

  const move = (event: ReactPointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.x;
    if (!current.started && Math.abs(dx) < DRAG_SLOP_PX && Math.abs(event.clientY - current.y) < DRAG_SLOP_PX) return;
    geometry.autoScroll(event.clientX);
    const deltaMs = Math.round(pxToMs(dx, geometry.pxPerSecond));
    const base = current.base;
    restart(current);
    if (current.gesture === "fadeIn" || current.gesture === "fadeOut") {
      const patch = current.gesture === "fadeIn" ? { fadeInMs: base.fadeInMs + deltaMs } : { fadeOutMs: base.fadeOutMs - deltaMs };
      store.getState().apply((doc) => updateClip(doc, clip.id, patch));
      feedback(event, deltaMs, null, null);
      return;
    }
    if (current.gesture === "volume") {
      const volume = levelFromY(event.clientY - current.top, wellHeight, STUDIO_LIMITS.maxVolume);
      store.getState().apply((doc) => updateClip(doc, clip.id, { volume }));
      return;
    }
    if (current.gesture === "slip") {
      store.getState().apply((doc) => slipClip(doc, clip.id, -deltaMs, sourceDurationMs));
      feedback(event, -deltaMs, "slip", null);
      return;
    }
    if (current.gesture === "slide") {
      commands.apply((doc) => slideClip(doc, clip.id, deltaMs, sourceOf));
      feedback(event, deltaMs, "slide", null);
      return;
    }
    const { snapping, playheadMs, magnetic, linkedSelection, tool: active } = view.getState();
    const snapOn = snapping && !event.altKey;
    const threshold = snapThresholdMs(geometry.pxPerSecond);
    const doc = store.getState().document;
    const candidates = snapOn ? snapCandidates(doc, { playheadMs, exclude: current.ids }) : [];
    if (current.gesture === "move") {
      const proposed = current.blockStart + deltaMs;
      const snapped = snapOn ? snapRangeStart(proposed, current.blockSpan, candidates, threshold) : { ms: proposed, snapped: null };
      const applied = Math.max(snapped.ms, 0) - current.blockStart;
      const hovered = geometry.laneAt(event.clientY);
      const mode = placementMode({ insert: event.ctrlKey || event.metaKey, overwrite: event.shiftKey, magnetic, onMainTrack: (hovered ?? track.id) === mainTrackId(doc) });
      commands.apply((next) => placeGroup(next, mode, clip.id, current.ids, current.ids.length > 1 ? null : hovered, base.startMs + applied));
      feedback(event, applied, mode, snapped.snapped);
      return;
    }
    const edgeMs = current.gesture === "start" ? base.startMs : clipEnd(base);
    const snapped = snapOn ? snapMs(edgeMs + deltaMs, candidates, threshold) : { ms: edgeMs + deltaMs, snapped: null };
    const edge = current.gesture;
    const ripple = active === "ripple" || event.ctrlKey || event.metaKey;
    const roll = active === "roll";
    feedback(event, Math.round(snapped.ms - edgeMs), ripple ? "ripple" : roll ? "roll" : null, snapped.snapped);
    commands.apply((next) => {
      if (roll) {
        const self = findClip(next, clip.id);
        const neighbour = self?.track.clips.find((c) => (edge === "end" ? c.startMs === clipEnd(base) : clipEnd(c) === base.startMs));
        if (neighbour) return edge === "end" ? rollEdit(next, clip.id, neighbour.id, snapped.ms, sourceOf) : rollEdit(next, neighbour.id, clip.id, snapped.ms, sourceOf);
      }
      if (ripple) return rippleTrim(next, clip.id, edge, snapped.ms, sourceOf);
      const linked = linkedSelection ? trimLinked(next, clip.id, edge, snapped.ms, sourceOf) : next;
      if (linked !== next) return linked;
      return edge === "start" ? trimClipStart(next, clip.id, snapped.ms) : trimClipEnd(next, clip.id, snapped.ms, sourceDurationMs);
    });
  };

  const finish = (commit: boolean) => {
    const current = drag.current;
    drag.current = null;
    setDragging(false);
    view.setState({ snapGuideMs: null, dragMode: null, feedback: null });
    if (!current?.started) return;
    if (commit) store.getState().commitTransaction();
    else store.getState().cancelTransaction();
  };

  const end = (event: ReactPointerEvent<HTMLElement>) => {
    if (drag.current?.pointerId === event.pointerId) finish(true);
  };

  const handlers = { onPointerMove: move, onPointerUp: end, onPointerCancel: () => finish(false), onLostPointerCapture: end };
  const description = t("clipDescription", { label, start: formatTimecode(clip.startMs), duration: formatTimecode(clip.durationMs) });
  const fadeInX = msToPx(clip.fadeInMs, geometry.pxPerSecond);
  const fadeOutX = width - msToPx(clip.fadeOutMs, geometry.pxPerSecond);
  const handleVisibility = selected ? "opacity-100" : "opacity-0 group-hover:opacity-100";
  const bodyCursor = locked ? "cursor-not-allowed" : tool === "slip" || tool === "slide" ? "cursor-ew-resize" : "cursor-grab active:cursor-grabbing";
  const edgeTools = tool !== "blade";

  if (!onScreen && !dragging) return null;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={description}
      title={description}
      data-clip-id={clip.id}
      data-disabled={clip.disabled ? "true" : undefined}
      onPointerDown={(event) => begin("move", event)}
      onKeyDown={(event) => {
        if (event.key === "Enter") commands.selectClip(clip.id, false);
      }}
      {...handlers}
      className={cn(
        "group absolute flex select-none flex-col overflow-hidden rounded-[6px] border bg-card text-foreground shadow-sm outline-none transition-[border-color,box-shadow]",
        selected ? "z-[3] border-primary ring-2 ring-primary/30" : "z-[1] border-border-strong",
        clip.disabled && "opacity-40",
        bodyCursor,
        "focus-visible:ring-2 focus-visible:ring-ring",
      )}
      style={{ left, width, top: CLIP_INSET, height, cursor: tool === "blade" && !locked ? BLADE_CURSOR : undefined }}
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 z-[2] w-[3px]", kindFill(kind))} />
      <div className={cn(kindTile(kind), "flex shrink-0 items-center gap-1 rounded-none border-0 pl-1.5 pr-1")} style={{ height: HEADER_PX }}>
        <Glyph className="h-2.5 w-2.5 shrink-0" aria-hidden />
        <span className="min-w-0 truncate text-2xs font-semibold leading-4">{label}</span>
        {clip.linkId ? <LinkSimple className="ml-auto h-3 w-3 shrink-0" aria-label={t("linked")} /> : null}
      </div>
      <div className="relative mx-1 mb-1 min-h-0 flex-1 overflow-hidden rounded-[3px] bg-muted">
        {span && clip.type === "video" ? <VideoFilmstrip clip={clip} widthPx={wellWidth} heightPx={wellHeight} span={span} sourceDurationMs={sourceDurationMs} /> : null}
        {span && clip.type === "image" ? <ImageFilmstrip clip={clip} widthPx={wellWidth} heightPx={wellHeight} span={span} /> : null}
        {span && audio && clip.assetId ? (
          <Waveform assetId={clip.assetId} trimInMs={clip.trimInMs} durationMs={clip.durationMs} widthPx={wellWidth} heightPx={wellHeight} span={span} colorVar={kindPlateVar(kind)} />
        ) : null}
        {clip.type === "overlay" ? (
          <span aria-hidden className="pointer-events-none absolute inset-x-1 top-1/2 -translate-y-1/2 truncate text-2xs text-muted-foreground">
            {clip.layer?.type === "text" ? clip.layer.text : label}
          </span>
        ) : null}
        {wellHeight > 6 && (audio || clip.fadeInMs > 0 || clip.fadeOutMs > 0 || clip.transform.opacity < 1) ? (
          <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible text-foreground" viewBox={`0 0 ${wellWidth} ${wellHeight}`} preserveAspectRatio="none">
            <polyline points={envelope} fill="none" stroke="currentColor" strokeOpacity={0.75} strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
          </svg>
        ) : null}
        {audio && !locked && wellHeight > 6 ? (
          <span
            aria-hidden
            onPointerDown={(event) => begin("volume", event)}
            {...handlers}
            className="absolute inset-x-2 z-[2] h-2 -translate-y-1/2 cursor-ns-resize"
            style={{ top: wellHeight * (1 - Math.min(1, level)) }}
          />
        ) : null}
        <ClipKeyframes clip={clip} widthPx={wellWidth} heightPx={wellHeight} />
      </div>
      {locked || !edgeTools ? null : (
        <>
          <span
            aria-hidden
            onPointerDown={(event) => begin("fadeIn", event)}
            {...handlers}
            className={cn("absolute z-[4] h-2 w-2 -translate-x-1/2 cursor-ew-resize rounded-[2px] border-2 border-foreground bg-card transition-opacity active:border-primary active:bg-primary", handleVisibility)}
            style={{ top: HEADER_PX - 1, left: Math.max(7, Math.min(fadeInX, width - 7)) }}
          />
          <span
            aria-hidden
            onPointerDown={(event) => begin("fadeOut", event)}
            {...handlers}
            className={cn("absolute z-[4] h-2 w-2 -translate-x-1/2 cursor-ew-resize rounded-[2px] border-2 border-foreground bg-card transition-opacity active:border-primary active:bg-primary", handleVisibility)}
            style={{ top: HEADER_PX - 1, left: Math.max(7, Math.min(fadeOutX, width - 7)) }}
          />
          <span
            aria-hidden
            data-trim="start"
            onPointerDown={(event) => begin("start", event)}
            {...handlers}
            className={cn("absolute inset-y-0 left-0 z-[3] w-1.5 cursor-ew-resize bg-border-strong transition-[opacity,background-color] active:bg-primary", handleVisibility)}
          />
          <span
            aria-hidden
            data-trim="end"
            onPointerDown={(event) => begin("end", event)}
            {...handlers}
            className={cn("absolute inset-y-0 right-0 z-[3] w-1.5 cursor-ew-resize bg-border-strong transition-[opacity,background-color] active:bg-primary", handleVisibility)}
          />
        </>
      )}
    </div>
  );
});
