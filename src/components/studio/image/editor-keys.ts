import { bindKeymap, canvasActionFor, imageZoomActionFor, isEditableTarget, vectorModeAction, type KeyStroke } from "@/lib/studio/keymap";
import type { ShapeOpIssue } from "@/lib/studio/shape-ops";
import { styleActionFor } from "@/lib/studio/style";

import type { ImageCommands } from "./commands";
import type { EditorUiStore } from "./editor-state";

export interface EditorKeyDeps {
  commands: ImageCommands;
  ui: EditorUiStore;
  isBusy: () => boolean;
  onShapeOp: (issue: ShapeOpIssue | null) => void;
}

export function bindEditorKeys(target: Window, { commands, ui, isBusy, onShapeOp }: EditorKeyDeps): () => void {
  const resolve = (stroke: KeyStroke) => {
    const { tool, pathEditId } = ui.getState();
    return tool === "select" && !pathEditId ? canvasActionFor(stroke) : vectorModeAction(canvasActionFor(stroke));
  };
  const unbindActions = bindKeymap(target, resolve, (action) => {
    if (isBusy()) return;
    if (ui.getState().crop && action.type !== "deselect" && action.type !== "undo" && action.type !== "redo") return;
    if (action.type === "shapeOp") return onShapeOp(commands.shapeOperation(action.kind));
    commands.runAction(action);
  });
  const unbindZoom = bindKeymap(target, imageZoomActionFor, (action) => {
    if (action.type === "fit") return commands.fit();
    if (action.type === "fitSelection") return commands.fitSelection();
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
    unbindActions();
    unbindZoom();
    unbindStyle();
    target.removeEventListener("keydown", onEnter);
  };
}
