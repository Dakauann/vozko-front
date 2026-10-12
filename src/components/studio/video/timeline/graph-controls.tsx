"use client";

import { useTranslations } from "next-intl";

import { ArrowsInSimple, ArrowsOut, ChartLine } from "@/components/icons";
import { GRAPH_MODES, type GraphTarget } from "@/lib/studio/graph-editor";

import { useVideoEditor, useViewState } from "../editor-context";
import { ToolButton, ToolDivider } from "../tool-button";

const TARGETS: readonly GraphTarget[] = ["keys", "in", "out"];

export function GraphControls() {
  const t = useTranslations("studio.video.graph");
  const { commands } = useVideoEditor();
  const open = useViewState((s) => s.graphEditor);
  const mode = useViewState((s) => s.graphMode);
  const show = useViewState((s) => s.graphShow);
  const target = useViewState((s) => s.graphTarget);

  return (
    <div className="flex items-center gap-1">
      <ToolButton label={t("toggle")} shortcut="Shift+F3" icon={<ChartLine className="h-3.5 w-3.5" />} showLabel pressed={open} onClick={commands.toggleGraph} />
      {open ? (
        <>
          <ToolDivider />
          <div role="group" aria-label={t("modeGroup")} className="flex items-center gap-0.5">
            {GRAPH_MODES.map((graphMode) => (
              <ToolButton key={graphMode} size="sm" label={t(`modes.${graphMode}`)} icon={null} showLabel pressed={mode === graphMode} onClick={() => commands.setGraphMode(graphMode)} />
            ))}
          </div>
          <ToolDivider />
          <div role="group" aria-label={t("targetGroup")} className="flex items-center gap-0.5">
            {TARGETS.map((graphTarget) => (
              <ToolButton key={graphTarget} size="sm" label={t(`targets.${graphTarget}`)} icon={null} showLabel pressed={target === graphTarget} onClick={() => commands.setGraphTarget(graphTarget)} />
            ))}
          </div>
          <ToolDivider />
          <ToolButton size="sm" label={t("onlySelected")} icon={null} showLabel pressed={show === "selected"} onClick={() => commands.setGraphShow(show === "selected" ? "animated" : "selected")} />
          <ToolButton size="sm" label={t("fit")} shortcut="Shift+F" icon={<ArrowsOut className="h-3.5 w-3.5" />} onClick={() => commands.fitGraph(false)} />
          <ToolButton size="sm" label={t("fitSelection")} shortcut="Ctrl+Shift+F" icon={<ArrowsInSimple className="h-3.5 w-3.5" />} onClick={() => commands.fitGraph(true)} />
        </>
      ) : null}
    </div>
  );
}
