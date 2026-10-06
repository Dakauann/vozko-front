"use client";

import { useTranslations } from "next-intl";

import type { CanvasSize, Layer } from "@/lib/studio/document";
import { boxPx, transformFromBoxPx, type PixelBox } from "@/lib/studio/geometry";
import { clampTo, LAYER_RANGES, normalizedRotation } from "@/lib/studio/layer-ranges";

import { InspectorSection, NumberField, SliderField } from "../controls";
import { useImageEditor } from "../editor-state";

export function TransformSection({ layers, canvas }: { layers: Layer[]; canvas: CanvasSize }) {
  const t = useTranslations("studio.image.inspector.transform");
  const { commands } = useImageEditor();
  const single = layers.length === 1 ? layers[0] : null;
  const ids = layers.map((l) => l.id);
  const locked = layers.every((l) => l.locked);
  const opacity = layers[0]?.transform.opacity ?? 1;

  const setBox = (patch: Partial<PixelBox>) => {
    if (!single) return;
    const box = { ...boxPx(single.transform, canvas), ...patch };
    commands.patchLayers([single.id], (layer) => ({ transform: transformFromBoxPx(box, canvas, layer.transform) }));
  };

  const box = single ? boxPx(single.transform, canvas) : null;

  return (
    <InspectorSection title={t("title")}>
      {single && box ? (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label={t("x")} short="X" value={box.left} suffix="px" disabled={locked} onCommit={(left) => setBox({ left })} />
          <NumberField label={t("y")} short="Y" value={box.top} suffix="px" disabled={locked} onCommit={(top) => setBox({ top })} />
          <NumberField label={t("width")} short={t("widthShort")} value={box.width} min={1} suffix="px" disabled={locked} onCommit={(width) => setBox({ width, left: box.left + (box.width - width) / 2 })} />
          <NumberField label={t("height")} short={t("heightShort")} value={box.height} min={1} suffix="px" disabled={locked} onCommit={(height) => setBox({ height, top: box.top + (box.height - height) / 2 })} />
          <NumberField
            label={t("rotation")}
            short={t("rotationShort")}
            value={single.transform.rotation}
            min={LAYER_RANGES.rotation[0]}
            max={LAYER_RANGES.rotation[1]}
            suffix="°"
            disabled={locked}
            onCommit={(rotation) => commands.patchLayers([single.id], (layer) => ({ transform: { ...layer.transform, rotation: normalizedRotation(rotation) } }))}
          />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t("multiple", { count: layers.length })}</p>
      )}
      <SliderField
        label={t("opacity")}
        value={Math.round(opacity * 100)}
        min={0}
        max={100}
        step={1}
        format={(value) => `${value}%`}
        disabled={locked}
        onStart={commands.beginLive}
        onEnd={commands.endLive}
        onChange={(value) => commands.patchLayers(ids, (layer) => ({ transform: { ...layer.transform, opacity: clampTo(value / 100, LAYER_RANGES.opacity) } }))}
      />
    </InspectorSection>
  );
}
