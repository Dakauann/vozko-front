import Konva from "konva";

import { keyImageData, type ChromaKey } from "@/lib/studio/chroma-key";
import { gradeImageData, gradeUniforms, isNeutralGrade, isNeutralPrimary, type ColorGrade } from "@/lib/studio/color-grade";
import { applyCurvesPixels, curvesLut, isNeutralCurves, type ColorCurves } from "@/lib/studio/color-curves";
import { hueImageData, hueUniforms, isNeutralHue, type HueSecondary } from "@/lib/studio/hue-secondary";
import { applyLutPixels, applyLutWarningPixels, isNeutralLut, lutIntensity, type LutAtlas } from "@/lib/studio/cube-lut";

type KonvaLut = LutAtlas | "missing" | null;
import type { Filters, Gradient } from "@/lib/studio/document";
import { applyLayerEffects } from "@/lib/studio/effect-pixels";
import { gradientMapLut, mapGradientPixels, type GradientMap } from "@/lib/studio/gradient-map";
import type { EffectPlan } from "@/lib/studio/layer-paint";
import { gradientPaint, type Box } from "@/lib/studio/paint";

export type KonvaFilter = typeof Konva.Filters.Blur;

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

function gradeFilter(grade: ColorGrade): KonvaFilter {
  const uniforms = gradeUniforms(grade);
  return (imageData: ImageData) => gradeImageData(imageData.data, uniforms);
}

function lutFilter(atlas: LutAtlas, intensity: number): KonvaFilter {
  return (imageData: ImageData) => applyLutPixels(imageData.data, atlas, intensity);
}

const lutWarningFilter: KonvaFilter = (imageData: ImageData) => applyLutWarningPixels(imageData.data, imageData.width);

function lutFilters(lut: KonvaLut, intensity: number): KonvaFilter[] {
  if (lut === "missing") return [lutWarningFilter];
  return lut ? [lutFilter(lut, intensity)] : [];
}

function curvesFilter(curves: ColorCurves): KonvaFilter {
  const lut = curvesLut(curves);
  return (imageData: ImageData) => applyCurvesPixels(imageData.data, lut);
}

function hueFilter(secondary: HueSecondary): KonvaFilter {
  const uniforms = hueUniforms(secondary);
  return (imageData: ImageData) => hueImageData(imageData.data, uniforms);
}

function finishFilters(grade: ColorGrade, lut: KonvaLut): KonvaFilter[] {
  return [
    ...(!isNeutralPrimary(grade) ? [gradeFilter(grade)] : []),
    ...(grade.lut && !isNeutralLut(grade.lut) ? lutFilters(lut, lutIntensity(grade.lut)) : []),
    ...(!isNeutralCurves(grade.curves) ? [curvesFilter(grade.curves!)] : []),
    ...(!isNeutralHue(grade.hsl) ? [hueFilter(grade.hsl!)] : []),
  ];
}

function chromaFilter(key: ChromaKey): KonvaFilter {
  return (imageData: ImageData) => keyImageData(imageData.data, imageData.width, imageData.height, key);
}

function gradientMapFilter(map: GradientMap): KonvaFilter {
  const lut = gradientMapLut(map);
  return (imageData: ImageData) => mapGradientPixels(imageData.data, lut, map.intensity);
}

export function effectsFilter(plan: EffectPlan): KonvaFilter {
  return (imageData: ImageData, pixelRatio?: number) => applyLayerEffects(imageData.data, imageData.width, imageData.height, plan, pixelRatio ?? 1);
}

interface FilterSetup {
  list: KonvaFilter[];
  props: Partial<Pick<Konva.NodeConfig, "brightness" | "contrast" | "saturation" | "blurRadius">>;
}

export function filterSetup(filters: Filters | undefined, grade: ColorGrade | undefined, gradientMap: GradientMap | undefined, chromaKey?: ChromaKey, lut: KonvaLut = null): FilterSetup {
  const graded = !isNeutralGrade(grade);
  if (!filters && !graded && !gradientMap && !chromaKey) return { list: [], props: {} };
  const list: KonvaFilter[] = [];
  if (chromaKey) list.push(chromaFilter(chromaKey));
  if (filters && filters.brightness !== 0) list.push(Konva.Filters.Brighten);
  if (filters && filters.contrast !== 0) list.push(Konva.Filters.Contrast);
  if (filters && filters.saturation !== 0) list.push(Konva.Filters.HSL);
  if (graded) list.push(...finishFilters(grade!, lut));
  if (gradientMap) list.push(gradientMapFilter(gradientMap));
  if (filters && filters.blur > 0) list.push(Konva.Filters.Blur);
  return { list, props: filters ? { brightness: filters.brightness, contrast: filters.contrast, saturation: filters.saturation, blurRadius: filters.blur } : {} };
}
