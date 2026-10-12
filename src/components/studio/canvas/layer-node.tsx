"use client";

import Konva from "konva";
import { forwardRef, memo, useEffect, useMemo, useRef, type ComponentProps } from "react";
import { Arrow, Ellipse, Group, Image as KonvaImage, Line, Path, Rect, Text, TextPath } from "react-konva";

import { DEFAULT_FONT_ID, DEFAULT_FONT_WEIGHT, type FontId } from "@/lib/studio/fonts";
import type { Layer } from "@/lib/studio/document";
import { arrowheadSize, lineMarkers, pathArrowheads, strokedArrowEnds } from "@/lib/studio/arrowheads";
import { paintsRichly } from "@/lib/studio/layer-paint";
import { compositeOf, curvePath, framePolygon, regularPolygon, starPolygon, strokeStyle, type Box, type Composite } from "@/lib/studio/paint";
import { flowsInLines } from "@/lib/studio/text-animation";
import { hasRuns } from "@/lib/studio/text-runs";
import { scalePath } from "@/lib/studio/vector-path";
import { pathOpsLayer } from "@/lib/studio/path-ops";
import { generatedPartLayers } from "@/lib/studio/generated-layers";

import { loadAssetImage, loadUrlImage, useLoadedImage } from "./asset-images";
import { iconDataUrl } from "./icon-catalog";
import { filterSetup, gradientFill } from "./konva-paint";
import { konvaLut, useLoadedLut } from "./lut-files";
import { MaskedContent, PaintContent } from "./pixel-content";
import { hasStillVfx, VfxLayer } from "./vfx-content";
import { RichContent, type ContentProps } from "./rich-content";
import { RichTextContent, type TextPaint } from "./rich-text";
import { textBlockProps, textFontProps } from "./text-props";
import { useFontsReady } from "./use-fonts-ready";

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
  pixelRatio?: number;
  onReady?: (layerId: string) => void;
  onError?: (layerId: string, error: Error) => void;
}

function color(value: string | undefined): string | undefined {
  return value ? value : undefined;
}

export function cornerRadiusPx(radius: number | undefined, width: number, height: number): number {
  return ((radius ?? 0) * Math.min(width, height)) / 2;
}

export { gradientFill };

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

function ImageContent({ layer, width, height, composite, pixelRatio, ready, fail }: ContentProps) {
  const loaded = useLoadedImage(layer.assetId ?? null, loadAssetImage);
  const lut = useLoadedLut(layer.color?.lut?.assetId ?? null);
  const atlas = konvaLut(lut);
  const lutError = lut.status === "failed" ? lut.error : null;
  const node = useRef<Konva.Image>(null);
  const filters = useMemo(() => filterSetup(layer.filters, layer.color, layer.gradientMap, layer.chromaKey, atlas), [layer.filters, layer.color, layer.gradientMap, layer.chromaKey, atlas]);
  const hasFilters = filters.list.length > 0;
  const clip = useMemo(() => frameClip(layer, width, height), [layer, width, height]);

  useEffect(() => {
    if (loaded.status === "failed") fail(loaded.error);
    if (loaded.status !== "ready" || lut.status === "loading") return;
    const image = node.current;
    if (image) {
      if (hasFilters) image.cache(pixelRatio ? { pixelRatio } : undefined);
      else image.clearCache();
      image.getLayer()?.batchDraw();
    }
    if (lutError) fail(lutError);
    else ready();
  }, [loaded, lut.status, lutError, hasFilters, filters, pixelRatio, width, height, layer.crop, layer.radius, layer.flipX, layer.flipY, layer.frame, layer.stroke, layer.strokeWidth, layer.dash, layer.dashArray, layer.dashOffset, layer.lineJoin, layer.miterLimit, layer.shadow, composite, ready, fail]);

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

function textPaint(layer: Layer, composite: ContentProps["composite"]): TextPaint {
  return { fillAfterStrokeEnabled: (layer.strokeWidth ?? 0) > 0, globalCompositeOperation: composite, ...strokeProps(layer), ...shadowProps(layer) };
}

function TextHighlight({ layer, width, height, composite, curved }: Pick<ContentProps, "layer" | "width" | "height" | "composite"> & { curved: boolean }) {
  if (!layer.highlight || curved) return null;
  return <Rect width={width} height={height} fill={layer.highlight.color} cornerRadius={cornerRadiusPx(layer.highlight.radius, width, height)} globalCompositeOperation={composite} />;
}

function PlainTextContent({ layer, width, height, fontBasePx, composite, ready, fail }: ContentProps) {
  const fontId: FontId = layer.fontId ?? DEFAULT_FONT_ID;
  const weight = layer.fontWeight || DEFAULT_FONT_WEIGHT;
  const italic = Boolean(layer.italic);
  const fonts = useMemo(() => [{ fontId, weight, italic }], [fontId, weight, italic]);
  const loaded = useFontsReady(fonts, fail);

  useEffect(() => {
    if (loaded.ready) ready();
  }, [loaded.ready, layer, width, height, fontBasePx, ready]);

  const curved = !flowsInLines(layer);
  const paint = {
    fill: layer.gradient ? undefined : color(layer.fill),
    ...gradientFill(layer.gradient, { x: 0, y: 0, width, height }),
    ...textPaint(layer, composite),
  };
  const font = textFontProps(layer, fontBasePx);
  const key = loaded.ready ? loaded.key : "pending";

  return (
    <>
      <TextHighlight layer={layer} width={width} height={height} composite={composite} curved={curved} />
      {curved ? (
        <TextPath key={key} data={curvePath(width, height, layer.curve ?? 0)} text={(layer.text ?? "").replace(/\s+/g, " ")} align="center" {...font} {...paint} />
      ) : (
        <Text key={key} {...textBlockProps(layer, width, height)} {...font} {...paint} />
      )}
    </>
  );
}

function TextContent(props: ContentProps) {
  if (!hasRuns(props.layer)) return <PlainTextContent {...props} />;
  return <RichTextContent {...props} paint={textPaint(props.layer, props.composite)} highlight={(curved) => <TextHighlight layer={props.layer} width={props.width} height={props.height} composite={props.composite} curved={curved} />} />;
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
    case "polygon":
      return <Line points={regularPolygon(layer, width, height)} closed {...fillIn({ x: 0, y: 0, width, height })} {...common} />;
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
      const pointers = strokedArrowEnds(layer);
      const marks = lineMarkers(layer, width, height);
      const line = (
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
          pointerAtBeginning={pointers.start}
          pointerAtEnding={pointers.end}
          pointerLength={pointer}
          pointerWidth={pointer}
          globalCompositeOperation={composite}
          {...shadow}
        />
      );
      if (marks.length === 0) return line;
      return (
        <Group>
          {line}
          {marks.map((points, i) => (
            <Line key={i} points={points} closed fill={lineColor} globalCompositeOperation={composite} {...shadow} />
          ))}
        </Group>
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

export interface ChartBodyProps {
  parts: readonly Layer[];
  width: number;
  height: number;
  composite?: Composite;
  pixelRatio?: number;
  ready: () => void;
  fail: (error: Error) => void;
}

function readiness(ids: readonly string[], done: () => void): (id: string) => void {
  const waiting = new Set(ids);
  return (id) => {
    if (!waiting.delete(id) || waiting.size > 0) return;
    done();
  };
}

export function ChartBody({ parts, width, height, composite, pixelRatio, ready, fail }: ChartBodyProps) {
  const partReady = useMemo(() => readiness(parts.map((part) => part.id), ready), [parts, ready]);
  const partFailed = useMemo(() => (_: string, error: Error) => fail(error), [fail]);

  useEffect(() => {
    if (parts.length === 0) ready();
  }, [parts, ready]);

  return (
    <>
      {parts.map((part) => (
        <LayerNode key={part.id} layer={part} width={width} height={height} fontBasePx={height} composite={composite} pixelRatio={pixelRatio} onReady={partReady} onError={partFailed} />
      ))}
    </>
  );
}

function GeneratedContent({ layer, width, height, composite, pixelRatio, ready, fail }: ContentProps) {
  const parts = useMemo(() => generatedPartLayers(layer, { width, height }), [layer, width, height]);
  return <ChartBody parts={parts} width={width} height={height} composite={composite === "destination-in" || composite === "destination-out" ? undefined : composite} pixelRatio={pixelRatio} ready={ready} fail={fail} />;
}

const CONTENT = { image: ImageContent, text: TextContent, shape: ShapeContent, icon: IconContent, instance: NoContent, paint: PaintContent, chart: GeneratedContent, table: GeneratedContent, qr: GeneratedContent } as const;

function NoContent() {
  return null;
}

function LayerBody(props: ContentProps) {
  if (paintsRichly(props.layer)) return <RichContent {...props} contents={CONTENT} />;
  const Content = CONTENT[props.layer.type];
  return Content ? <Content {...props} /> : null;
}

interface LayerContentProps {
  source: Layer;
  body: Omit<ContentProps, "composite" | "ready">;
  mode: Composite;
  done: () => void;
}

function LayerContent({ source, body, mode, done }: LayerContentProps) {
  if (source.type !== "image" || !source.mask) return <LayerBody {...body} composite={mode} ready={done} />;
  return (
    <MaskedContent layer={source} width={body.width} height={body.height} composite={mode} pixelRatio={body.pixelRatio} ready={done}>
      {(shown) => <LayerBody {...body} composite="source-over" ready={shown} />}
    </MaskedContent>
  );
}

export const LayerNode = memo(forwardRef<Konva.Group, LayerNodeProps>(function LayerNode({ layer, width, height, fontBasePx, groupProps, composite, pixelRatio, onReady, onError }, ref) {
  const boxWidth = layer.transform.w * width;
  const boxHeight = layer.transform.h * height;
  const callbacks = useRef({ onReady, onError });

  useEffect(() => {
    callbacks.current = { onReady, onError };
  }, [onReady, onError]);

  const ready = useMemo(() => () => callbacks.current.onReady?.(layer.id), [layer.id]);
  const fail = useMemo(() => (error: Error) => callbacks.current.onError?.(layer.id, error), [layer.id]);
  const shaped = useMemo(() => pathOpsLayer(layer, { width, height }), [layer, width, height]);
  const body = { layer: shaped, width: boxWidth, height: boxHeight, fontBasePx: fontBasePx ?? height, pixelRatio, fail };
  const blend = composite ?? compositeOf(layer.blendMode);

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
      scaleX={layer.flipX && layer.type !== "image" ? -1 : 1}
      scaleY={layer.flipY && layer.type !== "image" ? -1 : 1}
      visible={!layer.hidden}
    >
      {layer.type === "image" && hasStillVfx(layer.vfx) ? (
        <VfxLayer layer={layer} width={boxWidth} height={boxHeight} fontBasePx={body.fontBasePx} pixelRatio={pixelRatio} composite={blend} ready={ready}>
          {(shown) => <LayerContent source={layer} body={body} mode="source-over" done={shown} />}
        </VfxLayer>
      ) : (
        <LayerContent source={layer} body={body} mode={blend} done={ready} />
      )}
    </Group>
  );
}));
