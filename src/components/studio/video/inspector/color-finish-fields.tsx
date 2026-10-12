"use client";

import { changedGrade, type ExtrasChange } from "@/lib/studio/color-grade";
import type { Clip } from "@/lib/studio/document";

import { CurvesSection, LutSection, SelectiveColorSection } from "../../color/color-sections";
import { GradientMapSection } from "../../color/gradient-map-section";
import type { SelectionEditor } from "./use-selection-editor";

export function ColorFinishFields({ clip, disabled, editor }: { clip: Clip; disabled: boolean; editor: SelectionEditor }) {
  const onGrade = (change: ExtrasChange) => editor.patch((current) => ({ color: changedGrade(current.color, { extras: change }) }));
  const live = { disabled, onGrade, onStart: editor.gesture.onStart, onEnd: editor.gesture.onCommit };
  return (
    <>
      <CurvesSection curves={clip.color?.curves} {...live} />
      <SelectiveColorSection hsl={clip.color?.hsl} {...live} />
      <LutSection lut={clip.color?.lut} {...live} />
      <GradientMapSection map={clip.gradientMap} disabled={disabled} onStart={editor.gesture.onStart} onEnd={editor.gesture.onCommit} onChange={(map) => editor.patch(() => ({ gradientMap: map }))} />
    </>
  );
}
