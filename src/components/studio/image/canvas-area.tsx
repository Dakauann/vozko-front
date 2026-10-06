"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger } from "@/components/ui/context-menu";

import { Rulers } from "./canvas/rulers";
import { useSelectionActions, type MenuAction } from "./selection-actions";

const EditorStage = dynamic(() => import("./canvas/editor-stage"), { ssr: false });
const TextEditOverlay = dynamic(() => import("./canvas/text-edit-overlay").then((module) => module.TextEditOverlay), { ssr: false });

function Items({ actions }: { actions: MenuAction[] }) {
  return (
    <>
      {actions.map((action) => (
        <ContextMenuItem key={action.id} disabled={action.disabled} onSelect={action.run} className={action.destructive ? "text-destructive-ink" : undefined}>
          {action.label}
          {action.shortcut ? <ContextMenuShortcut>{action.shortcut}</ContextMenuShortcut> : null}
        </ContextMenuItem>
      ))}
    </>
  );
}

export function CanvasArea() {
  const t = useTranslations("studio.image.toolbar");
  const actions = useSelectionActions();
  const paste = actions.edit.find((a) => a.id === "paste");

  return (
    <div className="relative min-h-0 min-w-0 flex-1" data-tour="studio-image-canvas">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="absolute inset-0">
            <EditorStage />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-60">
          {actions.count === 0 ? (
            <>
              {paste ? <Items actions={[paste]} /> : null}
              <Items actions={[actions.selectAll]} />
            </>
          ) : (
            <>
              <Items actions={actions.special} />
              {actions.special.length > 0 ? <ContextMenuSeparator /> : null}
              <Items actions={actions.edit} />
              <ContextMenuSeparator />
              <Items actions={actions.style} />
              <ContextMenuSeparator />
              <Items actions={actions.order} />
              <ContextMenuSeparator />
              <ContextMenuSub>
                <ContextMenuSubTrigger>{t("align")}</ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-52">
                  <Items actions={actions.align} />
                  <ContextMenuSeparator />
                  <Items actions={actions.distribute} />
                </ContextMenuSubContent>
              </ContextMenuSub>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
      <TextEditOverlay />
      <Rulers />
    </div>
  );
}
