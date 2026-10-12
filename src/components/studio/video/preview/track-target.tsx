"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useFormatter, useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { localAtSource } from "@/lib/studio/clip-time";
import { canvasAspect } from "@/lib/studio/document";
import { TRACKER_LIMITS } from "@/lib/studio/point-track";
import type { PathPoint } from "@/lib/studio/position-path";
import { findClip } from "@/lib/studio/timeline";
import { TRACK_DIRECTIONS } from "@/lib/studio/tracking/track-run";
import { cn } from "@/lib/utils";

import { useEditorState, useVideoEditor, useViewState } from "../editor-context";

const DRAG_START_PX = 4;

interface Aim {
  start: PathPoint;
  startPx: PathPoint;
  size: number;
  dragged: boolean;
}

function clampSize(size: number): number {
  return Math.min(TRACKER_LIMITS.size[1], Math.max(TRACKER_LIMITS.size[0], size));
}

export function TrackTarget({ frameRef }: { frameRef: React.RefObject<HTMLDivElement | null> }) {
  const t = useTranslations("studio.video.tracking");
  const format = useFormatter();
  const { commands } = useVideoEditor();
  const tool = useViewState((s) => s.trackTool);
  const aspect = useEditorState((s) => canvasAspect(s.document));
  const clip = useEditorState((s) => (tool ? (findClip(s.document, tool.clipId)?.clip ?? null) : null));
  const aim = useRef<Aim | null>(null);
  const [draft, setDraft] = useState<{ point: PathPoint; size: number } | null>(null);

  useEffect(() => {
    if (!tool) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") commands.cancelTracking();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tool, commands]);

  if (!tool) return null;
  const running = tool.progress !== null;
  const shown = draft ?? (tool.point ? { point: tool.point, size: tool.size } : null);

  const locate = (event: ReactPointerEvent<HTMLDivElement>): PathPoint | null => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  };

  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (running || event.button !== 0) return;
    event.stopPropagation();
    const point = locate(event);
    if (!point) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    aim.current = { start: point, startPx: { x: event.clientX, y: event.clientY }, size: tool.size, dragged: false };
    setDraft({ point, size: tool.size });
  };

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = aim.current;
    const point = locate(event);
    if (!current || !point) return;
    if (!current.dragged && Math.hypot(event.clientX - current.startPx.x, event.clientY - current.startPx.y) < DRAG_START_PX) return;
    current.dragged = true;
    current.size = clampSize(2 * Math.max(Math.abs(point.x - current.start.x) * aspect, Math.abs(point.y - current.start.y)));
    setDraft({ point: current.start, size: current.size });
  };

  const up = () => {
    const current = aim.current;
    aim.current = null;
    setDraft(null);
    if (current) commands.aimTracking(current.start, current.size);
  };

  const loss = tool.pending?.kind === "tracked" ? tool.pending.loss : null;
  const lostAt = loss && clip ? (clip.startMs + Math.max(0, localAtSource(clip, loss.atMs))) / 1000 : null;

  return (
    <div className="absolute inset-0" style={{ zIndex: 900 }} data-track-target={tool.clipId}>
      <div
        className={cn("absolute inset-0 bg-black/10", running ? "cursor-progress" : "cursor-crosshair")}
        data-track-aim
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
      {shown ? (
        <div
          aria-hidden
          data-track-box
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 border-2 border-primary shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
          style={{ left: `${shown.point.x * 100}%`, top: `${shown.point.y * 100}%`, width: `${(shown.size / aspect) * 100}%`, height: `${shown.size * 100}%` }}
        >
          <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
        </div>
      ) : null}
      <div className="absolute left-1/2 top-2 flex max-w-[95%] -translate-x-1/2 flex-wrap items-center gap-1 rounded-md border bg-background/95 p-1.5 text-xs shadow-md" onPointerDown={(event) => event.stopPropagation()}>
        {running ? (
          <>
            <span>{t("tracking")}</span>
            <div role="progressbar" aria-label={t("tracking")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((tool.progress ?? 0) * 100)} className="h-1.5 w-28 overflow-hidden rounded bg-muted">
              <div className="h-full bg-primary transition-[width]" style={{ width: `${(tool.progress ?? 0) * 100}%` }} />
            </div>
            <Button variant="ghost" size="sm" title={t("cancel")} onClick={() => commands.cancelTracking()} />
          </>
        ) : loss ? (
          <>
            <span className="text-destructive">{t("lostNotice", { at: format.number(lostAt ?? 0, { maximumFractionDigits: 2 }), confidence: format.number(loss.confidence, { style: "percent", maximumFractionDigits: 0 }) })}</span>
            <Button variant="outline" size="sm" title={t("keepPartial")} onClick={() => commands.keepLostTrack()} />
            <Button variant="ghost" size="sm" title={t("cancel")} onClick={() => commands.cancelTracking()} />
          </>
        ) : (
          <>
            <span className="text-muted-foreground">{tool.point ? t("readyHint") : t("aimHint")}</span>
            {TRACK_DIRECTIONS.map((direction) => (
              <Button key={direction} variant={tool.direction === direction ? "outline" : "ghost"} size="sm" aria-pressed={tool.direction === direction} title={t(`direction.${direction}`)} onClick={() => commands.setTrackDirection(direction)} />
            ))}
            <Button variant="primary" size="sm" disabled={!tool.point} title={t("run")} onClick={() => void commands.runTracking()} />
            <Button variant="ghost" size="sm" title={t("cancel")} onClick={() => commands.cancelTracking()} />
          </>
        )}
      </div>
    </div>
  );
}
