"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslations } from "next-intl";

import { topmostAt } from "@/lib/studio/clip-transform";
import { videoCanvasSize, type CanvasSize } from "@/lib/studio/document";
import { animatedTransform } from "@/lib/studio/keyframes";
import { fitFrame, focusedPlan, visualPlan, zoomAround, type VisualItem } from "@/lib/studio/playback";
import { findClip, isClipPickable } from "@/lib/studio/timeline";

import { useEditorState, useVideoEditor, useViewState } from "../editor-context";
import { gpuRenderingWanted } from "@/components/studio/render/gpu-preference";

import { GpuStage } from "./gpu-stage";
import { OverlayStage } from "./overlay-stage";
import { PreviewMedia } from "./preview-media";
import { SelectionFrame } from "./selection-frame";
import { Transport } from "./transport";

function useElementSize(ref: React.RefObject<HTMLElement | null>): CanvasSize {
  const [size, setSize] = useState<CanvasSize>({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

function overlayGroups(items: VisualItem[]): [number, VisualItem[]][] {
  const groups = new Map<number, VisualItem[]>();
  for (const item of items) {
    if (item.type !== "overlay") continue;
    groups.set(item.trackIndex, [...(groups.get(item.trackIndex) ?? []), item]);
  }
  return [...groups.entries()];
}

function LegacyLayers({ canvas, frame }: { canvas: CanvasSize; frame: CanvasSize }) {
  const document = useEditorState((s) => s.document);
  const playheadMs = useViewState((s) => s.playheadMs);
  const playing = useViewState((s) => s.playing);
  const rate = useViewState((s) => s.rate);
  const focus = useViewState((s) => s.focus);
  const items = useMemo(() => focusedPlan(visualPlan(document, playheadMs), focus?.clipId ?? null, Boolean(focus?.solo)), [document, playheadMs, focus]);
  return (
    <>
      {items
        .filter((item) => item.type !== "overlay")
        .map((item) => (
          <PreviewMedia key={item.clipId} item={item} playing={playing} rate={rate} />
        ))}
      {overlayGroups(items).map(([trackIndex, group]) => (
        <OverlayStage key={trackIndex} items={group} canvas={canvas} frame={frame} zIndex={trackIndex + 1} />
      ))}
    </>
  );
}

function SelectedClipFrame({ clipId, canvas, frameRef }: { clipId: string; canvas: CanvasSize; frameRef: React.RefObject<HTMLDivElement | null> }) {
  const document = useEditorState((s) => s.document);
  const playheadMs = useViewState((s) => s.playheadMs);
  const found = findClip(document, clipId);
  const visible = found && visualPlan(document, playheadMs, 0).some((item) => item.clipId === clipId && item.active);
  if (!found || !visible) return null;
  return (
    <SelectionFrame
      clipId={clipId}
      transform={animatedTransform(found.clip.transform, found.clip.keyframes, playheadMs - found.clip.startMs)}
      canvas={canvas}
      frameRef={frameRef}
      locked={Boolean(found.track.locked)}
    />
  );
}

function useFocusZoom(): { scale: number; originX: number; originY: number } | null {
  const { store } = useVideoEditor();
  const key = useViewState((s) => {
    const focus = s.focus;
    if (!focus?.zoom) return "";
    const item = visualPlan(store.getState().document, s.playheadMs, 0).find((candidate) => candidate.clipId === focus.clipId && candidate.active);
    if (!item) return "";
    const zoom = zoomAround(item.transform);
    return `${zoom.scale}|${zoom.originX}|${zoom.originY}`;
  });
  if (!key) return null;
  const [scale, originX, originY] = key.split("|").map(Number);
  return { scale, originX, originY };
}

export function Preview() {
  const t = useTranslations("studio.video.preview");
  const { store, view } = useVideoEditor();
  const document = useEditorState((s) => s.document);
  const selectedId = useEditorState((s) => (s.selection.length === 1 ? s.selection[0] : null));
  const safeArea = useViewState((s) => s.safeArea);
  const container = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(container);
  const canvas = videoCanvasSize(document);
  const frame = fitFrame(size, canvas);
  const zoom = useFocusZoom();
  const [gpu, setGpu] = useState(gpuRenderingWanted);
  const fallBack = useCallback(() => setGpu(false), []);

  const pick = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect || event.button !== 0) return;
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const current = store.getState().document;
    const state = view.getState();
    const items = focusedPlan(visualPlan(current, state.playheadMs), state.focus?.clipId ?? null, Boolean(state.focus?.solo));
    const candidates = items.filter((item) => item.active && isClipPickable(current, item.clipId)).map((item) => ({ ...item, zIndex: item.trackIndex }));
    const hit = topmostAt(candidates, x, y, canvas.width / canvas.height);
    store.getState().select(hit ? [hit.clipId] : []);
  };

  return (
    <section aria-label={t("label")} className="flex h-full min-w-0 flex-col bg-muted">
      <div ref={container} className="relative flex min-h-0 flex-1 select-none items-center justify-center overflow-hidden" data-tour="studio-video-preview" data-studio-preview>
        {frame.width > 0 ? (
          <div
            ref={frameRef}
            data-studio-preview-frame
            className="relative overflow-hidden shadow-lg ring-1 ring-border"
            style={{
              width: frame.width,
              height: frame.height,
              backgroundColor: document.canvas.background,
              isolation: "isolate",
              transform: zoom ? `scale(${zoom.scale})` : undefined,
              transformOrigin: zoom ? `${zoom.originX * 100}% ${zoom.originY * 100}%` : undefined,
              transition: "transform 150ms ease",
            }}
          >
            {gpu ? <GpuStage frame={frame} onUnavailable={fallBack} /> : <LegacyLayers canvas={canvas} frame={frame} />}
            <div className="absolute inset-0" style={{ zIndex: 800 }} onPointerDown={pick} aria-hidden />
            {safeArea ? (
              <div className="pointer-events-none absolute inset-[6%_6%_20%_6%] border border-dashed border-primary" style={{ zIndex: 850 }} aria-hidden />
            ) : null}
            {selectedId ? <SelectedClipFrame clipId={selectedId} canvas={canvas} frameRef={frameRef} /> : null}
          </div>
        ) : null}
      </div>
      <Transport />
    </section>
  );
}
