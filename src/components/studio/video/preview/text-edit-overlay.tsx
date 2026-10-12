"use client";

import { useEffect } from "react";

import { RichTextEditor, type RichTextCounter } from "@/components/studio/canvas/rich-text-editor";
import { finalCounterValue, formatCounterNumber } from "@/lib/studio/counter";
import type { CanvasSize, Clip } from "@/lib/studio/document";
import { contentStretch, visualPlan, type VisualItem } from "@/lib/studio/playback";
import { findClip } from "@/lib/studio/timeline";
import type { ScreenRect } from "@/lib/studio/viewport";

import { useEditorState, useVideoEditor, useViewState } from "../editor-context";
import { reportSelection } from "../inspector/selection-notice";

export function withoutEditedText<T extends Pick<VisualItem, "clipId">>(items: readonly T[], clipId: string | null): T[] {
  return clipId ? items.filter((item) => item.clipId !== clipId) : [...items];
}

function counterOf(clip: Clip): RichTextCounter | undefined {
  const counter = clip.counter;
  if (!counter) return undefined;
  return { counter, number: formatCounterNumber(finalCounterValue(clip), counter.decimals, counter.locale, counter.grouping) };
}

export function VideoTextEditOverlay({ frame, canvas }: { frame: ScreenRect; canvas: CanvasSize }) {
  const { commands } = useVideoEditor();
  const clipId = useViewState((s) => s.editingTextClipId);
  const playheadMs = useViewState((s) => s.playheadMs);
  const document = useEditorState((s) => s.document);
  const found = clipId ? findClip(document, clipId) : null;
  const item = found ? visualPlan(document, playheadMs, 0).find((candidate) => candidate.clipId === clipId && candidate.active) : undefined;
  const layer = found?.clip.layer;
  const missing = clipId !== null && (!item || layer?.type !== "text");

  useEffect(() => {
    if (missing && clipId) commands.finishTextEdit(clipId);
  }, [missing, clipId, commands]);

  if (!clipId || !found || !item || !layer || missing) return null;
  const t = item.transform;
  const stretch = contentStretch(item);
  const box = {
    centerX: frame.left + t.x * frame.width,
    centerY: frame.top + t.y * frame.height,
    width: t.w * stretch.width * frame.width,
    height: t.h * stretch.height * frame.height,
    rotation: t.rotation,
    scaleX: stretch.scaleX,
    scaleY: stretch.scaleY,
  };
  return (
    <RichTextEditor
      key={clipId}
      layer={layer}
      box={box}
      fontScale={frame.height}
      surfaceHeight={canvas.height}
      counter={counterOf(found.clip)}
      onStyle={(patch) => {
        if (!commands.styleClipText(clipId, patch)) reportSelection("invalid");
      }}
      onDone={(edit) => commands.finishTextEdit(clipId, edit)}
    />
  );
}
