"use client";

import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslations } from "next-intl";

import { HANDLES, type Handle } from "@/lib/studio/clip-transform";
import { CENTER_ANCHOR, type CanvasSize, type Transform } from "@/lib/studio/document";
import { keyButtonPosition } from "@/lib/studio/motion-path";
import { anchorOf } from "@/lib/studio/clip-placement";
import { boxStyle } from "@/lib/studio/playback";
import { selectionMoment, toggleSelectionMoment } from "@/lib/studio/selection-edit";
import { findClip } from "@/lib/studio/timeline";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { useEditorState, useViewState } from "../editor-context";
import { KeyDiamond } from "../key-diamond";
import { noteMomentClick } from "../inspector/keyframe-coach";
import { useSelectionEditor } from "../inspector/use-selection-editor";
import { TOOLTIP_CLASS } from "../tool-button";
import { AnchorHandle } from "./anchor-handle";
import { MotionPathOverlay } from "./motion-path-overlay";
import type { TransformGesture } from "./transform-gesture";

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

interface SelectionFrameProps {
  clipId: string;
  transform: Transform;
  frameRef: React.RefObject<HTMLDivElement | null>;
  locked: boolean;
  gesture: TransformGesture;
}

export function SelectionFrame({ clipId, transform, frameRef, locked, gesture }: SelectionFrameProps) {
  const t = useTranslations("studio.video.preview");
  const tk = useTranslations("studio.video.keyframes");
  const clip = useEditorState((s) => findClip(s.document, clipId)?.clip ?? null);
  const playheadMs = useViewState((s) => s.playheadMs);
  const ids = useMemo(() => [clipId], [clipId]);
  const editor = useSelectionEditor(ids);
  const moment = clip ? selectionMoment([clip], playheadMs) : "outside";
  const frameSize = useFrameSize(frameRef);

  const grab = (kind: { kind: "resize"; handle: Handle } | { kind: "rotate" }) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => gesture.begin(clipId, { box: transform, anchor: clip ? anchorOf(clip) : CENTER_ANCHOR }, kind, event),
  });

  return (
    <>
      {clip ? <MotionPathOverlay clip={clip} frameRef={frameRef} locked={locked} editor={editor} /> : null}
      <div className="pointer-events-none absolute" style={{ ...boxStyle({ transform, opacity: 1, trackIndex: 900 }) }}>
        <div role="group" aria-label={t("selection")} data-locked={locked || undefined} className="absolute inset-0 outline outline-2 outline-primary" />
        {locked
          ? null
          : HANDLES.map((handle) => (
              <span
                key={handle}
                aria-hidden
                {...grab({ kind: "resize", handle })}
                className={cn("pointer-events-auto absolute h-2.5 w-2.5 rounded-[2px] border-2 border-primary bg-card shadow-sm", HANDLE_POSITION[handle])}
              />
            ))}
        {locked ? null : (
          <span
            aria-hidden
            {...grab({ kind: "rotate" })}
            className="pointer-events-auto absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-[22px] cursor-grab rounded-full border-2 border-primary bg-card shadow-sm"
          />
        )}
      </div>
      {locked || !clip || gesture.dragging ? null : <AnchorHandle clip={clip} placed={transform} frameRef={frameRef} editor={editor} />}
      {locked || !clip || gesture.dragging || moment === "outside" ? null : (
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
