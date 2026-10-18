"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import type { TerraDraw } from "terra-draw";

import { drawnFeatureToArea, type DrawnFeature } from "@/lib/maps/area";
import { areaSize, distanceValue, type AreaSize } from "@/lib/maps/area-size";
import type { MapPalette } from "@/lib/maps/palette";
import type { AreaShape } from "@/lib/maps/types";
import { cn } from "@/lib/utils";

import { AreaDrawButtons, type DrawMode } from "./AreaDrawButtons";
import { useLeadMap } from "./map-context";
import { MAP_FLOATY } from "./map-layout";

const STATIC_MODE = "static";
const DRAW_FILL_OPACITY = 0.06;
const DRAW_OUTLINE_PX = 2;
const PROVISIONAL_UPDATE = "provisional";
const SIZE_LABEL_OFFSET_PX = 14;

interface Pointer {
  x: number;
  y: number;
}

interface AreaDrawControlProps {
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

function drawingSize(instance: TerraDraw, ids: Array<string | number>): AreaSize | null | undefined {
  for (const id of ids) {
    const feature = instance.getSnapshotFeature(id) as DrawnFeature | undefined;
    if (feature?.properties?.currentlyDrawing) return areaSize(drawnFeatureToArea(feature));
  }
  return undefined;
}

function DrawSizeLabel({ size, pointer, container }: { size: AreaSize; pointer: Pointer; container: HTMLElement }) {
  const t = useTranslations("leadMap.draw.size");
  const tDistance = useTranslations("leadMap.districtList.radius");
  const distance = (meters: number) => {
    const { unit, value } = distanceValue(meters);
    return tDistance(unit, { value });
  };
  const text =
    size.kind === "radius"
      ? t("radius", { radius: distance(size.radiusM) })
      : t("box", { width: distance(size.widthM), height: distance(size.heightM) });
  return createPortal(
    <div
      aria-hidden="true"
      className={cn(MAP_FLOATY, "pointer-events-none absolute z-10 whitespace-nowrap px-2 py-1 text-xs tabular-nums")}
      style={{ left: pointer.x + SIZE_LABEL_OFFSET_PX, top: pointer.y + SIZE_LABEL_OFFSET_PX }}
    >
      {text}
    </div>,
    container,
  );
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
  const [size, setSize] = useState<AreaSize | null>(null);
  const [pointer, setPointer] = useState<Pointer | null>(null);

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
        instance.on("change", (ids) => {
          const current = instance;
          if (!current) return;
          const measured = drawingSize(current, ids);
          if (measured !== undefined) setSize(measured);
        });
        instance.on("finish", (id) => {
          const current = instance;
          if (!current) return;
          const area = drawnFeatureToArea(current.getSnapshotFeature(id) as DrawnFeature | undefined);
          current.clear();
          current.setMode(STATIC_MODE);
          setActiveMode(null);
          setSize(null);
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
    setSize(null);
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

  useEffect(() => {
    if (!activeMode || !map) return;
    const element = map.getContainer();
    const follow = (event: PointerEvent) => {
      const box = element.getBoundingClientRect();
      setPointer({ x: event.clientX - box.left, y: event.clientY - box.top });
    };
    element.addEventListener("pointermove", follow);
    return () => element.removeEventListener("pointermove", follow);
  }, [activeMode, map]);

  const selectMode = (mode: DrawMode) => {
    const instance = draw.current;
    if (!instance) return;
    instance.clear();
    instance.setMode(mode);
    markDrawing.current(true);
    setInvalid(false);
    setSize(null);
    setActiveMode(mode);
  };

  return (
    <>
      <AreaDrawButtons
        className={className}
        activeMode={activeMode}
        onSelectMode={selectMode}
        onCancel={cancel}
        disabled={!ready}
        error={failed ? t("unavailable") : invalid ? t("invalid") : null}
      />
      {activeMode && size && pointer && map ? <DrawSizeLabel size={size} pointer={pointer} container={map.getContainer()} /> : null}
    </>
  );
}
