"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { TerraDraw } from "terra-draw";

import { drawnFeatureToArea, type DrawnFeature } from "@/lib/maps/area";
import type { MapPalette } from "@/lib/maps/palette";
import type { AreaShape } from "@/lib/maps/types";

import { AreaDrawButtons, type DrawMode } from "./AreaDrawButtons";
import { useLeadMap } from "./map-context";

const STATIC_MODE = "static";
const DRAW_FILL_OPACITY = 0.06;
const DRAW_OUTLINE_PX = 2;
const PROVISIONAL_UPDATE = "provisional";

export interface AreaDrawControlProps {
  onAreaDrawn: (area: AreaShape) => void;
  className?: string;
}

function drawStyles(palette: MapPalette) {
  return {
    fillColor: palette.primaryHex,
    fillOpacity: DRAW_FILL_OPACITY,
    outlineColor: palette.primaryHex,
    outlineWidth: DRAW_OUTLINE_PX,
  };
}

function polygonStyles(palette: MapPalette) {
  return {
    ...drawStyles(palette),
    closingPointColor: palette.primaryHex,
    closingPointWidth: 4,
    closingPointOutlineColor: palette.surfaceHex,
    closingPointOutlineWidth: 2,
  };
}

function stopQuietly(instance: TerraDraw | null) {
  if (!instance?.enabled) return;
  try {
    instance.stop();
  } catch {
    return;
  }
}

export function AreaDrawControl({ onAreaDrawn, className }: AreaDrawControlProps) {
  const t = useTranslations("leadMap.draw");
  const { map, palette, setDrawing } = useLeadMap();
  const draw = useRef<TerraDraw | null>(null);
  const markDrawing = useRef(setDrawing);
  const onDrawn = useRef(onAreaDrawn);
  const currentPalette = useRef(palette);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [activeMode, setActiveMode] = useState<DrawMode | null>(null);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    onDrawn.current = onAreaDrawn;
    currentPalette.current = palette;
    markDrawing.current = setDrawing;
  });

  useEffect(() => {
    const initialPalette = currentPalette.current;
    if (!map || !initialPalette) return;
    let cancelled = false;
    let instance: TerraDraw | null = null;
    let release: ReturnType<typeof setTimeout> | null = null;
    Promise.all([import("terra-draw"), import("terra-draw-maplibre-gl-adapter")])
      .then(([terra, adapter]) => {
        if (cancelled) return;
        instance = new terra.TerraDraw({
          adapter: new adapter.TerraDrawMapLibreGLAdapter({ map }),
          modes: [
            new terra.TerraDrawPolygonMode({
              styles: polygonStyles(initialPalette),
              validation: (feature, context) =>
                String(context.updateType) === PROVISIONAL_UPDATE ? { valid: true } : terra.ValidateNotSelfIntersecting(feature),
            }),
            new terra.TerraDrawRectangleMode({ styles: drawStyles(initialPalette) }),
            new terra.TerraDrawCircleMode({ styles: drawStyles(initialPalette) }),
          ],
        });
        instance.start();
        instance.on("finish", (id) => {
          const current = instance;
          if (!current) return;
          const area = drawnFeatureToArea(current.getSnapshotFeature(id) as DrawnFeature | undefined);
          current.clear();
          current.setMode(STATIC_MODE);
          setActiveMode(null);
          setInvalid(area === null);
          if (release !== null) clearTimeout(release);
          release = setTimeout(() => {
            release = null;
            if (current.getMode() === STATIC_MODE) markDrawing.current(false);
          }, 0);
          if (area) onDrawn.current(area);
        });
        draw.current = instance;
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (release !== null) clearTimeout(release);
      draw.current = null;
      stopQuietly(instance);
      markDrawing.current(false);
    };
  }, [map]);

  useEffect(() => {
    const instance = draw.current;
    if (!ready || !instance || !palette) return;
    instance.setModeStyles("polygon", polygonStyles(palette));
    instance.setModeStyles("rectangle", drawStyles(palette));
    instance.setModeStyles("circle", drawStyles(palette));
  }, [ready, palette]);

  const cancel = useCallback(() => {
    draw.current?.clear();
    draw.current?.setMode(STATIC_MODE);
    markDrawing.current(false);
    setActiveMode(null);
  }, []);

  useEffect(() => {
    if (!activeMode || !map) return;
    const element = map.getContainer();
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      cancel();
    };
    element.addEventListener("keydown", cancelOnEscape);
    return () => element.removeEventListener("keydown", cancelOnEscape);
  }, [activeMode, map, cancel]);

  const selectMode = (mode: DrawMode) => {
    const instance = draw.current;
    if (!instance) return;
    instance.clear();
    instance.setMode(mode);
    markDrawing.current(true);
    setInvalid(false);
    setActiveMode(mode);
  };

  return (
    <AreaDrawButtons
      className={className}
      activeMode={activeMode}
      onSelectMode={selectMode}
      onCancel={cancel}
      disabled={!ready}
      error={failed ? t("unavailable") : invalid ? t("invalid") : null}
    />
  );
}
