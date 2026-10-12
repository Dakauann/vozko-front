import type { CanvasSize, Layer, Transform } from "../document";
import { maskPlacement } from "../pixel-space";
import { liveOpFor, type PixelLive, type SurfaceKind } from "../pixel-surface";
import { repeatSourceId } from "../repeat-edits";
import type { RasterPlan } from "./raster";
import type { PixelMaskNode, PixelsSource, SceneNode } from "./scene";

export function pixelsSource(layer: Layer, kind: SurfaceKind, live: PixelLive | null | undefined): PixelsSource | null {
  const surface = kind === "paint" ? layer.surface : layer.mask;
  if (!surface) return null;
  const sourceId = repeatSourceId(layer.id);
  return { kind: "pixels", key: `${sourceId}:${kind}`, surface, live: liveOpFor(live, sourceId, kind) };
}

export function paintNode(layer: Layer, shown: Transform, canvas: CanvasSize, live: PixelLive | null | undefined, clipOf: string | undefined): SceneNode | null {
  const source = pixelsSource(layer, "paint", live);
  if (!source) return null;
  return {
    id: layer.id,
    source,
    box: { x: shown.x * canvas.width, y: shown.y * canvas.height, width: shown.w * canvas.width, height: shown.h * canvas.height, rotation: shown.rotation },
    fit: "fill",
    opacity: shown.opacity,
    visible: true,
    ...(layer.flipX ? { flipX: true } : {}),
    ...(layer.flipY ? { flipY: true } : {}),
    ...(layer.blendMode && layer.blendMode !== "normal" ? { blend: layer.blendMode } : {}),
    ...(clipOf ? { clipOf } : {}),
  };
}

export function pixelMaskOf(layer: Layer, plan: RasterPlan, canvas: CanvasSize, live: PixelLive | null | undefined): PixelMaskNode | undefined {
  const source = layer.type === "image" ? pixelsSource(layer, "mask", live) : null;
  if (!source || plan.source.kind !== "raster") return undefined;
  const { widthPx, heightPx } = plan.source;
  const place = maskPlacement(layer, layer.transform.w * canvas.width, layer.transform.h * canvas.height);
  return {
    source,
    rect: { x: (plan.padPx + place.x) / widthPx, y: (plan.padPx + place.y) / heightPx, width: place.width / widthPx, height: place.height / heightPx },
    flipX: place.flipX,
    flipY: place.flipY,
  };
}
