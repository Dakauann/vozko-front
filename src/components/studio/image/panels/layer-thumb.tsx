"use client";

import Image from "next/image";

import { loadAssetImage, useLoadedImage } from "@/components/studio/canvas/asset-images";
import { STUDIO_ICONS } from "@/components/studio/canvas/icon-catalog";
import type { Layer } from "@/lib/studio/document";
import { framePolygon } from "@/lib/studio/paint";

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
    case "star":
      return <polygon points={framePolygon(layer.shape, size, size).map((v) => v + inset).join(" ")} fill={paint} />;
    case "line":
    case "arrow":
      return <line x1={inset} y1={BOX / 2} x2={BOX - inset} y2={BOX / 2} stroke={paint} strokeWidth={2.5} strokeLinecap="round" />;
    default:
      return <rect x={inset} y={inset + 2} width={size} height={size - 4} rx={(layer.radius ?? 0) * 6} fill={paint} />;
  }
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
    </span>
  );
}
