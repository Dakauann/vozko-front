import { bindKeymap, isEditableTarget, type KeyStroke } from "@/lib/keyboard/stroke";
import { canvasActionFor, imageZoomActionFor, vectorModeAction } from "@/lib/studio/keymap";
import { pixelKeyActionFor } from "@/lib/studio/pixel-tools";
import type { ShapeOpIssue } from "@/lib/studio/shape-ops";
import { styleActionFor } from "@/lib/studio/style";

import type { ImageCommands } from "./commands";
import type { EditorUiStore } from "./editor-state";

interface EditorKeyDeps {
  commands: ImageCommands;
  ui: EditorUiStore;
  onShapeOp: (issue: ShapeOpIssue | null) => void;
}

export function bindEditorKeys(target: Window, { commands, ui, onShapeOp }: EditorKeyDeps): () => void {
  const resolve = (stroke: KeyStroke) => {
    const { tool, pathEditId } = ui.getState();
    return tool === "select" && !pathEditId ? canvasActionFor(stroke) : vectorModeAction(canvasActionFor(stroke));
  };
  const unbindPixels = bindKeymap(
    target,
    (stroke) => {
      const state = ui.getState();
      return state.crop || state.editingTextId ? null : pixelKeyActionFor(stroke, { tool: state.pixelTool, hasSelection: state.pixelSelection !== null });
    },
    commands.pixel.runKey,
  );
  const unbindActions = bindKeymap(target, resolve, (action) => {
    if (ui.getState().crop && action.type !== "deselect" && action.type !== "undo" && action.type !== "redo") return;
    if (action.type === "shapeOp") return onShapeOp(commands.shapeOperation(action.kind));
    commands.runAction(action);
  });
  const unbindZoom = bindKeymap(target, imageZoomActionFor, (action) => {
    if (action.type === "fit") return commands.fit();
    if (action.type === "fitSelection") return commands.fitSelection();
    if (action.type === "actualSize") return commands.setZoom(1);
    commands.zoomStep(action.direction);
  });
  const unbindStyle = bindKeymap(target, styleActionFor, (action) => (action.type === "copyStyle" ? commands.copyStyle() : commands.pasteStyle()));
  const onEnter = (event: KeyboardEvent) => {
    if (event.key !== "Enter" || isEditableTarget(event.target) || !ui.getState().crop) return;
    event.preventDefault();
    commands.finishCrop();
  };
  target.addEventListener("keydown", onEnter);
  return () => {
    unbindPixels();
    unbindActions();
    unbindZoom();
    unbindStyle();
    target.removeEventListener("keydown", onEnter);
  };
}
