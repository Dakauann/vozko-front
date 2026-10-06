"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { useImageDoc } from "../editor-state";
import { ArrangeSection } from "./arrange-section";
import { CanvasSection } from "./canvas-section";
import { ImageSection } from "./image-section";
import { IconSection, ShapeSection } from "./shape-section";
import { TextSection } from "./text-section";
import { TransformSection } from "./transform-section";

export function Inspector() {
  const t = useTranslations("studio.image.inspector");
  const layers = useImageDoc((s) => s.document.layers);
  const selection = useImageDoc((s) => s.selection);
  const canvas = useImageDoc((s) => s.document.canvas);
  const picked = useMemo(() => {
    const wanted = new Set(selection);
    return layers.filter((l) => wanted.has(l.id));
  }, [layers, selection]);

  const types = new Set(picked.map((l) => l.type));
  const only = types.size === 1 ? picked[0].type : null;
  const heading = picked.length === 0 ? t("canvasTitle") : picked.length === 1 ? t(`types.${picked[0].type}`) : t("selectionTitle", { count: picked.length });

  return (
    <aside aria-label={t("label")} data-tour="studio-image-inspector" className="flex h-full min-h-0 flex-col">
      <h2 className="shrink-0 border-b border-border px-3 py-2.5 text-sm font-semibold text-foreground">{heading}</h2>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {picked.length === 0 ? (
          <CanvasSection />
        ) : (
          <>
            {picked.every((l) => l.locked) ? <p className="border-b border-border bg-muted px-3 py-2 text-xs text-muted-foreground">{t("lockedHint")}</p> : null}
            <TransformSection key={`transform:${picked.map((l) => l.id).join(",")}`} layers={picked} canvas={canvas} />
            {only === "text" ? <TextSection layers={picked} canvas={canvas} /> : null}
            {only === "shape" ? <ShapeSection layers={picked} /> : null}
            {only === "icon" ? <IconSection layers={picked} /> : null}
            {only === "image" && picked.length === 1 ? <ImageSection key={`image:${picked[0].id}`} layer={picked[0]} canvas={canvas} /> : null}
            <ArrangeSection />
          </>
        )}
      </div>
    </aside>
  );
}
