"use client";

import { useMemo } from "react";

import { perceptionShapes } from "@/lib/studio/agent/look-reports";
import { videoSceneAt } from "@/lib/studio/agent/scene";
import { videoCanvasSize } from "@/lib/studio/document";

import { PerceptionShapes } from "../../agent/perception-shapes";
import { measureText } from "../../agent/text-measure";
import { useEditorState, useViewState } from "../editor-context";

export function VideoPerceptionOverlay() {
  const depth = useViewState((s) => s.depthOverlay);
  const layout = useViewState((s) => s.layoutOverlay);
  const playheadMs = useViewState((s) => s.playheadMs);
  const document = useEditorState((s) => s.document);
  const shapes = useMemo(() => (depth || layout ? perceptionShapes(videoSceneAt(document, playheadMs), { depth, layout }, measureText) : []), [document, playheadMs, depth, layout]);
  if (shapes.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 870 }}>
      <PerceptionShapes shapes={shapes} size={videoCanvasSize(document)} />
    </div>
  );
}
