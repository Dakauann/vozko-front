import { BlurFilter, type Filter } from "pixi.js";

import { gradeUniforms, isNeutralPrimary, type ColorGrade } from "@/lib/studio/color-grade";
import { isNeutralCurves } from "@/lib/studio/color-curves";
import { hueUniforms, isNeutralHue } from "@/lib/studio/hue-secondary";
import { isNeutralLut, lutIntensity, type LutAtlas } from "@/lib/studio/cube-lut";
import type { GradientMap } from "@/lib/studio/gradient-map";

import { CurvesFilter } from "./curves-filter";
import { GradeFilter } from "./grade-filter";
import { GradientMapFilter } from "./gradient-map-filter";
import { HueFilter } from "./hue-filter";
import { LutFilter, LutWarningFilter } from "./lut-filter";

export type LutState = LutAtlas | "loading" | "missing";

export type LutLookup = (assetId: string) => LutState;

interface ColorLook {
  grade?: ColorGrade;
  gradientMap?: GradientMap;
  blurPx?: number;
}

export class ColorChain {
  private grade: GradeFilter | null = null;
  private lut: LutFilter | null = null;
  private warning: LutWarningFilter | null = null;
  private curves: CurvesFilter | null = null;
  private hue: HueFilter | null = null;
  private gradientMap: GradientMapFilter | null = null;
  private blur: BlurFilter | null = null;

  filters(look: ColorLook, luts: LutLookup, screenScale: number): Filter[] {
    const filters: Filter[] = [];
    const grade = look.grade;
    if (grade && !isNeutralPrimary(grade)) {
      this.grade ??= new GradeFilter();
      this.grade.set(gradeUniforms(grade));
      filters.push(this.grade);
    }
    if (grade?.lut && !isNeutralLut(grade.lut)) filters.push(...this.lutFilters(luts(grade.lut.assetId), lutIntensity(grade.lut)));
    if (grade && !isNeutralCurves(grade.curves)) {
      this.curves ??= new CurvesFilter();
      this.curves.set(grade.curves!);
      filters.push(this.curves);
    }
    if (grade && !isNeutralHue(grade.hsl)) {
      this.hue ??= new HueFilter();
      this.hue.set(hueUniforms(grade.hsl!));
      filters.push(this.hue);
    }
    if (look.gradientMap) {
      this.gradientMap ??= new GradientMapFilter();
      this.gradientMap.set(look.gradientMap);
      filters.push(this.gradientMap);
    }
    if (look.blurPx && look.blurPx > 0) {
      this.blur ??= new BlurFilter();
      this.blur.strength = look.blurPx * screenScale;
      filters.push(this.blur);
    }
    return filters;
  }

  destroy(): void {
    for (const filter of [this.grade, this.lut, this.warning, this.curves, this.hue, this.gradientMap, this.blur]) filter?.destroy();
  }

  private lutFilters(state: LutState, intensity: number): Filter[] {
    if (state === "loading") return [];
    if (state === "missing") {
      this.warning ??= new LutWarningFilter();
      return [this.warning];
    }
    this.lut ??= new LutFilter();
    this.lut.set(state, intensity);
    return [this.lut];
  }
}
