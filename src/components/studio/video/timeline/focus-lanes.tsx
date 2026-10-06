"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslations } from "next-intl";

import { Plus } from "@/components/icons";
import type { Clip } from "@/lib/studio/document";
import { quantizeMs } from "@/lib/studio/document";
import { curvePoints, KEY_LANE_HEIGHT, keyAtPoint, keyLanesHeight, keyLaneTop, keysInBox, keyX, shiftedKeys, toggledKeys, type KeySpot } from "@/lib/studio/focus-lanes";
import { isAnimated, toggleAnimation } from "@/lib/studio/keyframe-edit";
import { duplicateKeyframes, KEYFRAME_PROPERTIES, moveKeyframes } from "@/lib/studio/keyframes";
import { snapMs, updateClip } from "@/lib/studio/timeline";
import { msToPx, normalizedRect, pxToMs, snapThresholdMs, type Rect } from "@/lib/studio/timeline-view";
import { cn } from "@/lib/utils";

import { useVideoEditor, useViewState } from "../editor-context";
import { KeyDiamond } from "../key-diamond";
import { useTimelineGeometry } from "./timeline-geometry";

export function focusLanesHeight(): number {
  return keyLanesHeight(KEY_LANE_HEIGHT);
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

export function FocusLanes({ clip }: { clip: Clip }) {
  const t = useTranslations("studio.video.keyframes");
  const { store, view, commands, playback } = useVideoEditor();
  const geometry = useTimelineGeometry();
  const selectedKeys = useViewState((s) => s.selectedKeys);
  const playheadMs = useViewState((s) => s.playheadMs);
  const host = useRef<HTMLDivElement>(null);
  const drag = useRef<KeyDrag | null>(null);
  const [marquee, setMarquee] = useState<KeyMarquee | null>(null);
  const left = msToPx(clip.startMs, geometry.pxPerSecond);
  const width = Math.max(2, msToPx(clip.durationMs, geometry.pxPerSecond));
  const localPlayhead = playheadMs - clip.startMs;
  const playheadInside = localPlayhead >= 0 && localPlayhead <= clip.durationMs;
  const isSelected = (property: string, atMs: number) => selectedKeys.some((k) => k.property === property && k.atMs === atMs);

  const local = (clientX: number, clientY: number) => {
    const rect = host.current?.getBoundingClientRect();
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
  };

  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const point = local(event.clientX, event.clientY);
    const property = KEYFRAME_PROPERTIES[Math.floor(point.y / KEY_LANE_HEIGHT)];
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
      const hits = keysInBox(clip.keyframes, rect, clip.durationMs, width);
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
    const others = [...new Set(KEYFRAME_PROPERTIES.flatMap((p) => (current.base.keyframes?.[p] ?? []).map((f) => f.atMs)))].filter((at) => !current.keys.some((k) => k.atMs === at));
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

  return (
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
    >
      {KEYFRAME_PROPERTIES.map((property) => {
        const frames = clip.keyframes?.[property] ?? [];
        const top = keyLaneTop(property);
        const points = curvePoints(frames, property, clip.durationMs, width, KEY_LANE_HEIGHT)
          .map(([x, y]) => `${x},${y}`)
          .join(" ");
        return (
          <div key={property} className="absolute inset-x-0 border-b border-background" style={{ top, height: KEY_LANE_HEIGHT }} data-key-lane={property}>
            {frames.length > 1 ? (
              <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible text-muted-foreground" viewBox={`0 0 ${width} ${KEY_LANE_HEIGHT}`} preserveAspectRatio="none">
                <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
              </svg>
            ) : null}
            {frames.map((frame) => (
              <span
                key={frame.atMs}
                aria-label={t("keyAt", { name: t(`properties.${property}`), time: Math.round(frame.atMs) })}
                className={cn("pointer-events-none absolute top-1/2 flex h-3 w-3 -translate-x-1/2 -translate-y-1/2 items-center justify-center", isSelected(property, frame.atMs) ? "text-primary" : "text-foreground")}
                style={{ left: keyX(frame.atMs, clip.durationMs, width) }}
              >
                <KeyDiamond filled className="h-3 w-3" />
              </span>
            ))}
            {!isAnimated(clip, property) && playheadInside ? (
              <button
                type="button"
                aria-label={t("animate", { name: t(`properties.${property}`) })}
                title={t("animate", { name: t(`properties.${property}`) })}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => commands.patchKeyframes(clip.id, (current, at) => toggleAnimation(current, property, at))}
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
  );
}

