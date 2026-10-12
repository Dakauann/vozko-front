"use client";

import { sceneLens, tiltMatrix } from "@/lib/studio/clip-tilt";
import { videoCanvasSize } from "@/lib/studio/document";
import { projectHomography } from "@/lib/studio/perspective";
import { visualPlan } from "@/lib/studio/playback";

import { useEditorState, useViewState } from "../editor-context";

const CORNERS = [
  [-0.5, -0.5],
  [0.5, -0.5],
  [0.5, 0.5],
  [-0.5, 0.5],
] as const;

export function TiltOutlines() {
  const document = useEditorState((s) => s.document);
  const selection = useEditorState((s) => s.selection);
  const playheadMs = useViewState((s) => s.playheadMs);
  const canvas = videoCanvasSize(document);
  const lens = sceneLens(document.canvas, canvas);
  const items = visualPlan(document, playheadMs, 0).filter((item) => item.active && item.tilt && selection.includes(item.clipId));
  if (items.length === 0) return null;
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${canvas.width} ${canvas.height}`} preserveAspectRatio="none" style={{ zIndex: 860 }}>
      {items.map((item) => {
        const t = item.transform;
        const box = { x: t.x * canvas.width, y: t.y * canvas.height, width: t.w * canvas.width, height: t.h * canvas.height, rotation: t.rotation };
        const matrix = tiltMatrix(lens, box, item.tilt!);
        const turn = (t.rotation * Math.PI) / 180;
        const corners = CORNERS.map(([u, v]) => {
          const ox = u * box.width;
          const oy = v * box.height;
          return projectHomography(matrix, { x: box.x + ox * Math.cos(turn) - oy * Math.sin(turn), y: box.y + ox * Math.sin(turn) + oy * Math.cos(turn) });
        });
        if (corners.some((corner) => corner === null)) return null;
        return <polygon key={item.clipId} data-tilt-outline={item.clipId} points={corners.map((corner) => `${corner!.x},${corner!.y}`).join(" ")} fill="none" stroke="currentColor" strokeDasharray="6 4" vectorEffect="non-scaling-stroke" className="text-primary" />;
      })}
    </svg>
  );
}
