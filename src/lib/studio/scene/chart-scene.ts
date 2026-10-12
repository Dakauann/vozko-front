import { partPose, scaledTransform, sweepPolygon, type ChartMotion } from "../chart-animation";
import { chartParts, type ChartPart } from "../chart-parts";
import type { ChartSpec } from "../chart";
import type { CanvasSize, Layer, Transform } from "../document";
import { lineReach, lineStep, strokelessLayer, type LineAnimation, type LineState } from "../line-animation";
import { lineNode } from "./line-node";
import { paintedContent, rasterPlan } from "./raster";
import type { SceneNode } from "./scene";

const NEUTRAL: Transform = { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 };

function trimState(layer: Layer, progress: number): LineState {
  const line: LineAnimation = { trim: { start: 0, end: progress, offset: 0 } };
  return { resolved: { trim: { start: 0, end: progress, offset: 0, sequential: false } }, reachPx: lineReach({ line, layer }), step: lineStep({ line }) };
}

function partNode(id: string, part: ChartPart, spec: ChartSpec, motion: ChartMotion, size: CanvasSize): SceneNode | null {
  const pose = partPose(part, spec, motion);
  if (pose.effect !== "none" && pose.progress <= 0) return null;
  const base = part.layer.transform;
  const moving = pose.progress < 1;
  const shown = moving && pose.effect === "scale" ? scaledTransform(part, pose.progress, size) : base;
  const trim = moving && pose.effect === "trim" ? trimState(part.layer, pose.progress) : null;
  const painted = trim ? strokelessLayer(part.layer) : part.layer;
  const { source } = rasterPlan({ ...paintedContent(painted), transform: NEUTRAL }, base.w * size.width, base.h * size.height, size.height, trim?.reachPx ?? 0);
  const scaleX = base.w > 0 ? shown.w / base.w : 1;
  const scaleY = base.h > 0 ? shown.h / base.h : 1;
  const frame = { x: base.x * size.width, y: base.y * size.height, width: base.w * size.width, height: base.h * size.height, rotation: 0 };
  return {
    id: `${id};${part.layer.id}`,
    source,
    box: { x: shown.x * size.width, y: shown.y * size.height, width: source.widthPx * scaleX, height: source.heightPx * scaleY, rotation: shown.rotation },
    fit: "fill",
    opacity: base.opacity * (moving && pose.effect === "opacity" ? pose.progress : 1),
    visible: true,
    ...(trim && part.layer.stroke ? { line: lineNode(trim, part.layer, source, part.layer.stroke) } : {}),
    ...(moving && pose.effect === "sweep" && part.wedge ? { reveal: { box: frame, polygon: sweepPolygon(part.wedge, pose.progress, frame.width, frame.height), inverse: false } } : {}),
  };
}

export function chartNodes(id: string, layer: Layer, motion: ChartMotion, size: CanvasSize): SceneNode[] {
  const spec = layer.chart;
  if (!spec) return [];
  return chartParts(spec, size).flatMap((part) => {
    const node = partNode(id, part, spec, motion, size);
    return node ? [node] : [];
  });
}
