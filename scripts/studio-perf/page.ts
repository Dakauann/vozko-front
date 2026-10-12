import { drawCallsSoFar, lastCanvasCreatedAt, startProbes, stopProbes } from "./probes";
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

import { heavyDocument, heavyRoles, type HeavyRoles } from "./heavy-document";

const SHAPES = ["rect", "ellipse", "star", "triangle"] as const;
const FILLS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"] as const;
const LABEL_LIFT_PX = 12;
const EDGE_BAND_PX = 1.5;

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

function nextFrames(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function settle(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 250))));
}

async function quiet(): Promise<void> {
  await settle();
  while (performance.now() - lastCanvasCreatedAt() < QUIET_MS) await settle();
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

function transformsOf(ids: readonly string[]) {
  const doc = store.getState().document;
  return ids.map((id) => {
    const artboard = artboardOfLayer(doc, id)!;
    const layer = artboard.layers.find((l) => l.id === id)!;
    return [layer.transform.x * artboard.canvas.width, layer.transform.y * artboard.canvas.height];
  });
}

type HeavyTarget = "small" | "header" | "multi";

function heavyChoice(roles: HeavyRoles, target: HeavyTarget): { ids: string[]; anchor: string; preselect: boolean } {
  if (target === "small") return { ids: [roles.smallLabel], anchor: roles.smallLabel, preselect: false };
  if (target === "header") return { ids: [roles.header], anchor: roles.header, preselect: false };
  return { ids: roles.multi, anchor: roles.multiAnchor, preselect: true };
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
  async loadHeavy() {
    const parsed = parseDocument("image", JSON.parse(JSON.stringify(heavyDocument())));
    if (!parsed.ok) throw new Error(`heavy document refused: ${JSON.stringify(parsed.issue)}`);
    store.getState().reset(parsed.document);
    store.getState().select([]);
    commands.fit();
    await quiet();
    return ui.getState().viewport;
  },
  async heavyTarget(target: HeavyTarget) {
    commands.fit();
    const choice = heavyChoice(heavyRoles(), target);
    store.getState().select(choice.preselect ? choice.ids : []);
    await quiet();
    return { ids: choice.ids, anchor: layerScreen(choice.anchor), scale: ui.getState().viewport.scale, before: transformsOf(choice.ids) };
  },
  async heavyView() {
    commands.fit();
    store.getState().select([]);
    await quiet();
    return ui.getState().viewport;
  },
  async redrawLive() {
    ui.setState({});
    await nextFrames();
  },
  nextFrames,
  drawCallsSoFar,
  async pixelDiff(first: string, second: string) {
    const decode = async (data: string) => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d")!;
      context.drawImage(bitmap, 0, 0);
      return context.getImageData(0, 0, bitmap.width, bitmap.height);
    };
    const [shotA, shotB] = await Promise.all([decode(first), decode(second)]);
    const { width } = shotA;
    const a = shotA.data;
    const b = shotB.data;
    const edges = store.getState().document.artboards.map((artboard) => {
      const from = toScreen(artboard.x, artboard.y);
      const to = toScreen(artboard.x + artboard.canvas.width, artboard.y + artboard.canvas.height);
      return { left: from.x, top: from.y, right: to.x, bottom: to.y };
    });
    const onEdge = (x: number, y: number) =>
      edges.some((e) => {
        const nearX = Math.abs(x - e.left) <= EDGE_BAND_PX || Math.abs(x - e.right) <= EDGE_BAND_PX;
        const nearY = Math.abs(y - e.top) <= EDGE_BAND_PX || Math.abs(y - e.bottom) <= EDGE_BAND_PX;
        return (nearX && y >= e.top - EDGE_BAND_PX && y <= e.bottom + EDGE_BAND_PX) || (nearY && x >= e.left - EDGE_BAND_PX && x <= e.right + EDGE_BAND_PX);
      });
    let max = 0;
    let differing = 0;
    for (let i = 0; i < a.length; i += 4) {
      const pixel = i / 4;
      if (onEdge(pixel % width, Math.floor(pixel / width))) continue;
      const diff = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
      if (diff > 0) differing += 1;
      max = Math.max(max, diff);
    }
    return { max, differing, pixels: a.length / 4 };
  },
  async rasterizedAfter() {
    startProbes();
    await quiet();
    return (await stopProbes()).canvases;
  },
  transformsOf,
  viewport() {
    return ui.getState().viewport;
  },
  record() {
    frames.length = 0;
    startProbes();
    recording = true;
    return store.getState().revision;
  },
  async stop(quick = false) {
    await (quick ? nextFrames() : settle());
    recording = false;
    const probes = await stopProbes();
    const sorted = [...frames].sort((a, b) => a - b);
    const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
    return { ...probes, frames: sorted.length, p50: at(0.5), p95: at(0.95), max: sorted[sorted.length - 1] ?? 0, slow: sorted.filter((d) => d > 34).length, revision: store.getState().revision };
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
