"use client";

import { useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslations } from "next-intl";

import { Plus } from "@/components/icons";
import type { Clip } from "@/lib/studio/document";
import { quantizeMs } from "@/lib/studio/document";
import { colorStops, curvePoints, KEY_LANE_HEIGHT, keyAtPoint, keyLanesHeight, keyLaneTop, keysInBox, keyTimeAt, keyX, shiftedKeys, toggledKeys, type KeySpot } from "@/lib/studio/focus-lanes";
import { GRAPH_HEIGHT } from "@/lib/studio/graph-editor";
import { keySideShapes } from "@/lib/studio/keyframe-ease";
import { isAnimated, keyTimes, keyTimesFor, laneProperties, toggleAnimation } from "@/lib/studio/keyframe-edit";
import { carriesValue, colorFramesOf, duplicateKeyframes, isColorProperty, moveKeyframes, type AnimatedProperty } from "@/lib/studio/keyframes";
import { snapMs, updateClip } from "@/lib/studio/timeline";
import { msToPx, normalizedRect, pxToMs, snapThresholdMs, type Rect } from "@/lib/studio/timeline-view";
import { cn } from "@/lib/utils";

import { usePanelPlayhead, useVideoEditor, useViewState } from "../editor-context";
import { KeyDiamond } from "../key-diamond";
import { GraphEditor } from "./graph-editor";
import { BehaviorOverlay } from "./behavior-overlay";
import { KeyframeMenu, type KeyMenuTarget } from "./keyframe-menu";
import { useTimelineGeometry } from "./timeline-geometry";

export function focusLanesHeight(clip: Clip, graph: boolean): number {
  const lanes = keyLanesHeight(laneProperties(clip).length, KEY_LANE_HEIGHT);
  return graph ? Math.max(GRAPH_HEIGHT, lanes) : lanes;
}

export function FocusLanes({ clip }: { clip: Clip }) {
  const graph = useViewState((s) => s.graphEditor);
  return graph ? <GraphEditor clip={clip} height={focusLanesHeight(clip, true)} /> : <KeyLanes clip={clip} />;
}

function LaneTrace({ clip, property, width }: { clip: Clip; property: AnimatedProperty; width: number }) {
  if (isColorProperty(property)) {
    const stops = colorStops(colorFramesOf(clip.keyframes, property), clip.durationMs);
    if (stops.length === 0) return null;
    return <span aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full" style={{ background: `linear-gradient(to right, ${stops.map((stop) => `${stop.color} ${stop.offset * 100}%`).join(", ")})` }} />;
  }
  if (!carriesValue(property)) return null;
  const frames = clip.keyframes?.[property] ?? [];
  if (frames.length < 2) return null;
  const points = curvePoints(frames, property, clip.durationMs, width, KEY_LANE_HEIGHT)
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible text-muted-foreground" viewBox={`0 0 ${width} ${KEY_LANE_HEIGHT}`} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

interface KeyDrag {
  pointerId: number;
  x: number;
  base: Clip;
  keys: KeySpot[];
  duplicate: boolean;
  started: boolean;
}

interface KeyMarquee {
  pointerId: number;
  x: number;
  y: number;
  rect: Rect | null;
  base: KeySpot[];
}

function KeyLanes({ clip }: { clip: Clip }) {
  const t = useTranslations("studio.video.keyframes");
  const { store, view, commands, playback } = useVideoEditor();
  const geometry = useTimelineGeometry();
  const selectedKeys = useViewState((s) => s.selectedKeys);
  const playheadMs = usePanelPlayhead();
  const host = useRef<HTMLDivElement>(null);
  const drag = useRef<KeyDrag | null>(null);
  const [marquee, setMarquee] = useState<KeyMarquee | null>(null);
  const [menu, setMenu] = useState<KeyMenuTarget | null>(null);
  const left = msToPx(clip.startMs, geometry.pxPerSecond);
  const width = Math.max(2, msToPx(clip.durationMs, geometry.pxPerSecond));
  const localPlayhead = playheadMs - clip.startMs;
  const playheadInside = localPlayhead >= 0 && localPlayhead <= clip.durationMs;
  const isSelected = (property: string, atMs: number) => selectedKeys.some((k) => k.property === property && k.atMs === atMs);
  const lanes = laneProperties(clip);

  const local = (clientX: number, clientY: number) => {
    const rect = host.current?.getBoundingClientRect();
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
  };

  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const point = local(event.clientX, event.clientY);
    const property = lanes[Math.floor(point.y / KEY_LANE_HEIGHT)];
    const hit = property ? keyAtPoint(clip.keyframes, property, point.x, clip.durationMs, width) : null;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (!hit) {
      setMarquee({ pointerId: event.pointerId, x: point.x, y: point.y, rect: null, base: event.shiftKey ? selectedKeys : [] });
      return;
    }
    const additive = event.shiftKey;
    const already = isSelected(hit.property, hit.atMs);
    const next = additive ? toggledKeys(selectedKeys, hit, true) : already ? selectedKeys : [hit];
    view.setState({ selectedKeys: next, keyProperty: hit.property });
    drag.current = { pointerId: event.pointerId, x: event.clientX, base: clip, keys: next.length > 0 ? next : [hit], duplicate: event.altKey, started: false };
  };

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const point = local(event.clientX, event.clientY);
    if (marquee && marquee.pointerId === event.pointerId) {
      const rect = normalizedRect(marquee.x, marquee.y, point.x, point.y);
      setMarquee({ ...marquee, rect });
      const hits = keysInBox(clip.keyframes, lanes, rect, clip.durationMs, width);
      view.setState({ selectedKeys: [...marquee.base, ...hits.filter((h) => !marquee.base.some((b) => b.property === h.property && b.atMs === h.atMs))] });
      return;
    }
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.x;
    if (!current.started && Math.abs(dx) < 3) return;
    const state = store.getState();
    if (current.started) state.cancelTransaction();
    current.started = true;
    state.beginTransaction();
    const anchor = current.keys[0].atMs;
    const others = keyTimes(current.base).filter((at) => !current.keys.some((k) => k.atMs === at));
    const { snapping, playheadMs: playhead } = view.getState();
    const proposed = anchor + pxToMs(dx, geometry.pxPerSecond);
    const snapped = snapping ? snapMs(proposed, [playhead - clip.startMs, 0, clip.durationMs, ...others], snapThresholdMs(geometry.pxPerSecond)).ms : proposed;
    const delta = Math.round(quantizeMs(snapped) - anchor);
    const keyframes = current.duplicate ? duplicateKeyframes(current.base.keyframes, current.keys, delta) : moveKeyframes(current.base.keyframes, current.keys, delta);
    if (keyframes !== current.base.keyframes) state.apply((doc) => updateClip(doc, clip.id, { keyframes }));
    view.setState({ feedback: { deltaMs: delta, x: event.clientX, y: event.clientY }, selectedKeys: keyframes !== current.base.keyframes ? shiftedKeys(current.keys, delta) : current.keys });
  };

  const up = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (marquee?.pointerId === event.pointerId) {
      setMarquee(null);
      return;
    }
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    view.setState({ feedback: null });
    if (current.started) store.getState().commitTransaction();
    else playback.seek(clip.startMs + current.keys[0].atMs);
  };

  const context = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const point = local(event.clientX, event.clientY);
    const property = lanes[Math.min(lanes.length - 1, Math.max(0, Math.floor(point.y / KEY_LANE_HEIGHT)))];
    const hit = keyAtPoint(clip.keyframes, property, point.x, clip.durationMs, width);
    if (!hit) {
      setMenu({ kind: "lane", clipId: clip.id, property, atMs: Math.round(quantizeMs(keyTimeAt(point.x, clip.durationMs, width))) });
      return;
    }
    if (!isSelected(hit.property, hit.atMs)) view.setState({ selectedKeys: [hit], keyProperty: hit.property });
    setMenu({ kind: "keys", clipId: clip.id, property: hit.property, atMs: hit.atMs });
  };

  return (
    <KeyframeMenu target={menu}>
      <div
        ref={host}
        role="group"
        aria-label={t("lanes")}
        className="absolute inset-y-0 border-t border-border-strong bg-background"
        style={{ left, width }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onContextMenu={context}
      >
        {lanes.map((property) => {
          const top = keyLaneTop(lanes, property);
          return (
            <div key={property} className="absolute inset-x-0 border-b border-background" style={{ top, height: KEY_LANE_HEIGHT }} data-key-lane={property}>
              <LaneTrace clip={clip} property={property} width={width} />
              <BehaviorOverlay clip={clip} lane={property} width={width} />
              {keyTimesFor(clip, property).map((atMs) => (
                <span
                  key={atMs}
                  aria-label={t("keyAt", { name: t(`properties.${property}`), time: Math.round(atMs) })}
                  className={cn("pointer-events-none absolute top-1/2 flex h-3 w-3 -translate-x-1/2 -translate-y-1/2 items-center justify-center", isSelected(property, atMs) ? "text-primary" : "text-foreground")}
                  style={{ left: keyX(atMs, clip.durationMs, width) }}
                >
                  <KeyDiamond filled sides={keySideShapes(clip.keyframes, property, atMs)} className="h-3 w-3" />
                </span>
              ))}
              {!isAnimated(clip, property) && playheadInside ? (
                <button
                  type="button"
                  aria-label={t("animate", { name: t(`properties.${property}`) })}
                  title={t("animate", { name: t(`properties.${property}`) })}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => commands.patchKeyframes(clip.id, (current, at, aspect) => toggleAnimation(current, property, at, aspect))}
                  className="absolute top-1/2 flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[3px] border border-border-strong bg-card text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  style={{ left: keyX(localPlayhead, clip.durationMs, width) }}
                >
                  <Plus className="h-2.5 w-2.5" aria-hidden />
                </button>
              ) : null}
            </div>
          );
        })}
        {marquee?.rect ? (
          <span
            aria-hidden
            className="pointer-events-none absolute border border-primary"
            style={{ left: marquee.rect.left, top: marquee.rect.top, width: marquee.rect.right - marquee.rect.left, height: marquee.rect.bottom - marquee.rect.top }}
          />
        ) : null}
      </div>
    </KeyframeMenu>
  );
}

