"use client";

import type { Layer } from "@/lib/studio/document";
import { takesFills, takesStrokes } from "@/lib/studio/layer-paint";
import type { LayerPatch } from "@/lib/studio/layers";

import { InspectorGroup } from "../../inspector/inspector-context";
import { useImageEditor } from "../editor-state";
import { EffectsSection } from "./effects-list";
import { FillsSection, StrokesSection } from "./paint-lists";
import { PatternSection } from "./pattern-fields";

export function PaintSections({ layers }: { layers: Layer[] }) {
  const { commands } = useImageEditor();
  const first = layers[0];
  const ids = layers.map((l) => l.id);
  const disabled = layers.every((l) => l.locked);
  const patch = (next: LayerPatch) => commands.patchLayers(ids, next);
  const fillable = layers.every(takesFills);
  const listedFills = (first.fills?.length ?? 0) > 0;
  return (
    <>
      {fillable && !listedFills ? <PatternSection layer={first} disabled={disabled} onPatch={patch} /> : null}
      {fillable ? <FillsSection layer={first} disabled={disabled} onPatch={patch} /> : null}
      {layers.every(takesStrokes) ? <StrokesSection layer={first} disabled={disabled} onPatch={patch} /> : null}
      <InspectorGroup id="effects">
        <EffectsSection layer={first} disabled={disabled} onPatch={patch} />
      </InspectorGroup>
    </>
  );
}
