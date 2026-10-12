import { describe, expect, it } from "vitest";

import { chartInk, newChartSpec, type ChartData, type ChartKind, type ChartSpec } from "./chart";
import { chartParts, niceScale, wedgePath, type ChartPart } from "./chart-parts";
import { isValidPath } from "./vector-path";

const SIZE = { width: 800, height: 500 };
const DATA: ChartData = {
  labels: ["Jan", "Fev", "Mar", "Abr"],
  series: [
    { name: "Vendas", values: [10, 20, 40, 30] },
    { name: "Meta", values: [15, 15, 15, 15] },
  ],
};

function spec(kind: ChartKind, data: ChartData = DATA, style: Partial<ChartSpec["style"]> = {}): ChartSpec {
  const base = newChartSpec(kind, data, "pt-BR", chartInk("#111111"));
  return { ...base, style: { ...base.style, ...style } };
}

function px(part: ChartPart) {
  const t = part.layer.transform;
  return { left: (t.x - t.w / 2) * SIZE.width, top: (t.y - t.h / 2) * SIZE.height, width: t.w * SIZE.width, height: t.h * SIZE.height };
}

function byRole(parts: readonly ChartPart[], role: ChartPart["role"]): ChartPart[] {
  return parts.filter((part) => part.role === role);
}

describe("nice scales", () => {
  it("rounds to human steps and keeps zero for bars", () => {
    expect(niceScale(0, 40)).toEqual({ low: 0, high: 40, step: 10, ticks: [0, 10, 20, 30, 40] });
    expect(niceScale(0, 37).step).toBe(10);
    expect(niceScale(-3, 7).ticks).toEqual([-4, -2, 0, 2, 4, 6, 8]);
    expect(niceScale(5, 5).ticks[0]).toBe(0);
    expect(niceScale(0, 0.9).step).toBe(0.2);
  });
});

describe("chart parts", () => {
  it("draws bar heights in proportion to the data from a shared baseline", () => {
    const bars = byRole(chartParts(spec("bar"), SIZE), "bar");
    expect(bars.map((part) => part.layer.id)).toEqual(["bar-0-0", "bar-0-1", "bar-0-2", "bar-0-3"]);
    const heights = bars.map((part) => px(part).height);
    expect(heights[1] / heights[0]).toBeCloseTo(2, 3);
    expect(heights[2] / heights[0]).toBeCloseTo(4, 3);
    const bottoms = bars.map((part) => px(part).top + px(part).height);
    for (const bottom of bottoms) expect(bottom).toBeCloseTo(bottoms[0], 1);
    expect(bars.every((part) => part.base?.axis === "y" && Math.abs(part.base.at * SIZE.height - bottoms[0]) < 0.5)).toBe(true);
  });

  it("draws negative bars below the baseline", () => {
    const bars = byRole(chartParts(spec("bar", { labels: ["a", "b"], series: [{ name: "x", values: [10, -10] }] }), SIZE), "bar");
    const [up, down] = bars.map(px);
    expect(up.top + up.height).toBeCloseTo(down.top, 1);
    expect(up.height).toBeCloseTo(down.height, 1);
  });

  it("puts grouped bars side by side and stacks stacked bars", () => {
    const grouped = byRole(chartParts(spec("barGrouped"), SIZE), "bar").map(px);
    expect(grouped).toHaveLength(8);
    expect(grouped[1].left).toBeCloseTo(grouped[0].left + grouped[0].width, 3);
    const stacked = byRole(chartParts(spec("barStacked"), SIZE), "bar");
    const first = stacked.filter((part) => part.category === 0).map(px);
    expect(first[1].top + first[1].height).toBeCloseTo(first[0].top, 3);
    expect(first[0].height / first[1].height).toBeCloseTo(10 / 15, 3);
  });

  it("draws horizontal bars along the width", () => {
    const bars = byRole(chartParts(spec("barHorizontal"), SIZE), "bar");
    const widths = bars.map((part) => px(part).width);
    expect(widths[2] / widths[0]).toBeCloseTo(4, 3);
    expect(bars[0].base?.axis).toBe("x");
    expect(px(bars[1]).top).toBeGreaterThan(px(bars[0]).top);
  });

  it("splits a pie by the share of each value", () => {
    const slices = byRole(chartParts(spec("pie"), SIZE), "slice");
    const total = 10 + 20 + 40 + 30;
    const sweeps = slices.map((part) => part.wedge!.end - part.wedge!.start);
    expect(sweeps.map((sweep) => sweep / (Math.PI * 2))).toEqual([10, 20, 40, 30].map((value) => expect.closeTo(value / total, 6)));
    expect(slices[0].wedge!.start).toBeCloseTo(-Math.PI / 2, 9);
    expect(slices[1].wedge!.start).toBeCloseTo(slices[0].wedge!.end, 9);
    for (const slice of slices) expect(isValidPath(slice.layer.path ?? "")).toBe(true);
    const box = px(slices[0]);
    expect(box.width).toBeCloseTo(box.height, 3);
  });

  it("labels pie slices with their percent in the chart locale", () => {
    const texts = byRole(chartParts(spec("pie"), SIZE), "value").map((part) => part.layer.text);
    expect(texts).toEqual(["10%", "20%", "40%", "30%"]);
  });

  it("cuts a hole in a donut and fills a single full ring with the even odd rule", () => {
    const ring = byRole(chartParts(spec("donut", { labels: ["a"], series: [{ name: "x", values: [5] }] }), SIZE), "slice");
    expect(ring).toHaveLength(1);
    expect(ring[0].layer.fillRule).toBe("evenodd");
    expect(wedgePath(0, Math.PI, 0.5)).toContain("A0.25 0.25");
  });

  it("draws one path per line series through every point and leaves gaps for empty cells", () => {
    const lines = byRole(chartParts(spec("lineMulti"), SIZE), "line");
    expect(lines.map((part) => part.layer.id)).toEqual(["line-0", "line-1"]);
    expect(lines[0].layer.path?.match(/[ML]/g)).toHaveLength(4);
    const gap = byRole(chartParts(spec("line", { labels: ["a", "b", "c", "d", "e"], series: [{ name: "x", values: [1, 2, null, 4, 5] }] }), SIZE), "line");
    expect(gap[0].layer.path?.match(/M/g)).toHaveLength(2);
    expect(isValidPath(gap[0].layer.path ?? "")).toBe(true);
  });

  it("stacks areas on the series below", () => {
    const areas = byRole(chartParts(spec("areaStacked"), SIZE), "area");
    expect(areas).toHaveLength(2);
    expect(areas.every((part) => isValidPath(part.layer.path ?? ""))).toBe(true);
  });

  it("places scatter points by the first column on x", () => {
    const data: ChartData = { labels: ["a", "b"], series: [{ name: "x", values: [0, 10] }, { name: "y", values: [0, 10] }] };
    const points = byRole(chartParts(spec("scatter", data), SIZE), "point").map(px);
    expect(points).toHaveLength(2);
    expect(points[1].left).toBeGreaterThan(points[0].left);
    expect(points[1].top).toBeLessThan(points[0].top);
  });

  it("draws axes, gridlines and a legend only when asked", () => {
    const full = chartParts(spec("barGrouped"), SIZE);
    expect(byRole(full, "grid").length).toBeGreaterThan(0);
    expect(byRole(full, "axis")).toHaveLength(1);
    expect(byRole(full, "legend").map((part) => part.layer.text).filter(Boolean)).toEqual(["Vendas", "Meta"]);
    const bare = chartParts(spec("barGrouped", DATA, { axes: false, gridlines: false, legend: "none" }), SIZE);
    expect(byRole(bare, "grid")).toHaveLength(0);
    expect(byRole(bare, "axis")).toHaveLength(0);
    expect(byRole(bare, "tick")).toHaveLength(0);
    expect(byRole(bare, "legend")).toHaveLength(0);
  });

  it("formats axis ticks in the chart locale", () => {
    const ticks = byRole(chartParts({ ...spec("bar", { labels: ["a"], series: [{ name: "x", values: [4000] }] }), format: { locale: "pt-BR", decimals: 0, percent: false } }, SIZE), "tick").map((part) => part.layer.text);
    expect(ticks).toContain("4.000");
  });

  it("skips category labels that would collide", () => {
    const labels = Array.from({ length: 40 }, (_, i) => `Categoria ${i}`);
    const many = spec("bar", { labels, series: [{ name: "x", values: labels.map((_, i) => i) }] });
    const shown = chartParts(many, SIZE).filter((part) => part.layer.id.startsWith("label-x-"));
    expect(shown.length).toBeLessThan(40);
    expect(shown.length).toBeGreaterThan(1);
  });

  it("keeps text parts on the chart font and color and paints data from the palette", () => {
    const parts = chartParts(spec("bar", DATA, { palette: ["#123456"], textColor: "#abcdef" }), SIZE);
    expect(byRole(parts, "bar").every((part) => part.layer.fill === "#123456")).toBe(true);
    expect(byRole(parts, "tick").every((part) => part.layer.fill === "#abcdef" && part.layer.fontId === "inter")).toBe(true);
  });

  it("returns the same parts for the same spec and size", () => {
    const chart = spec("line");
    expect(chartParts(chart, SIZE)).toBe(chartParts(chart, SIZE));
    expect(chartParts(chart, { width: 400, height: 300 })).not.toBe(chartParts(chart, SIZE));
  });
});
