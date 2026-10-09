"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { isEditableTarget } from "@/lib/studio/keymap";
import type { Subpath } from "@/lib/studio/path-nodes";
import { constrainAngle, EMPTY_PEN, penDrag, penFinish, penPress, penUndo, type PenDraft } from "@/lib/studio/pen";
import { worldToScreen, type Point, type Viewport } from "@/lib/studio/viewport";

import { ANCHOR_PX, canvasPoint, CLOSE_RADIUS_PX, DRAG_START_PX, HANDLE_PX, screenPath, VECTOR_INK, VECTOR_PAPER } from "./vector-style";

interface PenOverlayProps {
  view: Viewport;
  onCreate: (subpath: Subpath) => void;
  onCancel: () => void;
}

export function PenOverlay({ view, onCreate, onCancel }: PenOverlayProps) {
  const [draft, setDraft] = useState<PenDraft>(EMPTY_PEN);
  const [pointer, setPointer] = useState<Point | null>(null);
  const pressed = useRef<{ at: Point; dragging: boolean } | null>(null);
  useEffect(() => {
    const finish = () => {
      const subpath = penFinish(draft);
      setDraft(EMPTY_PEN);
      if (subpath) onCreate(subpath);
      else onCancel();
    };
    const onKey = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (event.key === "Enter" || event.key === "Escape") {
        event.preventDefault();
        finish();
      } else if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        setDraft((current) => penUndo(current));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draft, onCreate, onCancel]);

  const placed = (event: ReactPointerEvent<SVGSVGElement>): Point => {
    const point = canvasPoint(event, event.currentTarget, view);
    const last = draft.nodes[draft.nodes.length - 1];
    return event.shiftKey && last ? constrainAngle(last, point) : point;
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = placed(event);
    const result = penPress(draft, point, CLOSE_RADIUS_PX / view.scale);
    pressed.current = { at: point, dragging: false };
    if (!result.finished) {
      setDraft(result.draft);
      return;
    }
    const subpath = penFinish(result.draft);
    setDraft(EMPTY_PEN);
    if (subpath) onCreate(subpath);
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const point = canvasPoint(event, event.currentTarget, view);
    setPointer(point);
    const press = pressed.current;
    if (!press) return;
    if (!press.dragging && Math.hypot(point.x - press.at.x, point.y - press.at.y) * view.scale < DRAG_START_PX) return;
    press.dragging = true;
    setDraft((current) => penDrag(current, event.shiftKey ? constrainAngle(press.at, point) : point, event.altKey));
  };

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    pressed.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const screen = (p: Point) => worldToScreen(view, p);
  const last = draft.nodes[draft.nodes.length - 1];
  const first = draft.nodes[0];
  const nearFirst = Boolean(pointer && first && draft.nodes.length >= 2 && Math.hypot(pointer.x - first.x, pointer.y - first.y) * view.scale <= CLOSE_RADIUS_PX);

  return (
    <svg
      data-vector-tool="pen"
      className="absolute inset-0 h-full w-full touch-none"
      style={{ cursor: "crosshair" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => setPointer(null)}
    >
      {draft.nodes.length > 1 ? <path d={screenPath([{ closed: false, nodes: draft.nodes }], view)} fill="none" stroke={VECTOR_INK} strokeWidth={1.5} /> : null}
      {last && pointer ? (
        <line x1={screen(last.out ?? last).x} y1={screen(last.out ?? last).y} x2={screen(pointer).x} y2={screen(pointer).y} stroke={VECTOR_INK} strokeWidth={1} strokeDasharray="4 3" pointerEvents="none" />
      ) : null}
      {last?.in || last?.out
        ? [last.in, last.out].map((handle, i) =>
            handle ? (
              <g key={i} pointerEvents="none">
                <line x1={screen(last).x} y1={screen(last).y} x2={screen(handle).x} y2={screen(handle).y} stroke={VECTOR_INK} strokeWidth={1} />
                <circle cx={screen(handle).x} cy={screen(handle).y} r={HANDLE_PX / 2} fill={VECTOR_PAPER} stroke={VECTOR_INK} strokeWidth={1.5} />
              </g>
            ) : null,
          )
        : null}
      {draft.nodes.map((node, i) => {
        const at = screen(node);
        const highlight = i === 0 && nearFirst;
        return (
          <rect
            key={i}
            x={at.x - ANCHOR_PX / 2}
            y={at.y - ANCHOR_PX / 2}
            width={ANCHOR_PX}
            height={ANCHOR_PX}
            fill={highlight || i === draft.nodes.length - 1 ? VECTOR_INK : VECTOR_PAPER}
            stroke={VECTOR_INK}
            strokeWidth={1.5}
            pointerEvents="none"
          />
        );
      })}
    </svg>
  );
}
