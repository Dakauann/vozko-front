"use client";

import { changedGrade, type ExtrasChange } from "@/lib/studio/color-grade";
import type { Layer } from "@/lib/studio/document";

import { CurvesSection, LutSection, SelectiveColorSection } from "../../color/color-sections";
import { GradientMapSection } from "../../color/gradient-map-section";
import { useImageEditor } from "../editor-state";

export function ColorFinishSections({ layer }: { layer: Layer }) {
  const { commands } = useImageEditor();
  const disabled = Boolean(layer.locked);
  const onGrade = (change: ExtrasChange) => commands.patchLayers([layer.id], { color: changedGrade(layer.color, { extras: change }) });
  const live = { disabled, onGrade, onStart: commands.beginLive, onEnd: commands.endLive };
  return (
    <>
      <CurvesSection curves={layer.color?.curves} {...live} />
      <SelectiveColorSection hsl={layer.color?.hsl} {...live} />
      <LutSection lut={layer.color?.lut} {...live} />
      <GradientMapSection map={layer.gradientMap} disabled={disabled} onStart={commands.beginLive} onEnd={commands.endLive} onChange={(map) => commands.patchLayers([layer.id], { gradientMap: map })} />
    </>
  );
}
