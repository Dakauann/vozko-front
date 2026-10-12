import { createElement as h, type Context } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { IntlProvider } from "use-intl";

import messages from "../../src/i18n/messages/pt.json";
import { ImageEditorContext } from "@/components/studio/image/editor-state";
import { ImageEditor } from "@/components/studio/image/image-editor";
import { LIBRARY_CATEGORIES, libraryItems } from "@/components/studio/library/registry";
import { VideoEditorContext } from "@/components/studio/video/editor-context";
import { VideoExportContext } from "@/components/studio/video/use-video-export";
import { VideoEditor } from "@/components/studio/video/video-editor";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { StudioProjectHandle } from "@/hooks/use-studio-project";
import { emptyArtboard, emptyVideoDocument, imageDocument, newImageLayer, newMediaClip, newOverlayClip, newShapeLayer, newTextLayer } from "@/lib/studio/document";
import { labelText } from "@/lib/studio/library/catalog";
import type { LibraryLabel } from "@/lib/studio/library/model";
import { loadAllItems, loadItems } from "@/lib/studio/library/store";
import type { StudioProject } from "@/lib/studio/project";
import { STILL_VFX_KINDS } from "@/lib/studio/still-vfx";
import { VFX_KINDS } from "@/lib/studio/vfx";

const TOUR_KEYS = ["tour_dismissed_studio_image", "tour_dismissed_studio_video"];
for (const key of TOUR_KEYS) {
  try {
    localStorage.setItem(key, "true");
  } catch {
    void key;
  }
}

const params = new URLSearchParams(location.search);
const kind = params.get("editor") === "video" ? "video" : "image";

const edits: unknown[] = [];

function handle<K extends "image" | "video">(project: StudioProject): StudioProjectHandle<K> {
  return {
    load: { status: "ready", project },
    generation: 1,
    name: project.name,
    saveStatus: "saved",
    saveError: null,
    conflict: null,
    edit: (change) => void edits.push(change),
    flush: async () => undefined,
    committed: () => ({ version: project.version, settled: true }),
    retrySave: () => undefined,
    reloadFromServer: () => undefined,
    keepMine: () => undefined,
    reload: () => undefined,
  } as unknown as StudioProjectHandle<K>;
}

const now = new Date().toISOString();
const initial = kind === "image" ? imageDocument([{ ...emptyArtboard({ width: 1080, height: 1080 }), id: "artboard-main" }]) : { ...emptyVideoDocument("landscape"), durationMs: 6000 };
const project: StudioProject = { id: `harness-${kind}`, kind, name: `Harness ${kind}`, document: initial, version: 1, createdAt: now, updatedAt: now };
const studio = handle(project);

type Fiber = { type: unknown; memoizedProps: { value?: unknown } | null; return: Fiber | null; child: Fiber | null; sibling: Fiber | null };

function rootFiber(): Fiber | null {
  const container = document.getElementById("root") as unknown as Record<string, unknown> | null;
  if (!container) return null;
  const key = Object.keys(container).find((name) => name.startsWith("__reactContainer$"));
  return key ? ((container[key] as { child?: Fiber }).child ?? (container[key] as Fiber)) : null;
}

function provided<T>(context: Context<T>): T | null {
  const stack: Fiber[] = [];
  const start = rootFiber();
  if (start) stack.push(start);
  while (stack.length > 0) {
    const fiber = stack.pop()!;
    const type = fiber.type as { _context?: unknown } | null;
    if ((type === context || type?._context === context) && fiber.memoizedProps?.value) return fiber.memoizedProps.value as T;
    if (fiber.sibling) stack.push(fiber.sibling);
    if (fiber.child) stack.push(fiber.child);
  }
  return null;
}

function message(path: string): string {
  const found = path.split(".").reduce<unknown>((node, part) => (node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined), messages);
  return typeof found === "string" ? found : path;
}

function label(value: LibraryLabel): string {
  return labelText(value, message, "pt");
}

async function registry(editor: "image" | "video") {
  const lists = await Promise.all(LIBRARY_CATEGORIES.map((category) => loadItems(category)));
  return LIBRARY_CATEGORIES.map((category, index) => ({
    id: category.id,
    panel: category.panel,
    tile: category.tile,
    name: label(category.label),
    items: lists[index].filter((item) => item.editors.includes(editor)).map((item) => ({ id: item.id, kind: item.template.kind, name: label(item.label), subcategory: item.subcategory ?? null })),
  }));
}

function size(): number {
  const image = provided(ImageEditorContext);
  if (image) return image.store.getState().document.artboards.reduce((total, artboard) => total + artboard.layers.length, 0);
  const video = provided(VideoEditorContext);
  return video ? video.store.getState().document.tracks.reduce((total, track) => total + track.clips.length, 0) : -1;
}

function settle(ms = 250): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, ms))));
}

const harness = {
  kind,
  edits,
  factories: { emptyArtboard, newImageLayer, newMediaClip, newOverlayClip, newShapeLayer, newTextLayer },
  image: () => provided(ImageEditorContext),
  video: () => provided(VideoEditorContext),
  exporter: () => provided(VideoExportContext),
  categories: LIBRARY_CATEGORIES,
  libraryItems,
  loadAllItems: () => loadAllItems(LIBRARY_CATEGORIES),
  registry,
  effects: { still: STILL_VFX_KINDS, video: VFX_KINDS },
  size,
  settle,
};

Object.assign(window, { harness });

const editor = kind === "image" ? h(ImageEditor, { project: project as never, studio: studio as never }) : h(VideoEditor, { project: project as never, studio: studio as never });

createRoot(document.getElementById("root")!).render(
  h(
    IntlProvider,
    { locale: "pt", messages, onError: () => undefined, timeZone: "America/Sao_Paulo" },
    h(TooltipProvider, null, h("div", { className: "h-screen w-screen min-h-0" }, editor), h(Toaster, { position: "bottom-center" })),
  ),
);
