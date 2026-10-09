import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { IntlProvider } from "use-intl";

import messages from "../../src/i18n/messages/pt.json";
import { createAgentPresence } from "@/components/studio/agent/presence";
import { CanvasArea } from "@/components/studio/image/canvas-area";
import { createImageCommands } from "@/components/studio/image/commands";
import { bindEditorKeys } from "@/components/studio/image/editor-keys";
import { createEditorUiStore, ImageEditorContext } from "@/components/studio/image/editor-state";
import { ExportMenu } from "@/components/studio/image/export-menu";
import { createImageAgent } from "@/components/studio/image/image-agent";
import { RightDock } from "@/components/studio/image/right-dock";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ScreenCommand } from "@/lib/aichat/screen";
import { artboardById, artboardOfLayer } from "@/lib/studio/artboards";
import { emptyArtboard, imageDocument, newShapeLayer, newTextLayer, type ImageDocument, type Layer } from "@/lib/studio/document";
import { createStudioStore } from "@/lib/studio/store";
import { parseDocument } from "@/lib/studio/validate";

const SHAPES = ["rect", "ellipse", "star", "triangle"] as const;
const FILLS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"] as const;
const LABEL_LIFT_PX = 12;

function grid(count: number): Layer[] {
  const columns = Math.ceil(Math.sqrt(count));
  const cell = 1 / columns;
  return Array.from({ length: count }, (_, i) => {
    const transform = { x: cell * ((i % columns) + 0.5), y: cell * (Math.floor(i / columns) + 0.5), w: cell * 0.8, h: cell * 0.8, rotation: 0, opacity: 1 };
    if (i % 6 === 5) return { ...newTextLayer(`Texto ${i}`, "body", transform), id: `layer-${i}`, fontSize: cell * 0.25 };
    return { ...newShapeLayer(SHAPES[i % SHAPES.length], transform), id: `layer-${i}`, fill: FILLS[i % FILLS.length] };
  });
}

function documentWith(count: number): ImageDocument {
  return imageDocument([{ ...emptyArtboard({ width: 1080, height: 1080 }), id: "artboard-main", layers: grid(count) }]);
}

const store = createStudioStore(documentWith(0));
const ui = createEditorUiStore();
const naturalSize = async () => ({ width: 1000, height: 1000 });
const commands = createImageCommands(store, ui, { requestJob: async () => ({ error: "harness", code: "harness" }) as never, naturalSize });
const agent = createImageAgent({ store, ui, commands, naturalSize, presence: createAgentPresence(), label: (action) => action, reduceMotion: () => true });

const created = { canvases: 0, lastAt: 0, stacks: new Map<string, number>() };
const createElement = document.createElement.bind(document);
document.createElement = ((tag: string, options?: ElementCreationOptions) => {
  if (tag === "canvas") created.lastAt = performance.now();
  if (recording && tag === "canvas") {
    created.canvases += 1;
    const where = (new Error().stack ?? "").split(String.fromCharCode(10)).slice(2, 7).join(" < ");
    created.stacks.set(where, (created.stacks.get(where) ?? 0) + 1);
  }
  return createElement(tag, options);
}) as typeof document.createElement;

const frames: number[] = [];
let recording = false;
let last = 0;
function tick(now: number) {
  if (recording && last > 0) frames.push(now - last);
  last = now;
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

const QUIET_MS = 800;

function settle(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 250))));
}

async function quiet(): Promise<void> {
  await settle();
  while (performance.now() - created.lastAt < QUIET_MS) await settle();
}

function toScreen(x: number, y: number) {
  const host = document.querySelector("[data-studio-canvas]")!.getBoundingClientRect();
  const { viewport } = ui.getState();
  return { x: host.left + viewport.x + x * viewport.scale, y: host.top + viewport.y + y * viewport.scale };
}

function layerScreen(id: string) {
  const doc = store.getState().document;
  const artboard = artboardOfLayer(doc, id)!;
  const layer = artboard.layers.find((l) => l.id === id)!;
  return toScreen(artboard.x + layer.transform.x * artboard.canvas.width, artboard.y + layer.transform.y * artboard.canvas.height);
}

const harness = {
  store,
  ui,
  commands,
  async setup(count: number, selected: number) {
    store.getState().reset(documentWith(count));
    commands.fit();
    await settle();
    const layers = store.getState().document.artboards[0].layers;
    store.getState().select(layers.slice(0, selected).map((l) => l.id));
    await quiet();
    return { anchor: layers.length > 0 ? layerScreen(layers[0].id) : null, scale: ui.getState().viewport.scale };
  },
  record() {
    frames.length = 0;
    created.canvases = 0;
    created.stacks.clear();
    recording = true;
    return store.getState().revision;
  },
  async stop() {
    await settle();
    recording = false;
    const sorted = [...frames].sort((a, b) => a - b);
    const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
    return { canvases: created.canvases, stacks: [...created.stacks.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3), frames: sorted.length, p50: at(0.5), p95: at(0.95), max: sorted[sorted.length - 1] ?? 0, slow: sorted.filter((d) => d > 34).length, revision: store.getState().revision };
  },
  positions(count: number) {
    return store.getState().document.artboards[0].layers.slice(0, count).map((l) => [l.transform.x, l.transform.y]);
  },
  async agent(name: ScreenCommand["name"], args: unknown) {
    const reply = await agent({ id: `cmd-${Math.random().toString(36).slice(2)}`, name, projectId: "harness", args });
    await quiet();
    return reply;
  },
  layerScreen,
  artboardCenter(id: string) {
    const artboard = artboardById(store.getState().document, id)!;
    return toScreen(artboard.x + artboard.canvas.width / 2, artboard.y + artboard.canvas.height / 2);
  },
  labelPoint(id: string) {
    const artboard = artboardById(store.getState().document, id)!;
    const corner = toScreen(artboard.x, artboard.y);
    return { x: corner.x + 24, y: corner.y - LABEL_LIFT_PX };
  },
  snapshot() {
    const { document: doc, selection } = store.getState();
    return {
      active: ui.getState().artboardId,
      selection,
      scale: ui.getState().viewport.scale,
      artboards: doc.artboards.map((a) => ({ id: a.id, name: a.name ?? null, x: a.x, y: a.y, width: a.canvas.width, height: a.canvas.height, background: a.canvas.background, layers: a.layers.map((l) => ({ id: l.id, text: l.text ?? null, x: l.transform.x, y: l.transform.y, w: l.transform.w })) })),
    };
  },
  documentJSON() {
    return JSON.stringify(store.getState().document);
  },
  reload(json: string) {
    const parsed = parseDocument("image", JSON.parse(json));
    if (!parsed.ok) return parsed.issue;
    store.getState().reset(parsed.document);
    return null;
  },
  async imageSize(url: string) {
    const bitmap = await createImageBitmap(await (await fetch(url)).blob());
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  },
  settle: quiet,
};

Object.assign(window, { harness });
bindEditorKeys(window, { commands, ui, isBusy: () => false, onShapeOp: () => undefined });

createRoot(document.getElementById("root")!).render(
  h(
    IntlProvider,
    { locale: "pt", messages, onError: () => undefined, timeZone: "America/Sao_Paulo" },
    h(
      ImageEditorContext.Provider,
      { value: { store, ui, commands, projectName: "Harness" } },
      h(
        TooltipProvider,
        null,
        h(
          "div",
          { className: "flex h-screen w-screen min-h-0 flex-col" },
          h("div", { className: "flex h-12 shrink-0 items-center justify-end border-b border-border px-3" }, h(ExportMenu)),
          h("div", { className: "flex min-h-0 flex-1" }, h(CanvasArea), h(RightDock)),
        ),
      ),
    ),
  ),
);
