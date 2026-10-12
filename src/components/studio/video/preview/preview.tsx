"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslations } from "next-intl";

import { stackAt } from "@/lib/studio/clip-transform";
import { videoCanvasSize, type CanvasSize } from "@/lib/studio/document";
import { anchorOf } from "@/lib/studio/clip-placement";
import { worldPlacementIn } from "@/lib/studio/parenting";
import { focusedPlan, PREMOUNT_MS, visualPlan, zoomAround } from "@/lib/studio/playback";
import { pickFromStack, pressMovesSelection } from "@/lib/studio/picking";
import { findClip, isClipPickable } from "@/lib/studio/timeline";
import { SAFE_AREA } from "@/lib/studio/frame-layout";
import { cn } from "@/lib/utils";

import { useEditorState, useVideoEditor, useViewState } from "../editor-context";
import { useReactLevels } from "../react-levels";
import { gpuRenderingWanted } from "@/components/studio/render/gpu-preference";
import { useViewportGestures } from "@/components/studio/canvas/use-viewport-gestures";
import { checkerSource } from "@/components/studio/image/canvas/checker";
import type { VideoViewStore } from "../view-store";

import { GpuStage } from "./gpu-stage";
import { previewPlacement, previewViewportOf } from "./preview-placement";
import { LegacyItems } from "./legacy-items";
import { SelectionFrame } from "./selection-frame";
import { SelectionOutlines } from "./selection-outlines";
import { NullOutlines } from "./null-outlines";
import { VideoJobOverlays } from "../job-overlays";
import { VideoPerceptionOverlay } from "./perception-overlay";
import { TiltOutlines } from "./tilt-outline";
import { FrameGuides } from "./frame-guides";
import { VfxHandles } from "./vfx-handles";
import { TrackPaths } from "./track-paths";
import { TrackTarget } from "./track-target";
import { PathKeyOverlay } from "./path-key-overlay";
import { useTransformGesture, type GestureMember, type TransformGesture } from "./transform-gesture";
import { Transport } from "./transport";
import { TrimPreviewOverlay } from "./trim-preview";
import { VideoTextEditOverlay, withoutEditedText } from "./text-edit-overlay";
import { useVideoPreviewDrop } from "../library-adapter";
import { sceneLens } from "@/lib/studio/clip-tilt";

function useContainerSize(ref: React.RefObject<HTMLElement | null>, view: VideoViewStore): void {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const size = { width: element.clientWidth, height: element.clientHeight };
      const current = view.getState().previewContainer;
      if (current?.width === size.width && current.height === size.height) return;
      view.setState({ previewContainer: size.width > 0 && size.height > 0 ? size : null });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, view]);
}

function useFollowFit(view: VideoViewStore, width: number, height: number): void {
  const fit = useViewState((s) => s.previewFit);
  const container = useViewState((s) => s.previewContainer);
  useEffect(() => {
    const state = view.getState();
    const next = previewViewportOf(state, { width, height });
    if (next !== state.previewViewport) view.setState({ previewViewport: next });
  }, [view, fit, container, width, height]);
}


function LegacyLayers({ canvas, frame }: { canvas: CanvasSize; frame: CanvasSize }) {
  const document = useEditorState((s) => s.document);
  const playheadMs = useViewState((s) => s.playheadMs);
  const playing = useViewState((s) => s.playing);
  const rate = useViewState((s) => s.rate);
  const focus = useViewState((s) => s.focus);
  const levels = useReactLevels(document);
  const editing = useViewState((s) => s.editingTextClipId);
  const items = useMemo(
    () => withoutEditedText(focusedPlan(visualPlan(document, playheadMs, PREMOUNT_MS, levels), focus?.clipId ?? null, Boolean(focus?.solo)), editing),
    [document, playheadMs, focus, levels, editing],
  );
  const lens = useMemo(() => sceneLens(document.canvas, canvas), [document.canvas, canvas]);
  return <LegacyItems items={items} canvas={canvas} frame={frame} lens={lens} playing={playing} rate={rate} />;
}

function SelectedClipFrame({ clipId, frameRef, gesture }: { clipId: string; frameRef: React.RefObject<HTMLDivElement | null>; gesture: TransformGesture }) {
  const document = useEditorState((s) => s.document);
  const playheadMs = useViewState((s) => s.playheadMs);
  const found = findClip(document, clipId);
  const visible = found && visualPlan(document, playheadMs, 0).some((item) => item.clipId === clipId && item.active);
  if (!found || !visible || found.clip.type === "effect") return null;
  return (
    <SelectionFrame
      clipId={clipId}
      transform={worldPlacementIn(document, found.clip, playheadMs - found.clip.startMs)}
      frameRef={frameRef}
      locked={Boolean(found.track.locked)}
      gesture={gesture}
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
  const { store, view, playback, commands } = useVideoEditor();
  const document = useEditorState((s) => s.document);
  const editingId = useViewState((s) => s.editingTextClipId);
  const singleId = useEditorState((s) => (s.selection.length === 1 ? s.selection[0] : null));
  const selectedId = singleId === editingId ? null : singleId;
  const selected = useEditorState((s) => s.selection);
  const safeArea = useViewState((s) => s.safeArea);
  const container = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvas = videoCanvasSize(document);
  useContainerSize(container, view);
  useFollowFit(view, canvas.width, canvas.height);
  const previewFit = useViewState((s) => s.previewFit);
  const previewViewport = useViewState((s) => s.previewViewport);
  const previewContainer = useViewState((s) => s.previewContainer);
  const placement = previewPlacement({ previewFit, previewViewport, previewContainer }, canvas);
  const grid = useViewState((s) => s.transparencyGrid);
  const hovering = useRef(false);
  const { spaceHeld, panning } = useViewportGestures({
    host: container,
    viewport: () => previewViewportOf(view.getState(), videoCanvasSize(store.getState().document)),
    setViewport: (previewViewport) => view.setState({ previewViewport, previewFit: false }),
    claimsSpace: () => hovering.current,
    onSpaceTap: () => playback.toggle(),
    wheelPans: () => !view.getState().previewFit,
  });
  const frame = placement?.frame ?? null;
  const zoom = useFocusZoom();
  const [gpu, setGpu] = useState(gpuRenderingWanted);
  const fallBack = useCallback(() => setGpu(false), []);

  const gesture = useTransformGesture(frameRef, canvas);
  const libraryDrop = useVideoPreviewDrop();
  const [overSelection, setOverSelection] = useState(false);

  const stackUnder = (event: { clientX: number; clientY: number }): string[] => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return [];
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const current = store.getState().document;
    const state = view.getState();
    const items = focusedPlan(visualPlan(current, state.playheadMs), state.focus?.clipId ?? null, Boolean(state.focus?.solo));
    const candidates = items.filter((item) => item.active && item.type !== "effect" && isClipPickable(current, item.clipId)).map((item) => ({ ...item, zIndex: item.trackIndex }));
    return stackAt(candidates, x, y, canvas.width / canvas.height).map((item) => item.clipId);
  };

  const companions = (target: string): GestureMember[] => {
    const current = store.getState().document;
    const { playheadMs } = view.getState();
    const others = new Set(store.getState().selection.filter((id) => id !== target));
    return visualPlan(current, playheadMs, 0)
      .filter((item) => item.active && item.type !== "effect" && others.has(item.clipId) && isClipPickable(current, item.clipId))
      .map((item) => {
        const { clip } = findClip(current, item.clipId)!;
        return { clipId: clip.id, box: worldPlacementIn(current, clip, playheadMs - clip.startMs) };
      });
  };

  const pick = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const stack = stackUnder(event);
    const selection = store.getState().selection;
    const target = pickFromStack(stack, selection, event.altKey);
    if (event.shiftKey) {
      if (target) store.getState().select(selection.includes(target) ? selection.filter((id) => id !== target) : [...selection, target]);
      return;
    }
    const together = target !== null && !event.altKey && selection.length > 1 && selection.includes(target);
    if (!together) store.getState().select(target ? [target] : []);
    setOverSelection(target !== null && stack[0] === target);
    const { document: current } = store.getState();
    const found = target && !event.altKey ? findClip(current, target) : null;
    if (!found) return;
    const box = worldPlacementIn(current, found.clip, view.getState().playheadMs - found.clip.startMs);
    gesture.begin(found.clip.id, { box, anchor: anchorOf(found.clip) }, { kind: "move" }, event, together ? companions(found.clip.id) : []);
  };

  const hover = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (gesture.active()) {
      gesture.handlers.onPointerMove(event);
      return;
    }
    const over = pressMovesSelection(stackUnder(event), store.getState().selection);
    if (over !== overSelection) setOverSelection(over);
  };

  return (
    <section aria-label={t("label")} className="flex h-full min-w-0 flex-col bg-muted">
      <div
        ref={container}
        className="relative min-h-0 flex-1 select-none overflow-hidden"
        data-tour="studio-video-preview"
        data-studio-preview
        onPointerEnter={() => (hovering.current = true)}
        onPointerLeave={() => (hovering.current = false)}
        style={{ cursor: panning ? "grabbing" : spaceHeld ? "grab" : undefined }}
      >
        {placement && frame && frame.width > 0 ? (
          <div
            ref={frameRef}
            data-studio-preview-frame
            className={cn("absolute overflow-hidden shadow-lg ring-1 ring-border", overSelection || gesture.dragging ? "cursor-move" : undefined)}
            onPointerDown={pick}
            onPointerMove={hover}
            onPointerUp={gesture.handlers.onPointerUp}
            onPointerCancel={gesture.handlers.onPointerCancel}
            onDragOver={libraryDrop.onDragOver}
            onDrop={libraryDrop.onDrop}
            onPointerLeave={() => setOverSelection(false)}
            onDoubleClick={(event) => {
              const [top] = stackUnder(event);
              if (top) commands.startTextEdit(top);
            }}
            style={{
              left: frame.left,
              top: frame.top,
              width: frame.width,
              height: frame.height,
              backgroundColor: grid ? undefined : document.canvas.background,
              backgroundImage: grid ? `url("${checkerSource()}")` : undefined,
              isolation: "isolate",
              transform: zoom ? `scale(${zoom.scale})` : undefined,
              transformOrigin: zoom ? `${zoom.originX * 100}% ${zoom.originY * 100}%` : undefined,
              transition: "transform 150ms ease",
            }}
          >
            {gpu ? <GpuStage placement={placement} onUnavailable={fallBack} /> : <LegacyLayers canvas={canvas} frame={frame} />}
            <div className="absolute inset-0" style={{ zIndex: 800 }} aria-hidden />
            {safeArea ? (
              <div
                className="pointer-events-none absolute border border-dashed border-primary"
                style={{ zIndex: 850, left: `${SAFE_AREA.left * 100}%`, top: `${SAFE_AREA.top * 100}%`, right: `${(1 - SAFE_AREA.right) * 100}%`, bottom: `${(1 - SAFE_AREA.bottom) * 100}%` }}
                aria-hidden
              />
            ) : null}
            {selectedId ? <SelectedClipFrame clipId={selectedId} frameRef={frameRef} gesture={gesture} /> : null}
            <NullOutlines />
            <VideoPerceptionOverlay />
            <TiltOutlines />
            {selected.length > 1 ? <SelectionOutlines ids={selected} /> : null}
            <VideoJobOverlays />
            {gesture.snap ? <FrameGuides snap={gesture.snap} size={canvas} /> : null}
            {selectedId && !gesture.dragging ? <VfxHandles clipId={selectedId} frameRef={frameRef} /> : null}
            {selectedId ? <TrackPaths clipId={selectedId} /> : null}
            {selectedId ? <PathKeyOverlay clipId={selectedId} frameRef={frameRef} /> : null}
            <TrackTarget frameRef={frameRef} />
          </div>
        ) : null}
        <TrimPreviewOverlay />
        {frame && frame.width > 0 ? <VideoTextEditOverlay frame={frame} canvas={canvas} /> : null}
      </div>
      <Transport />
    </section>
  );
}
