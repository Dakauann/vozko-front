"use client";

import type Konva from "konva";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { Group, Rect } from "react-konva";

import type { Layer } from "@/lib/studio/document";
import { effectPlan, paintReach, type Paint } from "@/lib/studio/layer-paint";
import { cachePixelRatioFor, compositeOf, type Composite } from "@/lib/studio/paint";
import { paintParts, type PaintPart, type PartComposite } from "@/lib/studio/paint-parts";

import { effectsFilter, filterSetup, gradientFill } from "./konva-paint";
import { konvaLut, useLoadedLut } from "./lut-files";
import { usePatternFill } from "./pattern-fill";

export interface ContentProps {
  layer: Layer;
  width: number;
  height: number;
  fontBasePx: number;
  composite: Composite | PartComposite;
  pixelRatio?: number;
  ready: () => void;
  fail: (error: Error) => void;
}

type ContentMap = Record<Layer["type"], ComponentType<ContentProps>>;

interface RichContentProps extends ContentProps {
  contents: ContentMap;
}

const SAFETY_PX = 2;
const TEXT_OVERFLOW = 0.5;

export function screenRatio(): number {
  return typeof window === "undefined" ? 1 : cachePixelRatioFor(1, window.devicePixelRatio);
}

export function recache(node: Konva.Group, pixelRatio: number, offset: number): void {
  node.clearCache();
  const rect = node.getClientRect({ skipTransform: true });
  if (rect.width >= 1 && rect.height >= 1) node.cache({ pixelRatio, offset });
  node.getLayer()?.batchDraw();
}

function partKeys(parts: readonly PaintPart[]): string[] {
  return parts.flatMap((part) => (part.kind === "content" ? [part.key] : [...part.mask.map((_, j) => `${part.key}:${j}`), `${part.key}:paint`]));
}

function overflow(layer: Layer, fontBasePx: number): number {
  return layer.type === "text" ? Math.ceil(TEXT_OVERFLOW * (layer.fontSize ?? 0) * fontBasePx) : 0;
}

interface PaintRectProps {
  paint: Paint;
  width: number;
  height: number;
  reach: number;
  pixelRatio: number;
  ready: () => void;
  fail: (error: Error) => void;
}

function PaintRect({ paint, width, height, reach, pixelRatio, ready, fail }: PaintRectProps) {
  const pattern = usePatternFill(paint.type === "pattern" ? paint.pattern : undefined, pixelRatio, width, height, reach);
  const patternStatus = paint.type === "pattern" ? pattern.status : "ready";

  useEffect(() => {
    if (patternStatus === "ready") ready();
    if (patternStatus === "failed" && pattern.status === "failed") fail(pattern.error);
  }, [patternStatus, pattern, paint, width, height, reach, pixelRatio, ready, fail]);

  const box = { x: reach, y: reach, width, height };
  const fill = paint.type === "solid" ? { fill: paint.color } : paint.type === "gradient" ? gradientFill(paint.gradient, box) : pattern.status === "ready" ? pattern.props : null;
  if (!fill) return null;
  return <Rect x={-reach} y={-reach} width={width + 2 * reach} height={height + 2 * reach} globalCompositeOperation="source-in" listening={false} {...fill} />;
}

export function RichContent({ layer, width, height, fontBasePx, composite, pixelRatio, contents, ready, fail }: RichContentProps) {
  const ratio = pixelRatio ?? screenRatio();
  const parts = useMemo(() => paintParts(layer), [layer]);
  const keys = useMemo(() => partKeys(parts), [parts]);
  const lut = useLoadedLut(layer.type === "image" ? (layer.color?.lut?.assetId ?? null) : null);
  const atlas = konvaLut(lut);
  const lutError = lut.status === "failed" ? lut.error : null;
  const filters = useMemo(() => {
    const plan = effectPlan(layer);
    const picture = layer.type === "image" ? filterSetup(layer.filters, layer.color, layer.gradientMap, undefined, atlas) : { list: [], props: {} };
    return { list: [...(plan.effects.length > 0 || plan.outlines.length > 0 ? [effectsFilter(plan)] : []), ...picture.list], props: picture.props };
  }, [layer, atlas]);
  const offset = Math.ceil(paintReach(layer)) + SAFETY_PX;
  const margin = overflow(layer, fontBasePx) + SAFETY_PX;
  const outer = useRef<Konva.Group>(null);
  const masks = useRef(new Map<string, Konva.Group>());
  const reported = useRef(new Set<string>());
  const [tick, setTick] = useState(0);
  const reporters = useMemo(
    () =>
      new Map(
        keys.map((key) => [
          key,
          () => {
            reported.current.add(key);
            setTick((value) => value + 1);
          },
        ]),
      ),
    [keys],
  );
  const reporter = (key: string) => reporters.get(key) ?? fail.bind(null, new Error(`studio paint part ${key} has no reporter`));

  const register = useCallback((key: string, node: Konva.Group | null) => {
    if (node) masks.current.set(key, node);
    else masks.current.delete(key);
  }, []);

  useLayoutEffect(() => {
    if (layer.hidden) return;
    for (const group of masks.current.values()) recache(group, ratio, 0);
    if (outer.current) recache(outer.current, ratio, offset);
    if (lut.status === "loading" || !keys.every((key) => reported.current.has(key))) return;
    if (lutError) fail(lutError);
    else ready();
  }, [tick, layer, width, height, ratio, offset, keys, filters, lut.status, lutError, ready, fail]);

  return (
    <Group ref={outer} globalCompositeOperation={composite} filters={filters.list} {...filters.props}>
      {parts.map((part) => {
        if (part.kind === "content") {
          const Content = contents[part.layer.type];
          return (
            <Group key={part.key} opacity={part.opacity}>
              <Content layer={part.layer} width={width} height={height} fontBasePx={fontBasePx} composite={compositeOf(part.blend || undefined)} pixelRatio={ratio} ready={reporter(part.key)} fail={fail} />
            </Group>
          );
        }
        const Content = contents[layer.type];
        return (
          <Group key={part.key} ref={(node) => register(part.key, node)} opacity={part.opacity} globalCompositeOperation={compositeOf(part.blend || undefined)}>
            {part.mask.map((shape, j) => (
              <Content key={j} layer={shape.layer} width={width} height={height} fontBasePx={fontBasePx} composite={shape.composite} ready={reporter(`${part.key}:${j}`)} fail={fail} />
            ))}
            <PaintRect paint={part.paint} width={width} height={height} reach={Math.ceil(part.reach) + margin} pixelRatio={ratio} ready={reporter(`${part.key}:paint`)} fail={fail} />
          </Group>
        );
      })}
    </Group>
  );
}
