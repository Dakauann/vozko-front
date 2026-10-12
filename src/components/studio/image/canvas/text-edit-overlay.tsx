"use client";

import { RichTextEditor } from "@/components/studio/canvas/rich-text-editor";
import { artboardOfLayer } from "@/lib/studio/artboards";
import { localViewport } from "@/lib/studio/viewport";

import { useEditorUi, useImageDoc, useImageEditor } from "../editor-state";

export function TextEditOverlay() {
  const { commands } = useImageEditor();
  const id = useEditorUi((s) => s.editingTextId);
  const viewport = useEditorUi((s) => s.viewport);
  const artboard = useImageDoc((s) => (id ? artboardOfLayer(s.document, id) : undefined));
  const layer = artboard?.layers.find((l) => l.id === id);
  if (!id || !artboard || !layer) return null;
  const local = localViewport(viewport, artboard);
  const { canvas } = artboard;
  const tr = layer.transform;
  const box = {
    centerX: tr.x * canvas.width * local.scale + local.x,
    centerY: tr.y * canvas.height * local.scale + local.y,
    width: tr.w * canvas.width * local.scale,
    height: tr.h * canvas.height * local.scale,
    rotation: tr.rotation,
    scaleX: 1,
    scaleY: 1,
  };
  return (
    <RichTextEditor
      key={id}
      layer={layer}
      box={box}
      fontScale={canvas.height * local.scale}
      surfaceHeight={canvas.height}
      onStyle={(patch) => commands.patchLayers([id], patch)}
      onDone={(edit) => commands.finishTextEdit(id, edit)}
    />
  );
}
