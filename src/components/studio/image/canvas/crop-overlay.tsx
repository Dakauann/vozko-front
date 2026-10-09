"use client";

import type Konva from "konva";
import { useEffect, useRef } from "react";
import { Group, Image as KonvaImage, Rect, Transformer } from "react-konva";

import { loadAssetImage, useLoadedImage } from "@/components/studio/canvas/asset-images";
import { clampCropBox } from "@/lib/studio/crop";
import type { PixelBox } from "@/lib/studio/geometry";

import { layerOf } from "@/lib/studio/artboards";

import { useEditorUi, useImageDoc, useImageEditor } from "../editor-state";

const CROP_COLOR = "#6366f1";
const DIM_OPACITY = 0.35;

function FlippedImage({ image, width, height, flipX, flipY, opacity }: { image: HTMLImageElement; width: number; height: number; flipX?: boolean; flipY?: boolean; opacity?: number }) {
  return (
    <KonvaImage
      image={image}
      x={flipX ? width : 0}
      y={flipY ? height : 0}
      scaleX={flipX ? -1 : 1}
      scaleY={flipY ? -1 : 1}
      width={width}
      height={height}
      opacity={opacity}
      listening={false}
    />
  );
}

export function CropOverlay() {
  const { commands } = useImageEditor();
  const crop = useEditorUi((s) => s.crop);
  const scale = useEditorUi((s) => s.viewport.scale);
  const layer = useImageDoc((s) => (crop ? layerOf(s.document, crop.layerId) : undefined));
  const loaded = useLoadedImage(layer?.assetId ?? null, loadAssetImage);
  const box = useRef<Konva.Rect>(null);
  const transformer = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (!transformer.current || !box.current) return;
    transformer.current.nodes([box.current]);
    transformer.current.getLayer()?.batchDraw();
  }, [loaded.status]);

  if (!crop || !layer || loaded.status !== "ready") return null;
  const { frame } = crop;

  const commit = (next: PixelBox) => {
    const clamped = clampCropBox(next, frame);
    box.current?.setAttrs({ x: clamped.left, y: clamped.top, width: clamped.width, height: clamped.height, scaleX: 1, scaleY: 1 });
    commands.updateCropBox(clamped);
  };

  const read = (node: Konva.Rect): PixelBox => ({ left: node.x(), top: node.y(), width: node.width() * node.scaleX(), height: node.height() * node.scaleY() });

  return (
    <Group x={frame.center.x} y={frame.center.y} rotation={frame.rotation} offsetX={frame.width / 2} offsetY={frame.height / 2} opacity={layer.transform.opacity}>
      <FlippedImage image={loaded.image} width={frame.width} height={frame.height} flipX={layer.flipX} flipY={layer.flipY} opacity={DIM_OPACITY} />
      <Group clipX={crop.box.left} clipY={crop.box.top} clipWidth={crop.box.width} clipHeight={crop.box.height} listening={false}>
        <FlippedImage image={loaded.image} width={frame.width} height={frame.height} flipX={layer.flipX} flipY={layer.flipY} />
      </Group>
      <Rect
        ref={box}
        x={crop.box.left}
        y={crop.box.top}
        width={crop.box.width}
        height={crop.box.height}
        stroke={CROP_COLOR}
        strokeWidth={1.5 / scale}
        strokeScaleEnabled={false}
        draggable
        onDragMove={(event) => commit(read(event.target as Konva.Rect))}
        onTransform={(event) => commit(read(event.target as Konva.Rect))}
        onDblClick={() => commands.finishCrop()}
      />
      <Transformer
        ref={transformer}
        rotateEnabled={false}
        keepRatio={false}
        flipEnabled={false}
        ignoreStroke
        borderStroke={CROP_COLOR}
        anchorStroke={CROP_COLOR}
        anchorFill="#ffffff"
        anchorSize={10}
        anchorCornerRadius={2}
      />
    </Group>
  );
}
