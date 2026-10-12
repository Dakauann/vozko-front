"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { PixelLiveContext } from "@/components/studio/canvas/pixel-content";
import { canvasPoint } from "@/components/studio/canvas/vector/vector-style";
import { artboardById } from "@/lib/studio/artboards";
import type { Artboard, ImageDocument } from "@/lib/studio/document";
import { ellipsePoints, rectPoints, type PixelSelection, type SelectionCombine } from "@/lib/studio/pixel-selection";
import { isBrushTool } from "@/lib/studio/pixel-tools";
import { localViewport, worldToScreen, type Point, type Viewport } from "@/lib/studio/viewport";

import { useEditorUi, useImageEditor } from "../editor-state";
import type { StrokeRefusal, StrokeSession } from "../pixel-commands";

const ANT_DASH = 4;
const MIN_DRAG_PX = 3;

interface Draft {
  start: Point;
  current: Point;
  points: number[];
  combine: SelectionCombine;
  moved: boolean;
}

function screenPolygon(points: readonly number[], view: Viewport): string {
  const out: string[] = [];
  for (let i = 0; i + 1 < points.length; i += 2) {
    const at = worldToScreen(view, { x: points[i], y: points[i + 1] });
    out.push(`${i === 0 ? "M" : "L"}${at.x.toFixed(1)} ${at.y.toFixed(1)}`);
  }
  return out.length > 0 ? `${out.join(" ")} Z` : "";
}

export function PixelLiveProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const live = useEditorUi((s) => (enabled ? s.pixelLive : null));
  return <PixelLiveContext.Provider value={live}>{children}</PixelLiveContext.Provider>;
}

export function MarchingAnts({ path }: { path: string }) {
  return (
    <g pointerEvents="none" data-pixel-selection="">
      <path d={path} fill="none" stroke="#ffffff" strokeWidth={1} />
      <path d={path} fill="none" stroke="#111111" strokeWidth={1} strokeDasharray={`${ANT_DASH} ${ANT_DASH}`}>
        <animate attributeName="stroke-dashoffset" from="0" to={String(ANT_DASH * 2)} dur="0.6s" repeatCount="indefinite" />
      </path>
    </g>
  );
}

function selectionPath(selection: PixelSelection, home: Artboard, view: Viewport): string {
  const parts = selection.parts.map((part) => screenPolygon(part.points, view));
  if (selection.invert) parts.push(screenPolygon(rectPoints({ x: 0, y: 0 }, { x: home.canvas.width, y: home.canvas.height }), view));
  return parts.join(" ");
}

function draftShape(tool: "rect" | "ellipse" | "lasso", draft: Draft, at: Point): number[] {
  if (tool === "lasso") return [...draft.points, at.x, at.y];
  return tool === "rect" ? rectPoints(draft.start, at) : ellipsePoints(draft.start, at);
}

export function PixelOverlay({ viewport, document, active }: { viewport: Viewport; document: ImageDocument; active: Artboard }) {
  const t = useTranslations("studio.image.pixels");
  const { commands } = useImageEditor();
  const tool = useEditorUi((s) => s.pixelTool);
  const brush = useEditorUi((s) => s.brush);
  const selection = useEditorUi((s) => s.pixelSelection);
  const session = useRef<StrokeSession | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const [refusal, setRefusal] = useState<StrokeRefusal | null>(null);
  const view = localViewport(viewport, active);
  const home = selection ? artboardById(document, selection.artboardId) : undefined;

  if (!tool && !(selection && home)) return null;

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!tool || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = canvasPoint(event, event.currentTarget, view);
    if (isBrushTool(tool)) {
      const started = commands.pixel.startStroke(active.id, tool, event.pointerType === "pen");
      if (typeof started === "string") {
        setRefusal(started);
        return;
      }
      setRefusal(null);
      session.current = started;
      started.add(point, event.pressure);
      return;
    }
    const combine: SelectionCombine = event.shiftKey ? "add" : event.altKey ? "subtract" : "replace";
    setDraft({ start: point, current: point, points: [point.x, point.y], combine, moved: false });
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setHover({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    if (session.current) {
      const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
      for (const sample of samples.length > 0 ? samples : [event.nativeEvent]) session.current.add(canvasPoint(sample, event.currentTarget, view), sample.pressure);
      return;
    }
    if (!draft) return;
    const point = canvasPoint(event, event.currentTarget, view);
    const moved = draft.moved || Math.hypot(point.x - draft.start.x, point.y - draft.start.y) * view.scale > MIN_DRAG_PX;
    setDraft({ ...draft, moved, current: point, points: tool === "lasso" ? [...draft.points, point.x, point.y] : draft.points });
  };

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (session.current) {
      session.current.finish();
      session.current = null;
      return;
    }
    if (!draft || !tool || isBrushTool(tool)) return;
    setDraft(null);
    if (!draft.moved) {
      if (draft.combine === "replace") commands.pixel.deselect();
      return;
    }
    commands.pixel.selectShape(active.id, draftShape(tool, draft, canvasPoint(event, event.currentTarget, view)), draft.combine);
  };

  const onPointerCancel = () => {
    session.current?.cancel();
    session.current = null;
    setDraft(null);
  };

  const ringRadius = (brush.size / 2) * view.scale;
  const draftPath = draft && draft.moved && tool && !isBrushTool(tool) ? screenPolygon(draftShape(tool, draft, draft.current), view) : "";

  return (
    <>
      <svg
        data-pixel-tool={tool ?? ""}
        aria-label={tool ? t(`tools.${tool}`) : undefined}
        className="absolute inset-0 h-full w-full touch-none"
        style={{ pointerEvents: tool ? "auto" : "none", cursor: tool && isBrushTool(tool) ? "none" : "crosshair" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={() => setHover(null)}
      >
        {selection && home ? <MarchingAnts path={selectionPath(selection, home, localViewport(viewport, home))} /> : null}
        {draftPath ? <MarchingAnts path={draftPath} /> : null}
        {tool && isBrushTool(tool) && hover ? (
          <g pointerEvents="none" data-brush-ring="">
            <circle cx={hover.x} cy={hover.y} r={Math.max(1, ringRadius)} fill="none" stroke="#ffffff" strokeWidth={1.5} />
            <circle cx={hover.x} cy={hover.y} r={Math.max(1, ringRadius)} fill="none" stroke="#111111" strokeWidth={0.75} />
          </g>
        ) : null}
      </svg>
      {refusal ? (
        <p role="status" className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md bg-foreground/85 px-3 py-1.5 text-xs text-background">
          {t(`refusals.${refusal}`)}
        </p>
      ) : null}
    </>
  );
}
