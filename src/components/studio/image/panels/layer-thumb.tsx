"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

import { PuzzlePiece } from "@/components/icons";
import { loadAssetImage, useLoadedImage } from "@/components/studio/canvas/asset-images";
import { STUDIO_ICONS } from "@/components/studio/canvas/icon-catalog";
import { layerSurfacePicture } from "@/components/studio/canvas/surface-canvas";
import type { Layer } from "@/lib/studio/document";
import { framePolygon, regularPolygon, starPolygon } from "@/lib/studio/paint";
import { scalePath } from "@/lib/studio/vector-path";

const BOX = 24;

function paintOf(layer: Layer): string {
  return layer.gradient?.from || layer.fill || layer.stroke || "#9ca3af";
}

function ImageThumb({ layer }: { layer: Layer }) {
  const loaded = useLoadedImage(layer.assetId ?? null, loadAssetImage);
  if (loaded.status !== "ready") return null;
  return (
    <span className="relative block h-full w-full" style={{ transform: `scale(${layer.flipX ? -1 : 1}, ${layer.flipY ? -1 : 1})` }}>
      <Image src={loaded.image.src} alt="" fill unoptimized sizes="24px" className="object-cover" />
    </span>
  );
}

function ShapeThumb({ layer }: { layer: Layer }) {
  const paint = paintOf(layer);
  const inset = 4;
  const size = BOX - inset * 2;
  switch (layer.shape) {
    case "ellipse":
      return <ellipse cx={BOX / 2} cy={BOX / 2} rx={size / 2} ry={size / 2} fill={paint} />;
    case "triangle":
      return <polygon points={framePolygon(layer.shape, size, size).map((v) => v + inset).join(" ")} fill={paint} />;
    case "star":
      return <polygon points={starPolygon(layer, size, size).map((v) => v + inset).join(" ")} fill={paint} />;
    case "polygon":
      return <polygon points={regularPolygon(layer, size, size).map((v) => v + inset).join(" ")} fill={paint} />;
    case "path":
      return <path d={scalePath(layer.path ?? "", size, size)} transform={`translate(${inset} ${inset})`} fillRule={layer.fillRule} fill={layer.fill ? paint : "none"} stroke={layer.fill ? undefined : paint} strokeWidth={1.5} />;
    case "line":
    case "arrow":
      return <line x1={inset} y1={BOX / 2} x2={BOX - inset} y2={BOX / 2} stroke={paint} strokeWidth={2.5} strokeLinecap="round" />;
    default:
      return <rect x={inset} y={inset + 2} width={size} height={size - 4} rx={(layer.radius ?? 0) * 6} fill={paint} />;
  }
}

const THUMB_PX = 48;

function PaintThumb({ layer }: { layer: Layer }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    const picture = context ? layerSurfacePicture(layer, "paint") : null;
    if (!context || !picture) return;
    const fit = Math.min(THUMB_PX / picture.canvas.width, THUMB_PX / picture.canvas.height);
    const width = picture.canvas.width * fit;
    const height = picture.canvas.height * fit;
    context.clearRect(0, 0, THUMB_PX, THUMB_PX);
    context.drawImage(picture.canvas, (THUMB_PX - width) / 2, (THUMB_PX - height) / 2, width, height);
  }, [layer]);
  return <canvas ref={canvas} width={THUMB_PX} height={THUMB_PX} className="h-full w-full" />;
}

export function LayerThumb({ layer }: { layer: Layer }) {
  const Glyph = layer.type === "icon" ? STUDIO_ICONS[layer.iconId ?? ""] : null;
  return (
    <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-[3px] border border-border bg-card">
      {layer.type === "image" ? <ImageThumb layer={layer} /> : null}
      {layer.type === "shape" ? (
        <svg viewBox={`0 0 ${BOX} ${BOX}`} className="h-full w-full">
          <ShapeThumb layer={layer} />
        </svg>
      ) : null}
      {layer.type === "text" ? (
        <span className="text-xs font-bold leading-none" style={{ color: paintOf(layer) }}>
          T
        </span>
      ) : null}
      {Glyph ? <Glyph size={16} color={paintOf(layer)} /> : null}
      {layer.type === "instance" ? <PuzzlePiece size={14} weight="fill" className="text-primary" /> : null}
      {layer.type === "paint" ? <PaintThumb layer={layer} /> : null}
    </span>
  );
}
