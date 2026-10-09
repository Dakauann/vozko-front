import type Konva from "konva";

import { CLIP_GROUP_NAME } from "@/components/studio/canvas/layer-stack";
import type { CanvasSize, ImageSurface, Transform } from "@/lib/studio/document";

export function stageNodes(stage: Konva.Stage | null | undefined, ids: Iterable<string>): Map<string, Konva.Node> {
  const wanted = new Set(ids);
  const found = new Map<string, Konva.Node>();
  for (const node of stage?.find((candidate: Konva.Node) => wanted.has(candidate.id())) ?? []) if (!found.has(node.id())) found.set(node.id(), node);
  return found;
}

export function gestureNodes(stage: Konva.Stage | null | undefined, ids: Iterable<string>): Map<string, Konva.Node> {
  const found = stageNodes(stage, ids);
  for (const node of found.values()) node.findAncestor(`.${CLIP_GROUP_NAME}`)?.clearCache();
  return found;
}

export function placeNodes(nodes: ReadonlyMap<string, Konva.Node>, transforms: ReadonlyMap<string, Transform>, canvas: CanvasSize, owned: ReadonlySet<Konva.Node> = new Set()) {
  for (const [id, transform] of transforms) {
    const node = nodes.get(id);
    if (!node || owned.has(node)) continue;
    node.position({ x: transform.x * canvas.width, y: transform.y * canvas.height });
    node.rotation(transform.rotation);
  }
}

export function settleNodes(nodes: ReadonlyMap<string, Konva.Node>, surface: ImageSurface) {
  placeNodes(nodes, new Map(surface.layers.filter((l) => nodes.has(l.id)).map((l) => [l.id, l.transform])), surface.canvas);
}
