"use client";

import { useEffect, useMemo, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { videoCanvasSize, type CanvasSize, type Clip, type VideoDocument } from "@/lib/studio/document";
import { keyAt, morphValue } from "@/lib/studio/keyframe-edit";
import { morphFramesOf } from "@/lib/studio/keyframes";
import { maskSelectionEdit, setClipMaskPathVertex, toggleClipMaskPathKey, updateClipMask } from "@/lib/studio/mask-edit";
import { maskAt } from "@/lib/studio/masks";
import { editClipPath, morphSelectionEdit, setFirstVertex, togglePathKey } from "@/lib/studio/morph-edit";
import type { VertexPin } from "@/lib/studio/morph-keys";
import { frameToUnit, maskBox, pathFrameOf, unitToFrame, type PathFrame } from "@/lib/studio/path-frame";
import { flattenSegment, moveHandle, moveNode, pathToSubpaths, segmentCount, subpathsToPath, type HandleSide, type NodeRef, type Subpath } from "@/lib/studio/path-nodes";
import { vertexIndex } from "@/lib/studio/path-morph";
import { worldPlacementIn } from "@/lib/studio/parenting";
import type { PathPoint } from "@/lib/studio/position-path";
import type { SelectionEdit } from "@/lib/studio/selection-edit";
import { useSelectionEditor } from "../inspector/use-selection-editor";
import { findClip } from "@/lib/studio/timeline";
import { cn } from "@/lib/utils";

import { useEditorState, useVideoEditor, useViewState } from "../editor-context";
import type { PathEditTarget } from "../view-store";
import { usePointDrag } from "./point-drag";

const FLATTEN_STEP = 0.01;

interface PathTarget {
  path: string;
  frame: PathFrame;
  pin: VertexPin | null;
  write: (doc: VideoDocument, path: string) => SelectionEdit;
  pinAt: (doc: VideoDocument, pin: VertexPin) => SelectionEdit;
}

function overlayTarget(doc: VideoDocument, clip: Clip, localMs: number, canvas: CanvasSize): PathTarget | null {
  if (clip.type !== "overlay" || clip.layer?.type !== "shape" || clip.layer.shape !== "path") return null;
  const keyed = keyAt(morphFramesOf(clip.keyframes), localMs);
  return {
    path: morphValue(clip, localMs),
    frame: pathFrameOf(worldPlacementIn(doc, clip, localMs), canvas, clip.layer.transform),
    pin: keyed?.firstVertex ?? null,
    write: (current, path) => morphSelectionEdit(editClipPath(current, clip.id, path, localMs)),
    pinAt: (current, pin) => {
      const keyedNow = findClip(current, clip.id)?.clip;
      const start = keyedNow && keyAt(morphFramesOf(keyedNow.keyframes), localMs) ? { ok: true as const, document: current } : togglePathKey(current, clip.id, localMs);
      if (!start.ok) return morphSelectionEdit(start);
      const key = keyAt(morphFramesOf(findClip(start.document, clip.id)!.clip.keyframes), localMs)!;
      return morphSelectionEdit(setFirstVertex(start.document, clip.id, key.atMs, pin));
    },
  };
}

function maskTarget(doc: VideoDocument, clip: Clip, maskId: string, localMs: number, canvas: CanvasSize): PathTarget | null {
  const mask = clip.masks?.find((entry) => entry.id === maskId);
  if (!mask || mask.shape !== "path") return null;
  const shown = maskAt(mask, localMs);
  const keyed = mask.keyframes?.path?.find((frame) => frame.atMs === localMs);
  return {
    path: shown.path ?? "",
    frame: pathFrameOf(worldPlacementIn(doc, clip, localMs), canvas, maskBox(shown)),
    pin: keyed?.firstVertex ?? null,
    write: (current, path) => maskSelectionEdit(updateClipMask(current, clip.id, maskId, { path }, localMs)),
    pinAt: (current, pin) => {
      const present = findClip(current, clip.id)?.clip.masks?.find((entry) => entry.id === maskId)?.keyframes?.path?.some((frame) => frame.atMs === localMs);
      const start = present ? { ok: true as const, document: current } : toggleClipMaskPathKey(current, clip.id, maskId, localMs);
      if (!start.ok) return maskSelectionEdit(start);
      return maskSelectionEdit(setClipMaskPathVertex(start.document, clip.id, maskId, localMs, pin));
    },
  };
}

function targetOf(doc: VideoDocument, edit: PathEditTarget, playheadMs: number): PathTarget | null {
  const found = findClip(doc, edit.clipId);
  if (!found || found.track.locked) return null;
  const { clip } = found;
  const localMs = Math.round(playheadMs - clip.startMs);
  if (localMs < 0 || localMs > clip.durationMs) return null;
  const canvas = videoCanvasSize(doc);
  return edit.maskId ? maskTarget(doc, clip, edit.maskId, localMs, canvas) : overlayTarget(doc, clip, localMs, canvas);
}

function outline(subpaths: readonly Subpath[], frame: PathFrame): string {
  return subpaths
    .map((subpath) => {
      if (subpath.nodes.length === 0) return "";
      const points = [subpath.nodes[0], ...Array.from({ length: segmentCount(subpath) }, (_, s) => flattenSegment(subpath, s, FLATTEN_STEP)).flat()].map((point) => unitToFrame(frame, point));
      return `M${points.map((point) => `${point.x} ${point.y}`).join(" L")}${subpath.closed ? " Z" : ""}`;
    })
    .join(" ");
}

function percent(point: PathPoint): { left: string; top: string } {
  return { left: `${point.x * 100}%`, top: `${point.y * 100}%` };
}

export function PathKeyOverlay({ clipId, frameRef }: { clipId: string; frameRef: React.RefObject<HTMLDivElement | null> }) {
  const t = useTranslations("studio.video.morph");
  const { view } = useVideoEditor();
  const edit = useViewState((s) => (s.pathEdit?.clipId === clipId ? s.pathEdit : null));
  const ids = useMemo(() => (edit ? [edit.clipId] : []), [edit]);
  const editor = useSelectionEditor(ids);
  const playheadMs = useViewState((s) => s.playheadMs);
  const document = useEditorState((s) => s.document);
  const drag = usePointDrag(frameRef);

  useEffect(() => {
    if (!edit) return;
    const leave = (event: KeyboardEvent) => {
      if (event.key === "Escape") view.setState({ pathEdit: null });
    };
    window.addEventListener("keydown", leave);
    return () => window.removeEventListener("keydown", leave);
  }, [edit, view]);

  const target = edit ? targetOf(document, edit, playheadMs) : null;
  if (!edit || !target) return null;
  const subpaths = pathToSubpaths(target.path);
  const pinned = target.pin ? vertexIndex(target.path, target.pin) : null;

  const apply = (change: (doc: VideoDocument, current: PathTarget) => SelectionEdit) =>
    editor.run((doc) => {
      const current = targetOf(doc, edit, editor.playheadMs());
      return current ? change(doc, current) : { ok: false, reason: "invalid" };
    });
  const reshape = (build: (current: Subpath[], frame: PathFrame) => Subpath[]) => apply((doc, current) => current.write(doc, subpathsToPath(build(pathToSubpaths(current.path), current.frame))));

  const nodes = subpaths.flatMap((subpath, p) => subpath.nodes.map((node, n) => ({ ref: { path: p, node: n } as NodeRef, node }))).map((entry, index) => ({ ...entry, index }));

  const handleSpan = (ref: NodeRef, side: HandleSide, tip: PathPoint, number: number) => (
    <span
      key={`${ref.path}-${ref.node}-${side}`}
      title={t(side === "in" ? "handleIn" : "handleOut", { index: number })}
      aria-label={t(side === "in" ? "handleIn" : "handleOut", { index: number })}
      {...drag({
        disabled: false,
        onMove: (point, event: ReactPointerEvent<HTMLElement>) => reshape((current, frame) => moveHandle(current, ref, side, frameToUnit(frame, point), !event.altKey)),
      })}
      className="pointer-events-auto absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 cursor-crosshair rounded-full border border-primary bg-card"
      style={{ ...percent(unitToFrame(target.frame, tip)), zIndex: 905 }}
    />
  );

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 904 }} role="group" aria-label={t("overlay")}>
      <svg aria-hidden className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 1 1" preserveAspectRatio="none">
        <path d={outline(subpaths, target.frame)} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {nodes.flatMap(({ ref, node }) =>
          (["in", "out"] as const).flatMap((side) => {
            const tip = node[side];
            if (!tip) return [];
            const from = unitToFrame(target.frame, node);
            const to = unitToFrame(target.frame, tip);
            return [<line key={`${ref.path}-${ref.node}-${side}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="hsl(var(--primary))" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity={0.7} />];
          }),
        )}
      </svg>
      {nodes.flatMap(({ ref, node, index: number }) => (["in", "out"] as const).flatMap((side) => (node[side] ? [handleSpan(ref, side, node[side]!, number + 1)] : [])))}
      {nodes.map(({ ref, node, index: number }) => {
        const label = t("node", { index: number + 1 });
        const first = pinned === number;
        return (
          <span
            key={`${ref.path}-${ref.node}`}
            role="button"
            tabIndex={0}
            title={`${label}. ${t("nodeHint")}`}
            aria-label={label}
            aria-pressed={first}
            data-studio-path-node={number}
            onDoubleClick={(event) => {
              event.stopPropagation();
              apply((doc, current) => current.pinAt(doc, { x: node.x, y: node.y }));
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              apply((doc, current) => current.pinAt(doc, { x: node.x, y: node.y }));
            }}
            {...drag({
              disabled: false,
              onMove: (point) =>
                reshape((current, frame) => {
                  const moved = frameToUnit(frame, point);
                  const at = current[ref.path]?.nodes[ref.node];
                  return at ? moveNode(current, ref, { x: moved.x - at.x, y: moved.y - at.y }) : current;
                }),
            })}
            className={cn(
              "pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 cursor-move rounded-[2px] border-2 border-primary shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              first ? "h-3.5 w-3.5 bg-primary" : "h-2.5 w-2.5 bg-card",
            )}
            style={{ ...percent(unitToFrame(target.frame, node)), zIndex: 906 }}
          />
        );
      })}
      <div className="pointer-events-auto absolute left-2 top-2 flex max-w-[16rem] items-center gap-2 rounded-md border border-border-strong bg-card/95 px-2 py-1.5 text-2xs text-foreground shadow-sm" style={{ zIndex: 907 }}>
        <span className="min-w-0 flex-1">{t("editHint")}</span>
        <Button variant="primary" size="sm" title={t("done")} onClick={() => view.setState({ pathEdit: null })} />
      </div>
    </div>
  );
}
