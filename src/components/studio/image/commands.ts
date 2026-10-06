import type { ActionResult } from "@/app/actions/action-result";
import type { MediaGenerationInput, MediaGenerationJob } from "@/lib/media-generation/types";
import { applyCropBox, cropFrame } from "@/lib/studio/crop";
import { produce } from "immer";

import { newImageLayer, newStudioId, type CanvasSize, type Gradient, type ImageDocument, type Layer } from "@/lib/studio/document";
import { fitInside, fittedTransform, type PixelBox } from "@/lib/studio/geometry";
import { clipboardOf, type ClipboardContent } from "@/lib/studio/clipboard";
import { dissolveGroup, moveItem, renameGroup, type TreeItem } from "@/lib/studio/groups";
import { commitText, jobErrorCode, replaceImageAsset } from "@/lib/studio/image-edits";
import { styleOf, stylePatch, type CopiedStyle } from "@/lib/studio/style";
import type { ImageAction } from "@/lib/studio/keymap";
import {
  addLayers,
  alignLayers,
  deleteLayers,
  DUPLICATE_OFFSET,
  distributeLayers,
  duplicateLayers,
  groupLayers,
  layerById,
  moveLayerTo,
  pasteLayers,
  reorderLayers,
  resizeCanvas,
  setLayersHidden,
  setLayersLocked,
  translateLayers,
  ungroupLayers,
  updateLayers,
  type Alignment,
  type DistributeAxis,
  type LayerPatch,
  type OrderDirection,
} from "@/lib/studio/layers";
import type { StudioEditorStore } from "@/lib/studio/store";
import { fitViewport, stepZoom, zoomAt } from "@/lib/studio/viewport";

import type { EditorUiStore, JobPurpose, StudioJob } from "./editor-state";

export interface CommandDeps {
  requestJob: (input: MediaGenerationInput) => Promise<ActionResult<MediaGenerationJob>>;
  naturalSize: (assetId: string) => Promise<CanvasSize>;
}

export interface InsertImageOptions {
  aboveId?: string;
  within?: Layer["transform"];
}

export type ImageCommands = ReturnType<typeof createImageCommands>;

export function createImageCommands(store: StudioEditorStore<ImageDocument>, ui: EditorUiStore, deps: CommandDeps) {
  const doc = () => store.getState().document;
  const selection = () => store.getState().selection;
  const apply = (operation: (d: ImageDocument) => ImageDocument, next?: string[]) => store.getState().apply(operation, next);

  const patchJob = (id: string, patch: Partial<StudioJob>) =>
    ui.setState((s) => ({ jobs: s.jobs.map((job) => (job.id === id ? { ...job, ...patch } : job)) }));
  const dropJob = (id: string) => ui.setState((s) => ({ jobs: s.jobs.filter((job) => job.id !== id) }));

  const insert = (layers: Layer[], atIndex?: number): string[] => {
    if (layers.length === 0) return [];
    const ids = layers.map((l) => l.id);
    const before = doc();
    apply((d) => addLayers(d, layers, atIndex), ids);
    return doc() === before ? [] : ids;
  };

  const insertImage = async (assetId: string, options: InsertImageOptions = {}): Promise<boolean> => {
    let natural: CanvasSize;
    try {
      natural = await deps.naturalSize(assetId);
    } catch {
      return false;
    }
    const canvas = doc().canvas;
    const transform = options.within ? fitInside(natural.width, natural.height, options.within, canvas) : fittedTransform(natural.width, natural.height, canvas);
    const index = options.aboveId ? doc().layers.findIndex((l) => l.id === options.aboveId) : -1;
    return insert([newImageLayer(assetId, transform)], index >= 0 ? index + 1 : undefined).length > 0;
  };

  const select = (ids: string[]) => store.getState().select(ids);

  const setZoom = (scale: number) => {
    const { container, viewport } = ui.getState();
    const anchor = container ? { x: container.width / 2, y: container.height / 2 } : { x: 0, y: 0 };
    ui.setState({ viewport: zoomAt(viewport, scale, anchor), fit: false });
  };

  const fit = () => {
    const { container } = ui.getState();
    if (!container) return ui.setState({ fit: true });
    ui.setState({ viewport: fitViewport(container, doc().canvas), fit: true });
  };

  const cancelCrop = () => ui.setState({ crop: null });

  let copied: ClipboardContent = { layers: [], groups: [] };
  let copiedStyle: CopiedStyle | null = null;

  const commands = {
    undo: () => store.getState().undo(),
    redo: () => store.getState().redo(),
    select,
    selectAll: () => select(doc().layers.filter((l) => !l.hidden).map((l) => l.id)),
    deselect: () => {
      const state = ui.getState();
      if (state.crop) return cancelCrop();
      if (state.editingTextId) return ui.setState({ editingTextId: null });
      select([]);
    },
    remove: () => {
      const ids = selection();
      const before = doc();
      apply((d) => deleteLayers(d, ids), []);
      if (doc() === before) return;
      select(ids.filter((id) => layerById(doc(), id)));
    },
    duplicate: () => {
      let created: string[] = [];
      apply((d) => {
        const result = duplicateLayers(d, selection());
        created = result.ids;
        return result.document;
      });
      if (created.length > 0) select(created);
    },
    group: () => apply((d) => groupLayers(d, selection()).document),
    ungroup: () => apply((d) => ungroupLayers(d, selection())),
    order: (direction: OrderDirection) => apply((d) => reorderLayers(d, selection(), direction)),
    nudge: (dx: number, dy: number) => apply((d) => translateLayers(d, selection(), dx / d.canvas.width, dy / d.canvas.height)),
    align: (alignment: Alignment) => apply((d) => alignLayers(d, selection(), alignment)),
    distribute: (axis: DistributeAxis) => apply((d) => distributeLayers(d, selection(), axis)),
    setLocked: (ids: readonly string[], locked: boolean) => apply((d) => setLayersLocked(d, ids, locked)),
    setHidden: (ids: readonly string[], hidden: boolean) => apply((d) => setLayersHidden(d, ids, hidden)),
    rename: (id: string, name: string) => {
      const clean = name.trim();
      apply((d) => updateLayers(d, [id], { name: clean === "" ? undefined : clean }));
    },
    move: (id: string, toIndex: number) => apply((d) => moveLayerTo(d, id, toIndex)),
    moveItem: (item: TreeItem, toIndex: number, parent: string | null) => apply((d) => moveItem(d, item, toIndex, parent)),
    renameGroup: (groupId: string, name: string) => apply((d) => renameGroup(d, groupId, name)),
    dissolveGroup: (groupId: string) => apply((d) => dissolveGroup(d, groupId)),
    copyStyle: () => {
      const layer = layerById(doc(), selection()[0] ?? "");
      if (!layer) return false;
      copiedStyle = styleOf(layer);
      ui.setState({ styleCopied: true });
      return true;
    },
    pasteStyle: () => {
      const style = copiedStyle;
      if (!style) return;
      apply((d) => updateLayers(d, selection(), (layer) => stylePatch(style, layer)));
    },
    setCanvasGradient: (gradient: Gradient | undefined) =>
      apply((d) => produce(d, (draft) => {
        if (gradient) draft.canvas.gradient = gradient;
        else delete draft.canvas.gradient;
      })),
    patchLayers: (ids: readonly string[], patch: LayerPatch | ((layer: Layer) => LayerPatch)) => apply((d) => updateLayers(d, ids, patch)),
    patchSelection: (patch: LayerPatch | ((layer: Layer) => LayerPatch)) => apply((d) => updateLayers(d, selection(), patch)),
    beginLive: () => store.getState().beginTransaction(),
    endLive: () => store.getState().commitTransaction(),
    insert,
    insertImage,
    copySelection: (): ClipboardContent => {
      const content = clipboardOf(doc(), selection());
      if (content.layers.length > 0) {
        copied = content;
        ui.setState({ clipboard: true });
      }
      return content;
    },
    pasteCopied: () => commands.paste(copied),
    paste: (content: ClipboardContent) => {
      let created: string[] = [];
      apply((d) => {
        const result = pasteLayers(d, content.layers, DUPLICATE_OFFSET, content.groups);
        created = result.ids;
        return result.document;
      });
      if (created.length > 0) select(created);
    },
    startTextEdit: (id: string) => {
      const layer = layerById(doc(), id);
      if (!layer || layer.type !== "text" || layer.locked) return;
      select([id]);
      ui.setState({ editingTextId: id, crop: null });
    },
    finishTextEdit: (id: string, text: string) => {
      ui.setState({ editingTextId: null });
      apply((d) => commitText(d, id, text), text.trim() === "" ? [] : [id]);
    },
    startCrop: (id: string) => {
      const layer = layerById(doc(), id);
      if (!layer || layer.type !== "image" || layer.locked) return;
      const frame = cropFrame(layer, doc().canvas);
      select([id]);
      ui.setState({ crop: { layerId: id, frame, box: frame.box }, editingTextId: null });
    },
    updateCropBox: (box: PixelBox) => ui.setState((s) => (s.crop ? { crop: { ...s.crop, box } } : {})),
    resetCrop: () => ui.setState((s) => (s.crop ? { crop: { ...s.crop, box: { left: 0, top: 0, width: s.crop.frame.width, height: s.crop.frame.height } } } : {})),
    finishCrop: () => {
      const session = ui.getState().crop;
      if (!session) return;
      ui.setState({ crop: null });
      apply((d) => {
        const layer = layerById(d, session.layerId);
        if (!layer) return d;
        return updateLayers(d, [layer.id], applyCropBox(layer, session.frame, session.box, d.canvas));
      });
    },
    cancelCrop,
    resize: (size: CanvasSize) => {
      apply((d) => resizeCanvas(d, size));
      if (ui.getState().fit) fit();
    },
    setBackground: (background: string) =>
      apply((d) => (d.canvas.background === background ? d : { ...d, canvas: { ...d.canvas, background } })),
    setZoom,
    zoomStep: (direction: 1 | -1) => setZoom(stepZoom(ui.getState().viewport.scale, direction)),
    fit,
    startJob: async (purpose: JobPurpose, input: MediaGenerationInput, layerId: string | null = null) => {
      const id = newStudioId("job");
      ui.setState((s) => ({ jobs: [...s.jobs, { id, purpose, layerId, created: null, settling: false, error: null }] }));
      const result = await deps.requestJob(input);
      if ("error" in result) {
        patchJob(id, { error: jobErrorCode(result.code) });
        return;
      }
      patchJob(id, { created: result.data });
    },
    jobProgress: (id: string, settling: boolean) => patchJob(id, { settling }),
    jobFailed: (id: string, code: string) => patchJob(id, { error: jobErrorCode(code) }),
    jobDone: async (id: string, mediaId: string) => {
      const job = ui.getState().jobs.find((j) => j.id === id);
      if (!job) return;
      const source = job.layerId ? layerById(doc(), job.layerId) : undefined;
      if (job.purpose === "cutout" && source && !source.locked) {
        apply((d) => updateLayers(d, [source.id], { assetId: mediaId }));
        dropJob(id);
        return;
      }
      const placed = await insertImage(mediaId, job.purpose === "generate" || !source ? {} : { aboveId: source.id, within: source.transform });
      if (placed) dropJob(id);
      else patchJob(id, { error: "result_unavailable" });
    },
    dismissJob: dropJob,
    replaceImage: async (layerId: string, assetId: string): Promise<boolean> => {
      let natural: CanvasSize;
      try {
        natural = await deps.naturalSize(assetId);
      } catch {
        return false;
      }
      const layer = layerById(doc(), layerId);
      if (!layer || layer.locked) return false;
      apply((d) => updateLayers(d, [layerId], replaceImageAsset(layer, assetId, natural, d.canvas)));
      return true;
    },
    runAction: (action: ImageAction) => {
      switch (action.type) {
        case "undo":
          return commands.undo();
        case "redo":
          return commands.redo();
        case "group":
          return commands.group();
        case "ungroup":
          return commands.ungroup();
        case "duplicate":
          return commands.duplicate();
        case "order":
          return commands.order(action.direction);
        case "nudge":
          return commands.nudge(action.dx, action.dy);
        case "delete":
          return commands.remove();
        case "selectAll":
          return commands.selectAll();
        case "deselect":
          return commands.deselect();
      }
    },
  };
  return commands;
}
