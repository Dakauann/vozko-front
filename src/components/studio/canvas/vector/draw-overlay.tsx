"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { freehandSubpath } from "@/lib/studio/freehand";
import type { Subpath } from "@/lib/studio/path-nodes";
import { worldToScreen, type Point, type Viewport } from "@/lib/studio/viewport";

import { canvasPoint, DRAW_CLOSE_PX, DRAW_TOLERANCE_PX, VECTOR_INK } from "./vector-style";

interface DrawOverlayProps {
  view: Viewport;
  onCreate: (subpath: Subpath) => void;
}

export function DrawOverlay({ view, onCreate }: DrawOverlayProps) {
  const stroke = useRef<Point[] | null>(null);
  const [trail, setTrail] = useState<Point[]>([]);

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = canvasPoint(event, event.currentTarget, view);
    stroke.current = [point];
    setTrail([point]);
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const points = stroke.current;
    if (!points) return;
    points.push(canvasPoint(event, event.currentTarget, view));
    setTrail([...points]);
  };

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const points = stroke.current;
    stroke.current = null;
    setTrail([]);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!points) return;
    const subpath = freehandSubpath(points, { tolerance: DRAW_TOLERANCE_PX / view.scale, closeDistance: DRAW_CLOSE_PX / view.scale });
    if (subpath) onCreate(subpath);
  };

  return (
    <svg
      data-vector-tool="draw"
      className="absolute inset-0 h-full w-full touch-none"
      style={{ cursor: "crosshair" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {trail.length > 1 ? (
        <polyline
          points={trail.map((p) => worldToScreen(view, p)).map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke={VECTOR_INK}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      ) : null}
    </svg>
  );
}
