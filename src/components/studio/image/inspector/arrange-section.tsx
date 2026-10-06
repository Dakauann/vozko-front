"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { InspectorSection, OUTLINE_BUTTON_CLASS } from "../controls";
import { useSelectionActions, type MenuAction } from "../selection-actions";

function ActionGrid({ label, actions, columns }: { label: string; actions: MenuAction[]; columns: string }) {
  return (
    <div role="group" aria-label={label} className={cn("grid gap-1", columns)}>
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          disabled={action.disabled}
          title={action.shortcut ? `${action.label} (${action.shortcut})` : action.label}
          onClick={action.run}
          className={cn(OUTLINE_BUTTON_CLASS, "justify-start px-2", action.destructive && "text-destructive-ink")}
        >
          <span className="truncate">{action.label}</span>
        </button>
      ))}
    </div>
  );
}

export function ArrangeSection() {
  const t = useTranslations("studio.image.inspector.arrange");
  const actions = useSelectionActions();
  return (
    <InspectorSection title={t("title")}>
      <ActionGrid label={t("align")} actions={actions.align} columns="grid-cols-2" />
      <ActionGrid label={t("distribute")} actions={actions.distribute} columns="grid-cols-1" />
      <ActionGrid label={t("order")} actions={actions.order} columns="grid-cols-1" />
      <ActionGrid label={t("edit")} actions={actions.edit.filter((a) => a.id !== "copy" && a.id !== "paste")} columns="grid-cols-2" />
    </InspectorSection>
  );
}
