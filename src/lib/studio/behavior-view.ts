import { behaviorTrace } from "./behavior-edit";
import { behaviorsOn, isBehaviorProperty, type Behavior, type BehaviorProperty, type TrackLevels } from "./behaviors";
import type { Clip } from "./document";
import { CURVE_SAMPLES, lanePoints } from "./focus-lanes";
import { graphX, graphY, type GraphScale } from "./graph-editor";
import { axisScaled, onPath } from "./keyframe-edit";
import { AXIS_SCALE_PROPERTIES, PATH_PROPERTY, type AnimatedProperty } from "./keyframes";

const PX_PER_SAMPLE = 2;

export function behaviorLanes(clip: Pick<Clip, "keyframes">, property: BehaviorProperty): AnimatedProperty[] {
  if (property === "x" || property === "y") return onPath(clip) ? [PATH_PROPERTY] : [property];
  if (property === "scale") return axisScaled(clip) ? [...AXIS_SCALE_PROPERTIES] : ["scale"];
  if (property === "scaleX" || property === "scaleY") return axisScaled(clip) ? [property] : ["scale"];
  return [property];
}

export function behaviorsOnLane(clip: Pick<Clip, "keyframes" | "behaviors">, lane: AnimatedProperty): Behavior[] {
  return (clip.behaviors ?? []).filter((behavior) => behaviorLanes(clip, behavior.property).includes(lane));
}

function traceSamples(widthPx: number): number {
  return Math.max(CURVE_SAMPLES, Math.ceil(widthPx / PX_PER_SAMPLE));
}

export function laneTracePoints(clip: Clip, lane: AnimatedProperty, widthPx: number, heightPx: number, levels: TrackLevels): [number, number][] {
  if (!isBehaviorProperty(lane) || behaviorsOn(clip, lane).length === 0) return [];
  return lanePoints(
    behaviorTrace(clip, lane, traceSamples(widthPx), levels).map((point) => point.value),
    widthPx,
    heightPx,
  );
}

export function graphTracePoints(clip: Clip, property: AnimatedProperty, scale: GraphScale, levels: TrackLevels): [number, number][] {
  if (!isBehaviorProperty(property) || behaviorsOn(clip, property).length === 0) return [];
  return behaviorTrace(clip, property, traceSamples(scale.widthPx), levels).map((point) => [graphX(scale, point.ms), graphY(scale, point.value)]);
}
