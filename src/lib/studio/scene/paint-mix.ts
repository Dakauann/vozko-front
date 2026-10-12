import type { Layer } from "../document";
import type { ColorProperty } from "../keyframes";
import type { PaintMix } from "../playback";
import type { AnimatorProperties } from "../text-selectors";

export interface PaintAxis {
  colors: readonly (string | undefined)[];
  base: readonly number[];
  steps: readonly (number | null)[];
}

export interface PaintPlan {
  fill: PaintAxis;
  stroke: PaintAxis;
  parts: readonly (readonly number[])[];
}

export interface MixedParts<S> {
  parts: { source: S; weight: number }[];
  plan?: PaintPlan;
}

function axisOf(paint: PaintMix | undefined, property: ColorProperty, animators: readonly { properties: AnimatorProperties }[]): PaintAxis {
  const segment = paint?.[property];
  const colors: (string | undefined)[] = segment ? [segment.from, segment.to] : [undefined];
  const base = segment ? [1 - segment.weight, segment.weight] : [1];
  const steps = animators.map((animator) => {
    const color = animator.properties[property];
    if (color === undefined) return null;
    colors.push(color);
    return colors.length - 1;
  });
  return { colors, base: [...base, ...new Array<number>(colors.length - base.length).fill(0)], steps };
}

function painted(layer: Layer, fill: string | undefined, stroke: string | undefined): Layer {
  return { ...layer, ...(fill !== undefined ? { fill } : {}), ...(stroke !== undefined ? { stroke } : {}) };
}

export function mixedParts<S extends { key: string }>(layer: Layer, paint: PaintMix | undefined, animators: readonly { properties: AnimatorProperties }[], sourceOf: (layer: Layer) => S): MixedParts<S> {
  const fill = axisOf(paint, "fill", animators);
  const stroke = axisOf(paint, "stroke", animators);
  const parts: { source: S; weight: number }[] = [];
  const indexOf = new Map<string, number>();
  const grid = fill.colors.map((fillColor, f) =>
    stroke.colors.map((strokeColor, s) => {
      const source = sourceOf(painted(layer, fillColor, strokeColor));
      let at = indexOf.get(source.key);
      if (at === undefined) {
        at = parts.length;
        parts.push({ source, weight: 0 });
        indexOf.set(source.key, at);
      }
      parts[at].weight += fill.base[f] * stroke.base[s];
      return at;
    }),
  );
  const tinted = [...fill.steps, ...stroke.steps].some((step) => step !== null);
  return { parts, ...(tinted ? { plan: { fill, stroke, parts: grid } } : {}) };
}

function axisWeights(axis: PaintAxis, tints: readonly number[]): number[] {
  const weights = [...axis.base];
  tints.forEach((amount, k) => {
    const at = axis.steps[k];
    if (at === null || at === undefined || amount <= 0) return;
    for (let i = 0; i < weights.length; i++) weights[i] *= 1 - amount;
    weights[at] += amount;
  });
  return weights;
}

export function pieceWeights(plan: PaintPlan, tints: readonly number[], count: number): number[] {
  const fill = axisWeights(plan.fill, tints);
  const stroke = axisWeights(plan.stroke, tints);
  const weights = new Array<number>(count).fill(0);
  plan.parts.forEach((row, f) => row.forEach((part, s) => (weights[part] += fill[f] * stroke[s])));
  return weights;
}
