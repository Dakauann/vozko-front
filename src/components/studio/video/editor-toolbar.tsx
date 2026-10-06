"use client";

import { useTranslations } from "next-intl";

import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { ArrowClockwise, ArrowCounterClockwise, ArrowsLeftRight, Copy, GridFour, Trash, TrashSimple } from "@/components/icons";
import { VIDEO_ASPECTS, type VideoAspect } from "@/lib/studio/document";

import { useEditorState, useVideoEditor, useViewState } from "./editor-context";
import { ExportControl } from "./export/export-control";
import { ToolButton, ToolDivider } from "./tool-button";

const ASPECT_RATIO_LABEL: Record<VideoAspect, string> = { square: "1:1", portrait: "4:5", story: "9:16", landscape: "16:9" };

export function EditorToolbar() {
  const t = useTranslations("studio.video.toolbar");
  const { commands } = useVideoEditor();
  const canUndo = useEditorState((s) => s.canUndo);
  const canRedo = useEditorState((s) => s.canRedo);
  const hasSelection = useEditorState((s) => s.selection.length > 0);
  const aspect = useEditorState((s) => s.document.canvas.aspect);
  const safeArea = useViewState((s) => s.safeArea);

  return (
    <div role="toolbar" aria-label={t("label")} className="flex h-10 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-border bg-card px-2">
      <ToolButton label={t("undo")} shortcut="Ctrl+Z" icon={<ArrowCounterClockwise className="h-4 w-4" />} disabled={!canUndo} onClick={commands.undo} />
      <ToolButton label={t("redo")} shortcut="Ctrl+Shift+Z" icon={<ArrowClockwise className="h-4 w-4" />} disabled={!canRedo} onClick={commands.redo} />
      <ToolDivider />
      <ToolButton label={t("split")} shortcut="S" icon={<ArrowsLeftRight className="h-4 w-4" />} onClick={commands.split} />
      <ToolButton label={t("duplicate")} shortcut="Ctrl+D" icon={<Copy className="h-4 w-4" />} disabled={!hasSelection} onClick={commands.duplicate} />
      <ToolButton label={t("delete")} shortcut="Delete" icon={<TrashSimple className="h-4 w-4" />} disabled={!hasSelection} onClick={() => commands.remove(false)} />
      <ToolButton label={t("rippleDelete")} shortcut="Shift+Delete" icon={<Trash className="h-4 w-4" />} disabled={!hasSelection} onClick={() => commands.remove(true)} />
      <ToolDivider />
      <ElevatedPillToggle<VideoAspect>
        aria-label={t("aspect")}
        value={aspect}
        onChange={commands.setAspect}
        options={VIDEO_ASPECTS.map((option) => ({ value: option, label: ASPECT_RATIO_LABEL[option], title: t(`aspects.${option}`) }))}
      />
      <ToolButton label={t("safeArea")} icon={<GridFour className="h-4 w-4" />} pressed={safeArea} onClick={commands.toggleSafeArea} />
      <div className="ml-auto flex shrink-0 items-center pl-2">
        <ExportControl />
      </div>
    </div>
  );
}
