"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslations } from "next-intl";

import { topmostAt } from "@/lib/studio/clip-transform";
import { videoCanvasSize, type CanvasSize } from "@/lib/studio/document";
import { animatedTransform } from "@/lib/studio/keyframes";
import { fitFrame, focusedPlan, visualPlan, zoomAround, type VisualItem } from "@/lib/studio/playback";
import { findClip } from "@/lib/studio/timeline";

import { useEditorState, useVideoEditor, useViewState } from "../editor-context";
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

export function Preview() {
  const t = useTranslations("studio.video.preview");
  const { store } = useVideoEditor();
  const document = useEditorState((s) => s.document);
  const selection = useEditorState((s) => s.selection);
  const playheadMs = useViewState((s) => s.playheadMs);
  const playing = useViewState((s) => s.playing);
  const rate = useViewState((s) => s.rate);
  const safeArea = useViewState((s) => s.safeArea);
  const container = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(container);
  const canvas = videoCanvasSize(document);
  const frame = fitFrame(size, canvas);
  const focus = useViewState((s) => s.focus);
  const items = useMemo(() => focusedPlan(visualPlan(document, playheadMs), focus?.clipId ?? null, Boolean(focus?.solo)), [document, playheadMs, focus]);
  const focusItem = focus?.zoom ? items.find((item) => item.clipId === focus.clipId && item.active) : undefined;
  const zoom = focusItem ? zoomAround(focusItem.transform) : null;
  const selected = selection.length === 1 ? findClip(document, selection[0]) : null;
  const selectedVisual = selected && items.some((item) => item.clipId === selected.clip.id && item.active) ? selected : null;

  const pick = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect || event.button !== 0) return;
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const candidates = items.filter((item) => item.active).map((item) => ({ ...item, zIndex: item.trackIndex }));
    const hit = topmostAt(candidates, x, y, canvas.width / canvas.height);
    store.getState().select(hit ? [hit.clipId] : []);
  };

  return (
    <section aria-label={t("label")} className="flex h-full min-w-0 flex-col bg-muted">
      <div ref={container} className="relative flex min-h-0 flex-1 select-none items-center justify-center overflow-hidden" data-tour="studio-video-preview">
        {frame.width > 0 ? (
          <div
            ref={frameRef}
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
            {items
              .filter((item) => item.type !== "overlay")
              .map((item) => (
                <PreviewMedia key={item.clipId} item={item} playing={playing} rate={rate} />
              ))}
            {overlayGroups(items).map(([trackIndex, group]) => (
              <OverlayStage key={trackIndex} items={group} canvas={canvas} frame={frame} zIndex={trackIndex + 1} />
            ))}
            <div className="absolute inset-0" style={{ zIndex: 800 }} onPointerDown={pick} aria-hidden />
            {safeArea ? (
              <div className="pointer-events-none absolute inset-[6%_6%_20%_6%] border border-dashed border-primary" style={{ zIndex: 850 }} aria-hidden />
            ) : null}
            {selectedVisual ? (
              <SelectionFrame
                clipId={selectedVisual.clip.id}
                transform={animatedTransform(selectedVisual.clip.transform, selectedVisual.clip.keyframes, playheadMs - selectedVisual.clip.startMs)}
                canvas={canvas}
                frameRef={frameRef}
                locked={Boolean(selectedVisual.track.locked)}
              />
            ) : null}
          </div>
        ) : null}
      </div>
      <Transport />
    </section>
  );
}
