"use client";

import { useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslations } from "next-intl";

import { gainAt, gainToDb, MAX_GAIN_DB, SILENCE_DB } from "@/lib/studio/audio-gain";
import { formatLevel } from "@/lib/studio/live-meter";
import type { Clip, Track } from "@/lib/studio/document";
import { addGainKey, bandGain, bandY, dragGainKey, dragGainLine, nudgeGainKey, removeGainKey, segmentKeys } from "@/lib/studio/gain-band";
import { framesOf } from "@/lib/studio/keyframe-edit";
import { formatTimecode, pxToMs } from "@/lib/studio/timeline-view";
import { findClip, updateClip } from "@/lib/studio/timeline";
import { cn } from "@/lib/utils";

import { useVideoEditor } from "../editor-context";
import { KeyframeMenu, type KeyMenuTarget } from "./keyframe-menu";
import { DRAG_SLOP_PX, useTimelineGeometry } from "./timeline-geometry";

const SAMPLE_PX = 3;
const KEY_PX = 8;
const NUDGE_DB = 1;
const FINE_NUDGE_DB = 0.1;
const FINE_LINE = 0.25;

interface BandDrag {
  kind: "line" | "key";
  pointerId: number;
  x: number;
  y: number;
  base: Clip;
  atMs: number;
  lineDb: number;
  started: boolean;
}

interface Readout {
  x: number;
  y: number;
  db: number;
}

function decibels(db: number): string {
  return `${formatLevel(db)} dB`;
}

export function GainBand({ clip, track, widthPx, heightPx }: { clip: Clip; track: Track; widthPx: number; heightPx: number }) {
  const t = useTranslations("studio.video.gainBand");
  const { store, commands } = useVideoEditor();
  const geometry = useTimelineGeometry();
  const host = useRef<HTMLDivElement>(null);
  const drag = useRef<BandDrag | null>(null);
  const [readout, setReadout] = useState<Readout | null>(null);
  const [menu, setMenu] = useState<KeyMenuTarget | null>(null);
  const trackGainDb = track.gainDb ?? 0;
  const locked = Boolean(track.locked);
  const keys = framesOf(clip, "gainDb");
  const xOf = (localMs: number) => (clip.durationMs > 0 ? (localMs / clip.durationMs) * widthPx : 0);
  const yOf = (localMs: number) => bandY(gainAt(clip, localMs, { trackGainDb }), heightPx);

  const line = useMemo(() => {
    const count = Math.max(2, Math.ceil(widthPx / SAMPLE_PX));
    return Array.from({ length: count + 1 }, (_, i) => {
      const localMs = (i / count) * clip.durationMs;
      return `${(i / count) * widthPx},${bandY(gainAt(clip, localMs, { trackGainDb }), heightPx)}`;
    }).join(" ");
  }, [clip, trackGainDb, widthPx, heightPx]);

  const point = (event: { clientX: number; clientY: number }) => {
    const rect = host.current?.getBoundingClientRect();
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
  };
  const localAt = (x: number) => Math.min(clip.durationMs, Math.max(0, Math.round((x / Math.max(1, widthPx)) * clip.durationMs)));
  const lineDbAt = (y: number) => gainToDb(bandGain(y, heightPx));

  const select = () => {
    if (!store.getState().selection.includes(clip.id)) commands.selectClip(clip.id, false);
  };

  const begin = (kind: BandDrag["kind"], event: ReactPointerEvent<Element>, atMs: number, base: Clip) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const at = point(event);
    drag.current = { kind, pointerId: event.pointerId, x: event.clientX, y: event.clientY, base, atMs, lineDb: lineDbAt(kind === "key" ? yOf(atMs) : at.y), started: false };
  };

  const startTransaction = (current: BandDrag) => {
    const state = store.getState();
    if (current.started) state.cancelTransaction();
    current.started = true;
    state.beginTransaction();
  };

  const downOnLine = (event: ReactPointerEvent<SVGPolylineElement>) => {
    if (event.button !== 0 || locked) return;
    select();
    const localMs = localAt(point(event).x);
    if (!(event.altKey || event.ctrlKey || event.metaKey)) {
      begin("line", event, localMs, clip);
      return;
    }
    const added = { ...clip, ...addGainKey(clip, localMs) };
    const atMs = framesOf(added, "gainDb").find((key) => Math.abs(key.atMs - localMs) <= 17)?.atMs ?? localMs;
    begin("key", event, atMs, added);
    startTransaction(drag.current!);
    store.getState().apply((doc) => updateClip(doc, clip.id, { keyframes: added.keyframes }));
  };

  const downOnKey = (event: ReactPointerEvent<HTMLButtonElement>, atMs: number) => {
    if (event.button !== 0 || locked) return;
    select();
    begin("key", event, atMs, clip);
  };

  const move = (event: ReactPointerEvent<Element>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (!current.started && Math.abs(dx) < DRAG_SLOP_PX && Math.abs(dy) < DRAG_SLOP_PX) return;
    startTransaction(current);
    const startY = bandY(10 ** (current.lineDb / 20), heightPx);
    const deltaDb = lineDbAt(startY + dy) - current.lineDb;
    const base = current.base;
    const at = point(event);
    if (current.kind === "line") {
      const patch = dragGainLine(base, current.atMs, event.shiftKey ? deltaDb * FINE_LINE : deltaDb);
      store.getState().apply((doc) => updateClip(doc, clip.id, patch));
      const first = segmentKeys(base, current.atMs)[0];
      const shown = patch.volume !== undefined ? gainToDb(patch.volume) : (framesOf(patch, "gainDb").find((frame) => frame.atMs === first)?.value ?? 0);
      setReadout({ x: at.x, y: at.y, db: shown });
      return;
    }
    const key = framesOf(base, "gainDb").find((frame) => frame.atMs === current.atMs);
    if (!key) return;
    const toMs = event.shiftKey ? current.atMs : current.atMs + pxToMs(dx, geometry.pxPerSecond);
    const value = Math.min(MAX_GAIN_DB, Math.max(SILENCE_DB, key.value + deltaDb));
    store.getState().apply((doc) => updateClip(doc, clip.id, { keyframes: dragGainKey(base, current.atMs, toMs, value) }));
    setReadout({ x: at.x, y: at.y, db: value });
  };

  const finish = (event: ReactPointerEvent<Element>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    setReadout(null);
    if (current.started) store.getState().commitTransaction();
  };

  const cancel = () => {
    const current = drag.current;
    drag.current = null;
    setReadout(null);
    if (current?.started) store.getState().cancelTransaction();
  };

  const keyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, atMs: number) => {
    if (locked) return;
    const found = findClip(store.getState().document, clip.id)?.clip;
    if (!found) return;
    const step = event.shiftKey ? FINE_NUDGE_DB : NUDGE_DB;
    const patch = event.key === "Delete" || event.key === "Backspace" ? removeGainKey(found, atMs) : event.key === "ArrowUp" ? nudgeGainKey(found, atMs, step) : event.key === "ArrowDown" ? nudgeGainKey(found, atMs, -step) : null;
    if (!patch) return;
    event.preventDefault();
    event.stopPropagation();
    store.getState().apply((doc) => updateClip(doc, clip.id, patch));
  };

  const handlers = { onPointerMove: move, onPointerUp: finish, onPointerCancel: cancel, onLostPointerCapture: finish };

  return (
    <KeyframeMenu target={menu}>
      <div ref={host} className="pointer-events-none absolute inset-0 z-[2]" onContextMenu={(event) => event.stopPropagation()}>
        <svg aria-hidden className="absolute inset-0 h-full w-full overflow-visible text-foreground" viewBox={`0 0 ${widthPx} ${heightPx}`} preserveAspectRatio="none">
          <polyline points={line} fill="none" stroke="currentColor" strokeOpacity={0.8} strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
          {locked ? null : (
            <polyline
              data-gain-line
              points={line}
              fill="none"
              stroke="transparent"
              strokeWidth={10}
              vectorEffect="non-scaling-stroke"
              className="cursor-ns-resize"
              style={{ pointerEvents: "stroke" }}
              onPointerDown={downOnLine}
              onContextMenu={(event) => setMenu({ kind: "lane", clipId: clip.id, property: "gainDb", atMs: localAt(point(event).x) })}
              {...handlers}
            />
          )}
        </svg>
        {keys.map((key) => {
          const label = t("key", { time: formatTimecode(clip.startMs + key.atMs), value: decibels(key.value) });
          return (
            <button
              key={key.atMs}
              type="button"
              aria-label={label}
              title={label}
              disabled={locked}
              onPointerDown={(event) => downOnKey(event, key.atMs)}
              onKeyDown={(event) => keyDown(event, key.atMs)}
              onContextMenu={() => setMenu({ kind: "key", clipId: clip.id, property: "gainDb", atMs: key.atMs })}
              {...handlers}
              className={cn(
                "pointer-events-auto absolute flex -translate-x-1/2 -translate-y-1/2 rotate-45 items-center justify-center border border-foreground bg-card shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none",
                "cursor-move hover:bg-primary active:bg-primary",
              )}
              style={{ left: xOf(key.atMs), top: yOf(key.atMs), width: KEY_PX, height: KEY_PX }}
            />
          );
        })}
        {readout ? (
          <span role="status" className="pointer-events-none absolute z-[5] -translate-y-full rounded-[3px] bg-foreground px-1 py-px font-mono text-2xs tabular-nums text-background" style={{ left: readout.x + 8, top: readout.y - 4 }}>
            {decibels(readout.db)}
          </span>
        ) : null}
      </div>
    </KeyframeMenu>
  );
}
