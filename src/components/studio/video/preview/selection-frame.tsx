"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslations } from "next-intl";

import { HANDLES, moveBox, resizeBox, rotateBox, type Handle } from "@/lib/studio/clip-transform";
import type { CanvasSize, Clip, Transform } from "@/lib/studio/document";
import { KEY_TOLERANCE_MS } from "@/lib/studio/keyframe-edit";
import { keyButtonPosition, motionPath, movePathKeyPatch, type PathKey } from "@/lib/studio/motion-path";
import { boxStyle } from "@/lib/studio/playback";
import { selectionMoment, toggleSelectionMoment } from "@/lib/studio/selection-edit";
import { findClip } from "@/lib/studio/timeline";
import { formatTimecode } from "@/lib/studio/timeline-view";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { useEditorState, useVideoEditor, useViewState } from "../editor-context";
import { KeyDiamond } from "../inspector/keyframe-fields";
import { noteMomentClick } from "../inspector/keyframe-coach";
import { useSelectionEditor, type SelectionEditor } from "../inspector/use-selection-editor";
import { TOOLTIP_CLASS } from "../tool-button";

const HANDLE_POSITION: Record<Handle, string> = {
  nw: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
  n: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize",
  ne: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
  e: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
  se: "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
  s: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize",
  sw: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
  w: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
};

const PAD_DRAG_PX = 3;
const KEY_BUTTON_PX = 24;
const KEY_BUTTON_GAP_PX = 6;

function useFrameSize(frameRef: React.RefObject<HTMLDivElement | null>): CanvasSize {
  const [size, setSize] = useState<CanvasSize>({ width: 0, height: 0 });
  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [frameRef]);
  return size;
}

interface FloatingKeyButtonProps {
  transform: Transform;
  frame: CanvasSize;
  on: boolean;
  label: string;
  onToggle: () => void;
}

function FloatingKeyButton({ transform, frame, on, label, onToggle }: FloatingKeyButtonProps) {
  if (frame.width === 0) return null;
  const position = keyButtonPosition(transform, frame, KEY_BUTTON_PX, KEY_BUTTON_GAP_PX);
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={on}
          data-inside={position.inside || undefined}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onToggle}
          className={cn(
            "pointer-events-auto absolute flex h-[24px] w-[24px] items-center justify-center rounded-[6px] border border-border-strong bg-card shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            on ? "text-primary-ink" : "text-foreground",
          )}
          style={{ left: position.left, top: position.top, zIndex: 902 }}
        >
          <KeyDiamond filled={on} className="h-[14px] w-[14px]" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className={TOOLTIP_CLASS}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

type Gesture = { kind: "move" } | { kind: "resize"; handle: Handle } | { kind: "rotate" };

interface SelectionFrameProps {
  clipId: string;
  transform: Transform;
  canvas: CanvasSize;
  frameRef: React.RefObject<HTMLDivElement | null>;
  locked: boolean;
}

interface MotionPathProps {
  clip: Clip;
  frameRef: React.RefObject<HTMLDivElement | null>;
  locked: boolean;
  editor: SelectionEditor;
}

function MotionPathOverlay({ clip, frameRef, locked, editor }: MotionPathProps) {
  const t = useTranslations("studio.video.keyframes");
  const { store, playback } = useVideoEditor();
  const localMs = useViewState((s) => s.playheadMs - clip.startMs);
  const path = useMemo(() => motionPath(clip), [clip]);
  const drag = useRef<{ pointerId: number; x: number; y: number; moved: boolean } | null>(null);
  if (!path) return null;

  const pointAt = (event: ReactPointerEvent<HTMLElement>) => {
    const frame = frameRef.current?.getBoundingClientRect();
    return frame ? { x: (event.clientX - frame.left) / frame.width, y: (event.clientY - frame.top) / frame.height } : null;
  };

  const seek = (key: PathKey) => playback.seek(clip.startMs + key.atMs);

  const padHandlers = (key: PathKey) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      const current = drag.current;
      if (!current || current.pointerId !== event.pointerId || locked) return;
      if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) < PAD_DRAG_PX) return;
      if (!current.moved) {
        current.moved = true;
        store.getState().beginTransaction();
      }
      const point = pointAt(event);
      if (point) editor.patch((target) => movePathKeyPatch(target, key.atMs, point.x, point.y));
    },
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
      const current = drag.current;
      if (!current || current.pointerId !== event.pointerId) return;
      drag.current = null;
      if (current.moved) store.getState().commitTransaction();
      else seek(key);
    },
    onPointerCancel: () => {
      if (drag.current?.moved) store.getState().cancelTransaction();
      drag.current = null;
    },
  });

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 899 }}>
      <svg aria-hidden className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 1 1" preserveAspectRatio="none">
        <polyline
          points={path.points.map((point) => `${point.x},${point.y}`).join(" ")}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="1.5"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div role="group" aria-label={t("pathLabel")}>
        {path.keys.map((key) => {
          const current = Math.abs(key.atMs - localMs) <= KEY_TOLERANCE_MS;
          const label = t("pathPad", { time: formatTimecode(clip.startMs + key.atMs) });
          return (
            <span
              key={key.atMs}
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-current={current || undefined}
              title={label}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                seek(key);
              }}
              {...padHandlers(key)}
              className={cn(
                "pointer-events-auto absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border-2 border-primary shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                locked ? "cursor-pointer" : "cursor-move",
                current ? "bg-primary" : "bg-card",
              )}
              style={{ left: `${key.x * 100}%`, top: `${key.y * 100}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function SelectionFrame({ clipId, transform, canvas, frameRef, locked }: SelectionFrameProps) {
  const t = useTranslations("studio.video.preview");
  const tk = useTranslations("studio.video.keyframes");
  const { store, commands } = useVideoEditor();
  const clip = useEditorState((s) => findClip(s.document, clipId)?.clip ?? null);
  const playheadMs = useViewState((s) => s.playheadMs);
  const ids = useMemo(() => [clipId], [clipId]);
  const editor = useSelectionEditor(ids);
  const moment = clip ? selectionMoment([clip], playheadMs) : "outside";
  const frameSize = useFrameSize(frameRef);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<{ kind: Gesture; base: Transform; x: number; y: number; pointerId: number } | null>(null);

  const begin = (kind: Gesture, event: ReactPointerEvent<HTMLElement>) => {
    if (locked || event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { kind, base: transform, x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    setDragging(true);
    store.getState().beginTransaction();
  };

  const move = (event: ReactPointerEvent<HTMLElement>) => {
    const current = gesture.current;
    const frame = frameRef.current?.getBoundingClientRect();
    if (!current || !frame || current.pointerId !== event.pointerId) return;
    const dx = (event.clientX - current.x) / frame.width;
    const dy = (event.clientY - current.y) / frame.height;
    let next: Transform;
    if (current.kind.kind === "move") next = moveBox(current.base, dx, dy);
    else if (current.kind.kind === "resize") {
      const corner = current.kind.handle.length === 2;
      next = resizeBox(current.base, current.kind.handle, dx, dy, { aspect: canvas.width / canvas.height, keepRatio: corner !== event.shiftKey });
    } else {
      const center = { x: frame.left + current.base.x * frame.width, y: frame.top + current.base.y * frame.height };
      next = rotateBox(current.base, center, { x: event.clientX, y: event.clientY }, event.shiftKey ? 15 : 0);
    }
    commands.editTransform(clipId, next);
  };

  const end = (event: ReactPointerEvent<HTMLElement>) => {
    if (!gesture.current || gesture.current.pointerId !== event.pointerId) return;
    gesture.current = null;
    setDragging(false);
    store.getState().commitTransaction();
  };

  const cancel = () => {
    if (!gesture.current) return;
    gesture.current = null;
    setDragging(false);
    store.getState().cancelTransaction();
  };

  const handlers = { onPointerMove: move, onPointerUp: end, onPointerCancel: cancel };

  return (
    <>
      {clip ? <MotionPathOverlay clip={clip} frameRef={frameRef} locked={locked} editor={editor} /> : null}
      <div className="pointer-events-none absolute" style={{ ...boxStyle({ transform, opacity: 1, trackIndex: 900 }) }}>
        <div
          role="group"
          aria-label={t("selection")}
          className={cn("pointer-events-auto absolute inset-0 outline outline-2 outline-primary", locked ? "cursor-not-allowed" : "cursor-move")}
          onPointerDown={(event) => begin({ kind: "move" }, event)}
          {...handlers}
        />
        {locked
          ? null
          : HANDLES.map((handle) => (
              <span
                key={handle}
                aria-hidden
                onPointerDown={(event) => begin({ kind: "resize", handle }, event)}
                {...handlers}
                className={cn("pointer-events-auto absolute h-2.5 w-2.5 rounded-[2px] border-2 border-primary bg-card shadow-sm", HANDLE_POSITION[handle])}
              />
            ))}
        {locked ? null : (
          <span
            aria-hidden
            onPointerDown={(event) => begin({ kind: "rotate" }, event)}
            {...handlers}
            className="pointer-events-auto absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-[22px] cursor-grab rounded-full border-2 border-primary bg-card shadow-sm"
          />
        )}
      </div>
      {locked || !clip || dragging || moment === "outside" ? null : (
        <FloatingKeyButton
          transform={transform}
          frame={frameSize}
          on={moment === "key"}
          label={moment === "key" ? tk("remove") : tk("add")}
          onToggle={() => {
            noteMomentClick();
            editor.run((doc) => toggleSelectionMoment(doc, ids, editor.playheadMs()));
          }}
        />
      )}
    </>
  );
}
