import { describe, expect, it } from "vitest";

import { chartInk, newChartSpec } from "./chart";
import { chartParts } from "./chart-parts";
import { chartTransform, expandChart, newChartLayer } from "./chart-edits";
import { generatedSurfaceParts, instanceAnchors, liveParts, partIdsOf, resolvedSurface } from "./components";
import { emptyArtboard, imageDocument, type Artboard } from "./document";
import { layerIssue, surfaceIssue } from "./validate";

const DATA = { labels: ["Jan", "Fev", "Mar"], series: [{ name: "Vendas", values: [10, 20, 30] }] };

function board(): Artboard {
  const artboard = emptyArtboard({ width: 1000, height: 1000 });
  const chart = { ...newChartLayer(newChartSpec("bar", DATA, "pt-BR", chartInk("#111111")), { x: 0.5, y: 0.5, w: 0.8, h: 0.5, rotation: 0, opacity: 1 }, "Vendas"), id: "chart" };
  return { ...artboard, id: "board", layers: [chart] };
}

describe("chart layers as resolved parts", () => {
  it("creates a valid chart layer sized for its kind", () => {
    const layer = newChartLayer(newChartSpec("pie", DATA, "pt-BR", chartInk("#111111")), chartTransform({ width: 1080, height: 1080 }, "pie"));
    expect(layerIssue(layer)).toBeNull();
    expect(layer.transform.w / layer.transform.h).toBeCloseTo(1.3, 6);
  });

  it("resolves a chart into locked parts placed inside its box on the artboard", () => {
    const surface = board();
    const resolved = resolvedSurface(imageDocument([surface]), surface);
    expect(resolved.layers.some((layer) => layer.id === "chart")).toBe(false);
    const bars = resolved.layers.filter((layer) => layer.id.startsWith("chart;bar-"));
    expect(bars).toHaveLength(3);
    expect(bars.every((bar) => bar.locked)).toBe(true);
    const local = chartParts(surface.layers[0].chart!, { width: 800, height: 500 }).find((part) => part.layer.id === "bar-0-0")!.layer.transform;
    expect(bars[0].transform.x).toBeCloseTo(0.1 + local.x * 0.8, 6);
    expect(bars[0].transform.y).toBeCloseTo(0.25 + local.y * 0.5, 6);
    expect(bars[0].transform.h).toBeCloseTo(local.h * 0.5, 6);
  });

  it("scales text with the box and keeps fonts relative to the artboard", () => {
    const surface = board();
    const text = generatedSurfaceParts(surface.layers[0], surface.canvas).find((layer) => layer.type === "text")!;
    expect(text.fontSize).toBeCloseTo(surface.layers[0].chart!.style.fontSize * 0.5 * 0.85, 6);
  });

  it("follows a turned chart box", () => {
    const surface = board();
    const turned = { ...surface.layers[0], transform: { ...surface.layers[0].transform, rotation: 90 } };
    expect(generatedSurfaceParts(turned, surface.canvas).every((part) => part.transform.rotation === 90)).toBe(true);
  });

  it("anchors the chart for picking above its top part and moves the parts live", () => {
    const surface = board();
    const doc = imageDocument([surface]);
    const resolved = resolvedSurface(doc, surface);
    const anchors = instanceAnchors(surface, resolved);
    expect([...anchors.after.values()].flat().map((layer) => layer.id)).toEqual(["chart"]);
    const moved = liveParts(doc, surface, new Map([["chart", { ...surface.layers[0].transform, x: 0.6 }]]));
    const ids = partIdsOf(doc, surface, ["chart"]);
    expect(ids.length).toBeGreaterThan(3);
    expect(ids.every((id) => moved.has(id))).toBe(true);
  });

  it("expands a chart into editable layers in one group", () => {
    const surface = board();
    const expanded = expandChart(surface, "chart");
    if (!expanded.ok) throw new Error(expanded.reason);
    expect(expanded.document.layers.some((layer) => layer.type === "chart")).toBe(false);
    expect(expanded.document.layers.every((layer) => layer.groupId === expanded.groupId && !layer.locked)).toBe(true);
    expect(expanded.document.groups?.find((group) => group.id === expanded.groupId)?.name).toBe("Vendas");
    expect(surfaceIssue(expanded.document)).toBeNull();
    expect(expandChart({ ...surface, layers: [{ ...surface.layers[0], locked: true }] }, "chart")).toEqual({ ok: false, reason: "locked" });
    expect(expandChart(surface, "nope")).toEqual({ ok: false, reason: "missing" });
  });
});
