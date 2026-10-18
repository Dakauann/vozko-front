import { artboardById, artboardOfItem, editArtboard } from "@/lib/studio/artboards";
import type { Artboard, ImageDocument, ImageSurface, Layer } from "@/lib/studio/document";
import { layerById } from "@/lib/studio/layers";
import { addPaintLayer, appendPixelOp, copySelectionToLayer, cropToSelection, paintSelection, type PixelAction, type PixelEdit, type PixelEditIssue } from "@/lib/studio/pixel-edits";
import { combineSelection, invertSelection, type PixelSelection, type SelectionCombine } from "@/lib/studio/pixel-selection";
import { pixelFrame } from "@/lib/studio/pixel-space";
import { newPixelOpId, type PixelMode, type SurfaceKind } from "@/lib/studio/pixel-surface";
import { brushStroke, nextBrushSize, nextHardness, StrokeBuilder, type BrushSettings, type PixelKeyAction, type PixelTool } from "@/lib/studio/pixel-tools";
import type { StudioEditorStore } from "@/lib/studio/store";
import type { Point } from "@/lib/studio/viewport";

import type { EditorUiStore } from "./editor-state";

export interface StrokeSession {
  add: (point: Point, pressure: number) => void;
  finish: () => void;
  cancel: () => void;
}

export type StrokeRefusal = "no_layer" | "locked" | "no_pixels";

interface StrokeTarget {
  layerId: string;
  kind: SurfaceKind;
  mode: PixelMode;
}

export function createPixelCommands(store: StudioEditorStore<ImageDocument>, ui: EditorUiStore) {
  const document = () => store.getState().document;
  const applyOn = (artboardId: string, operation: (surface: ImageSurface) => ImageSurface, next?: string[]) => store.getState().apply((d) => editArtboard(d, artboardId, operation), next);

  const picked = (artboard: Artboard): Layer | null => {
    const ids = store.getState().selection;
    return ids.length === 1 ? (layerById(artboard, ids[0]) ?? null) : null;
  };

  const strokeTarget = (artboard: Artboard, tool: "brush" | "eraser"): StrokeTarget | StrokeRefusal => {
    const layer = picked(artboard);
    const brush = ui.getState().brush;
    if (layer?.locked) return "locked";
    if (tool === "brush") {
      if (layer?.type === "paint") return { layerId: layer.id, kind: "paint", mode: "paint" };
      const added = addPaintLayer(artboard, layer ? { aboveId: layer.id } : {});
      applyOn(artboard.id, () => added.document, [added.id]);
      return { layerId: added.id, kind: "paint", mode: "paint" };
    }
    if (!layer) return "no_layer";
    if (layer.type === "paint") return { layerId: layer.id, kind: "paint", mode: "erase" };
    return layer.type === "image" ? { layerId: layer.id, kind: "mask", mode: brush.restore ? "reveal" : "hide" } : "no_pixels";
  };

  const selectionHome = (selection: PixelSelection): Artboard | undefined => artboardById(document(), selection.artboardId);

  const selectionLayer = (selection: PixelSelection): Layer | null => {
    const home = selectionHome(selection);
    return home ? picked(home) : null;
  };

  const run = (selection: PixelSelection, edit: (surface: ImageSurface) => PixelEdit): PixelEditIssue | null => {
    const home = selectionHome(selection);
    if (!home) return "missing";
    const result = edit(home);
    if (!result.ok) return result.issue;
    applyOn(home.id, () => result.document, result.created ? [result.created] : undefined);
    return null;
  };

  const withSelection = (action: (selection: PixelSelection) => PixelEditIssue | null): PixelEditIssue | null => {
    const selection = ui.getState().pixelSelection;
    return selection ? action(selection) : "empty";
  };

  const paintArea = (action: PixelAction) =>
    withSelection((selection) => {
      const layer = selectionLayer(selection);
      const brush = ui.getState().brush;
      const ink = { color: brush.color, opacity: brush.opacity };
      if (layer) return run(selection, (surface) => paintSelection(surface, layer.id, selection, action, ink));
      if (action !== "fill") return "missing";
      return run(selection, (surface) => {
        const added = addPaintLayer(surface);
        const filled = paintSelection(added.document, added.id, selection, "fill", ink);
        return filled.ok ? { ...filled, created: added.id } : filled;
      });
    });

  const commands = {
    setTool: (pixelTool: PixelTool | null) => ui.setState({ pixelTool, tool: "select", pathEditId: null, crop: null, editingTextId: null, pixelLive: null }),
    setBrush: (patch: Partial<BrushSettings>) => ui.setState({ brush: { ...ui.getState().brush, ...patch } }),
    startStroke: (artboardId: string, tool: "brush" | "eraser", pen: boolean): StrokeSession | StrokeRefusal => {
      const artboard = artboardById(document(), artboardId);
      if (!artboard) return "no_layer";
      const target = strokeTarget(artboard, tool);
      if (typeof target === "string") return target;
      const home = artboardOfItem(document(), target.layerId) ?? artboard;
      const layer = layerById(home, target.layerId)!;
      const frame = pixelFrame(layer, home.canvas, target.kind);
      if (!frame) return "no_pixels";
      const brush = ui.getState().brush;
      const builder = new StrokeBuilder(frame, brushStroke(brush, frame, target.mode, newPixelOpId(), pen && brush.pressure));
      const end = () => ui.setState({ pixelLive: null });
      return {
        add: (point, pressure) => ui.setState({ pixelLive: { layerId: target.layerId, kind: target.kind, op: builder.add(point, pressure) } }),
        finish: () => {
          const op = builder.finish();
          if (op.points.length > 0) applyOn(home.id, (surface) => appendPixelOp(surface, target.layerId, target.kind, op), [target.layerId]);
          end();
        },
        cancel: end,
      };
    },
    selectShape: (artboardId: string, points: number[], combine: SelectionCombine) => {
      if (points.length < 6) return;
      ui.setState({ pixelSelection: combineSelection(ui.getState().pixelSelection, artboardId, points, combine) });
    },
    setFeather: (feather: number) => {
      const selection = ui.getState().pixelSelection;
      if (selection) ui.setState({ pixelSelection: { ...selection, feather } });
    },
    invert: () => {
      const selection = ui.getState().pixelSelection;
      if (selection) ui.setState({ pixelSelection: invertSelection(selection) });
    },
    deselect: () => ui.setState({ pixelSelection: null }),
    erase: () => paintArea("erase"),
    reveal: () => paintArea("reveal"),
    fill: () => paintArea("fill"),
    crop: () =>
      withSelection((selection) => {
        const layer = selectionLayer(selection);
        return layer ? run(selection, (surface) => cropToSelection(surface, layer.id, selection)) : "missing";
      }),
    copyToLayer: () =>
      withSelection((selection) => {
        const layer = selectionLayer(selection);
        return layer ? run(selection, (surface) => copySelectionToLayer(surface, layer.id, selection)) : "missing";
      }),
    runKey: (action: PixelKeyAction) => {
      const brush = ui.getState().brush;
      switch (action.type) {
        case "tool":
          return commands.setTool(action.tool);
        case "size":
          return commands.setBrush({ size: nextBrushSize(brush.size, action.direction) });
        case "hardness":
          return commands.setBrush({ hardness: nextHardness(brush.hardness, action.direction) });
        case "opacity":
          return commands.setBrush({ opacity: action.value });
        case "swap":
          return commands.setBrush({ restore: !brush.restore });
        case "erase":
          return void commands.erase();
        case "deselect":
          return commands.deselect();
        case "invert":
          return commands.invert();
        case "copy":
          return void commands.copyToLayer();
      }
    },
  };
  return commands;
}
