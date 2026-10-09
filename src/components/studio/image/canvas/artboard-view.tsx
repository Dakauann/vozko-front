"use client";

import type Konva from "konva";
import { memo, type ComponentProps } from "react";
import { Group, Rect, Shape } from "react-konva";

import { gradientFill, LayerNode } from "@/components/studio/canvas/layer-node";
import { LayerStack, type StackNodeExtra } from "@/components/studio/canvas/layer-stack";
import type { Artboard, CanvasSize, Layer } from "@/lib/studio/document";
import { cachePixelRatioFor } from "@/lib/studio/paint";

import { useCheckerImage } from "./checker";

export const BACKDROP_NAME = "studio-backdrop";
export const ARTBOARD_NAME = "studio-artboard";
export const SELECTION_COLOR = "#6366f1";
const BACKDROP_PREFIX = "backdrop:";

export function backdropId(artboardId: string): string {
  return `${BACKDROP_PREFIX}${artboardId}`;
}

export function backdropArtboard(node: Konva.Node): string | null {
  return node.name() === BACKDROP_NAME && node.id().startsWith(BACKDROP_PREFIX) ? node.id().slice(BACKDROP_PREFIX.length) : null;
}

export type GroupProps = NonNullable<ComponentProps<typeof LayerNode>["groupProps"]>;

interface LayerItemProps extends StackNodeExtra {
  layer: Layer;
  canvas: CanvasSize;
  draggable: boolean;
  pickable: boolean;
  concealed: boolean;
  handlers: GroupProps;
}

type ProxyProps = Omit<LayerItemProps, keyof StackNodeExtra>;

function drawNothing() {}

function hitRect(context: Konva.Context, shape: Konva.Shape) {
  context.beginPath();
  context.rect(0, 0, shape.width(), shape.height());
  context.closePath();
  context.fillStrokeShape(shape);
}

function hitEllipse(context: Konva.Context, shape: Konva.Shape) {
  context.beginPath();
  context.ellipse(shape.width() / 2, shape.height() / 2, shape.width() / 2, shape.height() / 2, 0, 0, Math.PI * 2);
  context.closePath();
  context.fillStrokeShape(shape);
}

const LayerProxy = memo(function LayerProxy({ layer, canvas, draggable, pickable, concealed, handlers }: ProxyProps) {
  const t = layer.transform;
  const width = t.w * canvas.width;
  const height = t.h * canvas.height;
  const round = layer.type === "shape" ? layer.shape === "ellipse" : layer.frame === "ellipse";
  return (
    <Group
      {...handlers}
      id={layer.id}
      x={t.x * canvas.width}
      y={t.y * canvas.height}
      offsetX={width / 2}
      offsetY={height / 2}
      rotation={t.rotation}
      visible={!layer.hidden && !concealed}
      draggable={draggable}
      listening={pickable}
    >
      <Shape width={width} height={height} fill="transparent" perfectDrawEnabled={false} sceneFunc={drawNothing} hitFunc={round ? hitEllipse : hitRect} />
    </Group>
  );
});

const LayerItem = memo(function LayerItem({ layer, canvas, draggable, pickable, concealed, handlers, composite, onReady, onError }: LayerItemProps) {
  const shown = concealed ? { ...layer, hidden: true } : layer;
  return <LayerNode layer={shown} width={canvas.width} height={canvas.height} composite={composite} onReady={onReady} onError={onError} groupProps={{ ...handlers, draggable, listening: pickable }} />;
});

export function LayerOutline({ layer, canvas, scale, solid = false }: { layer: Layer; canvas: CanvasSize; scale: number; solid?: boolean }) {
  const pad = 3 / scale;
  const width = layer.transform.w * canvas.width + pad * 2;
  const height = layer.transform.h * canvas.height + pad * 2;
  return (
    <Rect
      x={layer.transform.x * canvas.width}
      y={layer.transform.y * canvas.height}
      offsetX={width / 2}
      offsetY={height / 2}
      width={width}
      height={height}
      rotation={layer.transform.rotation}
      stroke={SELECTION_COLOR}
      strokeWidth={(solid ? 2 : 1.5) / scale}
      dash={solid ? undefined : [4 / scale, 3 / scale]}
      listening={false}
    />
  );
}

export interface ArtboardViewProps {
  artboard: Artboard;
  gpu: boolean;
  busy: boolean;
  editingTextId: string | null;
  croppingId: string | null;
  scale: number;
  handlers: GroupProps;
  register: (id: string, node: Konva.Group | null) => void;
}

function cachePixelRatio(scale: number): number {
  return cachePixelRatioFor(scale, typeof window === "undefined" ? 1 : window.devicePixelRatio);
}

export const ArtboardView = memo(function ArtboardView({ artboard, gpu, busy, editingTextId, croppingId, scale, handlers, register }: ArtboardViewProps) {
  const { canvas } = artboard;
  const pattern = useCheckerImage(!gpu && !canvas.background && !canvas.gradient);
  const layerProps = (layer: Layer) => ({
    layer,
    canvas,
    draggable: !layer.locked && !busy && editingTextId !== layer.id,
    pickable: !layer.locked,
    concealed: editingTextId === layer.id || croppingId === layer.id,
    handlers,
  });
  return (
    <Group ref={(node) => register(artboard.id, node)} name={ARTBOARD_NAME} x={artboard.x} y={artboard.y}>
      {gpu ? (
        <Rect name={BACKDROP_NAME} id={backdropId(artboard.id)} width={canvas.width} height={canvas.height} fill="transparent" perfectDrawEnabled={false} />
      ) : (
        <Rect
          name={BACKDROP_NAME}
          id={backdropId(artboard.id)}
          width={canvas.width}
          height={canvas.height}
          fill={canvas.background || undefined}
          {...gradientFill(canvas.gradient, { x: 0, y: 0, width: canvas.width, height: canvas.height })}
          fillPatternImage={pattern ?? undefined}
          fillPatternScaleX={pattern ? 1 / scale : undefined}
          fillPatternScaleY={pattern ? 1 / scale : undefined}
          shadowColor="#000000"
          shadowOpacity={0.12}
          shadowBlur={16 / scale}
          shadowOffsetY={2 / scale}
        />
      )}
      <Group clipX={0} clipY={0} clipWidth={canvas.width} clipHeight={canvas.height}>
        {gpu ? (
          artboard.layers.map((layer) => <LayerProxy key={layer.id} {...layerProps(layer)} />)
        ) : (
          <LayerStack layers={artboard.layers} pixelRatio={cachePixelRatio(scale)} render={(layer, extra) => <LayerItem key={layer.id} {...layerProps(layer)} {...extra} />} />
        )}
      </Group>
    </Group>
  );
});
