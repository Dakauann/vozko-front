"use client";

import Konva from "konva";
import { forwardRef, memo, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { Arrow, Ellipse, Group, Image as KonvaImage, Line, Path, Rect, Text, TextPath } from "react-konva";

import { DEFAULT_FONT_ID, DEFAULT_FONT_WEIGHT, type FontId } from "@/lib/studio/fonts";
import type { Filters, Gradient, Layer } from "@/lib/studio/document";
import { arrowheadSize, pathArrowheads } from "@/lib/studio/arrowheads";
import { compositeOf, curvePath, framePolygon, gradientPaint, starPolygon, strokeStyle, type Box, type Composite } from "@/lib/studio/paint";
import { scalePath } from "@/lib/studio/vector-path";

import { loadAssetImage, loadUrlImage, useLoadedImage } from "./asset-images";
import { ensureFont, konvaFontFamily, konvaFontStyle } from "./ensure-font";
import { iconDataUrl } from "./icon-catalog";

export const DEFAULT_LINE_HEIGHT = 1.2;
export const ICON_RESOLUTION = 2;

const PLACEHOLDER_FILL = "#e5e7eb";
const BROKEN_STROKE = "#dc2626";

type GroupProps = Omit<ComponentProps<typeof Group>, "x" | "y" | "offsetX" | "offsetY" | "rotation" | "opacity" | "visible" | "id" | "children">;

export interface LayerFrame {
  width: number;
  height: number;
  fontBasePx?: number;
}

export interface LayerNodeProps extends LayerFrame {
  layer: Layer;
  groupProps?: GroupProps;
  composite?: Composite;
  onReady?: (layerId: string) => void;
  onError?: (layerId: string, error: Error) => void;
}

interface ContentProps {
  layer: Layer;
  width: number;
  height: number;
  fontBasePx: number;
  composite: Composite;
  ready: () => void;
  fail: (error: Error) => void;
}

function color(value: string | undefined): string | undefined {
  return value ? value : undefined;
}

export function cornerRadiusPx(radius: number | undefined, width: number, height: number): number {
  return ((radius ?? 0) * Math.min(width, height)) / 2;
}

export function gradientFill(gradient: Gradient | undefined, box: Box) {
  if (!gradient) return {};
  const paint = gradientPaint(gradient, box);
  if (paint.kind === "radial") {
    return {
      fillPriority: "radial-gradient",
      fillRadialGradientStartPoint: paint.center,
      fillRadialGradientEndPoint: paint.center,
      fillRadialGradientStartRadius: 0,
      fillRadialGradientEndRadius: paint.radius,
      fillRadialGradientColorStops: paint.stops,
    };
  }
  return {
    fillPriority: "linear-gradient",
    fillLinearGradientStartPoint: paint.start,
    fillLinearGradientEndPoint: paint.end,
    fillLinearGradientColorStops: paint.stops,
  };
}

function shadowProps(layer: Layer) {
  if (!layer.shadow) return {};
  return { shadowColor: layer.shadow.color, shadowBlur: layer.shadow.blur, shadowOffsetX: layer.shadow.x, shadowOffsetY: layer.shadow.y, shadowEnabled: true };
}

function strokeProps(layer: Layer) {
  const width = layer.strokeWidth ?? 0;
  const style = strokeStyle(layer);
  return {
    stroke: width > 0 ? color(layer.stroke) : undefined,
    strokeWidth: width,
    lineCap: style.lineCap,
    lineJoin: style.lineJoin,
    miterLimit: style.miterLimit,
    dash: style.dash,
    dashOffset: style.dashOffset,
  };
}

function filterSetup(filters: Filters | undefined) {
  if (!filters) return { list: [] as typeof Konva.Filters.Blur[], props: {} };
  const list: (typeof Konva.Filters.Blur)[] = [];
  if (filters.brightness !== 0) list.push(Konva.Filters.Brighten);
  if (filters.contrast !== 0) list.push(Konva.Filters.Contrast);
  if (filters.saturation !== 0) list.push(Konva.Filters.HSL);
  if (filters.blur > 0) list.push(Konva.Filters.Blur);
  return { list, props: { brightness: filters.brightness, contrast: filters.contrast, saturation: filters.saturation, blurRadius: filters.blur } };
}

function frameClip(layer: Layer, width: number, height: number) {
  const frame = layer.frame;
  if (!frame) return undefined;
  return (ctx: Konva.Context) => {
    ctx.beginPath();
    if (frame === "ellipse") {
      ctx.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
    } else {
      const points = framePolygon(frame, width, height);
      ctx.moveTo(points[0], points[1]);
      for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
    }
    ctx.closePath();
  };
}

function ImageContent({ layer, width, height, composite, ready, fail }: ContentProps) {
  const loaded = useLoadedImage(layer.assetId ?? null, loadAssetImage);
  const node = useRef<Konva.Image>(null);
  const filters = useMemo(() => filterSetup(layer.filters), [layer.filters]);
  const hasFilters = filters.list.length > 0;
  const clip = useMemo(() => frameClip(layer, width, height), [layer, width, height]);

  useEffect(() => {
    if (loaded.status === "failed") fail(loaded.error);
    if (loaded.status !== "ready") return;
    const image = node.current;
    if (image) {
      if (hasFilters) image.cache();
      else image.clearCache();
      image.getLayer()?.batchDraw();
    }
    ready();
  }, [loaded, hasFilters, width, height, layer.crop, layer.radius, layer.flipX, layer.flipY, layer.frame, layer.stroke, layer.strokeWidth, layer.dash, layer.dashArray, layer.dashOffset, layer.lineJoin, layer.miterLimit, layer.shadow, composite, ready, fail]);

  if (loaded.status !== "ready") {
    return (
      <Rect
        width={width}
        height={height}
        fill={loaded.status === "loading" ? PLACEHOLDER_FILL : undefined}
        stroke={loaded.status === "failed" ? BROKEN_STROKE : undefined}
        strokeWidth={loaded.status === "failed" ? 2 : 0}
        dash={[8, 6]}
        cornerRadius={cornerRadiusPx(layer.radius, width, height)}
      />
    );
  }

  const natural = loaded.image;
  const crop = layer.crop
    ? { x: layer.crop.x * natural.naturalWidth, y: layer.crop.y * natural.naturalHeight, width: layer.crop.w * natural.naturalWidth, height: layer.crop.h * natural.naturalHeight }
    : undefined;

  const picture = (
    <KonvaImage
      ref={node}
      image={natural}
      crop={crop}
      x={layer.flipX ? width : 0}
      y={layer.flipY ? height : 0}
      scaleX={layer.flipX ? -1 : 1}
      scaleY={layer.flipY ? -1 : 1}
      width={width}
      height={height}
      cornerRadius={clip ? 0 : cornerRadiusPx(layer.radius, width, height)}
      filters={filters.list}
      globalCompositeOperation={composite}
      {...filters.props}
      {...(clip ? {} : strokeProps(layer))}
      {...(clip ? {} : shadowProps(layer))}
    />
  );
  return clip ? <Group clipFunc={clip}>{picture}</Group> : picture;
}

function TextContent({ layer, width, height, fontBasePx, composite, ready, fail }: ContentProps) {
  const fontId: FontId = layer.fontId ?? DEFAULT_FONT_ID;
  const weight = layer.fontWeight || DEFAULT_FONT_WEIGHT;
  const italic = Boolean(layer.italic);
  const fontKey = `${fontId}:${weight}:${italic}`;
  const [loadedFont, setLoadedFont] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    ensureFont(fontId, weight, italic).then(
      () => !cancelled && setLoadedFont(fontKey),
      (error: Error) => !cancelled && fail(error),
    );
    return () => {
      cancelled = true;
    };
  }, [fontId, weight, italic, fontKey, fail]);

  const fontReady = loadedFont === fontKey;

  useEffect(() => {
    if (fontReady) ready();
  }, [fontReady, layer, width, height, fontBasePx, ready]);

  const fontSize = (layer.fontSize ?? 0) * fontBasePx;
  const outlined = (layer.strokeWidth ?? 0) > 0;
  const curved = Math.abs(layer.curve ?? 0) >= 1e-3;
  const paint = {
    fill: layer.gradient ? undefined : color(layer.fill),
    ...gradientFill(layer.gradient, { x: 0, y: 0, width, height }),
    fillAfterStrokeEnabled: outlined,
    globalCompositeOperation: composite,
    ...strokeProps(layer),
    ...shadowProps(layer),
  };
  const font = {
    fontFamily: konvaFontFamily(fontId),
    fontStyle: konvaFontStyle(fontId, weight, italic),
    fontSize,
    letterSpacing: (layer.letterSpacing ?? 0) * fontSize,
  };
  const key = fontReady ? fontKey : "pending";

  return (
    <>
      {layer.highlight && !curved ? (
        <Rect width={width} height={height} fill={layer.highlight.color} cornerRadius={cornerRadiusPx(layer.highlight.radius, width, height)} globalCompositeOperation={composite} />
      ) : null}
      {curved ? (
        <TextPath key={key} data={curvePath(width, height, layer.curve ?? 0)} text={(layer.text ?? "").replace(/\s+/g, " ")} align="center" {...font} {...paint} />
      ) : (
        <Text
          key={key}
          text={layer.text ?? ""}
          width={width}
          height={height}
          verticalAlign="middle"
          align={layer.align || "left"}
          wrap="word"
          lineHeight={layer.lineHeight || DEFAULT_LINE_HEIGHT}
          {...font}
          {...paint}
        />
      )}
    </>
  );
}

function ShapeContent({ layer, width, height, composite, ready }: ContentProps) {
  useEffect(() => {
    ready();
  }, [layer, width, height, ready]);

  const plain = color(layer.fill);
  const stroke = strokeProps(layer);
  const shadow = shadowProps(layer);
  const lineColor = color(layer.stroke) ?? plain;
  const lineWidth = layer.strokeWidth ?? 0;
  const fillIn = (box: Box) => (layer.gradient ? gradientFill(layer.gradient, box) : { fill: plain });
  const common = { globalCompositeOperation: composite, ...stroke, ...shadow };

  switch (layer.shape) {
    case "rect":
      return <Rect width={width} height={height} cornerRadius={cornerRadiusPx(layer.radius, width, height)} {...fillIn({ x: 0, y: 0, width, height })} {...common} />;
    case "ellipse":
      return <Ellipse x={width / 2} y={height / 2} radiusX={width / 2} radiusY={height / 2} {...fillIn({ x: -width / 2, y: -height / 2, width, height })} {...common} />;
    case "triangle":
      return <Line points={[width / 2, 0, width, height, 0, height]} closed {...fillIn({ x: 0, y: 0, width, height })} {...common} />;
    case "star":
      return <Line points={starPolygon(layer, width, height)} closed {...fillIn({ x: 0, y: 0, width, height })} {...common} />;
    case "path": {
      const body = <Path data={scalePath(layer.path ?? "", width, height)} fillRule={layer.fillRule} {...fillIn({ x: 0, y: 0, width, height })} {...common} />;
      const heads = pathArrowheads(layer, width, height);
      if (heads.length === 0) return body;
      return (
        <Group>
          {body}
          {heads.map((points, i) => (
            <Line key={i} points={points} closed fill={lineColor} globalCompositeOperation={composite} {...shadow} />
          ))}
        </Group>
      );
    }
    case "line":
    case "arrow": {
      const pointer = arrowheadSize(lineWidth);
      return (
        <Arrow
          points={[0, height / 2, width, height / 2]}
          stroke={lineColor}
          fill={lineColor}
          strokeWidth={lineWidth}
          lineCap={stroke.lineCap}
          lineJoin={stroke.lineJoin}
          miterLimit={stroke.miterLimit}
          dash={stroke.dash}
          dashOffset={stroke.dashOffset}
          pointerAtBeginning={Boolean(layer.arrowStart)}
          pointerAtEnding={Boolean(layer.arrowEnd)}
          pointerLength={pointer}
          pointerWidth={pointer}
          globalCompositeOperation={composite}
          {...shadow}
        />
      );
    }
  }
  return null;
}

function IconContent({ layer, width, height, composite, ready, fail }: ContentProps) {
  const source = useMemo(
    () => iconDataUrl(layer.iconId ?? "", layer.fill || "#000000", width * ICON_RESOLUTION, height * ICON_RESOLUTION),
    [layer.iconId, layer.fill, width, height],
  );
  const loaded = useLoadedImage(source, loadUrlImage);

  useEffect(() => {
    if (loaded.status === "failed") fail(loaded.error);
    if (loaded.status === "ready") ready();
  }, [loaded, ready, fail]);

  if (loaded.status !== "ready") return <Rect width={width} height={height} stroke={loaded.status === "failed" ? BROKEN_STROKE : undefined} strokeWidth={2} dash={[8, 6]} />;
  return <KonvaImage image={loaded.image} width={width} height={height} globalCompositeOperation={composite} {...shadowProps(layer)} />;
}

const CONTENT = { image: ImageContent, text: TextContent, shape: ShapeContent, icon: IconContent } as const;

export const LayerNode = memo(forwardRef<Konva.Group, LayerNodeProps>(function LayerNode({ layer, width, height, fontBasePx, groupProps, composite, onReady, onError }, ref) {
  const boxWidth = layer.transform.w * width;
  const boxHeight = layer.transform.h * height;
  const callbacks = useRef({ onReady, onError });

  useEffect(() => {
    callbacks.current = { onReady, onError };
  }, [onReady, onError]);

  const ready = useMemo(() => () => callbacks.current.onReady?.(layer.id), [layer.id]);
  const fail = useMemo(() => (error: Error) => callbacks.current.onError?.(layer.id, error), [layer.id]);
  const Content = CONTENT[layer.type];

  return (
    <Group
      ref={ref}
      {...groupProps}
      id={layer.id}
      x={layer.transform.x * width}
      y={layer.transform.y * height}
      offsetX={boxWidth / 2}
      offsetY={boxHeight / 2}
      rotation={layer.transform.rotation}
      opacity={layer.transform.opacity}
      visible={!layer.hidden}
    >
      {Content ? (
        <Content layer={layer} width={boxWidth} height={boxHeight} fontBasePx={fontBasePx ?? height} composite={composite ?? compositeOf(layer.blendMode)} ready={ready} fail={fail} />
      ) : null}
    </Group>
  );
}));
