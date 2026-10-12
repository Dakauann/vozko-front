"use client";

import { useTranslations } from "next-intl";

import { anchorAt, anchorOf, placedPivot } from "@/lib/studio/clip-placement";
import { CENTER_ANCHOR, canvasAspect, type Clip, type Transform } from "@/lib/studio/document";

import { useEditorState } from "../editor-context";
import type { SelectionEditor } from "../inspector/use-selection-editor";
import { usePointDrag } from "./point-drag";

interface AnchorHandleProps {
  clip: Clip;
  placed: Transform;
  frameRef: React.RefObject<HTMLDivElement | null>;
  editor: SelectionEditor;
}

export function AnchorHandle({ clip, placed, frameRef, editor }: AnchorHandleProps) {
  const t = useTranslations("studio.video.preview");
  const aspect = useEditorState((s) => canvasAspect(s.document));
  const drag = usePointDrag(frameRef);
  const anchor = anchorOf(clip);
  const pivot = placedPivot(placed, anchor, aspect);
  const handlers = drag({
    disabled: false,
    onMove: (point, event) => {
      editor.anchor(() => anchorAt(placed, point, aspect), !event.altKey);
    },
  });

  return (
    <span
      aria-hidden
      title={t("anchor")}
      data-studio-anchor
      {...handlers}
      onDoubleClick={(event) => {
        event.stopPropagation();
        editor.anchor(() => CENTER_ANCHOR, true);
      }}
      className="pointer-events-auto absolute flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-move items-center justify-center rounded-full border-2 border-primary bg-card/60 shadow-sm"
      style={{ left: `${pivot.x * 100}%`, top: `${pivot.y * 100}%`, zIndex: 901 }}
    >
      <span className="absolute h-px w-[22px] bg-primary" />
      <span className="absolute h-[22px] w-px bg-primary" />
    </span>
  );
}
