"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslations } from "next-intl";

import type { CanvasSize, Layer } from "@/lib/studio/document";
import { isEditableTarget } from "@/lib/studio/keymap";
import type { LayerPatch } from "@/lib/studio/layers";
import { deleteNode, insertNode, mapSubpaths, moveHandle, moveNode, nearestOnPath, toggleSmooth, type HandleSide, type NodeRef, type Subpath } from "@/lib/studio/path-nodes";
import { canvasToUnit, layerSubpaths, refitPathLayer, unitToCanvas } from "@/lib/studio/vector-layer";
import { worldToScreen, type Point, type Viewport } from "@/lib/studio/viewport";

import { ANCHOR_PX, canvasPoint, HANDLE_PX, HIT_STROKE_PX, screenPath, VECTOR_INK, VECTOR_PAPER } from "./vector-style";

interface PathEditOverlayProps {
  layer: Layer;
  canvas: CanvasSize;
  view: Viewport;
  onBegin: () => void;
  onChange: (patch: LayerPatch) => void;
  onEnd: () => void;
  onExit: () => void;
}

type Grip = { kind: "node" } | { kind: "handle"; side: HandleSide };

interface DragSession {
  ref: NodeRef;
  grip: Grip;
  layer: Layer;
  subpaths: Subpath[];
  start: Point;
}

function sameRef(a: NodeRef | null, b: NodeRef): boolean {
  return a !== null && a.path === b.path && a.node === b.node;
}

function indexOf(subpaths: readonly Subpath[], ref: NodeRef): number {
  return subpaths.slice(0, ref.path).reduce((total, s) => total + s.nodes.length, 0) + ref.node + 1;
}

export function PathEditOverlay({ layer, canvas, view, onBegin, onChange, onEnd, onExit }: PathEditOverlayProps) {
  const t = useTranslations("studio.vectors.edit");
  const subpaths = useMemo(() => layerSubpaths(layer), [layer]);
  const [selected, setSelected] = useState<NodeRef | null>(null);
  const drag = useRef<DragSession | null>(null);
  const commit = (edited: Subpath[] | null, base: Layer = layer) => {
    if (!edited) return;
    const patch = refitPathLayer(base, edited, canvas);
    if (!patch) return;
    onBegin();
    onChange(patch);
    onEnd();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (event.key === "Escape" || event.key === "Enter") {
        event.preventDefault();
        onExit();
        return;
      }
      const chosen = selected;
      if ((event.key === "Delete" || event.key === "Backspace") && chosen) {
        event.preventDefault();
        const remaining = deleteNode(subpaths, chosen);
        if (!remaining) return;
        setSelected(null);
        const patch = refitPathLayer(layer, remaining, canvas);
        if (!patch) return;
        onBegin();
        onChange(patch);
        onEnd();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [layer, subpaths, selected, canvas, onBegin, onChange, onEnd, onExit]);

  const screenOf = (unit: Point) => worldToScreen(view, unitToCanvas(layer.transform, canvas, unit));
  const unitAt = (event: ReactPointerEvent<Element> | ReactMouseEvent<Element>, surface: Element, base: Layer) => canvasToUnit(base.transform, canvas, canvasPoint(event, surface, view));
  const surfaceOf = (element: Element) => element.closest("svg") ?? element;

  const begin = (event: ReactPointerEvent<SVGElement>, ref: NodeRef, grip: Grip) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelected(ref);
    drag.current = { ref, grip, layer, subpaths, start: canvasPoint(event, surfaceOf(event.currentTarget), view) };
    onBegin();
  };

  const move = (event: ReactPointerEvent<SVGElement>) => {
    const session = drag.current;
    if (!session) return;
    const surface = surfaceOf(event.currentTarget);
    const now = canvasPoint(event, surface, view);
    let edited: Subpath[];
    if (session.grip.kind === "node") {
      const dx = now.x - session.start.x;
      const dy = now.y - session.start.y;
      const target = event.shiftKey ? (Math.abs(dx) >= Math.abs(dy) ? { x: session.start.x + dx, y: session.start.y } : { x: session.start.x, y: session.start.y + dy }) : now;
      const from = canvasToUnit(session.layer.transform, canvas, session.start);
      const to = canvasToUnit(session.layer.transform, canvas, target);
      edited = moveNode(session.subpaths, session.ref, { x: to.x - from.x, y: to.y - from.y });
    } else {
      edited = moveHandle(session.subpaths, session.ref, session.grip.side, canvasToUnit(session.layer.transform, canvas, now), !event.altKey);
    }
    const patch = refitPathLayer(session.layer, edited, canvas);
    if (patch) onChange(patch);
  };

  const end = (event: ReactPointerEvent<SVGElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!drag.current) return;
    drag.current = null;
    onEnd();
  };

  const addNodeAt = (event: ReactMouseEvent<SVGPathElement>) => {
    event.stopPropagation();
    const hit = nearestOnPath(subpaths, unitAt(event, surfaceOf(event.currentTarget), layer));
    if (!hit) return;
    setSelected({ path: hit.path, node: hit.segment + 1 });
    commit(insertNode(subpaths, { path: hit.path, segment: hit.segment }, hit.t));
  };

  const onSurfaceDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.target === event.currentTarget) onExit();
  };

  const outline = screenPath(mapSubpaths(subpaths, (p) => unitToCanvas(layer.transform, canvas, p)), view);
  const handleRefs: { ref: NodeRef; side: HandleSide }[] = [];
  if (selected) {
    const path = subpaths[selected.path];
    const count = path?.nodes.length ?? 0;
    if (path && selected.node < count) {
      handleRefs.push({ ref: selected, side: "in" }, { ref: selected, side: "out" });
      const before = selected.node > 0 ? selected.node - 1 : path.closed ? count - 1 : -1;
      const after = selected.node < count - 1 ? selected.node + 1 : path.closed ? 0 : -1;
      if (before >= 0) handleRefs.push({ ref: { path: selected.path, node: before }, side: "out" });
      if (after >= 0) handleRefs.push({ ref: { path: selected.path, node: after }, side: "in" });
    }
  }

  return (
    <svg data-vector-tool="edit" className="absolute inset-0 h-full w-full touch-none" onPointerDown={onSurfaceDown}>
      <path d={outline} fill="none" stroke={VECTOR_INK} strokeWidth={1.5} pointerEvents="none" />
      <path d={outline} fill="none" stroke="transparent" strokeWidth={HIT_STROKE_PX} pointerEvents="stroke" style={{ cursor: "copy" }} onDoubleClick={addNodeAt} />
      {handleRefs.map(({ ref, side }) => {
        const node = subpaths[ref.path]?.nodes[ref.node];
        const handle = node?.[side];
        if (!node || !handle) return null;
        const anchor = screenOf(node);
        const tip = screenOf(handle);
        return (
          <g key={`${ref.path}-${ref.node}-${side}`}>
            <line x1={anchor.x} y1={anchor.y} x2={tip.x} y2={tip.y} stroke={VECTOR_INK} strokeWidth={1} pointerEvents="none" />
            <circle
              aria-label={t("handle", { index: indexOf(subpaths, ref) })}
              cx={tip.x}
              cy={tip.y}
              r={HANDLE_PX / 2}
              fill={VECTOR_PAPER}
              stroke={VECTOR_INK}
              strokeWidth={1.5}
              style={{ cursor: "move" }}
              onPointerDown={(event) => begin(event, ref, { kind: "handle", side })}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
            />
          </g>
        );
      })}
      {subpaths.map((path, p) =>
        path.nodes.map((node, n) => {
          const ref = { path: p, node: n };
          const at = screenOf(node);
          return (
            <rect
              key={`${p}-${n}`}
              aria-label={t("node", { index: indexOf(subpaths, ref) })}
              x={at.x - ANCHOR_PX / 2}
              y={at.y - ANCHOR_PX / 2}
              width={ANCHOR_PX}
              height={ANCHOR_PX}
              fill={sameRef(selected, ref) ? VECTOR_INK : VECTOR_PAPER}
              stroke={VECTOR_INK}
              strokeWidth={1.5}
              style={{ cursor: "move" }}
              onPointerDown={(event) => begin(event, ref, { kind: "node" })}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
              onDoubleClick={(event) => {
                event.stopPropagation();
                commit(toggleSmooth(subpaths, ref));
              }}
            />
          );
        }),
      )}
    </svg>
  );
}
