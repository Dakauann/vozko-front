import type { ActionResult } from "@/app/actions/action-result";
import { canStart } from "@/lib/media-generation/limits";
import type { MediaGenerationInput, MediaGenerationJob } from "@/lib/media-generation/types";
import { applyCropBox, applyFramedCrop, centeredFramedBox, cropFrame, framedRatio } from "@/lib/studio/crop";
import { produce } from "immer";

import {
  addArtboard,
  artboardBounds,
  artboardById,
  artboardOfItem,
  artboardsBounds,
  deleteArtboards,
  duplicateArtboard,
  editArtboard,
  moveLayersToArtboard,
  neighborArtboard,
  selectedArtboards,
  updateArtboard,
  type LayerTransfer,
} from "@/lib/studio/artboards";
import { arrangeArtboards, arrangeTargets, tidyArrangement, type ArrangeOptions } from "@/lib/studio/artboard-arrange";
import { newImageLayer, newStudioId, type Artboard, type CanvasSize, type Gradient, type ImageDocument, type ImageSurface, type Layer } from "@/lib/studio/document";
import { childrenSelection, fitInside, fittedTransform, parentSelection, type PixelBox } from "@/lib/studio/geometry";
import { clipboardOf, type ClipboardContent } from "@/lib/studio/clipboard";
import { dissolveGroup, dropItem, renameGroup, type DropPosition, type TreeItem } from "@/lib/studio/groups";
import type { Repeat } from "@/lib/studio/repeat";
import { editSurfaceVfx, type StillVfxChange, type StillVfxTarget } from "@/lib/studio/still-vfx-edit";
import { expandRepeat, repeatLayers, setRepeat } from "@/lib/studio/repeat-edits";
import { addInstance, clipboardComponents, createComponent, detachInstance, pastedContent, resetOverrides, setComponent, setOverrides, swapComponent, type ComponentRefusal } from "@/lib/studio/component-edits";
import type { OverrideField, OverrideValues } from "@/lib/studio/components";
import { applyStyle, createStyle, deleteStyle, detachStyle, mergedStyles, referencedStyles, styleUses, updateStyle, type NewStyle, type StylePatchInput, type StyleRefusal, type StyleTarget } from "@/lib/studio/shared-style-edits";
import type { LayerSlot, StyleRole, StyleSlot } from "@/lib/studio/shared-styles";
import type { HugMeasure, Layout, LayoutItem } from "@/lib/studio/auto-layout";
import { removeLayout, scaffoldFor, setLayout, setLayoutItem, type LayoutRefusal, type LayoutTarget } from "@/lib/studio/auto-layout-edits";
import { commitText, jobErrorCode, replaceImageAsset } from "@/lib/studio/image-edits";
import { fillFrame, fillTargetAt, fillTargetOf } from "@/lib/studio/frame-fill";
import { slotAsset, withSlotAsset, type AssetSlot } from "@/lib/studio/image-sources";
import { jobLanding, jobStartAsset } from "@/lib/studio/job-landing";
import type { TextEdit } from "@/lib/studio/text-run-editing";
import { styleOf, stylePatch, type CopiedStyle } from "@/lib/studio/style";
import type { ImageAction } from "@/lib/studio/keymap";
import {
  addLayers,
  addLayersAbove,
  alignLayers,
  createScaffold,
  deleteLayers,
  DUPLICATE_OFFSET,
  distributeLayers,
  duplicateLayers,
  groupLayers,
  isPickable,
  layerBounds,
  layerById,
  newlyLocked,
  pasteLayers,
  reorderLayers,
  resizeCanvas,
  setLayersHidden,
  setLayersLocked,
  translateLayers,
  ungroupLayers,
  updateLayers,
  type Alignment,
  type Bounds,
  type DistributeAxis,
  type LayerPatch,
  type OrderDirection,
} from "@/lib/studio/layers";
import type { Subpath } from "@/lib/studio/path-nodes";
import { mergeLive, runShapeOp, type ShapeOpIssue, type ShapeOpKind } from "@/lib/studio/shape-ops";
import type { MergeMode } from "@/lib/studio/path-ops";
import type { StudioEditorStore } from "@/lib/studio/store";
import { layersToSvg } from "@/lib/studio/svg-export";
import type { TraceResult } from "@/lib/studio/trace/trace";
import { importSvg, type SvgImportOutcome, type SvgTarget } from "@/lib/studio/svg-import";
import { insertImageContent } from "@/lib/studio/library/instantiate";
import { expandChart } from "@/lib/studio/chart-edits";
import type { LibraryLayers } from "@/lib/studio/library/model";
import { documentIssue } from "@/lib/studio/validate";
import { convertToPath, pathLayerFromCanvas } from "@/lib/studio/vector-layer";
import type { VectorTool } from "@/lib/studio/vector-tools";
import { fitBounds, stepZoom, viewArea, visibleShare, zoomAt, type Point } from "@/lib/studio/viewport";

import { currentArtboard, jobKind, type EditorUiStore, type JobPurpose, type StudioJob } from "./editor-state";
import { createPixelCommands } from "./pixel-commands";

function runningJobKinds(ui: EditorUiStore): ("image" | "cutout")[] {
  return ui.getState().jobs.filter((job) => !job.error).map((job) => jobKind(job.purpose));
}

export interface CommandDeps {
  requestJob: (input: MediaGenerationInput) => Promise<ActionResult<MediaGenerationJob>>;
  naturalSize: (assetId: string) => Promise<CanvasSize>;
  measure?: HugMeasure;
}

interface PhotoSpot {
  artboardId: string;
  x: number;
  y: number;
}

interface InsertImageOptions {
  aboveId?: string;
  within?: Layer["transform"];
}

export type ImageCommands = ReturnType<typeof createImageCommands>;

const MIN_VISIBLE_SHARE = 0.6;

function selectionArea(doc: ImageDocument, selection: readonly string[], fallback: Artboard): Bounds {
  const boards = selectedArtboards(doc, selection);
  if (boards.length > 0) return boards.map(artboardBounds).reduce(union);
  const home = selection.length > 0 ? artboardOfItem(doc, selection[0]) : undefined;
  const picked = home ? home.layers.filter((l) => selection.includes(l.id) && !l.hidden) : [];
  if (!home || picked.length === 0) return artboardBounds(fallback);
  return picked.map((l) => layerBounds(l.transform, home.canvas)).map((b) => ({ left: b.left + home.x, right: b.right + home.x, top: b.top + home.y, bottom: b.bottom + home.y })).reduce(union);
}

function union(a: Bounds, b: Bounds): Bounds {
  return { left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) };
}

export function createImageCommands(store: StudioEditorStore<ImageDocument>, ui: EditorUiStore, deps: CommandDeps) {
  const document = () => store.getState().document;
  const active = (): Artboard => currentArtboard(store, ui);
  const homeOf = (ids: readonly string[]): Artboard => (ids.length > 0 ? artboardOfItem(document(), ids[0]) : undefined) ?? active();
  const selection = () => store.getState().selection;
  const applyDocument = (operation: (d: ImageDocument) => ImageDocument, next?: string[]) => store.getState().apply(operation, next);
  const apply = (operation: (s: ImageSurface) => ImageSurface, next?: string[], artboardId: string = active().id) =>
    applyDocument((d) => editArtboard(d, artboardId, operation), next);
  const applyToSelection = (operation: (s: ImageSurface, ids: string[]) => ImageSurface) => {
    const ids = selection();
    apply((s) => operation(s, ids), undefined, homeOf(ids).id);
  };
  const boardsInSelection = () => selectedArtboards(document(), selection()).map((a) => a.id);

  store.subscribe((state, previous) => {
    if (state.selection === previous.selection || state.selection.length === 0) return;
    const home = artboardOfItem(state.document, state.selection[0]);
    if (home && home.id !== ui.getState().artboardId) ui.setState({ artboardId: home.id });
  });

  const patchJob = (id: string, patch: Partial<StudioJob>) =>
    ui.setState((s) => ({ jobs: s.jobs.map((job) => (job.id === id ? { ...job, ...patch } : job)) }));
  const dropJob = (id: string) => ui.setState((s) => ({ jobs: s.jobs.filter((job) => job.id !== id) }));
  const addJob = (spec: { purpose: JobPurpose; layerId: string | null; slot?: AssetSlot; start: MediaGenerationInput | MediaGenerationJob; created: MediaGenerationJob | null; byAgent: boolean }): string => {
    const id = newStudioId("job");
    const startedFrom = jobStartAsset(spec.start);
    const job: StudioJob = {
      id,
      purpose: spec.purpose,
      layerId: spec.layerId,
      ...(spec.slot !== undefined ? { slot: spec.slot } : {}),
      ...(startedFrom ? { startedFrom } : {}),
      created: spec.created,
      settling: false,
      error: null,
      byAgent: spec.byAgent,
    };
    ui.setState((s) => ({ jobs: [...s.jobs, job] }));
    return id;
  };

  const insert = (layers: Layer[], atIndex?: number): string[] => {
    if (layers.length === 0) return [];
    const ids = layers.map((l) => l.id);
    const before = document();
    apply((s) => addLayers(s, layers, atIndex), ids);
    return document() === before ? [] : ids;
  };

  const insertImage = async (assetId: string, options: InsertImageOptions = {}): Promise<boolean> => {
    let natural: CanvasSize;
    try {
      natural = await deps.naturalSize(assetId);
    } catch {
      return false;
    }
    const home = options.aboveId ? homeOf([options.aboveId]) : active();
    const transform = options.within ? fitInside(natural.width, natural.height, options.within, home.canvas) : fittedTransform(natural.width, natural.height, home.canvas);
    const layer = newImageLayer(assetId, transform);
    const before = document();
    apply((s) => (options.aboveId ? addLayersAbove(s, [layer], options.aboveId) : addLayers(s, [layer])), [layer.id], home.id);
    return document() !== before;
  };

  const placePhoto = async (assetId: string, spot?: PhotoSpot): Promise<boolean> => {
    let natural: CanvasSize;
    try {
      natural = await deps.naturalSize(assetId);
    } catch {
      return false;
    }
    const ids = selection();
    const board = spot ? artboardById(document(), spot.artboardId) : homeOf(ids);
    if (!board) return false;
    const target = spot ? fillTargetAt(board, { x: spot.x * board.canvas.width, y: spot.y * board.canvas.height }) : ids.length === 1 ? fillTargetOf(board, ids[0]) : null;
    if (target) {
      const outcome = fillFrame(board, target, assetId, natural);
      if (!outcome.ok) return false;
      apply((s) => (s === board ? outcome.document : s), [outcome.photoId], board.id);
      return true;
    }
    if (!spot) return insertImage(assetId);
    const layer = newImageLayer(assetId, { ...fittedTransform(natural.width, natural.height, board.canvas), x: spot.x, y: spot.y });
    const before = document();
    apply((s) => addLayers(s, [layer]), [layer.id], board.id);
    return document() !== before;
  };

  const select = (ids: string[]) => store.getState().select(ids);

  const setZoom = (scale: number) => {
    const { container, viewport } = ui.getState();
    const anchor = container ? { x: container.width / 2, y: container.height / 2 } : { x: 0, y: 0 };
    ui.setState({ viewport: zoomAt(viewport, scale, anchor), fit: false });
  };

  const show = (area: Bounds, fit: boolean) => {
    const { container } = ui.getState();
    if (!container) return ui.setState({ fit });
    ui.setState({ viewport: fitBounds(container, area), fit });
  };

  const fit = () => show(artboardsBounds(document()), true);

  const reveal = (artboardId: string) => {
    const artboard = artboardById(document(), artboardId);
    if (!artboard) return;
    if (ui.getState().fit) return fit();
    show(artboardBounds(artboard), false);
  };

  const ensureVisible = (artboardId: string) => {
    const artboard = artboardById(document(), artboardId);
    const { container, viewport } = ui.getState();
    if (!artboard || !container || visibleShare(artboardBounds(artboard), viewArea(viewport, container)) >= MIN_VISIBLE_SHARE) return;
    if (ui.getState().fit) return fit();
    show(artboardBounds(artboard), false);
  };

  const cancelCrop = () => ui.setState({ crop: null });

  const convertible = (s: ImageSurface, ids: readonly string[]) =>
    ids.flatMap((id) => {
      const layer = layerById(s, id);
      const patch = layer && !layer.locked ? convertToPath(layer, s.canvas) : null;
      return patch ? [[id, patch] as const] : [];
    });

  const convertLayers = (ids: readonly string[]) => {
    const home = homeOf(ids);
    const patches = new Map(convertible(home, ids));
    if (patches.size > 0) apply((s) => updateLayers(s, [...patches.keys()], (layer) => patches.get(layer.id) ?? {}), undefined, home.id);
  };

  const shapeOperation = (kind: ShapeOpKind): ShapeOpIssue | null => {
    const home = homeOf(selection());
    const result = runShapeOp(home, selection(), kind);
    if (!result.ok) return result.issue;
    apply(() => result.document, result.ids, home.id);
    return null;
  };

  const liveMerge = (mode: MergeMode): ShapeOpIssue | null => {
    const home = homeOf(selection());
    const result = mergeLive(home, selection(), mode);
    if (!result.ok) return result.issue;
    apply(() => result.document, result.ids, home.id);
    return null;
  };

  const placed = (artboardId: string, surface: ImageSurface, ids: string[]): SvgImportOutcome | null => {
    const next = editArtboard(document(), artboardId, () => surface);
    const issue = documentIssue("image", next);
    if (issue) return { ok: false, reason: issue.code === "too_large" ? "too_large" : "invalid" };
    applyDocument(() => next, ids);
    return null;
  };

  const duplicateArtboards = (ids: readonly string[], size?: CanvasSize): string[] => {
    const created: string[] = [];
    applyDocument((d) =>
      ids.reduce((current, id) => {
        const copy = duplicateArtboard(current, id, { size });
        if (copy.id) created.push(copy.id);
        return copy.document;
      }, d),
    );
    if (created.length > 0) {
      select(created);
      reveal(created[created.length - 1]);
    }
    return created;
  };

  const removeArtboards = (ids: readonly string[]) => {
    const before = document();
    applyDocument((d) => deleteArtboards(d, ids), []);
    if (document() !== before) ui.setState({ artboardId: document().artboards[0].id });
  };

  let copied: ClipboardContent = { layers: [], groups: [] };
  let copiedStyle: CopiedStyle | null = null;

  const commands = {
    undo: () => store.getState().undo(),
    redo: () => store.getState().redo(),
    select,
    selectAll: () => select(active().layers.filter(isPickable).map((l) => l.id)),
    selectChildren: () => select(childrenSelection(homeOf(selection()), selection())),
    selectParent: () => select(parentSelection(homeOf(selection()), selection())),
    deselect: () => {
      const state = ui.getState();
      if (state.pathEditId) return ui.setState({ pathEditId: null });
      if (state.crop) return cancelCrop();
      if (state.editingTextId) return ui.setState({ editingTextId: null });
      select([]);
    },
    remove: () => {
      const boards = boardsInSelection();
      if (boards.length > 0) return removeArtboards(boards);
      const ids = selection();
      const home = homeOf(ids);
      const before = document();
      apply((s) => deleteLayers(s, ids), [], home.id);
      if (document() === before) return;
      select(ids.filter((id) => artboardOfItem(document(), id)));
    },
    duplicate: () => {
      const boards = boardsInSelection();
      if (boards.length > 0) return void duplicateArtboards(boards);
      let created: string[] = [];
      applyToSelection((s, ids) => {
        const result = duplicateLayers(s, ids);
        created = result.ids;
        return result.document;
      });
      if (created.length > 0) select(created);
    },
    group: () => applyToSelection((s, ids) => groupLayers(s, ids).document),
    scaffold: () => applyToSelection((s, ids) => createScaffold(s, ids).document),
    ungroup: () => applyToSelection(ungroupLayers),
    order: (direction: OrderDirection, ids: readonly string[] = selection()) => apply((s) => reorderLayers(s, ids, direction), undefined, homeOf(ids).id),
    nudge: (dx: number, dy: number) => {
      const boards = boardsInSelection();
      if (boards.length > 0) {
        return applyDocument((d) => boards.reduce((current, id) => {
          const artboard = artboardById(current, id)!;
          return updateArtboard(current, id, { x: artboard.x + dx, y: artboard.y + dy });
        }, d));
      }
      applyToSelection((s, ids) => translateLayers(s, ids, dx / s.canvas.width, dy / s.canvas.height));
    },
    align: (alignment: Alignment) => applyToSelection((s, ids) => alignLayers(s, ids, alignment)),
    distribute: (axis: DistributeAxis) => applyToSelection((s, ids) => distributeLayers(s, ids, axis)),
    setLocked: (ids: readonly string[], locked: boolean) => {
      const home = homeOf(ids);
      const after = setLayersLocked(home, ids, locked);
      const released = new Set(newlyLocked(home, after, selection()));
      apply(() => after, selection().filter((id) => !released.has(id)), home.id);
    },
    setHidden: (ids: readonly string[], hidden: boolean) => apply((s) => setLayersHidden(s, ids, hidden), undefined, homeOf(ids).id),
    toggleLocked: () => {
      const ids = selection();
      if (ids.length > 0) commands.setLocked(ids, !ids.every((id) => layerById(homeOf(ids), id)?.locked));
    },
    toggleHidden: () => {
      const ids = selection();
      if (ids.length > 0) commands.setHidden(ids, !ids.every((id) => layerById(homeOf(ids), id)?.hidden));
    },
    rename: (id: string, name: string) => {
      const clean = name.trim();
      apply((s) => updateLayers(s, [id], { name: clean === "" ? undefined : clean }), undefined, homeOf([id]).id);
    },
    dropItem: (item: TreeItem, target: TreeItem, position: DropPosition) => {
      const from = homeOf([item.id]);
      const to = homeOf([target.id]);
      if (from.id === to.id) return apply((s) => dropItem(s, item, target, position), undefined, from.id);
      if (item.kind === "layer") commands.moveLayersToArtboard([item.id], to.id, "keep-relative");
    },
    renameGroup: (groupId: string, name: string) => apply((s) => renameGroup(s, groupId, name), undefined, homeOf([groupId]).id),
    dissolveGroup: (groupId: string) => apply((s) => dissolveGroup(s, groupId), undefined, homeOf([groupId]).id),
    repeat: (repeat: Repeat) => applyToSelection((s, ids) => repeatLayers(s, ids, repeat).document),
    setRepeat: (groupId: string, repeat: Repeat | undefined) => apply((s) => setRepeat(s, groupId, repeat), undefined, homeOf([groupId]).id),
    createComponent: (name?: string): ComponentRefusal | null => {
      const result = createComponent(document(), selection(), name);
      if (!result.ok) return result.reason;
      applyDocument(() => result.document, [result.instanceId]);
      return null;
    },
    addInstance: (componentId: string): ComponentRefusal | null => {
      const result = addInstance(document(), active().id, componentId);
      if (!result.ok) return result.reason;
      applyDocument(() => result.document, [result.instanceId]);
      return null;
    },
    setOverrides: (instanceId: string, layerId: string, values: OverrideValues): ComponentRefusal | null => {
      const result = setOverrides(document(), instanceId, layerId, values);
      if (!result.ok) return result.reason;
      applyDocument(() => result.document);
      return null;
    },
    resetOverrides: (instanceId: string, layerId?: string, fields?: readonly OverrideField[]) => applyDocument((d) => resetOverrides(d, instanceId, layerId, fields)),
    detachInstances: (ids: readonly string[]) => {
      const created: string[] = [];
      const next = ids.reduce((doc, id) => {
        const result = detachInstance(doc, id);
        if (!result.ok) return doc;
        created.push(...result.ids);
        return result.document;
      }, document());
      if (created.length > 0) applyDocument(() => next, created);
    },
    swapComponent: (instanceId: string, componentId: string) => {
      const result = swapComponent(document(), instanceId, componentId);
      if (result.ok) applyDocument(() => result.document);
    },
    setComponent: (artboardId: string, on: boolean): ComponentRefusal | null => {
      const result = setComponent(document(), artboardId, on);
      if (!result.ok) return result.reason;
      applyDocument(() => result.document);
      return null;
    },
    createStyle: (input: NewStyle): StyleRefusal | null => {
      const result = createStyle(document(), input);
      if (!result.ok) return result.reason;
      applyDocument(() => result.document);
      return null;
    },
    updateStyle: (styleId: string, patch: { name?: string; description?: string; role?: StyleRole | null; values?: StylePatchInput }): StyleRefusal | null => {
      const result = updateStyle(document(), styleId, patch);
      if (!result.ok) return result.reason;
      applyDocument(() => result.document);
      return null;
    },
    applyStyle: (styleId: string, targets: readonly StyleTarget[], slot?: LayerSlot): StyleRefusal | null => {
      const result = applyStyle(document(), styleId, targets, slot);
      if (!result.ok) return result.reason;
      applyDocument(() => result.document);
      return null;
    },
    detachStyle: (targets: readonly StyleTarget[], slot?: StyleSlot) => applyDocument((d) => detachStyle(d, targets, slot)),
    deleteStyle: (styleId: string) => applyDocument((d) => deleteStyle(d, styleId)),
    selectStyleUses: (styleId: string) => {
      const uses = styleUses(document(), styleId);
      const layers = uses.flatMap((use) => (use.layerId ? [use.layerId] : []));
      const home = layers.length > 0 ? artboardOfItem(document(), layers[0]) : undefined;
      if (home) select(layers.filter((id) => artboardOfItem(document(), id)?.id === home.id));
      else if (uses.length > 0) select([uses[0].artboardId]);
    },
    setLayout: (target: LayoutTarget, patch: Partial<Layout>): LayoutRefusal | null => {
      const home = homeOf("groupId" in target ? [target.groupId] : [...target.ids]);
      const result = setLayout(home, target, patch, deps.measure);
      if (!result.ok) return result.reason;
      apply(() => result.document, undefined, home.id);
      return null;
    },
    addAutoLayout: (): LayoutRefusal | null => {
      const ids = selection().filter((id) => !artboardById(document(), id));
      if (ids.length === 0) return "missing";
      const group = scaffoldFor(homeOf(ids), ids);
      if (group?.layout) return null;
      return commands.setLayout(group ? { groupId: group.id } : { ids }, {});
    },
    removeLayout: (groupId: string) => apply((s) => removeLayout(s, groupId), undefined, homeOf([groupId]).id),
    setLayoutItem: (id: string, patch: Partial<LayoutItem>): LayoutRefusal | null => {
      const home = homeOf([id]);
      const result = setLayoutItem(home, id, patch, deps.measure);
      if (!result.ok) return result.reason;
      apply(() => result.document, undefined, home.id);
      return null;
    },
    showComponent: (componentId: string) => {
      const artboard = artboardById(document(), componentId);
      if (!artboard) return;
      select([componentId]);
      ui.setState({ artboardId: componentId });
      show(artboardBounds(artboard), false);
    },
    expandRepeat: (groupId: string): boolean => {
      const outcome = expandRepeat(homeOf([groupId]), groupId);
      if (!outcome.ok) return false;
      apply(() => outcome.document, undefined, homeOf([groupId]).id);
      return true;
    },
    expandChart: (layerId: string): boolean => {
      const outcome = expandChart(homeOf([layerId]), layerId);
      if (!outcome.ok) return false;
      apply(() => outcome.document, outcome.ids, homeOf([layerId]).id);
      return true;
    },
    copyStyle: () => {
      const id = selection()[0] ?? "";
      const layer = layerById(homeOf([id]), id);
      if (!layer) return false;
      copiedStyle = styleOf(layer);
      ui.setState({ styleCopied: true });
      return true;
    },
    pasteStyle: () => {
      const style = copiedStyle;
      if (!style) return;
      applyToSelection((s, ids) => updateLayers(s, ids, (layer) => stylePatch(style, layer)));
    },
    setCanvasGradient: (gradient: Gradient | undefined) =>
      apply((s) =>
        produce(s, (draft) => {
          if (gradient) draft.canvas.gradient = gradient;
          else delete draft.canvas.gradient;
        }),
      ),
    patchLayers: (ids: readonly string[], patch: LayerPatch | ((layer: Layer) => LayerPatch)) => apply((s) => updateLayers(s, ids, patch), undefined, homeOf(ids).id),
    editVfx: (target: StillVfxTarget, change: StillVfxChange): boolean => {
      let applied = false;
      apply(
        (s) => {
          const edit = editSurfaceVfx(s, target, change);
          applied = edit.ok;
          return edit.ok ? edit.surface : s;
        },
        undefined,
        target.kind === "layer" ? homeOf([target.layerId]).id : active().id,
      );
      return applied;
    },
    patchSelection: (patch: LayerPatch | ((layer: Layer) => LayerPatch)) => applyToSelection((s, ids) => updateLayers(s, ids, patch)),
    beginLive: () => store.getState().beginTransaction(),
    endLive: () => store.getState().commitTransaction(),
    insert,
    insertLibrary: (content: LibraryLayers, artboardId: string = active().id): string[] => {
      const home = artboardById(document(), artboardId);
      if (!home || content.layers.length === 0) return [];
      const placed = insertImageContent(home, content);
      const before = document();
      apply(() => placed.document, placed.ids, home.id);
      return document() === before ? [] : placed.ids;
    },
    insertImage,
    placePhoto,
    copySelection: (): ClipboardContent => {
      const surface = clipboardOf(homeOf(selection()), selection());
      const components = clipboardComponents(document(), surface.layers);
      const styles = referencedStyles(document(), surface.layers);
      const content = { ...surface, ...(components.length > 0 ? { components } : {}), ...(styles.length > 0 ? { styles } : {}) };
      if (content.layers.length > 0) {
        copied = content;
        ui.setState({ clipboard: true });
      }
      return content;
    },
    pasteCopied: () => commands.paste(copied),
    paste: (copiedContent: ClipboardContent) => {
      let created: string[] = [];
      const content = pastedContent(document(), active().id, copiedContent);
      const artboardId = active().id;
      applyDocument((d) =>
        editArtboard(mergedStyles(d, content.styles ?? []), artboardId, (s) => {
          const result = pasteLayers(s, content.layers, DUPLICATE_OFFSET, content.groups);
          created = result.ids;
          return result.document;
        }),
      );
      if (created.length > 0) select(created);
    },
    startTextEdit: (id: string) => {
      const layer = layerById(homeOf([id]), id);
      if (!layer || layer.type !== "text" || layer.locked) return;
      select([id]);
      ui.setState({ editingTextId: id, crop: null });
    },
    finishTextEdit: (id: string, edit: TextEdit) => {
      ui.setState({ editingTextId: null });
      apply((s) => commitText(s, id, edit), edit.text.trim() === "" ? [] : [id], homeOf([id]).id);
    },
    startCrop: (id: string) => {
      const home = homeOf([id]);
      const layer = layerById(home, id);
      if (!layer || layer.type !== "image" || layer.locked) return;
      const frame = cropFrame(layer, home.canvas);
      select([id]);
      ui.setState({ crop: { layerId: id, frame, box: frame.box, ...(layer.clip ? { ratio: framedRatio(layer, home.canvas) } : {}) }, editingTextId: null });
    },
    updateCropBox: (box: PixelBox) => ui.setState((s) => (s.crop ? { crop: { ...s.crop, box } } : {})),
    resetCrop: () =>
      ui.setState((s) => {
        if (!s.crop) return {};
        const { frame, ratio } = s.crop;
        return { crop: { ...s.crop, box: ratio ? centeredFramedBox(frame, ratio) : { left: 0, top: 0, width: frame.width, height: frame.height } } };
      }),
    finishCrop: () => {
      const session = ui.getState().crop;
      if (!session) return;
      ui.setState({ crop: null });
      apply(
        (s) => {
          const layer = layerById(s, session.layerId);
          if (!layer) return s;
          return updateLayers(s, [layer.id], session.ratio ? applyFramedCrop(layer, session.frame, session.box, s.canvas) : applyCropBox(layer, session.frame, session.box, s.canvas));
        },
        undefined,
        homeOf([session.layerId]).id,
      );
    },
    cancelCrop,
    setTool: (tool: VectorTool) => ui.setState({ tool, pathEditId: null, crop: null, editingTextId: null, pixelTool: null, pixelLive: null }),
    insertDrawnPath: (subpath: Subpath, open: boolean): string | null => {
      const layer = pathLayerFromCanvas([subpath], active().canvas, open);
      const [id] = insert([layer]);
      if (!id) return null;
      if (ui.getState().tool === "pen") ui.setState({ tool: "select" });
      return id;
    },
    convertToPath: convertLayers,
    startPathEdit: (id: string) => {
      const layer = layerById(homeOf([id]), id);
      if (!layer || layer.locked || layer.type !== "shape") return;
      if (layer.shape !== "path") {
        convertLayers([id]);
        if (layerById(homeOf([id]), id)?.shape !== "path") return;
      }
      select([id]);
      ui.setState({ pathEditId: id, tool: "select", crop: null, editingTextId: null });
    },
    finishPathEdit: () => ui.setState({ pathEditId: null }),
    shapeOperation,
    liveMerge,
    importSvg: (text: string, name?: string, target?: SvgTarget): SvgImportOutcome => {
      const home = active();
      const result = importSvg(text, home.canvas, { name, target });
      if (!result.ok) return result;
      const pasted = pasteLayers(home, result.value.layers, 0, result.value.groups);
      return placed(home.id, pasted.document, pasted.ids) ?? { ok: true, count: pasted.ids.length, skipped: result.value.skipped };
    },
    selectionSvg: () => layersToSvg(homeOf(selection()), selection()),
    placeTrace: (layerId: string, traced: TraceResult, name?: string): SvgImportOutcome => {
      const home = homeOf([layerId]);
      const layer = layerById(home, layerId);
      if (!layer || layer.type !== "image" || layer.locked) return { ok: false, reason: "invalid" };
      if (traced.shapes === 0) return { ok: false, reason: "empty" };
      const { canvas } = home;
      const t = layer.transform;
      const target = { center: { x: t.x * canvas.width, y: t.y * canvas.height }, width: t.w * canvas.width, height: t.h * canvas.height, rotation: t.rotation };
      const result = importSvg(traced.svg, canvas, { name, target });
      if (!result.ok) return result;
      const index = home.layers.findIndex((l) => l.id === layerId);
      const pasted = pasteLayers(home, result.value.layers, 0, result.value.groups, index + 1);
      return placed(home.id, updateLayers(pasted.document, [layerId], { hidden: true }), pasted.ids) ?? { ok: true, count: pasted.ids.length, skipped: 0 };
    },
    resize: (size: CanvasSize) => {
      apply((s) => resizeCanvas(s, size));
      if (ui.getState().fit) fit();
    },
    setBackground: (background: string) => apply((s) => (s.canvas.background === background ? s : { ...s, canvas: { ...s.canvas, background } })),
    setZoom,
    zoomStep: (direction: 1 | -1) => setZoom(stepZoom(ui.getState().viewport.scale, direction)),
    fit,
    fitSelection: () => show(selectionArea(document(), selection(), active()), false),
    showArtboard: (id: string) => {
      const artboard = artboardById(document(), id);
      if (artboard) show(artboardBounds(artboard), false);
    },
    ensureVisible,
    addArtboard: (size: CanvasSize, name?: string): string => {
      let id = "";
      applyDocument((d) => {
        const added = addArtboard(d, size, { name, after: active().id });
        id = added.id;
        return added.document;
      }, []);
      select([id]);
      ui.setState({ artboardId: id });
      reveal(id);
      return id;
    },
    duplicateArtboards,
    renameArtboard: (id: string, name: string) => applyDocument((d) => updateArtboard(d, id, { name })),
    moveArtboard: (id: string, place: Partial<Point>) => applyDocument((d) => updateArtboard(d, id, place)),
    arrangeArtboards: (options: ArrangeOptions) => applyDocument((d) => arrangeArtboards(d, arrangeTargets(d, selection()), options)),
    tidyArtboards: () =>
      applyDocument((d) => {
        const ids = arrangeTargets(d, selection());
        return arrangeArtboards(d, ids, tidyArrangement(d, ids));
      }),
    removeArtboards,
    selectArtboard: (id: string, additive: boolean) => {
      const current = boardsInSelection();
      select(additive ? (current.includes(id) ? current.filter((a) => a !== id) : [...current, id]) : [id]);
    },
    focusArtboard: (id: string) => {
      if (ui.getState().artboardId !== id) ui.setState({ artboardId: id });
    },
    stepArtboard: (direction: 1 | -1) => {
      const next = neighborArtboard(document(), active().id, direction);
      select([next.id]);
      ui.setState({ artboardId: next.id });
      show(artboardBounds(next), false);
    },
    startRenamingArtboard: (id: string) => ui.setState({ renamingArtboardId: id }),
    finishRenamingArtboard: (id: string, name: string) => {
      ui.setState({ renamingArtboardId: null });
      applyDocument((d) => updateArtboard(d, id, { name }));
    },
    moveLayersToArtboard: (ids: readonly string[], artboardId: string, mode: LayerTransfer = "keep-relative") => {
      applyDocument((d) => moveLayersToArtboard(d, ids, artboardId, mode), [...ids]);
    },
    startJob: async (purpose: JobPurpose, input: MediaGenerationInput, layerId: string | null = null, slot?: AssetSlot) => {
      if (!canStart(jobKind(purpose), runningJobKinds(ui))) return;
      const id = addJob({ purpose, layerId, slot, start: input, created: null, byAgent: false });
      const result = await deps.requestJob(input);
      if ("error" in result) {
        patchJob(id, { error: jobErrorCode(result.code) });
        return;
      }
      patchJob(id, { created: result.data });
    },
    followJob: (purpose: JobPurpose, job: MediaGenerationJob, layerId: string | null = null, slot?: AssetSlot): string => addJob({ purpose, layerId, slot, start: job, created: job, byAgent: true }),
    jobProgress: (id: string, settling: boolean) => patchJob(id, { settling }),
    jobFailed: (id: string, code: string) => patchJob(id, { error: jobErrorCode(code) }),
    jobDone: async (id: string, mediaId: string) => {
      const job = ui.getState().jobs.find((j) => j.id === id);
      if (!job) return;
      const source = job.layerId ? layerById(homeOf([job.layerId]), job.layerId) : undefined;
      const slot = job.slot ?? "asset";
      const inPlace = Boolean(source && !source.locked && jobLanding(job.startedFrom, slotAsset(source, slot)) === "inPlace");
      if (source && inPlace && (job.purpose === "cutout" || (job.purpose === "edit" && slot !== "asset"))) {
        apply((s) => updateLayers(s, [source.id], withSlotAsset(source, slot, mediaId)), undefined, homeOf([source.id]).id);
        dropJob(id);
        return;
      }
      if (source && inPlace && job.purpose === "edit" && fillTargetOf(homeOf([source.id]), source.id)?.photoId === source.id) {
        let natural: CanvasSize;
        try {
          natural = await deps.naturalSize(mediaId);
        } catch {
          patchJob(id, { error: "result_unavailable" });
          return;
        }
        const before = document();
        apply(
          (s) => {
            const target = fillTargetOf(s, source.id);
            const outcome = target?.photoId === source.id ? fillFrame(s, target, mediaId, natural) : null;
            return outcome?.ok ? outcome.document : s;
          },
          [source.id],
          homeOf([source.id]).id,
        );
        if (document() === before) patchJob(id, { error: "result_unavailable" });
        else dropJob(id);
        return;
      }
      const inserted = await insertImage(mediaId, job.purpose === "generate" || job.purpose === "element" || !source ? {} : { aboveId: source.id, within: source.transform });
      if (!inserted) {
        patchJob(id, { error: "result_unavailable" });
        return;
      }
      dropJob(id);
      if (job.purpose === "element") void commands.startJob("cutout", { kind: "cutout", sourceMediaId: mediaId }, selection()[0] ?? null);
    },
    dismissJob: dropJob,
    replaceImage: async (layerId: string, assetId: string): Promise<boolean> => {
      let natural: CanvasSize;
      try {
        natural = await deps.naturalSize(assetId);
      } catch {
        return false;
      }
      const home = homeOf([layerId]);
      const layer = layerById(home, layerId);
      if (!layer || layer.locked) return false;
      apply((s) => updateLayers(s, [layerId], replaceImageAsset(layer, assetId, natural, s.canvas)), undefined, home.id);
      return true;
    },
    pixel: createPixelCommands(store, ui),
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
        case "scaffold":
          return commands.scaffold();
        case "toggleLock":
          return commands.toggleLocked();
        case "toggleHidden":
          return commands.toggleHidden();
        case "selectChildren":
          return commands.selectChildren();
        case "selectParent":
          return commands.selectParent();
        case "tool":
          return commands.setTool(action.tool);
        case "shapeOp":
          return commands.shapeOperation(action.kind);
        case "artboard":
          return commands.stepArtboard(action.direction);
        case "component":
          return void commands.createComponent();
        case "detach":
          return commands.detachInstances(selection());
        case "autoLayout":
          return void commands.addAutoLayout();
      }
    },
  };
  return commands;
}
