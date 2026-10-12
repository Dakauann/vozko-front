import { describe, expect, it } from "vitest";

import { chartInk, newChartSpec, type ChartKind } from "../chart";
import type { Layer } from "../document";
import { componentLayers, componentRatio, componentSlots, type ChartSampler, type ComponentKit } from "./component-kit";
import type { LibraryContext, LibrarySlot } from "./model";

const SQUARE = { width: 1000, height: 1000 };
const STORY = { width: 1080, height: 1920 };

const KIT: ComponentKit = {
  width: 1,
  height: 0.5,
  parts: [
    { kind: "panel", box: { x: 0.5, y: 0.25, w: 1, h: 0.5 }, surface: { shape: "rect", fill: "#0f172a", radius: 0.1, effects: [{ type: "drop-shadow", color: "#000000", opacity: 0.3, x: 0, y: 0.02, blur: 0.05 }] } },
    { kind: "text", left: 0.05, top: 0.05, width: 0.6, align: "left", part: { kind: "text", slot: "title", sample: { pt: "Vendas", en: "Sales", es: "Ventas", de: "Umsatz" }, font: "inter", weight: 600, size: 0.06, color: "#f8fafc" } },
    { kind: "text", left: 0.05, top: 0.05, width: 0.9, align: "right", part: { kind: "text", slot: "badge", sample: { pt: "+12%", en: "+12%", es: "+12%", de: "+12%" }, font: "inter", weight: 700, size: 0.05, color: "#052e16", pill: { color: "#4ade80", padX: 0.4, padY: 0.15, radius: 0.5 } } },
    { kind: "chart", box: { x: 0.5, y: 0.32, w: 0.9, h: 0.26 }, chart: "bar", ink: "#f8fafc" },
  ],
};

const sampled: ChartSampler = (kind: ChartKind, locale: string, ink: string) => newChartSpec(kind, { labels: [locale], series: [{ name: "s", values: [1] }] }, "pt-BR", chartInk(ink));

function context(canvas = SQUARE, text: (slot: LibrarySlot) => string = (slot) => ("text" in slot.sample ? slot.sample.text.pt : "")): LibraryContext {
  return { editor: "image", canvas, ink: "#111111", locale: "en", text };
}

function edges(layer: Layer, canvas: { width: number }) {
  return { left: (layer.transform.x - layer.transform.w / 2) * canvas.width, right: (layer.transform.x + layer.transform.w / 2) * canvas.width };
}

describe("component kits", () => {
  it("exposes one slot per text part with its four samples", () => {
    expect(componentSlots(KIT).map((slot) => slot.id)).toEqual(["title", "badge"]);
    expect(componentSlots(KIT)[0].sample).toEqual({ text: { pt: "Vendas", en: "Sales", es: "Ventas", de: "Umsatz" } });
    expect(componentRatio(KIT)).toBe(2);
  });

  it("builds panel, text and chart layers in drawing order", () => {
    const layers = componentLayers(KIT, context(), sampled);
    expect(layers.map((layer) => layer.type)).toEqual(["shape", "text", "text", "chart"]);
    expect(layers[0]).toMatchObject({ shape: "rect", fill: "#0f172a", radius: 0.1 });
    expect(layers[3].chart?.kind).toBe("bar");
    expect(layers[3].chart?.data.labels).toEqual(["en"]);
    expect(layers[3].chart?.style.textColor).toBe("#f8fafc");
  });

  it("scales panel effects with the component and keeps it centered on any canvas", () => {
    for (const canvas of [SQUARE, STORY]) {
      const layers = componentLayers(KIT, context(canvas), sampled);
      const panel = layers[0];
      const { left, right } = edges(panel, canvas);
      expect((left + right) / 2).toBeCloseTo(canvas.width / 2, 3);
      expect(panel.effects?.[0].blur).toBeCloseTo((0.05 * (right - left)) / 1, 3);
    }
  });

  it("anchors a right aligned pill to the right edge of its span", () => {
    const [panel, , badge] = componentLayers(KIT, context(), sampled);
    const span = edges(panel, SQUARE);
    const right = span.left + 0.95 * (span.right - span.left);
    expect(edges(badge, SQUARE).right).toBeCloseTo(right, 3);
    expect(badge.highlight?.color).toBe("#4ade80");
  });

  it("shrinks words that do not fit inside the span instead of overflowing", () => {
    const short = componentLayers(KIT, context(SQUARE, () => "Oi"), sampled)[1];
    const long = componentLayers(KIT, context(SQUARE, () => "Um texto muito mais comprido que a caixa aguenta"), sampled)[1];
    expect(long.fontSize!).toBeLessThan(short.fontSize!);
    expect(long.transform.w).toBeCloseTo(short.transform.w, 6);
  });
});
