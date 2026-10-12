"use client";

import { memo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslations } from "next-intl";

import { GridFour, LinkSimple } from "@/components/icons";
import type { Clip, Track } from "@/lib/studio/document";
import { mainTrackId, placeGroup, placementMode, trimClipEdge } from "@/lib/studio/edits";
import { hasSourceTime } from "@/lib/studio/clip-time";
import { groupContentMs, isGroupClip, sourceLengthOf } from "@/lib/studio/group-scope";
import { clipJobState, readClipJobState } from "@/lib/studio/job-overlay";
import { clipEnd, findClip, snapCandidates, snapMs, snapRangeStart, updateClip } from "@/lib/studio/timeline";
import { envelopePoints, formatTimecode, msToPx, pxToMs, snapThresholdMs } from "@/lib/studio/timeline-view";
import { slipClip } from "@/lib/studio/tools";
import { limitOf, type TrimEdge, type TrimPreview } from "@/lib/studio/trim-edits";
import type { TrimLimit } from "@/lib/studio/edits";
import { cn } from "@/lib/utils";

import { JobBarState } from "../../ai/job-overlay";
import { CLIP_KIND_TONES, clipKind, kindFill, kindInk, kindPlateVar } from "../clip-tones";
import { useVideoEditor, useViewState } from "../editor-context";
import { useSourceDuration } from "../use-asset";
import { useClipLabel } from "../use-clip-label";
import type { DragMode } from "../view-store";
import { ClipKeyframes } from "./clip-keyframes";
import { BLADE_CURSOR, ROLL_CURSOR, SLIDE_CURSOR } from "./cursors";
import { ImageFilmstrip, VideoFilmstrip } from "./filmstrip";
import { GainBand } from "./gain-band";
import { GroupLanes } from "./group-lanes";
import { SpeedBadge } from "./speed-badge";
import { ParentWhip } from "./parent-whip";
import { MotionBlurIcon } from "./tool-icons";
import { CLIP_INSET, DRAG_SLOP_PX, useOnScreen, useTimelineGeometry, useVisibleSpan } from "./timeline-geometry";
import { Waveform } from "./waveform";
import { ClipMarkerTicks } from "./clip-marker-ticks";
import { labelHex } from "../label-colors";

type Gesture = "move" | "start" | "end" | "fadeIn" | "fadeOut" | "slip" | "slide";

interface DragState {
  gesture: Gesture;
  pointerId: number;
  x: number;
  y: number;
  base: Clip;
  ids: string[];
  blockStart: number;
  blockSpan: number;
  started: boolean;
}

const OVERSCAN_PX = 200;
const CLIP_BORDER = 1;
const LABEL_MIN_WIDTH = 24;
const FADE_HANDLE_TOP = 2;

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
  const jobState = useViewState((s) => clipJobState(s.jobs, clip.id));
  const clipJob = jobState ? readClipJobState(jobState) : null;
  const assetDurationMs = useSourceDuration(hasSourceTime(clip.type) ? clip.assetId : undefined);
  const sourceDurationMs = isGroupClip(clip) ? groupContentMs(clip) : assetDurationMs;
  const drag = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState(false);
  const [limited, setLimited] = useState<TrimEdge | null>(null);
  const label = useClipLabel(clip);
  const labelColor = labelHex(clip.labelColor ?? track.labelColor);
  const left = msToPx(clip.startMs, geometry.pxPerSecond);
  const width = Math.max(2, msToPx(clip.durationMs, geometry.pxPerSecond));
  const height = geometry.heightOf(track.kind) - CLIP_INSET * 2;
  const locked = Boolean(track.locked);
  const kind = clipKind(clip);
  const Glyph = CLIP_KIND_TONES[kind].glyph;
  const audio = clip.type === "audio";
  const wellWidth = Math.max(1, width - CLIP_BORDER * 2);
  const wellHeight = Math.max(0, height - CLIP_BORDER * 2);
  const span = useVisibleSpan(geometry.scroll, left + CLIP_BORDER, wellWidth, OVERSCAN_PX);
  const onScreen = useOnScreen(geometry.scroll, left, width, OVERSCAN_PX);
  const envelope = envelopePoints(clip, wellWidth, wellHeight, clip.transform.opacity)
    .map(([x, y]) => `${x},${y}`)
    .join(" ");

  const sourceOf = (id: string) => {
    const found = findClip(store.getState().document, id)?.clip;
    return found ? sourceLengthOf(found, (assetId) => assets.store.getState().assets[assetId]?.durationMs) : undefined;
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
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      gesture,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
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

  const feedback = (event: ReactPointerEvent<HTMLElement>, deltaMs: number, mode: DragMode | null, guide: number | null, limit?: TrimLimit) =>
    view.setState({ feedback: { deltaMs, x: event.clientX, y: event.clientY, ...(limit ? { limit } : {}) }, dragMode: mode, snapGuideMs: guide });

  const showTrim = (preview: TrimPreview, limit: TrimLimit | undefined, side: TrimEdge) => {
    if (!view.getState().trimPreview) view.setState({ trimPreview: preview });
    setLimited(limit ? side : null);
  };

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
    if (current.gesture === "slip") {
      store.getState().apply((doc) => slipClip(doc, clip.id, -deltaMs, sourceDurationMs));
      feedback(event, -deltaMs, "slip", null);
      return;
    }
    if (current.gesture === "slide") {
      const result = commands.slide(clip.id, base.startMs + deltaMs, view.getState().linkedSelection && !event.shiftKey);
      feedback(event, result.ok ? result.atMs - base.startMs : 0, "slide", null, limitOf(result));
      showTrim({ mode: "slide", clipId: clip.id, edge: "start" }, limitOf(result), deltaMs > 0 ? "end" : "start");
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
      commands.apply((next) => placeGroup(next, mode, clip.id, current.ids, hovered, base.startMs + applied));
      feedback(event, applied, mode, snapped.snapped);
      return;
    }
    const edgeMs = current.gesture === "start" ? base.startMs : clipEnd(base);
    const snapped = snapOn ? snapMs(edgeMs + deltaMs, candidates, threshold) : { ms: edgeMs + deltaMs, snapped: null };
    const edge = current.gesture;
    const ripple = active === "ripple" || event.ctrlKey || event.metaKey;
    if (active === "roll" && !ripple) {
      const result = commands.roll(clip.id, edge, snapped.ms, linkedSelection && !event.shiftKey);
      feedback(event, result.ok ? result.atMs - edgeMs : 0, "roll", snapped.snapped, limitOf(result));
      showTrim({ mode: "roll", clipId: clip.id, edge }, limitOf(result), edge);
      return;
    }
    feedback(event, Math.round(snapped.ms - edgeMs), ripple ? "ripple" : null, snapped.snapped);
    commands.apply((next) => trimClipEdge(next, clip.id, edge, snapped.ms, sourceOf, { ripple, linked: linkedSelection }));
  };

  const finish = (commit: boolean) => {
    const current = drag.current;
    drag.current = null;
    setDragging(false);
    setLimited(null);
    view.setState({ snapGuideMs: null, dragMode: null, feedback: null, trimPreview: null });
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
      onDoubleClick={() => {
        if (isGroupClip(clip)) commands.openGroup(clip.id);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter") return;
        if (isGroupClip(clip)) commands.openGroup(clip.id);
        else commands.selectClip(clip.id, false);
      }}
      {...handlers}
      className={cn(
        "group absolute select-none overflow-hidden rounded-[6px] border bg-card text-foreground shadow-sm outline-none transition-[border-color,box-shadow]",
        selected ? "z-[3] border-primary ring-2 ring-primary/30" : "z-[1] border-border-strong",
        clip.disabled && "opacity-40",
        clip.guide && "border-dashed",
        bodyCursor,
        "focus-visible:ring-2 focus-visible:ring-ring",
      )}
      style={{ left, width, top: CLIP_INSET, height, cursor: locked ? undefined : tool === "blade" ? BLADE_CURSOR : tool === "slide" ? SLIDE_CURSOR : undefined }}
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 z-[3]", labelColor ? "w-1" : "w-[3px]", !labelColor && kindFill(kind))} style={labelColor ? { background: labelColor } : undefined} />
      <div data-clip-well className="absolute inset-0 overflow-hidden bg-muted">
        {span && clip.type === "video" ? <VideoFilmstrip clip={clip} widthPx={wellWidth} heightPx={wellHeight} span={span} sourceDurationMs={sourceDurationMs} /> : null}
        {span && clip.type === "image" ? <ImageFilmstrip clip={clip} widthPx={wellWidth} heightPx={wellHeight} span={span} /> : null}
        {isGroupClip(clip) ? <GroupLanes clip={clip} widthPx={wellWidth} heightPx={wellHeight} /> : null}
        {span && audio && clip.assetId ? (
          <Waveform assetId={clip.assetId} clip={clip} widthPx={wellWidth} heightPx={wellHeight} span={span} colorVar={kindPlateVar(kind)} />
        ) : null}
        {wellHeight > 6 && !audio && (clip.fadeInMs > 0 || clip.fadeOutMs > 0 || clip.transform.opacity < 1) ? (
          <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible text-foreground" viewBox={`0 0 ${wellWidth} ${wellHeight}`} preserveAspectRatio="none">
            <polyline points={envelope} fill="none" stroke="currentColor" strokeOpacity={0.75} strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
          </svg>
        ) : null}
        {audio && wellHeight > 6 ? <GainBand clip={clip} track={track} widthPx={wellWidth} heightPx={wellHeight} /> : null}
        <ClipKeyframes clip={clip} widthPx={wellWidth} heightPx={wellHeight} />
        <ClipMarkerTicks clip={clip} pxPerSecond={geometry.pxPerSecond} locked={locked} />
        {clipJob ? <JobBarState jobKey={clipJob.jobId} phase={clipJob.phase} /> : null}
        {width >= LABEL_MIN_WIDTH ? (
          <span
            data-clip-label
            className="pointer-events-none absolute left-3 top-0.5 z-[2] flex h-4 max-w-[calc(100%-16px)] items-center gap-1 rounded-[4px] bg-card/85 px-1 text-2xs font-semibold leading-4 text-foreground shadow-sm"
          >
            <Glyph className={cn("h-2.5 w-2.5 shrink-0", kindInk(kind))} aria-hidden />
            <span className="min-w-0 truncate">{label}</span>
            <SpeedBadge clip={clip} />
            {clip.motionBlur ? (
              <span role="img" aria-label={t("motionBlur")} className="shrink-0 text-muted-foreground">
                <MotionBlurIcon className="h-3 w-3" />
              </span>
            ) : null}
            {clip.guide ? (
              <span role="img" aria-label={t("guide")} title={t("guideHint")} className="shrink-0 text-muted-foreground">
                <GridFour className="h-3 w-3" />
              </span>
            ) : null}
            <ParentWhip clip={clip} locked={locked} />
            {clip.linkId ? <LinkSimple className="h-3 w-3 shrink-0 text-muted-foreground" aria-label={t("linked")} /> : null}
          </span>
        ) : null}
      </div>
      {locked || !edgeTools ? null : (
        <>
          <span
            aria-hidden
            onPointerDown={(event) => begin("fadeIn", event)}
            {...handlers}
            className={cn("absolute z-[4] h-2 w-2 -translate-x-1/2 cursor-ew-resize rounded-[2px] border-2 border-foreground bg-card transition-opacity active:border-primary active:bg-primary", handleVisibility)}
            style={{ top: FADE_HANDLE_TOP, left: Math.max(7, Math.min(fadeInX, width - 7)) }}
          />
          <span
            aria-hidden
            onPointerDown={(event) => begin("fadeOut", event)}
            {...handlers}
            className={cn("absolute z-[4] h-2 w-2 -translate-x-1/2 cursor-ew-resize rounded-[2px] border-2 border-foreground bg-card transition-opacity active:border-primary active:bg-primary", handleVisibility)}
            style={{ top: FADE_HANDLE_TOP, left: Math.max(7, Math.min(fadeOutX, width - 7)) }}
          />
          {(["start", "end"] as const).map((side) => (
            <span
              key={side}
              aria-hidden
              data-trim={side}
              data-limited={limited === side ? "true" : undefined}
              onPointerDown={(event) => begin(side, event)}
              {...handlers}
              className={cn(
                "absolute inset-y-0 z-[3] w-1.5 cursor-ew-resize transition-[opacity,background-color]",
                side === "start" ? "left-0" : "right-0",
                limited === side ? "bg-destructive opacity-100" : cn("bg-border-strong active:bg-primary", handleVisibility),
              )}
              style={tool === "roll" ? { cursor: ROLL_CURSOR } : undefined}
            />
          ))}
        </>
      )}
    </div>
  );
});
