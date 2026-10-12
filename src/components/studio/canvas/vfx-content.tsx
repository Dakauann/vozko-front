"use client";

import type Konva from "konva";
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Group, Shape } from "react-konva";

import type { ImageCanvas, Layer } from "@/lib/studio/document";
import type { Composite } from "@/lib/studio/paint";
import { layerReach } from "@/lib/studio/scene/raster";
import { stillLooks, stillReach, type StillLook } from "@/lib/studio/still-vfx";
import { applyVfxPixels } from "@/lib/studio/vfx-pixels";

import type { KonvaFilter } from "./konva-paint";
import { screenRatio } from "./rich-content";

interface Region {
  pad: number;
  width: number;
  height: number;
}

function regionOf(layer: Layer, looks: readonly StillLook[], width: number, height: number, fontBasePx: number): Region {
  const pad = layerReach(layer, fontBasePx) + Math.ceil(stillReach(looks, { width, height }));
  return { pad, width: Math.ceil(width + 2 * pad), height: Math.ceil(height + 2 * pad) };
}

function layerVfxFilter(looks: readonly StillLook[], region: Region, width: number, height: number): KonvaFilter {
  return (imageData: ImageData) => {
    const sx = imageData.width / region.width;
    const sy = imageData.height / region.height;
    applyVfxPixels(imageData.data, imageData.width, imageData.height, looks, { left: region.pad * sx, top: region.pad * sy, width: width * sx, height: height * sy, unitsWide: width, unitsHigh: height });
  };
}

export function hasStillVfx(vfx: Layer["vfx"]): boolean {
  return stillLooks(vfx).length > 0;
}

interface VfxLayerProps {
  layer: Layer;
  width: number;
  height: number;
  fontBasePx: number;
  pixelRatio?: number;
  composite: Composite;
  ready: () => void;
  children: (shown: () => void) => ReactNode;
}

export function VfxLayer({ layer, width, height, fontBasePx, pixelRatio, composite, ready, children }: VfxLayerProps) {
  const ratio = pixelRatio ?? screenRatio();
  const looks = useMemo(() => stillLooks(layer.vfx), [layer.vfx]);
  const region = useMemo(() => regionOf(layer, looks, width, height, fontBasePx), [layer, looks, width, height, fontBasePx]);
  const filters = useMemo(() => [layerVfxFilter(looks, region, width, height)], [looks, region, width, height]);
  const group = useRef<Konva.Group>(null);
  const [shownCount, setShownCount] = useState(0);
  const shown = useCallback(() => setShownCount((count) => count + 1), []);

  useLayoutEffect(() => {
    const node = group.current;
    if (!node || shownCount === 0) return;
    node.clearCache();
    node.cache({ x: -region.pad, y: -region.pad, width: region.width, height: region.height, pixelRatio: ratio });
    node.getLayer()?.batchDraw();
    ready();
  }, [shownCount, filters, region, ratio, ready]);

  return (
    <Group ref={group} filters={filters} globalCompositeOperation={composite}>
      {children(shown)}
    </Group>
  );
}

function adjust(context: Konva.Context, looks: readonly StillLook[], width: number, height: number): void {
  const target = context._context;
  const m = target.getTransform();
  const x0 = m.e;
  const y0 = m.f;
  const x1 = m.a * width + m.e;
  const y1 = m.d * height + m.f;
  const left = Math.max(0, Math.floor(Math.min(x0, x1)));
  const top = Math.max(0, Math.floor(Math.min(y0, y1)));
  const right = Math.min(target.canvas.width, Math.ceil(Math.max(x0, x1)));
  const bottom = Math.min(target.canvas.height, Math.ceil(Math.max(y0, y1)));
  if (right <= left || bottom <= top) return;
  const image = target.getImageData(left, top, right - left, bottom - top);
  applyVfxPixels(image.data, image.width, image.height, looks, { left: x0 - left, top: y0 - top, width: x1 - x0, height: y1 - y0, unitsWide: width, unitsHigh: height });
  target.putImageData(image, left, top);
}

export function VfxAdjustment({ canvas }: { canvas: Pick<ImageCanvas, "width" | "height" | "vfx"> }) {
  const looks = useMemo(() => stillLooks(canvas.vfx), [canvas.vfx]);
  const { width, height } = canvas;
  const draw = useCallback((context: Konva.Context) => adjust(context, looks, width, height), [looks, width, height]);
  if (looks.length === 0) return null;
  return <Shape listening={false} perfectDrawEnabled={false} sceneFunc={draw} />;
}
