import { videoCanvasSize, type VideoDocument } from "../document";
import type { VisualItem } from "../playback";
import { paintedContent, rasterPlan } from "./raster";
import type { Scene, SceneBox, SceneNode } from "./scene";

function boxOf(item: VisualItem, width: number, height: number): SceneBox {
  const t = item.transform;
  return { x: t.x * width, y: t.y * height, width: t.w * width, height: t.h * height, rotation: t.rotation };
}

function overlayNode(item: VisualItem, width: number, height: number): SceneNode | null {
  if (!item.layer) return null;
  const baseWidth = item.base.w * width;
  const baseHeight = item.base.h * height;
  const { source } = rasterPlan(paintedContent(item.layer), baseWidth, baseHeight, height);
  const display = boxOf(item, width, height);
  const scaleX = baseWidth > 0 ? display.width / baseWidth : 1;
  const scaleY = baseHeight > 0 ? display.height / baseHeight : 1;
  return {
    id: item.clipId,
    source,
    box: { ...display, width: source.widthPx * scaleX, height: source.heightPx * scaleY },
    fit: "fill",
    opacity: item.opacity,
    visible: item.active,
    ...(item.layer.blendMode && item.layer.blendMode !== "normal" ? { blend: item.layer.blendMode } : {}),
  };
}

function mediaNode(item: VisualItem, width: number, height: number): SceneNode | null {
  if (!item.assetId) return null;
  const source = item.type === "video" ? { kind: "video" as const, clipId: item.clipId, assetId: item.assetId, sourceMs: item.sourceMs } : { kind: "image" as const, assetId: item.assetId };
  return { id: item.clipId, source, box: boxOf(item, width, height), fit: item.fit, opacity: item.opacity, visible: item.active };
}

export function videoScene(doc: VideoDocument, items: readonly VisualItem[]): Scene {
  const { width, height } = videoCanvasSize(doc);
  const nodes = items
    .map((item) => (item.type === "overlay" ? overlayNode(item, width, height) : mediaNode(item, width, height)))
    .filter((node): node is SceneNode => node !== null);
  return { width, height, background: doc.canvas.background, nodes };
}
