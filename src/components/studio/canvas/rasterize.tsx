"use client";

import Konva from "konva";
import { useCallback, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Layer as KonvaLayer, Rect, Stage } from "react-konva";

import type { ActionResult } from "@/app/actions/action-result";
import { DEFAULT_FONT_ID, DEFAULT_FONT_WEIGHT } from "@/lib/studio/fonts";
import type { Gradient, Layer } from "@/lib/studio/document";

import { ensureFont } from "./ensure-font";
import { gradientFill, LayerNode } from "./layer-node";
import { LayerStack } from "./layer-stack";
import { uploadStudioMedia, type UploadedMedia } from "./upload-media";

export const RASTER_TIMEOUT_MS = 30_000;

export type RasterMimeType = "image/png" | "image/jpeg";

export interface RasterOptions {
  background?: string;
  backgroundGradient?: Gradient;
  mimeType?: RasterMimeType;
  quality?: number;
  pixelRatio?: number;
  fontBasePx?: number;
}

export class RasterTimeoutError extends Error {
  constructor() {
    super("studio raster did not finish in time");
  }
}

interface RasterStageProps {
  layers: readonly Layer[];
  width: number;
  height: number;
  background?: string;
  backgroundGradient?: Gradient;
  pixelRatio: number;
  fontBasePx?: number;
  onSettled: (stage: Konva.Stage) => void;
  onFailed: (error: Error) => void;
}

function RasterStage({ layers, width, height, background, backgroundGradient, pixelRatio, fontBasePx, onSettled, onFailed }: RasterStageProps) {
  const stage = useRef<Konva.Stage>(null);
  const pending = useRef(new Set(layers.map((l) => l.id)));
  const done = useRef(false);

  const settleIfReady = useCallback(() => {
    if (done.current || pending.current.size > 0 || !stage.current) return;
    done.current = true;
    onSettled(stage.current);
  }, [onSettled]);

  useEffect(settleIfReady, [settleIfReady]);

  const ready = useCallback(
    (id: string) => {
      pending.current.delete(id);
      settleIfReady();
    },
    [settleIfReady],
  );

  const failed = useCallback(
    (_: string, error: Error) => {
      if (done.current) return;
      done.current = true;
      onFailed(error);
    },
    [onFailed],
  );

  return (
    <Stage ref={stage} width={width} height={height} listening={false}>
      <KonvaLayer>
        {background || backgroundGradient ? (
          <Rect width={width} height={height} fill={background || undefined} {...gradientFill(backgroundGradient, { x: 0, y: 0, width, height })} />
        ) : null}
        <LayerStack
          layers={layers}
          pixelRatio={pixelRatio}
          onReady={ready}
          onError={failed}
          render={(layer, extra) => (
            <LayerNode key={layer.id} layer={layer} width={width} height={height} fontBasePx={fontBasePx} composite={extra.composite} onReady={extra.onReady} onError={extra.onError} />
          )}
        />
      </KonvaLayer>
    </Stage>
  );
}

function stageBlob(stage: Konva.Stage, options: RasterOptions): Promise<Blob> {
  stage.draw();
  return new Promise((resolve, reject) => {
    stage.toBlob({
      mimeType: options.mimeType ?? "image/png",
      quality: options.quality,
      pixelRatio: options.pixelRatio ?? 1,
      callback: (blob) => (blob ? resolve(blob) : reject(new Error("studio raster produced no image"))),
    });
  });
}

async function withRasterStage<T>(layers: readonly Layer[], widthPx: number, heightPx: number, options: RasterOptions, finish: (stage: Konva.Stage) => T | Promise<T>): Promise<T> {
  const width = Math.max(1, Math.round(widthPx));
  const height = Math.max(1, Math.round(heightPx));
  await Promise.all(
    layers.filter((l) => l.type === "text").map((l) => ensureFont(l.fontId ?? DEFAULT_FONT_ID, l.fontWeight || DEFAULT_FONT_WEIGHT, Boolean(l.italic))),
  );
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:fixed;left:-100000px;top:0;pointer-events:none;";
  document.body.appendChild(host);
  const root = createRoot(host);
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const stage = await new Promise<Konva.Stage>((resolve, reject) => {
      timer = setTimeout(() => reject(new RasterTimeoutError()), RASTER_TIMEOUT_MS);
      root.render(
        <RasterStage
          layers={layers}
          width={width}
          height={height}
          background={options.background}
          backgroundGradient={options.backgroundGradient}
          pixelRatio={options.pixelRatio ?? 1}
          fontBasePx={options.fontBasePx}
          onSettled={resolve}
          onFailed={reject}
        />,
      );
    });
    return await finish(stage);
  } finally {
    if (timer !== null) clearTimeout(timer);
    root.unmount();
    host.remove();
  }
}

export function rasterizeLayers(layers: readonly Layer[], widthPx: number, heightPx: number, options: RasterOptions = {}): Promise<Blob> {
  return withRasterStage(layers, widthPx, heightPx, options, (stage) => stageBlob(stage, options));
}

export function rasterizeLayerCanvas(layer: Layer, widthPx: number, heightPx: number, options: RasterOptions = {}): Promise<HTMLCanvasElement> {
  return withRasterStage([layer], widthPx, heightPx, options, (stage) => {
    stage.draw();
    return stage.toCanvas({ pixelRatio: options.pixelRatio ?? 1 });
  });
}

export function rasterizeLayer(layer: Layer, widthPx: number, heightPx: number, options: RasterOptions = {}): Promise<Blob> {
  return rasterizeLayers([layer], widthPx, heightPx, options);
}

export function uploadRaster(blob: Blob, description: string, fileName: string = "studio.png"): Promise<ActionResult<UploadedMedia>> {
  return uploadStudioMedia(blob, "image", description, fileName);
}
