"use client";

import { Group, Layer as KonvaLayer, Stage } from "react-konva";

import { ChartBody, LayerNode } from "@/components/studio/canvas/layer-node";
import { chartFrameLayers } from "@/lib/studio/chart-animation";
import type { CanvasSize } from "@/lib/studio/document";
import { contentStretch, type VisualItem } from "@/lib/studio/playback";
import { shownLayer } from "@/lib/studio/text-glyphs";

interface OverlayStageProps {
  items: VisualItem[];
  canvas: CanvasSize;
  frame: CanvasSize;
  zIndex: number;
}

function settled() {}

export function OverlayStage({ items, canvas, frame, zIndex }: OverlayStageProps) {
  const scale = frame.width / canvas.width;
  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex }} aria-hidden>
      <Stage width={frame.width} height={frame.height} scaleX={scale} scaleY={scale} listening={false}>
        <KonvaLayer>
          {items.map((item) => {
            if (!item.layer) return null;
            const t = item.transform;
            const stretch = contentStretch(item);
            const width = t.w * stretch.width * canvas.width;
            const height = t.h * stretch.height * canvas.height;
            return (
              <Group key={item.clipId} x={t.x * canvas.width} y={t.y * canvas.height} offsetX={width / 2} offsetY={height / 2} scaleX={stretch.scaleX} scaleY={stretch.scaleY} rotation={t.rotation} opacity={item.opacity}>
                {item.chart ? (
                  <ChartBody parts={chartFrameLayers(item.layer, item.chart, { width, height })} width={width} height={height} ready={settled} fail={settled} />
                ) : (
                  <LayerNode layer={shownLayer(item.layer, item.glyphs)} width={width} height={height} fontBasePx={canvas.height} />
                )}
              </Group>
            );
          })}
        </KonvaLayer>
      </Stage>
    </div>
  );
}
