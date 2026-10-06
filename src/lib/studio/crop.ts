import type { CanvasSize, Crop, Layer, Transform } from "./document";
import type { PixelBox } from "./geometry";
import { clampTo, LAYER_RANGES } from "./layer-ranges";
import type { Point } from "./viewport";

export interface CropFrame {
  center: Point;
  width: number;
  height: number;
  rotation: number;
  box: PixelBox;
}

const FULL: Crop = { x: 0, y: 0, w: 1, h: 1 };
const FULL_EPSILON = 1e-4;

function rotate(point: Point, degrees: number): Point {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: point.x * cos - point.y * sin, y: point.x * sin + point.y * cos };
}

function displayed(start: number, side: number, flipped: boolean | undefined): number {
  return flipped ? 1 - start - side : start;
}

export function cropFrame(layer: Layer, canvas: CanvasSize): CropFrame {
  const crop = layer.crop ?? FULL;
  const t = layer.transform;
  const boxWidth = t.w * canvas.width;
  const boxHeight = t.h * canvas.height;
  const width = boxWidth / crop.w;
  const height = boxHeight / crop.h;
  const dx = displayed(crop.x, crop.w, layer.flipX);
  const dy = displayed(crop.y, crop.h, layer.flipY);
  const offset = rotate({ x: (0.5 - (dx + crop.w / 2)) * width, y: (0.5 - (dy + crop.h / 2)) * height }, t.rotation);
  return {
    center: { x: t.x * canvas.width + offset.x, y: t.y * canvas.height + offset.y },
    width,
    height,
    rotation: t.rotation,
    box: { left: dx * width, top: dy * height, width: boxWidth, height: boxHeight },
  };
}

export function clampCropBox(box: PixelBox, frame: Pick<CropFrame, "width" | "height">): PixelBox {
  const width = clampTo(box.width, [LAYER_RANGES.cropSide[0] * frame.width, frame.width]);
  const height = clampTo(box.height, [LAYER_RANGES.cropSide[0] * frame.height, frame.height]);
  return { left: clampTo(box.left, [0, frame.width - width]), top: clampTo(box.top, [0, frame.height - height]), width, height };
}

function isFull(crop: Crop): boolean {
  return Math.abs(crop.x) < FULL_EPSILON && Math.abs(crop.y) < FULL_EPSILON && Math.abs(crop.w - 1) < FULL_EPSILON && Math.abs(crop.h - 1) < FULL_EPSILON;
}

export function applyCropBox(layer: Layer, frame: CropFrame, box: PixelBox, canvas: CanvasSize): { transform: Transform; crop: Crop | undefined } {
  const b = clampCropBox(box, frame);
  const w = b.width / frame.width;
  const h = b.height / frame.height;
  const crop: Crop = { x: displayed(b.left / frame.width, w, layer.flipX), y: displayed(b.top / frame.height, h, layer.flipY), w, h };
  const offset = rotate({ x: b.left + b.width / 2 - frame.width / 2, y: b.top + b.height / 2 - frame.height / 2 }, frame.rotation);
  const transform: Transform = {
    ...layer.transform,
    x: clampTo((frame.center.x + offset.x) / canvas.width, LAYER_RANGES.position),
    y: clampTo((frame.center.y + offset.y) / canvas.height, LAYER_RANGES.position),
    w: clampTo(b.width / canvas.width, LAYER_RANGES.size),
    h: clampTo(b.height / canvas.height, LAYER_RANGES.size),
  };
  return { transform, crop: isFull(crop) ? undefined : crop };
}
