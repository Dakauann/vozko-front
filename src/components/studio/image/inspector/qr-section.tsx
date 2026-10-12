"use client";

import type { CanvasSize, Layer } from "@/lib/studio/document";
import { qrIssue, type QrSpec } from "@/lib/studio/qr";

import { QrFields } from "../../qr/qr-fields";
import { useEditorUi, useImageEditor } from "../editor-state";

export function QrSection({ layer, canvas }: { layer: Layer; canvas: CanvasSize }) {
  const { commands, ui } = useImageEditor();
  const fresh = useEditorUi((s) => s.dataEditorFor === layer.id);
  if (!layer.qr) return null;
  const change = (spec: QrSpec) => {
    if (qrIssue(spec)) return false;
    commands.patchLayers([layer.id], { qr: spec });
    if (fresh) ui.setState({ dataEditorFor: null });
    return true;
  };
  const sidePx = Math.min(layer.transform.w * canvas.width, layer.transform.h * canvas.height);
  return <QrFields spec={layer.qr} disabled={Boolean(layer.locked)} sidePx={sidePx} fresh={fresh} onChange={change} />;
}
