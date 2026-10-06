"use client";

import { Group, Layer as KonvaLayer, Stage } from "react-konva";

import { LayerNode } from "@/components/studio/canvas/layer-node";
import type { CanvasSize } from "@/lib/studio/document";
import type { VisualItem } from "@/lib/studio/playback";

interface OverlayStageProps {
  items: VisualItem[];
  canvas: CanvasSize;
  frame: CanvasSize;
  zIndex: number;
}

export function OverlayStage({ items, canvas, frame, zIndex }: OverlayStageProps) {
  const scale = frame.width / canvas.width;
  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex }} aria-hidden>
      <Stage width={frame.width} height={frame.height} scaleX={scale} scaleY={scale} listening={false}>
        <KonvaLayer>
          {items.map((item) => {
            if (!item.layer) return null;
            const t = item.transform;
            const width = t.w * canvas.width;
            const height = t.h * canvas.height;
            return (
              <Group key={item.clipId} x={t.x * canvas.width} y={t.y * canvas.height} offsetX={width / 2} offsetY={height / 2} rotation={t.rotation} opacity={item.opacity}>
                <LayerNode layer={item.layer} width={width} height={height} fontBasePx={canvas.height} />
              </Group>
            );
          })}
        </KonvaLayer>
      </Stage>
    </div>
  );
}
