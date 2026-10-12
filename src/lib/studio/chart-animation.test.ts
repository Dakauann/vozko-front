import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { chartInk, newChartSpec, type ChartData, type ChartKind } from "./chart";
import {
  chartAnimationSpan,
  chartAnimatorIssue,
  chartInIssue,
  chartMotionOf,
  chartUnits,
  defaultChartAnimator,
  partPose,
  partProgress,
  posedChartLayers,
  posedLayer,
  scaledTransform,
  sweepPolygon,
  trimmedPath,
  type ChartAnimator,
} from "./chart-animation";
import { chartParts } from "./chart-parts";
import { fullFrame, newOverlayClip, newShapeLayer, type Clip, type Layer } from "./document";
import { documentIssue } from "./validate";

const SIZE = { width: 800, height: 500 };
const DATA: ChartData = { labels: ["a", "b", "c"], series: [{ name: "x", values: [10, 20, 40] }, { name: "y", values: [5, 5, 5] }] };

function chartLayer(kind: ChartKind): Layer {
  return { id: "chart", type: "chart", transform: fullFrame(), chart: newChartSpec(kind, DATA, "pt-BR", chartInk("#ffffff")) };
}

function chartClip(kind: ChartKind, chartIn: ChartAnimator | undefined): Clip {
  return { ...newOverlayClip(chartLayer(kind), 0, 4000), id: "c", ...(chartIn ? { chartIn } : {}) };
}

const GROW: ChartAnimator = { style: "grow", order: "category", durationMs: 1000, staggerMs: 200, easing: "linear" };

describe("chart animation contract", () => {
  it("accepts the shared fixtures", () => {
    for (const [kind, name] of [["image", "editor_chart.json"], ["video", "editor_chart_motion.json"]] as const) {
      const raw = JSON.parse(readFileSync(resolve(__dirname, `../../../../vozko-back/domain/studio/testdata/${name}`), "utf8"));
      expect(documentIssue(kind, raw)).toBeNull();
    }
  });

  it("takes an entrance only on chart overlays", () => {
    expect(chartInIssue(chartClip("bar", GROW))).toBeNull();
    expect(chartInIssue({ ...newOverlayClip(newShapeLayer("rect"), 0, 1000), id: "s", chartIn: GROW })).toBe("invalid");
  });

  it("refuses unknown styles, orders, easings and ranges", () => {
    expect(chartAnimatorIssue({ ...GROW, style: "spin" as never })).toBe("unknown");
    expect(chartAnimatorIssue({ ...GROW, order: "row" as never })).toBe("unknown");
    expect(chartAnimatorIssue({ ...GROW, easing: "wobbly" as never })).toBe("unknown");
    expect(chartAnimatorIssue({ ...GROW, durationMs: 50 })).toBe("out_of_range");
    expect(chartAnimatorIssue({ ...GROW, staggerMs: 6000 })).toBe("out_of_range");
    expect(chartAnimatorIssue({ ...GROW, easing: "cubic-bezier(0.2,0,0.2,1)" })).toBeNull();
  });

  it("picks a fitting default per kind", () => {
    expect(defaultChartAnimator("pie").style).toBe("sweep");
    expect(defaultChartAnimator("lineMulti")).toMatchObject({ style: "draw", order: "series" });
    expect(defaultChartAnimator("barGrouped")).toMatchObject({ style: "grow", order: "category" });
  });
});

describe("chart motion", () => {
  it("lasts the duration plus one stagger per extra unit and then settles", () => {
    const clip = chartClip("bar", GROW);
    const spec = clip.layer!.chart!;
    expect(chartUnits(spec, "category")).toBe(3);
    expect(chartAnimationSpan(GROW, 3)).toBe(1400);
    expect(chartMotionOf(clip, 1399)).toBeDefined();
    expect(chartMotionOf(clip, 1400)).toBeUndefined();
    expect(chartMotionOf(chartClip("bar", undefined), 0)).toBeUndefined();
  });

  it("staggers categories and eases each one", () => {
    const spec = chartLayer("bar").chart!;
    const bars = chartParts(spec, SIZE).filter((part) => part.role === "bar");
    const motion = { animator: GROW, localMs: 600 };
    expect(bars.map((part) => partProgress(part, spec, motion))).toEqual([0.6, 0.4, 0.2]);
    expect(partProgress(bars[0], spec, { animator: { ...GROW, easing: "easeIn" }, localMs: 500 })).toBeCloseTo(0.125, 6);
  });

  it("grows a bar from its baseline to half its height at the middle of its run", () => {
    const spec = chartLayer("bar").chart!;
    const bar = chartParts(spec, SIZE).find((part) => part.layer.id === "bar-0-2")!;
    const half = scaledTransform(bar, 0.5, SIZE);
    const t = bar.layer.transform;
    expect(half.h).toBeCloseTo(t.h / 2, 9);
    expect(half.y + half.h / 2).toBeCloseTo(t.y + t.h / 2, 9);
    expect(bar.base!.at).toBeCloseTo(t.y + t.h / 2, 4);
  });

  it("keeps axes and legends still while the data animates", () => {
    const spec = chartLayer("barGrouped").chart!;
    const parts = chartParts(spec, SIZE);
    const motion = { animator: GROW, localMs: 0 };
    expect(parts.filter((part) => part.role === "grid" || part.role === "tick" || part.role === "legend").every((part) => partPose(part, spec, motion).effect === "none")).toBe(true);
    const shown = posedChartLayers(parts, spec, motion, SIZE);
    expect(shown.some((layer) => layer.id.startsWith("bar-"))).toBe(false);
    expect(shown.some((layer) => layer.id.startsWith("grid-"))).toBe(true);
  });

  it("draws a line on with the shared trim math", () => {
    const spec = chartLayer("line").chart!;
    const line = chartParts(spec, SIZE).find((part) => part.role === "line")!;
    const pose = partPose(line, spec, { animator: { ...GROW, style: "draw", order: "series" }, localMs: 500 });
    expect(pose).toEqual({ effect: "trim", progress: 0.5 });
    const half = posedLayer(line, spec, pose, SIZE)!;
    const ends = (path: string) => path.match(/-?\d*\.?\d+/g)!.map(Number);
    const full = ends(trimmedPath(line.layer, 1, SIZE)!);
    const cut = ends(half.path!);
    expect(cut[cut.length - 2]).toBeLessThan(full[full.length - 2]);
    expect(cut[0]).toBeCloseTo(full[0], 3);
  });

  it("sweeps pie slices from their start angle", () => {
    const spec = chartLayer("pie").chart!;
    const slice = chartParts(spec, SIZE).find((part) => part.role === "slice")!;
    const pose = partPose(slice, spec, { animator: defaultChartAnimator("pie"), localMs: 200 });
    expect(pose.effect).toBe("sweep");
    expect(posedLayer(slice, spec, pose, SIZE)!.path).not.toBe(slice.layer.path);
    const polygon = sweepPolygon(slice.wedge!, 0.5, 100, 100);
    expect(polygon.slice(0, 2)).toEqual([50, 50]);
    expect(polygon[2]).toBeCloseTo(50, 6);
    expect(polygon[3]).toBeLessThan(0);
  });

  it("fades parts by their progress", () => {
    const spec = chartLayer("bar").chart!;
    const bar = chartParts(spec, SIZE).find((part) => part.role === "bar")!;
    const faded = posedLayer(bar, spec, partPose(bar, spec, { animator: { ...GROW, style: "fade" }, localMs: 250 }), SIZE)!;
    expect(faded.transform.opacity).toBeCloseTo(0.25, 6);
  });
});
