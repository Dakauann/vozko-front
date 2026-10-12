"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { boxPointAt, framePointOf } from "@/lib/studio/clip-placement";
import { worldPlacementIn } from "@/lib/studio/parenting";
import { canvasAspect } from "@/lib/studio/document";
import { localTime } from "@/lib/studio/keyframe-edit";
import { visualPlan } from "@/lib/studio/playback";
import { findClip } from "@/lib/studio/timeline";
import { updateClipVfx, vfxSelectionEdit } from "@/lib/studio/vfx-edit";
import { pointPatch, vfxFrame, vfxPoints } from "@/lib/studio/vfx-points";

import { useEditorState, useViewState } from "../editor-context";
import { useSelectionEditor } from "../inspector/use-selection-editor";
import { VfxGlyph } from "../vfx-glyph";
import { usePointDrag } from "./point-drag";

interface VfxHandlesProps {
  clipId: string;
  frameRef: React.RefObject<HTMLDivElement | null>;
}

export function VfxHandles({ clipId, frameRef }: VfxHandlesProps) {
  const t = useTranslations("studio.video.vfx");
  const document = useEditorState((s) => s.document);
  const playheadMs = useViewState((s) => s.playheadMs);
  const ids = useMemo(() => [clipId], [clipId]);
  const editor = useSelectionEditor(ids);
  const drag = usePointDrag(frameRef);
  const found = findClip(document, clipId);
  if (!found || found.track.locked || !visualPlan(document, playheadMs, 0).some((item) => item.clipId === clipId && item.active)) return null;
  const { clip } = found;
  const aspect = canvasAspect(document);
  const localMs = playheadMs - clip.startMs;
  const frame = vfxFrame(clip, worldPlacementIn(document, clip, localMs));

  return (
    <>
      {vfxPoints(clip.vfx ?? [], localMs).map((point) => {
        const at = framePointOf(frame, point, aspect);
        const label = t("movePoint", { kind: t(`kinds.${point.kind}`) });
        const handlers = drag({
          disabled: false,
          onMove: (moved) => {
            editor.run((doc) => vfxSelectionEdit(updateClipVfx(doc, clipId, point.id, pointPatch(point.kind, boxPointAt(frame, moved, aspect)), localTime(clip, editor.playheadMs()))));
          },
        });
        return (
          <span
            key={point.id}
            aria-hidden
            title={label}
            data-studio-vfx-point={point.id}
            {...handlers}
            className="pointer-events-auto absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 cursor-move items-center justify-center rounded-full border-2 border-primary bg-card/80 shadow-sm"
            style={{ left: `${at.x * 100}%`, top: `${at.y * 100}%`, zIndex: 903 }}
          >
            <VfxGlyph kind={point.kind} className="h-3 w-3.5" />
          </span>
        );
      })}
    </>
  );
}
