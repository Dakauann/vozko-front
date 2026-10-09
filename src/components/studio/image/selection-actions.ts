"use client";

import { createElement, useMemo, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { childrenSelection, parentSelection } from "@/lib/studio/geometry";
import { canCreateScaffold, ungroupKind, type Alignment, type DistributeAxis, type OrderDirection } from "@/lib/studio/layers";
import { BOOLEAN_OPS } from "@/lib/studio/path-boolean";
import { shapeOpsFor, type ShapeCombine, type ShapeOpKind } from "@/lib/studio/shape-ops";

import { ShapeOpIcon } from "@/components/studio/canvas/vector/shape-op-icons";
import { useShapeOpFeedback } from "@/components/studio/canvas/vector/use-shape-op-feedback";
import { copySvgText, useSvgFeedback } from "@/components/studio/canvas/vector/use-svg-feedback";

import { useActiveArtboard, useEditorUi, useImageDoc, useImageEditor } from "./editor-state";

export interface MenuAction {
  id: string;
  label: string;
  shortcut?: string;
  run: () => void;
  disabled?: boolean;
  destructive?: boolean;
  icon?: ReactNode;
}

const ALIGNMENTS: Alignment[] = ["left", "center", "right", "top", "middle", "bottom"];
const AXES: DistributeAxis[] = ["horizontal", "vertical"];
const ORDERS: { direction: OrderDirection; shortcut: string }[] = [
  { direction: "front", shortcut: "Ctrl+Alt+]" },
  { direction: "forward", shortcut: "Ctrl+]" },
  { direction: "backward", shortcut: "Ctrl+[" },
  { direction: "back", shortcut: "Ctrl+Alt+[" },
];

const COMBINES: ShapeCombine[] = [...BOOLEAN_OPS, "flatten"];
const SHAPE_SHORTCUTS: Partial<Record<ShapeOpKind, string>> = { union: "Alt+Shift+U", subtract: "Alt+Shift+S", intersect: "Alt+Shift+I", exclude: "Alt+Shift+E", flatten: "Ctrl+E", outline: "Ctrl+Alt+O" };

export function useSelectionActions() {
  const t = useTranslations("studio.image.actions");
  const ta = useTranslations("studio.image.artboards");
  const tv = useTranslations("studio.vectors.svg");
  const to = useTranslations("studio.vectors.ops");
  const feedback = useSvgFeedback();
  const shapeFeedback = useShapeOpFeedback();
  const { commands } = useImageEditor();
  const document = useActiveArtboard();
  const artboards = useImageDoc((s) => s.document.artboards);
  const selection = useImageDoc((s) => s.selection);
  const clipboard = useEditorUi((s) => s.clipboard);
  const styleCopied = useEditorUi((s) => s.styleCopied);

  return useMemo(() => {
    const wanted = new Set(selection);
    const picked = document.layers.filter((l) => wanted.has(l.id));
    const count = picked.length;
    const boards = artboards.filter((a) => wanted.has(a.id)).length;
    const boardsRemovable = boards > 0 && boards < artboards.length;
    const allLocked = count > 0 && picked.every((l) => l.locked);
    const anyUnlocked = picked.some((l) => !l.locked);
    const ungrouping = ungroupKind(document, selection);
    const sameIds = (ids: string[]) => ids.length === selection.length && ids.every((id) => wanted.has(id));
    const parent = parentSelection(document, selection);
    const children = childrenSelection(document, selection);
    const allHidden = count > 0 && picked.every((l) => l.hidden);
    const single = count === 1 ? picked[0] : null;

    const edit: MenuAction[] = [
      { id: "copy", label: t("copy"), shortcut: "Ctrl+C", run: () => commands.copySelection(), disabled: count === 0 },
      { id: "paste", label: t("paste"), shortcut: "Ctrl+V", run: () => commands.pasteCopied(), disabled: !clipboard },
      { id: "duplicate", label: t("duplicate"), shortcut: "Ctrl+D", run: commands.duplicate, disabled: count === 0 && boards === 0 },
      ungrouping
        ? { id: "ungroup", label: t(ungrouping), shortcut: "Ctrl+Shift+G", run: commands.ungroup, disabled: !anyUnlocked }
        : { id: "group", label: t("group"), shortcut: "Ctrl+G", run: commands.group, disabled: count < 2 },
      { id: "scaffold", label: t("scaffold"), shortcut: "Ctrl+Alt+G", run: commands.scaffold, disabled: !canCreateScaffold(document, selection) },
      { id: "lock", label: allLocked ? t("unlock") : t("lock"), shortcut: "Ctrl+Shift+L", run: () => commands.setLocked(selection, !allLocked), disabled: count === 0 },
      { id: "hide", label: allHidden ? t("show") : t("hide"), shortcut: "Ctrl+Shift+H", run: () => commands.setHidden(selection, !allHidden), disabled: count === 0 },
      { id: "delete", label: t("delete"), shortcut: "Delete", run: commands.remove, disabled: !anyUnlocked && !boardsRemovable, destructive: true },
    ];

    const order: MenuAction[] = ORDERS.map(({ direction, shortcut }) => ({
      id: `order-${direction}`,
      label: t(`order.${direction}`),
      shortcut,
      run: () => commands.order(direction),
      disabled: count === 0,
    }));

    const align: MenuAction[] = ALIGNMENTS.map((alignment) => ({
      id: `align-${alignment}`,
      label: t(`align.${alignment}`),
      run: () => commands.align(alignment),
      disabled: !anyUnlocked,
    }));

    const distribute: MenuAction[] = AXES.map((axis) => ({
      id: `distribute-${axis}`,
      label: t(`distribute.${axis}`),
      run: () => commands.distribute(axis),
      disabled: count < 3 || !anyUnlocked,
    }));

    const special: MenuAction[] = [];
    if (single?.type === "image") {
      special.push({ id: "crop", label: t("crop"), run: () => commands.startCrop(single.id), disabled: Boolean(single.locked) });
    }
    if (single?.type === "text") {
      special.push({ id: "edit-text", label: t("editText"), run: () => commands.startTextEdit(single.id), disabled: Boolean(single.locked) });
    }

    const family: MenuAction[] = [
      ...(sameIds(parent) ? [] : [{ id: "select-parent", label: t("selectParent"), shortcut: "Shift+Enter", run: commands.selectParent }]),
      ...(sameIds(children) ? [] : [{ id: "select-children", label: t("selectChildren"), shortcut: "Enter", run: commands.selectChildren }]),
    ];

    const style: MenuAction[] = [
      { id: "copy-style", label: t("copyStyle"), shortcut: "Ctrl+Alt+C", run: () => void commands.copyStyle(), disabled: count !== 1 },
      { id: "paste-style", label: t("pasteStyle"), shortcut: "Ctrl+Alt+V", run: commands.pasteStyle, disabled: !styleCopied || !anyUnlocked },
      { id: "copy-svg", label: tv("copy"), run: () => void copySvgText(commands.selectionSvg()).then(feedback.copied), disabled: !picked.some((l) => l.type === "shape") },
    ];

    const ops = shapeOpsFor(document, selection);
    const shapeAction = (kind: ShapeOpKind, enabled: boolean): MenuAction => ({
      id: `shape-${kind}`,
      label: to(kind),
      shortcut: SHAPE_SHORTCUTS[kind],
      run: () => shapeFeedback(commands.shapeOperation(kind)),
      disabled: !enabled,
      icon: createElement(ShapeOpIcon, { kind, className: "h-4 w-4" }),
    });
    const hasShapes = picked.some((l) => l.type === "shape");
    const shapes: MenuAction[] = hasShapes ? COMBINES.map((kind) => shapeAction(kind, ops.combine)) : [];
    const paths: MenuAction[] = hasShapes ? [shapeAction("release", ops.release), shapeAction("reverse", ops.reverse), shapeAction("simplify", ops.simplify), shapeAction("outline", ops.outline)] : [];

    const artboard: MenuAction[] = [
      { id: "artboard-add", label: ta("add"), run: () => commands.addArtboard(document.canvas) },
      { id: "artboard-duplicate", label: ta("duplicate"), run: () => commands.duplicateArtboards([document.id]) },
      { id: "artboard-delete", label: ta("delete"), run: () => commands.removeArtboards([document.id]), disabled: artboards.length < 2, destructive: true },
    ];
    return { count, edit, family, style, shapes, paths, order, align, distribute, special, artboard, selectAll: { id: "select-all", label: t("selectAll"), shortcut: "Ctrl+A", run: commands.selectAll } as MenuAction };
  }, [t, ta, tv, to, feedback, shapeFeedback, commands, document, artboards, selection, clipboard, styleCopied]);
}
