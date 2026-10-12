"use client";

import { QrFields } from "@/components/studio/qr/qr-fields";
import { TableFields } from "@/components/studio/table/table-fields";
import { videoCanvasSize, type Clip } from "@/lib/studio/document";
import { qrIssue, type QrSpec } from "@/lib/studio/qr";
import { tableIssue, type TableSpec } from "@/lib/studio/table";
import type { SelectionEditor } from "./use-selection-editor";

import { useVideoEditor, useViewState } from "../editor-context";

interface GeneratedClipFieldsProps {
  clip: Clip;
  disabled: boolean;
  editor: SelectionEditor;
}

export function TableClipFields({ clip, disabled, editor }: GeneratedClipFieldsProps) {
  const { view } = useVideoEditor();
  const dataOpen = useViewState((s) => s.dataEditorFor === clip.id);
  const spec = clip.layer?.table;
  if (!spec) return null;
  const change = (next: TableSpec) => {
    if (tableIssue(next)) return false;
    editor.patch((target) => (target.layer?.type === "table" ? { layer: { ...target.layer, table: next } } : null));
    return true;
  };
  return <TableFields spec={spec} disabled={disabled} onChange={change} dataOpen={dataOpen} onDataOpenChange={(open) => view.setState({ dataEditorFor: open ? clip.id : null })} />;
}

export function QrClipFields({ clip, disabled, editor }: GeneratedClipFieldsProps) {
  const { store, view } = useVideoEditor();
  const fresh = useViewState((s) => s.dataEditorFor === clip.id);
  const spec = clip.layer?.qr;
  if (!spec) return null;
  const canvas = videoCanvasSize(store.getState().document);
  const change = (next: QrSpec) => {
    if (qrIssue(next)) return false;
    editor.patch((target) => (target.layer?.type === "qr" ? { layer: { ...target.layer, qr: next } } : null));
    if (fresh) view.setState({ dataEditorFor: null });
    return true;
  };
  return <QrFields spec={spec} disabled={disabled} sidePx={Math.min(clip.transform.w * canvas.width, clip.transform.h * canvas.height)} fresh={fresh} onChange={change} />;
}
