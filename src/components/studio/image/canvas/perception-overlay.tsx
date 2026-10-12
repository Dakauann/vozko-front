"use client";

import { useMemo } from "react";

import { perceivedSurface } from "@/lib/studio/components";
import { perceptionShapes } from "@/lib/studio/agent/look-reports";
import { imageScene } from "@/lib/studio/agent/scene";

import { PerceptionShapes } from "../../agent/perception-shapes";
import { measureText } from "../../agent/text-measure";
import { useEditorUi, useImageDoc } from "../editor-state";

export function PerceptionOverlay() {
  const depth = useEditorUi((s) => s.depthOverlay);
  const layout = useEditorUi((s) => s.layoutOverlay);
  const viewport = useEditorUi((s) => s.viewport);
  const document = useImageDoc((s) => s.document);
  const boards = useMemo(() => (depth || layout ? document.artboards.map((artboard) => ({ artboard, shapes: perceptionShapes(imageScene(perceivedSurface(document, artboard)), { depth, layout }, measureText) })) : []), [document, depth, layout]);
  return (
    <>
      {boards.map(({ artboard, shapes }) => (
        <div
          key={artboard.id}
          className="pointer-events-none absolute"
          style={{ left: viewport.x + artboard.x * viewport.scale, top: viewport.y + artboard.y * viewport.scale, width: artboard.canvas.width * viewport.scale, height: artboard.canvas.height * viewport.scale }}
        >
          <PerceptionShapes shapes={shapes} size={artboard.canvas} />
        </div>
      ))}
    </>
  );
}
