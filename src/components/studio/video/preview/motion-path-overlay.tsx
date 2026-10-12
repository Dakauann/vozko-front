"use client";

import { Fragment, useMemo } from "react";
import { useTranslations } from "next-intl";

import { ContextMenu, ContextMenuContent, ContextMenuLabel, ContextMenuRadioGroup, ContextMenuRadioItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { canvasAspect, type Clip } from "@/lib/studio/document";
import { KEY_TOLERANCE_MS } from "@/lib/studio/keyframe-edit";
import { framedPath, motionPath, movePathKeyPatch, pathHandlePoint, type PathKey } from "@/lib/studio/motion-path";
import { clipLookup, parentFrameOf, pointToLocal } from "@/lib/studio/parenting";
import { setHandleAt, setSpatialAt, type HandleSide, type MotionEdit } from "@/lib/studio/motion-edit";
import { SPATIAL_MODES, type SpatialMode } from "@/lib/studio/path-keys";
import type { PathPoint } from "@/lib/studio/position-path";
import { formatTimecode } from "@/lib/studio/timeline-view";
import { cn } from "@/lib/utils";

import { useEditorState, useVideoEditor, useViewState } from "../editor-context";
import type { SelectionEditor } from "../inspector/use-selection-editor";
import { usePointDrag } from "./point-drag";

interface MotionPathOverlayProps {
  clip: Clip;
  frameRef: React.RefObject<HTMLDivElement | null>;
  locked: boolean;
  editor: SelectionEditor;
}

const MENU_ITEM = "gap-2 text-xs focus:bg-accent-hover focus:text-foreground";

function patchOf(edit: MotionEdit) {
  return edit.ok ? edit.patch : null;
}

function dotsPath(dots: readonly PathPoint[]): string {
  return dots.map((dot) => `M${dot.x} ${dot.y}h0`).join("");
}

function visibleSides(index: number, count: number): HandleSide[] {
  return (["in", "out"] as const).filter((side) => (side === "in" ? index > 0 : index < count - 1));
}

export function MotionPathOverlay({ clip, frameRef, locked, editor }: MotionPathOverlayProps) {
  const t = useTranslations("studio.video.keyframes");
  const { playback } = useVideoEditor();
  const document = useEditorState((s) => s.document);
  const aspect = canvasAspect(document);
  const playheadMs = useViewState((s) => s.playheadMs);
  const localMs = playheadMs - clip.startMs;
  const frame = useMemo(() => parentFrameOf(clipLookup(document), clip, playheadMs, aspect), [document, clip, playheadMs, aspect]);
  const path = useMemo(() => {
    const local = motionPath(clip, aspect);
    return local ? framedPath(local, frame, aspect) : null;
  }, [clip, aspect, frame]);
  const drag = usePointDrag(frameRef);
  if (!path) return null;
  const inParent = (point: PathPoint) => pointToLocal(frame, point, aspect);

  const seek = (key: PathKey) => playback.seek(clip.startMs + key.atMs);
  const setSpatial = (key: PathKey, spatial: SpatialMode) => editor.patch((target) => patchOf(setSpatialAt(target, key.atMs, spatial, aspect)));

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 899 }}>
      <svg aria-hidden className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 1 1" preserveAspectRatio="none">
        <polyline points={path.points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <path d={dotsPath(path.dots)} fill="none" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity={0.55} />
        {path.curved
          ? path.keys.flatMap((key, index) =>
              visibleSides(index, path.keys.length).map((side) => {
                const tip = key[side]!;
                return <line key={`${key.atMs}-${side}`} x1={key.x} y1={key.y} x2={tip.x} y2={tip.y} stroke="hsl(var(--primary))" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity={key.spatial === "auto" ? 0.4 : 0.9} />;
              }),
            )
          : null}
      </svg>
      <div role="group" aria-label={t("pathLabel")}>
        {path.curved
          ? path.keys.flatMap((key, index) =>
              visibleSides(index, path.keys.length).map((side) => {
                const tip = key[side]!;
                const label = t(side === "in" ? "path.handleIn" : "path.handleOut", { time: formatTimecode(clip.startMs + key.atMs) });
                return (
                  <span
                    key={`${key.atMs}-${side}`}
                    aria-label={label}
                    title={label}
                    {...drag({
                      disabled: locked,
                      onMove: (point, event) => {
                        const local = inParent(point);
                        if (local) editor.patch((target) => patchOf(setHandleAt(target, key.atMs, side, pathHandlePoint(target, local), event.altKey, aspect)));
                      },
                    })}
                    className={cn("pointer-events-auto absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary bg-card", locked ? "cursor-default" : "cursor-crosshair", key.spatial === "auto" && "opacity-60")}
                    style={{ left: `${tip.x * 100}%`, top: `${tip.y * 100}%` }}
                  />
                );
              }),
            )
          : null}
        {path.keys.map((key) => {
          const current = Math.abs(key.atMs - localMs) <= KEY_TOLERANCE_MS;
          const label = t("pathPad", { time: formatTimecode(clip.startMs + key.atMs) });
          const pad = (
            <span
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-current={current || undefined}
              title={label}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                seek(key);
              }}
              {...drag({
                disabled: locked,
                onMove: (point) => {
                  const local = inParent(point);
                  if (local) editor.patch((target) => movePathKeyPatch(target, key.atMs, local.x, local.y));
                },
                onTap: () => seek(key),
              })}
              className={cn(
                "pointer-events-auto absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 border-2 border-primary shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                key.spatial === "linear" ? "rounded-none" : "rounded-[2px]",
                locked ? "cursor-pointer" : "cursor-move",
                current ? "bg-primary" : "bg-card",
              )}
              style={{ left: `${key.x * 100}%`, top: `${key.y * 100}%` }}
            />
          );
          if (!path.curved || locked) return <Fragment key={key.atMs}>{pad}</Fragment>;
          return (
            <ContextMenu key={key.atMs}>
              <ContextMenuTrigger asChild>{pad}</ContextMenuTrigger>
              <ContextMenuContent className="w-52 border-border-strong">
                <ContextMenuLabel className="text-2xs text-muted-foreground">{t("path.spatialMenu")}</ContextMenuLabel>
                <ContextMenuRadioGroup value={key.spatial ?? "auto"} onValueChange={(value) => setSpatial(key, value as SpatialMode)}>
                  {SPATIAL_MODES.map((mode) => (
                    <ContextMenuRadioItem key={mode} value={mode} className={MENU_ITEM}>
                      {t(`path.spatial.${mode}`)}
                    </ContextMenuRadioItem>
                  ))}
                </ContextMenuRadioGroup>
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
      </div>
    </div>
  );
}
