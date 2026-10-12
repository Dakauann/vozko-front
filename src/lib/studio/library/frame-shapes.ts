import { newPathLayer, newShapeLayer, newStudioId, type Layer, type Transform } from "../document";
import { newMask, type Mask } from "../masks";
import { DEFAULT_PATTERN, type Pattern } from "../pattern";

export type FrameShape = { kind: "ellipse" } | { kind: "rect"; radius: number } | { kind: "path"; path: string };

export const FRAME_PLACEHOLDER_FILL = "#e4e4e7";

export const FRAME_PLACEHOLDER_PATTERN: Pattern = { ...DEFAULT_PATTERN, presetId: "diagonal", color: "#a1a1aa", size: 24, opacity: 0.45 };

export interface MaskBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const WHOLE_BOX: MaskBox = { x: 0.5, y: 0.5, w: 1, h: 1 };

function shapeLayer(shape: FrameShape, transform: Transform): Layer {
  if (shape.kind === "ellipse") return newShapeLayer("ellipse", transform);
  if (shape.kind === "rect") return { ...newShapeLayer("rect", transform), ...(shape.radius > 0 ? { radius: shape.radius } : {}) };
  return newPathLayer(shape.path, transform);
}

export function frameSlotLayer(shape: FrameShape, transform: Transform): Layer {
  return { ...shapeLayer(shape, transform), fill: FRAME_PLACEHOLDER_FILL, pattern: FRAME_PLACEHOLDER_PATTERN };
}

export function frameMask(shape: FrameShape, box: MaskBox, id: string = newStudioId("m")): Mask {
  const placed = (mask: Mask): Mask => ({ ...mask, x: box.x, y: box.y, w: box.w, h: box.h });
  if (shape.kind === "ellipse") return placed(newMask("ellipse", id));
  if (shape.kind === "rect") return { ...placed(newMask("rectangle", id)), ...(shape.radius > 0 ? { roundness: shape.radius } : {}) };
  return { ...placed(newMask("path", id)), path: shape.path };
}

export function needsMask(shape: FrameShape): boolean {
  return !(shape.kind === "rect" && shape.radius === 0);
}

export function containedBox(ratio: number, boxRatio: number): MaskBox {
  return boxRatio >= ratio ? { x: 0.5, y: 0.5, w: ratio / boxRatio, h: 1 } : { x: 0.5, y: 0.5, w: 1, h: boxRatio / ratio };
}

export function isPlaceholderSlot(layer: Pick<Layer, "fill" | "pattern">): boolean {
  return layer.fill === FRAME_PLACEHOLDER_FILL && layer.pattern?.presetId === FRAME_PLACEHOLDER_PATTERN.presetId && layer.pattern?.color === FRAME_PLACEHOLDER_PATTERN.color;
}
