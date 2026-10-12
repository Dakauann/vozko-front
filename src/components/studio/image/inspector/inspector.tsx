"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { InspectorProvider } from "../../inspector/inspector-context";
import { InspectorBody, InspectorNav } from "../../inspector/inspector-nav";
import { useArtboardNames } from "../artboard-names";
import { useActiveArtboard, useImageDoc } from "../editor-state";
import { ArrangeSection } from "./arrange-section";
import { CanvasSection } from "./canvas-section";
import { ImageSection } from "./image-section";
import { InstanceSection } from "./instance-section";
import { ChartSection } from "./chart-section";
import { TableSection } from "./table-section";
import { QrSection } from "./qr-section";
import { LayerStylesSection } from "./styles-section";
import { AutoLayoutSection, LayoutItemSection } from "./layout-section";
import { PaintSections } from "./paint-sections";
import { PixelSection } from "./pixel-section";
import { RepeatSection } from "./repeat-section";
import { PathOpsSection } from "./path-ops-section";
import { IconSection, ShapeSection } from "./shape-section";
import { TextSection } from "./text-section";
import { TransformSection } from "./transform-section";

export function Inspector() {
  const t = useTranslations("studio.image.inspector");
  const artboard = useActiveArtboard();
  const { id, layers, canvas } = artboard;
  const names = useArtboardNames();
  const selection = useImageDoc((s) => s.selection);
  const picked = useMemo(() => {
    const wanted = new Set(selection);
    return layers.filter((l) => wanted.has(l.id));
  }, [layers, selection]);

  const types = new Set(picked.map((l) => l.type));
  const only = types.size === 1 ? picked[0].type : null;
  const heading = picked.length === 0 ? (names.get(id) ?? t("canvasTitle")) : picked.length === 1 ? t(`types.${picked[0].type}`) : t("selectionTitle", { count: picked.length });

  return (
    <InspectorProvider scope="image">
      <aside aria-label={t("label")} data-tour="studio-image-inspector" className="flex h-full min-h-0 flex-col">
        <h2 className="shrink-0 border-b border-border px-3 py-2.5 text-sm font-semibold text-foreground">{heading}</h2>
        <InspectorNav />
        <InspectorBody className="min-h-0 flex-1 overflow-y-auto">
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
              {only === "instance" && picked.length === 1 ? <InstanceSection key={`instance:${picked[0].id}`} layer={picked[0]} /> : null}
              {only === "chart" && picked.length === 1 ? <ChartSection key={`chart:${picked[0].id}`} layer={picked[0]} /> : null}
              {only === "table" && picked.length === 1 ? <TableSection key={`table:${picked[0].id}`} layer={picked[0]} /> : null}
              {only === "qr" && picked.length === 1 ? <QrSection key={`qr:${picked[0].id}`} layer={picked[0]} canvas={canvas} /> : null}
              {only && only !== "instance" && only !== "paint" && only !== "chart" && only !== "table" && only !== "qr" ? <PaintSections key={`paint:${picked.map((l) => l.id).join(",")}`} layers={picked} /> : null}
              <PixelSection key={`pixels:${picked.map((l) => l.id).join(",")}`} layers={picked} />
              <LayerStylesSection layers={picked} />
            <AutoLayoutSection key={`layout:${picked.map((l) => l.id).join(",")}`} artboard={artboard} layers={picked} />
            <LayoutItemSection key={`item:${picked.map((l) => l.id).join(",")}`} artboard={artboard} layers={picked} />
              <PathOpsSection key={`pathops:${picked.map((l) => l.id).join(",")}`} artboard={artboard} layers={picked} />
              <RepeatSection key={`repeat:${picked.map((l) => l.id).join(",")}`} artboard={artboard} layers={picked} />
              <ArrangeSection />
            </>
          )}
        </InspectorBody>
      </aside>
    </InspectorProvider>
  );
}
