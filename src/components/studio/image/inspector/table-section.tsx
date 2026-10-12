"use client";

import type { Layer } from "@/lib/studio/document";
import { tableIssue, type TableSpec } from "@/lib/studio/table";

import { TableFields } from "../../table/table-fields";
import { useEditorUi, useImageEditor } from "../editor-state";

export function TableSection({ layer }: { layer: Layer }) {
  const { commands, ui } = useImageEditor();
  const dataOpen = useEditorUi((s) => s.dataEditorFor === layer.id);
  const focusCell = useEditorUi((s) => (s.dataEditorFor === layer.id ? s.dataEditorCell : null));
  if (!layer.table) return null;
  const change = (spec: TableSpec) => {
    if (tableIssue(spec)) return false;
    commands.patchLayers([layer.id], { table: spec });
    return true;
  };
  return <TableFields spec={layer.table} disabled={Boolean(layer.locked)} onChange={change} dataOpen={dataOpen} focusCell={focusCell ?? undefined} onDataOpenChange={(open) => ui.setState({ dataEditorFor: open ? layer.id : null, dataEditorCell: null })} />;
}
