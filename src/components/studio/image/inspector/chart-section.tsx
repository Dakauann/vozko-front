"use client";

import { chartIssue, type ChartSpec } from "@/lib/studio/chart";
import type { Layer } from "@/lib/studio/document";

import { ChartFields } from "../../chart/chart-fields";
import { useEditorUi, useImageDoc, useImageEditor } from "../editor-state";

export function ChartSection({ layer }: { layer: Layer }) {
  const { commands, ui } = useImageEditor();
  const styles = useImageDoc((s) => s.document.styles);
  const dataOpen = useEditorUi((s) => s.dataEditorFor === layer.id);
  if (!layer.chart) return null;
  const change = (spec: ChartSpec) => {
    if (chartIssue(spec)) return false;
    commands.patchLayers([layer.id], { chart: spec });
    return true;
  };
  return (
    <ChartFields
      spec={layer.chart}
      disabled={Boolean(layer.locked)}
      onChange={change}
      dataOpen={dataOpen}
      onDataOpenChange={(open) => ui.setState({ dataEditorFor: open ? layer.id : null })}
      styles={styles}
      onExpand={() => commands.expandChart(layer.id)}
    />
  );
}
