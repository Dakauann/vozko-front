"use client";

import type { Clip } from "@/lib/studio/document";
import { localTime } from "@/lib/studio/keyframe-edit";
import { pathOpsPatch, replacedPathOp, togglePathOpKey } from "@/lib/studio/path-op-edits";
import { takesPathOps, type PathOp } from "@/lib/studio/path-ops";

import { PathOpsFields } from "../../inspector/path-ops-fields";
import { usePanelPlayhead } from "../editor-context";
import type { SelectionEditor } from "./use-selection-editor";

interface VideoPathOpFieldsProps {
  clip: Clip;
  disabled: boolean;
  editor: SelectionEditor;
}

export function VideoPathOpFields({ clip, disabled, editor }: VideoPathOpFieldsProps) {
  const playheadMs = usePanelPlayhead();
  const localMs = localTime(clip, playheadMs);
  const change = (build: (ops: readonly PathOp[]) => PathOp[]) =>
    editor.patch((current) => (current.layer && takesPathOps(current.layer) ? { layer: { ...current.layer, ...pathOpsPatch(build(current.layer.pathOps ?? [])) } } : null));
  const keying = {
    localMs,
    onToggleKey: (opId: string, field: Parameters<typeof togglePathOpKey>[1]) => {
      if (localMs !== null) change((ops) => replacedPathOp(ops, opId, (op) => togglePathOpKey(op, field, localMs)));
    },
  };
  return <PathOpsFields ops={clip.layer?.pathOps ?? []} disabled={disabled} onChange={change} keying={keying} gesture={editor.gesture} />;
}
