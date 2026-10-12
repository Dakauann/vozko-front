"use client";

import { useTranslations } from "next-intl";

import type { Layer } from "@/lib/studio/document";

import { InspectorSection, OUTLINE_BUTTON_CLASS } from "../controls";
import { useImageEditor } from "../editor-state";

function counts(layer: Layer, kind: "surface" | "mask"): { strokes: number; areas: number } {
  const ops = layer[kind]?.ops ?? [];
  return { strokes: ops.filter((op) => op.kind === "stroke").length, areas: ops.filter((op) => op.kind === "area").length };
}

export function PixelSection({ layers }: { layers: Layer[] }) {
  const t = useTranslations("studio.image.pixels.inspector");
  const { commands } = useImageEditor();
  const layer = layers.length === 1 ? layers[0] : null;
  if (!layer || (layer.type !== "paint" && layer.type !== "image")) return null;
  const disabled = Boolean(layer.locked);
  if (layer.type === "paint" && layer.surface) {
    const surface = layer.surface;
    return (
      <InspectorSection title={t("paintTitle")}>
        <p className="text-2xs text-muted-foreground">{t("surface", { width: surface.width, height: surface.height, ...counts(layer, "surface") })}</p>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={OUTLINE_BUTTON_CLASS} disabled={disabled} onClick={() => commands.pixel.setTool("brush")}>
            {t("paint")}
          </button>
          <button type="button" className={OUTLINE_BUTTON_CLASS} disabled={disabled} onClick={() => commands.pixel.setTool("eraser")}>
            {t("erase")}
          </button>
          <button type="button" className={OUTLINE_BUTTON_CLASS} disabled={disabled || surface.ops.length === 0} onClick={() => commands.patchLayers([layer.id], { surface: { ...surface, ops: [] } })}>
            {t("clear")}
          </button>
        </div>
      </InspectorSection>
    );
  }
  return (
    <InspectorSection title={t("maskTitle")} group="cutout">
      <p className="text-2xs text-muted-foreground">{layer.mask ? t("mask", counts(layer, "mask")) : t("noMask")}</p>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={OUTLINE_BUTTON_CLASS} disabled={disabled} onClick={() => commands.pixel.setTool("eraser")}>
          {t("hide")}
        </button>
        {layer.mask ? (
          <button type="button" className={OUTLINE_BUTTON_CLASS} disabled={disabled} onClick={() => commands.patchLayers([layer.id], { mask: undefined })}>
            {t("removeMask")}
          </button>
        ) : null}
      </div>
    </InspectorSection>
  );
}
