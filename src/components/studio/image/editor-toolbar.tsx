"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { ArrowBendUpLeft, ArrowsInSimple, ArrowsOut, CaretDown, Copy, Lock, Minus, Plus, Stack, Trash } from "@/components/icons";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ShapeOpIcon } from "@/components/studio/canvas/vector/shape-op-icons";
import { VectorToolIcon } from "@/components/studio/canvas/vector/tool-icons";
import { VECTOR_TOOL_KEYS, VECTOR_TOOLS } from "@/lib/studio/vector-tools";
import { ZOOM_PRESETS } from "@/lib/studio/viewport";
import { cn } from "@/lib/utils";

import { ICON_BUTTON_CLASS, IconButton, ToggleButton } from "./controls";
import { useActiveCanvas, useEditorUi, useImageDoc, useImageEditor } from "./editor-state";
import { ExportMenu } from "./export-menu";
import { ResizeForm } from "./resize-form";
import { useSelectionActions, type MenuAction } from "./selection-actions";

const DIVIDER = <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />;

function ActionItems({ actions }: { actions: MenuAction[] }) {
  return (
    <>
      {actions.map((action) => (
        <DropdownMenuItem key={action.id} disabled={action.disabled} onSelect={action.run}>
          {action.icon}
          {action.label}
          {action.shortcut ? <DropdownMenuShortcut>{action.shortcut}</DropdownMenuShortcut> : null}
        </DropdownMenuItem>
      ))}
    </>
  );
}

function ContextActions() {
  const t = useTranslations("studio.image.toolbar");
  const to = useTranslations("studio.vectors.ops");
  const actions = useSelectionActions();
  if (actions.count === 0) return null;
  const find = (id: string) => actions.edit.find((a) => a.id === id);
  const group = find("group") ?? find("ungroup");
  const lock = find("lock");
  const duplicate = find("duplicate");
  const remove = find("delete");
  return (
    <div role="toolbar" aria-label={t("selectionTools")} className="flex items-center gap-0.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={ICON_BUTTON_CLASS}>
            {t("position")}
            <CaretDown className="h-3 w-3" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuLabel>{t("order")}</DropdownMenuLabel>
          <ActionItems actions={actions.order} />
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t("align")}</DropdownMenuLabel>
          <ActionItems actions={actions.align} />
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t("distribute")}</DropdownMenuLabel>
          <ActionItems actions={actions.distribute} />
        </DropdownMenuContent>
      </DropdownMenu>
      {actions.shapes.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={ICON_BUTTON_CLASS} aria-label={to("title")}>
              <ShapeOpIcon kind="union" className="h-4 w-4" />
              <CaretDown className="h-3 w-3" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>{to("title")}</DropdownMenuLabel>
            <ActionItems actions={actions.shapes} />
            <DropdownMenuSeparator />
            <ActionItems actions={actions.paths} />
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {group ? (
        <IconButton label={group.label} onClick={group.run} disabled={group.disabled}>
          <Stack className="h-4 w-4" aria-hidden />
        </IconButton>
      ) : null}
      {lock ? (
        <IconButton label={lock.label} onClick={lock.run} disabled={lock.disabled}>
          <Lock className="h-4 w-4" aria-hidden />
        </IconButton>
      ) : null}
      {duplicate ? (
        <IconButton label={duplicate.label} onClick={duplicate.run} disabled={duplicate.disabled}>
          <Copy className="h-4 w-4" aria-hidden />
        </IconButton>
      ) : null}
      {remove ? (
        <IconButton label={remove.label} onClick={remove.run} disabled={remove.disabled} className="text-destructive-ink">
          <Trash className="h-4 w-4" aria-hidden />
        </IconButton>
      ) : null}
    </div>
  );
}

function ToolButtons() {
  const t = useTranslations("studio.vectors.tools");
  const { commands } = useImageEditor();
  const tool = useEditorUi((s) => s.tool);
  return (
    <div role="group" aria-label={t("label")} className="flex items-center gap-0.5">
      {VECTOR_TOOLS.map((id) => (
        <ToggleButton key={id} label={`${t(id)} (${VECTOR_TOOL_KEYS[id]})`} pressed={tool === id} onClick={() => commands.setTool(id)}>
          <VectorToolIcon tool={id} className="h-4 w-4" />
        </ToggleButton>
      ))}
    </div>
  );
}

function ZoomControls() {
  const t = useTranslations("studio.image.toolbar");
  const { commands } = useImageEditor();
  const scale = useEditorUi((s) => s.viewport.scale);
  const fit = useEditorUi((s) => s.fit);
  return (
    <div role="group" aria-label={t("zoom")} className="flex items-center">
      <IconButton label={t("zoomOut")} onClick={() => commands.zoomStep(-1)}>
        <Minus className="h-4 w-4" aria-hidden />
      </IconButton>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label={t("zoomLevel", { percent: Math.round(scale * 100) })} className={cn(ICON_BUTTON_CLASS, "w-16 tabular-nums")}>
            {Math.round(scale * 100)}%
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-40">
          <DropdownMenuCheckboxItem checked={fit} onSelect={commands.fit}>
            {t("fit")}
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          {ZOOM_PRESETS.filter((preset) => preset >= 0.5).map((preset) => (
            <DropdownMenuItem key={preset} onSelect={() => commands.setZoom(preset)}>
              {Math.round(preset * 100)}%
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <IconButton label={t("zoomIn")} onClick={() => commands.zoomStep(1)}>
        <Plus className="h-4 w-4" aria-hidden />
      </IconButton>
      <ToggleButton label={t("fit")} pressed={fit} onClick={commands.fit}>
        <ArrowsInSimple className="h-4 w-4" aria-hidden />
      </ToggleButton>
    </div>
  );
}

function ViewMenu() {
  const t = useTranslations("studio.image.toolbar");
  const { ui } = useImageEditor();
  const rulers = useEditorUi((s) => s.rulers);
  const snapping = useEditorUi((s) => s.snapping);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={ICON_BUTTON_CLASS}>
          {t("view")}
          <CaretDown className="h-3 w-3" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuCheckboxItem checked={rulers} onCheckedChange={(on) => ui.setState({ rulers: Boolean(on) })}>
          {t("rulers")}
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={snapping} onCheckedChange={(on) => ui.setState({ snapping: Boolean(on) })}>
          {t("snapping")}
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ResizeButton() {
  const t = useTranslations("studio.image.toolbar");
  const canvas = useActiveCanvas();
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={ICON_BUTTON_CLASS} aria-label={t("resizeLabel", { width: canvas.width, height: canvas.height })}>
          <ArrowsOut className="h-4 w-4" aria-hidden />
          {t("resize")}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <ResizeForm onDone={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

export function EditorToolbar() {
  const t = useTranslations("studio.image.toolbar");
  const { commands } = useImageEditor();
  const canUndo = useImageDoc((s) => s.canUndo);
  const canRedo = useImageDoc((s) => s.canRedo);
  return (
    <div role="toolbar" aria-label={t("label")} className="flex h-10 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-border bg-card px-1.5">
      <IconButton label={t("undo")} onClick={commands.undo} disabled={!canUndo}>
        <ArrowBendUpLeft className="h-4 w-4" aria-hidden />
      </IconButton>
      <IconButton label={t("redo")} onClick={commands.redo} disabled={!canRedo}>
        <ArrowBendUpLeft className="h-4 w-4" mirrored aria-hidden />
      </IconButton>
      {DIVIDER}
      <ToolButtons />
      {DIVIDER}
      <ResizeButton />
      <ViewMenu />
      {DIVIDER}
      <ContextActions />
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <ZoomControls />
        {DIVIDER}
        <ExportMenu />
      </div>
    </div>
  );
}
