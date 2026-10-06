"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import type { Alignment, DistributeAxis, OrderDirection } from "@/lib/studio/layers";

import { useEditorUi, useImageDoc, useImageEditor } from "./editor-state";

export interface MenuAction {
  id: string;
  label: string;
  shortcut?: string;
  run: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

const ALIGNMENTS: Alignment[] = ["left", "center", "right", "top", "middle", "bottom"];
const AXES: DistributeAxis[] = ["horizontal", "vertical"];
const ORDERS: { direction: OrderDirection; shortcut: string }[] = [
  { direction: "front", shortcut: "Ctrl+Alt+]" },
  { direction: "forward", shortcut: "Ctrl+]" },
  { direction: "backward", shortcut: "Ctrl+[" },
  { direction: "back", shortcut: "Ctrl+Alt+[" },
];

export function useSelectionActions() {
  const t = useTranslations("studio.image.actions");
  const { commands } = useImageEditor();
  const layers = useImageDoc((s) => s.document.layers);
  const selection = useImageDoc((s) => s.selection);
  const clipboard = useEditorUi((s) => s.clipboard);
  const styleCopied = useEditorUi((s) => s.styleCopied);

  return useMemo(() => {
    const wanted = new Set(selection);
    const picked = layers.filter((l) => wanted.has(l.id));
    const count = picked.length;
    const allLocked = count > 0 && picked.every((l) => l.locked);
    const anyUnlocked = picked.some((l) => !l.locked);
    const grouped = picked.some((l) => l.groupId);
    const allHidden = count > 0 && picked.every((l) => l.hidden);
    const single = count === 1 ? picked[0] : null;

    const edit: MenuAction[] = [
      { id: "copy", label: t("copy"), shortcut: "Ctrl+C", run: () => commands.copySelection(), disabled: count === 0 },
      { id: "paste", label: t("paste"), shortcut: "Ctrl+V", run: () => commands.pasteCopied(), disabled: !clipboard },
      { id: "duplicate", label: t("duplicate"), shortcut: "Ctrl+D", run: commands.duplicate, disabled: count === 0 },
      grouped
        ? { id: "ungroup", label: t("ungroup"), shortcut: "Ctrl+Shift+G", run: commands.ungroup, disabled: !anyUnlocked }
        : { id: "group", label: t("group"), shortcut: "Ctrl+G", run: commands.group, disabled: count < 2 },
      { id: "lock", label: allLocked ? t("unlock") : t("lock"), run: () => commands.setLocked(selection, !allLocked), disabled: count === 0 },
      { id: "hide", label: allHidden ? t("show") : t("hide"), run: () => commands.setHidden(selection, !allHidden), disabled: count === 0 },
      { id: "delete", label: t("delete"), shortcut: "Delete", run: commands.remove, disabled: !anyUnlocked, destructive: true },
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

    const style: MenuAction[] = [
      { id: "copy-style", label: t("copyStyle"), shortcut: "Ctrl+Alt+C", run: () => void commands.copyStyle(), disabled: count !== 1 },
      { id: "paste-style", label: t("pasteStyle"), shortcut: "Ctrl+Alt+V", run: commands.pasteStyle, disabled: !styleCopied || !anyUnlocked },
    ];

    return { count, edit, style, order, align, distribute, special, selectAll: { id: "select-all", label: t("selectAll"), shortcut: "Ctrl+A", run: commands.selectAll } as MenuAction };
  }, [t, commands, layers, selection, clipboard, styleCopied]);
}
