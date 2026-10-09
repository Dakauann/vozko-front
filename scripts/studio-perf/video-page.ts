import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { IntlProvider } from "use-intl";

import messages from "../../src/i18n/messages/pt.json";
import { VideoEditorContext } from "@/components/studio/video/editor-context";
import { Inspector } from "@/components/studio/video/inspector/inspector";
import { Preview } from "@/components/studio/video/preview/preview";
import { createVideoEditorRuntime } from "@/components/studio/video/runtime";
import { Timeline } from "@/components/studio/video/timeline/timeline";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { StudioProjectHandle } from "@/hooks/use-studio-project";
import { emptyVideoDocument, newOverlayClip, newShapeLayer, newTextLayer, type Clip, type VideoDocument } from "@/lib/studio/document";

const CLIP_MS = 1000;
const FILLS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"] as const;

function overlay(track: number, index: number): Clip {
  const layer = index % 4 === 3 ? newTextLayer(`Texto ${track}.${index}`, "body") : { ...newShapeLayer("rect"), fill: FILLS[(track + index) % FILLS.length] };
  const clip = newOverlayClip(layer, index * CLIP_MS, CLIP_MS, { x: 0.15 + (index % 6) * 0.14, y: 0.15 + track * 0.12, w: 0.12, h: 0.1, rotation: 0, opacity: 1 });
  return { ...clip, id: `clip-${track}-${index}` };
}

function documentWith(tracks: number, clipsPerTrack: number): VideoDocument {
  const doc = emptyVideoDocument("landscape");
  return {
    ...doc,
    durationMs: clipsPerTrack * CLIP_MS,
    tracks: Array.from({ length: tracks }, (_, t) => ({ id: `track-${t}`, kind: "visual" as const, clips: Array.from({ length: clipsPerTrack }, (_, i) => overlay(t, i)) })),
  };
}

const runtime = createVideoEditorRuntime(documentWith(1, 1));
const studio = { name: "Harness", edit: () => undefined } as unknown as StudioProjectHandle<"video">;
const value = { ...runtime, projectId: "harness", studio };

const frames: number[] = [];
let recording = false;
let last = 0;
function tick(now: number) {
  if (recording && last > 0) frames.push(now - last);
  last = now;
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

function settle(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 400))));
}

function centerOf(selector: string) {
  const element = document.querySelector(selector);
  if (!element) return null;
  const r = element.getBoundingClientRect();
  return { x: r.left + Math.min(r.width / 2, 30), y: r.top + r.height / 2 };
}

const harness = {
  runtime,
  async setup(tracks: number, clipsPerTrack: number, selected: number) {
    runtime.store.getState().reset(documentWith(tracks, clipsPerTrack));
    await settle();
    const ids = runtime.store.getState().document.tracks.flatMap((t) => t.clips.map((c) => c.id)).slice(0, selected);
    runtime.store.getState().select(ids);
    await settle();
    return { anchor: centerOf(`[data-clip-id="${ids[0] ?? "clip-0-0"}"]`), first: ids[0] ?? null };
  },
  record() {
    frames.length = 0;
    recording = true;
    return runtime.store.getState().revision;
  },
  async stop() {
    await settle();
    recording = false;
    const sorted = [...frames].sort((a, b) => a - b);
    const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
    return { canvases: 0, stacks: [], frames: sorted.length, p50: at(0.5), p95: at(0.95), max: sorted[sorted.length - 1] ?? 0, slow: sorted.filter((d) => d > 34).length, revision: runtime.store.getState().revision };
  },
  starts(count: number) {
    return runtime.store.getState().document.tracks.flatMap((t) => t.clips.map((c) => [c.startMs, 0])).slice(0, count);
  },
  pxPerSecond() {
    return runtime.view.getState().pxPerSecond;
  },
};

Object.assign(window, { harness });

createRoot(document.getElementById("root")!).render(
  h(
    IntlProvider,
    { locale: "pt", messages, onError: () => undefined, timeZone: "America/Sao_Paulo" },
    h(
      VideoEditorContext.Provider,
      { value },
      h(
        TooltipProvider,
        null,
        h(
          "div",
          { className: "flex h-screen w-screen min-h-0 flex-col" },
          h("div", { className: "flex min-h-0 flex-[3]" }, h("div", { className: "min-w-0 flex-1" }, h(Preview)), h("div", { className: "w-72 shrink-0 border-l border-border" }, h(Inspector))),
          h("div", { className: "min-h-0 flex-[2] border-t border-border" }, h(Timeline)),
        ),
      ),
    ),
  ),
);
