"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { STUDIO_LIMITS, type Track, type TrackKind } from "@/lib/studio/document";
import { mainTrackId } from "@/lib/studio/edits";
import { shownTracks } from "@/lib/studio/organize";
import { addTrack, snapCandidates, snapMs } from "@/lib/studio/timeline";
import {
  anchoredScroll,
  contentWidthPx,
  followScroll,
  formatSmpte,
  idsInMarquee,
  laneBoxes,
  laneOrder,
  msToPx,
  normalizedRect,
  pxToMs,
  rangeView,
  snapThresholdMs,
  stackTops,
  zoomBy,
  type Rect,
} from "@/lib/studio/timeline-view";
import { revealScroll, revealTarget, timelineWheel } from "@/lib/studio/timeline-scroll";
import { gapAt } from "@/lib/studio/tools";
import { cn } from "@/lib/utils";

import { useEditorState, useVideoEditor, useViewState } from "../editor-context";
import { useDefaultTrackNames } from "../use-track-names";
import { TRACK_HEIGHTS } from "../view-store";
import { clipKind, kindFill } from "../clip-tones";
import { BLADE_CURSOR } from "./cursors";
import { FocusLanes, focusLanesHeight } from "./focus-lanes";
import { TransitionChips } from "./transition-chips";
import { Mixer } from "./mixer";
import { FocusStrip } from "./focus-strip";
import { Ruler } from "./ruler";
import { TimelineBar } from "./timeline-bar";
import { GroupBreadcrumb } from "./group-breadcrumb";
import { TimelineClip } from "./timeline-clip";
import { TimelineContextMenu, type MenuTarget } from "./timeline-context-menu";
import {
  createTimelineScroll,
  DRAG_SLOP_PX,
  EDGE_SCROLL_PX,
  HEADER_WIDTH,
  MEDIA_DRAG_TYPE,
  RULER_HEIGHT,
  TimelineGeometryContext,
  readDraggedMedia,
  useScrollLeft,
  type TimelineGeometry,
  type TimelineScrollStore,
} from "./timeline-geometry";
import { TimelineOverview } from "./timeline-overview";
import { acceptLibraryDrag, takeDroppedItem } from "@/components/studio/library/drag";
import { useVideoLibrary } from "../library-adapter";
import { TrackHeader } from "./track-header";
import { LaneMarkers } from "./marker-flag";

const COLLAPSED_LANE = 18;
const EDGE_SCROLL_STEP = 18;

interface Marquee {
  pointerId: number;
  x: number;
  y: number;
  rect: Rect | null;
  base: string[];
}

function signedSmpte(ms: number): string {
  return `${ms < 0 ? "-" : "+"}${formatSmpte(Math.abs(ms))}`;
}

function AtScroll({ scroll, children }: { scroll: TimelineScrollStore; children: (scrollLeft: number) => ReactNode }) {
  return <>{children(useScrollLeft(scroll))}</>;
}

export function Timeline() {
  const t = useTranslations("studio.video.timeline");
  const { store, view, playback, commands } = useVideoEditor();
  const library = useVideoLibrary();
  const document = useEditorState((s) => s.document);
  const selection = useEditorState((s) => s.selection);
  const pxPerSecond = useViewState((s) => s.pxPerSecond);
  const snapGuideMs = useViewState((s) => s.snapGuideMs);
  const trackHeight = useViewState((s) => s.trackHeight);
  const mixerOpen = useViewState((s) => s.mixerOpen);
  const tool = useViewState((s) => s.tool);
  const range = useViewState((s) => s.range);
  const selectedGap = useViewState((s) => s.selectedGap);
  const feedback = useViewState((s) => s.feedback);
  const focus = useViewState((s) => s.focus);
  const graphEditor = useViewState((s) => s.graphEditor);
  const scroller = useRef<HTMLDivElement>(null);
  const lanesRef = useRef<HTMLDivElement>(null);
  const [scroll] = useState(createTimelineScroll);
  const [width, setWidth] = useState(0);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const [dropLane, setDropLane] = useState<string | null>(null);
  const [bladeHover, setBladeHover] = useState<{ trackId: string; ms: number } | null>(null);
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);
  const pointerInside = useRef(false);
  const pendingReveal = useRef<string | null>(null);
  const [revealRequest, setRevealRequest] = useState(0);
  const previousZoom = useRef(pxPerSecond);
  const wheelAnchor = useRef<{ ms: number; viewportPx: number } | null>(null);
  const showShy = useViewState((s) => s.showShy);
  const focusHome = focus ? (document.tracks.find((track) => track.clips.some((c) => c.id === focus.clipId))?.id ?? null) : null;
  const shown = useMemo(() => shownTracks(document.tracks, showShy, focusHome), [document.tracks, showShy, focusHome]);
  const lanes = useMemo(() => laneOrder(shown), [shown]);
  const names = useDefaultTrackNames(document.tracks);
  const main = mainTrackId(document);
  const selected = useMemo(() => new Set(selection), [selection]);
  const focusTrackId = focus ? (lanes.find((track) => track.clips.some((c) => c.id === focus.clipId))?.id ?? null) : null;
  const focusClip = focusTrackId ? lanes.find((track) => track.id === focusTrackId)!.clips.find((c) => c.id === focus!.clipId)! : null;
  const heights = TRACK_HEIGHTS[trackHeight];
  const heightOfTrack = useCallback(
    (track: Track) => {
      if (focusTrackId && track.id !== focusTrackId) return COLLAPSED_LANE;
      const base = heights[track.kind];
      return track.id === focusTrackId && focusClip ? base + focusLanesHeight(focusClip, graphEditor) : base;
    },
    [focusTrackId, focusClip, heights, graphEditor],
  );
  const heightOf = useCallback((kind: TrackKind) => heights[kind], [heights]);
  const tops = useMemo(() => stackTops(lanes.map(heightOfTrack)), [lanes, heightOfTrack]);
  const lanesWidth = Math.max(0, width - HEADER_WIDTH);
  const contentWidth = contentWidthPx(document.durationMs, STUDIO_LIMITS.maxVideoMs, pxPerSecond, lanesWidth);

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const scrolled = () => scroll.setState({ scrollLeft: element.scrollLeft });
    const measure = () => {
      const viewportPx = Math.max(0, element.clientWidth - HEADER_WIDTH);
      setWidth(element.clientWidth);
      scroll.setState({ scrollLeft: element.scrollLeft, viewportPx });
      view.setState({ viewportPx });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.addEventListener("scroll", scrolled, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", scrolled);
    };
  }, [view, scroll]);

  useLayoutEffect(() => {
    const element = scroller.current;
    const previous = previousZoom.current;
    previousZoom.current = pxPerSecond;
    if (!element || previous === pxPerSecond || view.getState().scrollRequest !== null) return;
    const width = Math.max(0, element.clientWidth - HEADER_WIDTH);
    let anchor = wheelAnchor.current;
    wheelAnchor.current = null;
    if (!anchor) {
      const playhead = view.getState().playheadMs;
      const at = msToPx(playhead, previous) - element.scrollLeft;
      anchor = at >= 0 && at <= width ? { ms: playhead, viewportPx: at } : { ms: playhead, viewportPx: width / 2 };
    }
    element.scrollLeft = anchoredScroll(anchor.ms, anchor.viewportPx, pxPerSecond);
  }, [pxPerSecond, view]);

  useLayoutEffect(
    () =>
      view.subscribe((state) => {
        const element = scroller.current;
        if (!element || state.scrollRequest === null) return;
        const target = state.scrollRequest;
        view.setState({ scrollRequest: null });
        requestAnimationFrame(() => {
          element.scrollLeft = target;
        });
      }),
    [view],
  );

  useEffect(
    () =>
      view.subscribe((state, previous) => {
        const element = scroller.current;
        if (!element || (!state.playing && !state.agentFollowing) || state.playheadMs === previous.playheadMs) return;
        const next = followScroll(msToPx(state.playheadMs, state.pxPerSecond), element.scrollLeft, element.clientWidth - HEADER_WIDTH);
        if (next !== null) element.scrollLeft = next;
      }),
    [view],
  );

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      const intent = timelineWheel(event, element.clientHeight);
      if (intent.kind === "native") return;
      event.preventDefault();
      if (intent.kind === "horizontal") {
        element.scrollLeft += intent.px;
        return;
      }
      if (intent.steps === 0) return;
      const rect = element.getBoundingClientRect();
      const viewportPx = Math.max(0, event.clientX - rect.left - HEADER_WIDTH);
      const { pxPerSecond: current } = view.getState();
      wheelAnchor.current = { ms: pxToMs(element.scrollLeft + viewportPx, current), viewportPx };
      view.setState({ pxPerSecond: zoomBy(current, intent.steps) });
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [view]);

  useEffect(() => {
    const release = () => {
      pointerInside.current = false;
    };
    window.addEventListener("pointerup", release, true);
    window.addEventListener("pointercancel", release, true);
    return () => {
      window.removeEventListener("pointerup", release, true);
      window.removeEventListener("pointercancel", release, true);
    };
  }, []);

  useEffect(
    () =>
      store.subscribe((state, previous) => {
        if (state.selection === previous.selection || pointerInside.current) return;
        const target = revealTarget(previous.selection, state.selection);
        if (!target) return;
        pendingReveal.current = target;
        setRevealRequest((count) => count + 1);
      }),
    [store],
  );

  useEffect(() => {
    const element = scroller.current;
    const target = pendingReveal.current;
    pendingReveal.current = null;
    if (!element || !target) return;
    const index = lanes.findIndex((track) => track.clips.some((c) => c.id === target));
    const clip = index < 0 ? undefined : lanes[index].clips.find((c) => c.id === target);
    if (!clip) return;
    const offsets = revealScroll(
      { top: tops[index], height: heightOfTrack(lanes[index]), left: msToPx(clip.startMs, pxPerSecond), width: msToPx(clip.durationMs, pxPerSecond) },
      { scrollTop: element.scrollTop, scrollLeft: element.scrollLeft, width: element.clientWidth - HEADER_WIDTH, height: element.clientHeight - RULER_HEIGHT },
    );
    if (offsets.top === null && offsets.left === null) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollTo({ top: offsets.top ?? element.scrollTop, left: offsets.left ?? element.scrollLeft, behavior: still ? "auto" : "smooth" });
  }, [revealRequest, lanes, tops, heightOfTrack, pxPerSecond]);

  const timeAt = useCallback(
    (clientX: number) => {
      const element = scroller.current;
      if (!element) return 0;
      const rect = element.getBoundingClientRect();
      return Math.max(0, pxToMs(clientX - rect.left - HEADER_WIDTH + element.scrollLeft, view.getState().pxPerSecond));
    },
    [view],
  );

  const laneAt = useCallback(
    (clientY: number) => {
      const element = lanesRef.current;
      if (!element) return null;
      const y = clientY - element.getBoundingClientRect().top;
      const index = tops.findIndex((top, i) => y >= top && y < top + heightOfTrack(lanes[i]));
      return lanes[index]?.id ?? null;
    },
    [lanes, tops, heightOfTrack],
  );

  const autoScroll = useCallback((clientX: number) => {
    const element = scroller.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    if (clientX < rect.left + HEADER_WIDTH + EDGE_SCROLL_PX) element.scrollLeft -= EDGE_SCROLL_STEP;
    else if (clientX > rect.right - EDGE_SCROLL_PX) element.scrollLeft += EDGE_SCROLL_STEP;
  }, []);

  const geometry = useMemo<TimelineGeometry>(
    () => ({ pxPerSecond, heightOf, scroll, laneAt, timeAt, autoScroll }),
    [pxPerSecond, heightOf, scroll, laneAt, timeAt, autoScroll],
  );

  const snappedTime = (clientX: number) => {
    const raw = timeAt(clientX);
    const { snapping, playheadMs: playhead } = view.getState();
    if (!snapping) return raw;
    return snapMs(raw, snapCandidates(store.getState().document, { playheadMs: playhead }), snapThresholdMs(pxPerSecond)).ms;
  };

  const startMarquee = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.target !== event.currentTarget || focus) return;
    if (tool === "blade") {
      const trackId = laneAt(event.clientY);
      if (trackId) commands.blade(trackId, snappedTime(event.clientX), event.shiftKey);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const additive = event.shiftKey || event.ctrlKey || event.metaKey;
    setMarquee({ pointerId: event.pointerId, x: event.clientX, y: event.clientY, rect: null, base: additive ? store.getState().selection : [] });
  };

  const moveMarquee = (event: ReactPointerEvent<HTMLDivElement>) => {
    const element = lanesRef.current;
    if (tool === "blade" && !focus) {
      const trackId = laneAt(event.clientY);
      setBladeHover(trackId ? { trackId, ms: snappedTime(event.clientX) } : null);
    }
    if (!marquee || marquee.pointerId !== event.pointerId || !element) return;
    if (!marquee.rect && Math.abs(event.clientX - marquee.x) < DRAG_SLOP_PX && Math.abs(event.clientY - marquee.y) < DRAG_SLOP_PX) return;
    autoScroll(event.clientX);
    const bounds = element.getBoundingClientRect();
    const rect = normalizedRect(marquee.x - bounds.left, marquee.y - bounds.top, event.clientX - bounds.left, event.clientY - bounds.top);
    setMarquee({ ...marquee, rect });
    const hits = idsInMarquee(laneBoxes(shown, pxPerSecond, (kind) => heights[kind]), rect);
    commands.selectClips([...new Set([...marquee.base, ...hits])]);
  };

  const endMarquee = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!marquee || marquee.pointerId !== event.pointerId) return;
    if (!marquee.rect && marquee.base.length === 0) {
      const trackId = laneAt(event.clientY);
      const gap = trackId ? gapAt(store.getState().document, trackId, timeAt(event.clientX)) : null;
      store.getState().select([]);
      commands.selectGap(gap);
    }
    setMarquee(null);
  };

  const onContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    const clipId = (event.target as HTMLElement).closest("[data-clip-id]")?.getAttribute("data-clip-id");
    if (clipId) {
      if (!store.getState().selection.includes(clipId)) commands.selectClip(clipId, false);
      setMenuTarget({ kind: "clip", clipId });
      return;
    }
    const trackId = laneAt(event.clientY);
    setMenuTarget(trackId ? { kind: "lane", trackId, atMs: timeAt(event.clientX) } : null);
  };

  const onDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const clipId = (event.target as HTMLElement).closest("[data-clip-id]")?.getAttribute("data-clip-id");
    if (clipId && view.getState().tool === "select") commands.enterFocus(clipId);
  };

  const onDragOver = (trackId: string) => (event: DragEvent<HTMLDivElement>) => {
    if (acceptLibraryDrag(event)) return setDropLane(trackId);
    if (!event.dataTransfer.types.includes(MEDIA_DRAG_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDropLane(trackId);
  };

  const onDrop = (trackId: string) => (event: DragEvent<HTMLDivElement>) => {
    setDropLane(null);
    const atMs = snappedTime(event.clientX);
    if (takeDroppedItem(event, (item) => library.insertAt(item, { atMs, trackId }), library.find)) return;
    const media = readDraggedMedia(event.dataTransfer);
    if (!media) return;
    event.preventDefault();
    void commands.insertMedia(media, snappedTime(event.clientX), trackId);
  };

  const addLane = (kind: Track["kind"]) => {
    const { document: current, apply } = store.getState();
    apply(() => addTrack(current, kind).document);
  };

  const scrollTo = (left: number) => {
    if (scroller.current) scroller.current.scrollLeft = left;
  };

  const zoomRange = (fromMs: number, toMs: number) => {
    const next = rangeView(fromMs, toMs, lanesWidth);
    view.setState({ pxPerSecond: next.pxPerSecond, scrollRequest: next.scrollLeft });
  };

  const marqueeRect = marquee?.rect;
  const rangeIn = range.inMs;
  const rangeOut = range.outMs;
  const totalHeight = tops.length > 0 ? tops[tops.length - 1] + heightOfTrack(lanes[lanes.length - 1]) : 0;

  return (
    <TimelineGeometryContext.Provider value={geometry}>
      <section aria-label={t("label")} data-tour="studio-video-timeline" data-studio-timeline className="flex h-full min-h-0 select-none flex-col bg-card text-foreground [&_input]:select-text [&_textarea]:select-text">
        <TimelineBar onAddTrack={addLane} />
        <GroupBreadcrumb />
        {focusClip ? <FocusStrip clip={focusClip} /> : null}
        <AtScroll scroll={scroll}>
          {(scrollLeft) => (
            <TimelineOverview
              tracks={document.tracks}
              durationMs={document.durationMs}
              pxPerSecond={pxPerSecond}
              scrollLeft={scrollLeft}
              viewportPx={lanesWidth}
              markers={document.markers ?? []}
              range={range}
              onScroll={scrollTo}
              onSeek={(ms) => playback.seek(ms)}
              onScrub={commands.setScrubbing}
              onZoomRange={zoomRange}
            />
          )}
        </AtScroll>
        <div
          ref={scroller}
          data-studio-timeline-scroller
          className="relative min-h-0 flex-1 overflow-auto overscroll-contain"
          onPointerDownCapture={() => {
            pointerInside.current = true;
          }}
        >
          <div className="relative" style={{ width: HEADER_WIDTH + contentWidth, minHeight: "100%" }}>
            <div className="sticky top-0 z-30 flex border-b border-border-strong bg-card" style={{ height: RULER_HEIGHT }}>
              <div className="sticky left-0 z-40 flex shrink-0 items-center border-r border-border-strong bg-card px-2" style={{ width: HEADER_WIDTH }}>
                <TimelineTimecode />
              </div>
              <AtScroll scroll={scroll}>
                {(scrollLeft) => (
                  <Ruler
                    width={contentWidth}
                    pxPerSecond={pxPerSecond}
                    scrollLeft={scrollLeft}
                    viewportWidth={lanesWidth}
                    durationMs={document.durationMs}
                    markers={document.markers ?? []}
                    range={range}
                    onSeek={(ms) => playback.seek(ms)}
                    onScrubStart={() => {
                      playback.pause();
                      commands.setScrubbing(true);
                    }}
                    onScrubEnd={() => commands.setScrubbing(false)}
                    timeAt={timeAt}
                  />
                )}
              </AtScroll>
            </div>
            <div className="relative flex">
              <div className="sticky left-0 z-20 shrink-0 border-r border-border-strong bg-card" style={{ width: HEADER_WIDTH }}>
                {lanes.map((track) => (
                  <div key={track.id} className={cn("border-b border-background", focusTrackId && track.id !== focusTrackId && "opacity-50")} style={{ height: heightOfTrack(track) }}>
                    <TrackHeader
                      track={track}
                      defaultName={names.get(track.id) ?? ""}
                      main={track.id === main}
                      collapsed={Boolean(focusTrackId && track.id !== focusTrackId)}
                      laneHeight={heights[track.kind]}
                      focusClip={track.id === focusTrackId ? focusClip : null}
                    />
                  </div>
                ))}
              </div>
              <TimelineContextMenu target={menuTarget}>
                <div
                  ref={lanesRef}
                  data-studio-lanes
                  data-tour="studio-video-trim"
                  className="relative"
                  style={{ width: contentWidth, height: totalHeight, cursor: tool === "blade" && !focus ? BLADE_CURSOR : undefined }}
                  onPointerDown={startMarquee}
                  onPointerMove={moveMarquee}
                  onPointerUp={endMarquee}
                  onPointerLeave={() => setBladeHover(null)}
                  onPointerCancel={() => setMarquee(null)}
                  onContextMenu={onContextMenu}
                  onDoubleClick={onDoubleClick}
                >
                  {lanes.map((track, index) => {
                    const collapsed = Boolean(focusTrackId && track.id !== focusTrackId);
                    return (
                      <div
                        key={track.id}
                        data-track-id={track.id}
                        role="group"
                        aria-label={track.name || names.get(track.id)}
                        onPointerDown={startMarquee}
                        onDragOver={onDragOver(track.id)}
                        onDragLeave={() => setDropLane((current) => (current === track.id ? null : current))}
                        onDrop={onDrop(track.id)}
                        className={cn(
                          "absolute inset-x-0 border-b border-border",
                          dropLane === track.id ? "bg-accent-hover" : index % 2 === 0 ? "bg-background" : "bg-muted",
                          (track.hidden || collapsed) && "opacity-40",
                          collapsed && "pointer-events-none",
                        )}
                        style={{ top: tops[index], height: heightOfTrack(track) }}
                      >
                        {collapsed ? (
                          <CollapsedClips track={track} pxPerSecond={pxPerSecond} />
                        ) : (
                          track.clips.map((clip) => <TimelineClip key={clip.id} clip={clip} track={track} selected={selected.has(clip.id)} />)
                        )}
                        {track.id === focusTrackId && focusClip ? (
                          <div className="absolute inset-x-0 bottom-0" style={{ height: focusLanesHeight(focusClip, graphEditor) }}>
                            <FocusLanes clip={focusClip} />
                          </div>
                        ) : null}
                        {collapsed ? null : <TransitionChips track={track} />}
                        {selectedGap?.trackId === track.id ? (
                          <span
                            aria-label={t("gapSelected")}
                            className="absolute inset-y-1 rounded-[3px] border border-dashed border-muted-foreground bg-accent-hover"
                            style={{ left: msToPx(selectedGap.fromMs, pxPerSecond), width: msToPx(selectedGap.toMs - selectedGap.fromMs, pxPerSecond) }}
                          />
                        ) : null}
                        {bladeHover?.trackId === track.id ? (
                          <span aria-hidden className="pointer-events-none absolute inset-y-0 z-[6] w-px bg-foreground" style={{ left: msToPx(bladeHover.ms, pxPerSecond) }}>
                            <span className="absolute -top-px left-1 whitespace-nowrap rounded-[2px] bg-card px-1 font-mono text-2xs tabular-nums text-foreground shadow-sm">
                              {formatSmpte(bladeHover.ms)}
                            </span>
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                  {lanes.length === 0 ? <p className="p-4 text-xs text-muted-foreground">{document.tracks.length > 0 ? t("allShy") : t("noTracks")}</p> : null}
                  {rangeIn !== null && rangeOut !== null && rangeOut > rangeIn ? (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 z-[4] border-x border-foreground bg-foreground/10"
                      style={{ left: msToPx(rangeIn, pxPerSecond), width: msToPx(rangeOut - rangeIn, pxPerSecond) }}
                    />
                  ) : null}
                  <LaneMarkers markers={document.markers ?? []} pxPerSecond={pxPerSecond} />
                  {snapGuideMs !== null ? (
                    <span aria-hidden className="pointer-events-none absolute inset-y-0 z-10 w-px bg-primary" style={{ left: msToPx(snapGuideMs, pxPerSecond) }} />
                  ) : null}
                  <TimelinePlayhead pxPerSecond={pxPerSecond} />
                  {marqueeRect ? (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute z-10 border border-primary"
                      style={{ left: marqueeRect.left, top: marqueeRect.top, width: marqueeRect.right - marqueeRect.left, height: marqueeRect.bottom - marqueeRect.top }}
                    />
                  ) : null}
                </div>
              </TimelineContextMenu>
            </div>
          </div>
        </div>
        {mixerOpen ? <Mixer /> : null}
        {feedback ? (
          <span
            role="status"
            className="pointer-events-none fixed z-[160] rounded-[3px] border border-border-strong bg-card px-1.5 py-0.5 font-mono text-2xs tabular-nums text-foreground shadow-md"
            style={{ left: feedback.x + 14, top: feedback.y - 28 }}
          >
            {signedSmpte(feedback.deltaMs)}
            {feedback.limit ? <span className="ml-1.5 font-sans text-destructive-ink">{t(`limits.${feedback.limit}`)}</span> : null}
          </span>
        ) : null}
      </section>
    </TimelineGeometryContext.Provider>
  );
}

function CollapsedClips({ track, pxPerSecond }: { track: Track; pxPerSecond: number }) {
  return (
    <>
      {track.clips.map((clip) => (
        <span
          key={clip.id}
          aria-hidden
          className={cn("absolute inset-y-1 rounded-[2px] border border-background", kindFill(clipKind(clip)))}
          style={{ left: msToPx(clip.startMs, pxPerSecond), width: Math.max(2, msToPx(clip.durationMs, pxPerSecond)) }}
        />
      ))}
    </>
  );
}

// Keep playback subscriptions out of the track/clip tree.
function TimelineTimecode() {
  const timecode = useViewState((s) => formatSmpte(s.playheadMs));
  return <span className="font-mono text-xs font-semibold tabular-nums text-foreground">{timecode}</span>;
}

function TimelinePlayhead({ pxPerSecond }: { pxPerSecond: number }) {
  const playheadMs = useViewState((s) => s.playheadMs);
  return <span aria-hidden className="pointer-events-none absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 bg-primary" style={{ left: msToPx(playheadMs, pxPerSecond) }} />;
}
