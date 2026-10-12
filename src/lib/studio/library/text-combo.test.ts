import { describe, expect, it } from "vitest";

import type { Layer } from "../document";
import { textAdvance } from "../font-metrics";
import { comboLayers, comboRatio, comboSlots, type TextCombo } from "./text-combo";

const SQUARE = { width: 1080, height: 1080 };
const STORY = { width: 1080, height: 1920 };

const PAIR: TextCombo = {
  id: "pair",
  subcategory: "headlines",
  name: { pt: "Par", en: "Pair", es: "Par", de: "Paar" },
  align: "center",
  parts: [
    { kind: "text", slot: "title", sample: { pt: "Um novo capítulo", en: "A new chapter", es: "Un nuevo capítulo", de: "Ein neues Kapitel" }, font: "playfair-display", weight: 700, size: 0.16, color: "ink", gap: 0.04, accent: { word: "last", style: { italic: true } } },
    { kind: "rule", width: 0.18, thickness: 0.008, color: "#c2410c", gap: 0.04 },
    { kind: "text", slot: "subtitle", sample: { pt: "Histórias que merecem ser contadas", en: "Stories worth telling", es: "Historias que merecen contarse", de: "Geschichten, die erzählt werden wollen" }, font: "inter", weight: 400, size: 0.05, lines: 2, color: "ink", opacity: 0.72 },
  ],
};

const BADGE: TextCombo = {
  id: "badge",
  subcategory: "stickers",
  name: { pt: "Selo", en: "Badge", es: "Sello", de: "Siegel" },
  align: "center",
  rotation: -8,
  backdrop: { shape: "burst", fill: "#e11d48", pad: [0.3, 0.3], square: true },
  parts: [
    {
      kind: "text",
      slot: "title",
      sample: { pt: "BOOM!", en: "BOOM!", es: "¡BUM!", de: "BUMM!" },
      font: "bungee",
      weight: 400,
      size: 0.3,
      color: "#ffffff",
      strokes: [{ color: "#111111", width: 0.08 }],
      effects: [{ type: "drop-shadow", color: "#111111", opacity: 0.5, x: 0, y: 0.04, blur: 0.08 }],
    },
  ],
};

function sample(locale: "pt" | "en" | "es" | "de") {
  return (slot: { sample: { text?: Record<string, string> } | { key: string } }) => ("text" in slot.sample && slot.sample.text ? slot.sample.text[locale] : "");
}

function texts(layers: Layer[]): Layer[] {
  return layers.filter((layer) => layer.type === "text");
}

function widthPx(layer: Layer, canvas: { width: number; height: number }): number {
  return layer.transform.w * canvas.width;
}

function fontPx(layer: Layer, canvas: { width: number; height: number }): number {
  return (layer.fontSize ?? 0) * canvas.height;
}

describe("text combinations", () => {
  it("exposes one slot per text part with its four samples", () => {
    expect(comboSlots(PAIR).map((slot) => slot.id)).toEqual(["title", "subtitle"]);
    expect(comboSlots(PAIR)[0].sample).toEqual({ text: PAIR.parts[0].kind === "text" ? PAIR.parts[0].sample : {} });
  });

  it("builds text, rule and backdrop layers in reading order with the backdrop first", () => {
    const pair = comboLayers(PAIR, { canvas: SQUARE, ink: "#111111", text: sample("pt") });
    expect(pair.map((layer) => layer.type)).toEqual(["text", "shape", "text"]);
    const badge = comboLayers(BADGE, { canvas: SQUARE, ink: "#111111", text: sample("pt") });
    expect(badge.map((layer) => layer.type)).toEqual(["shape", "text"]);
    expect(badge[0]).toMatchObject({ shape: "star", points: 16, fill: "#e11d48" });
  });

  it("fits each line inside its box in every language, shrinking long words instead of cutting them", () => {
    for (const locale of ["pt", "en", "es", "de"] as const) {
      for (const layer of texts(comboLayers(PAIR, { canvas: SQUARE, ink: "#111111", text: sample(locale) }))) {
        const lines = Math.round((layer.transform.h * SQUARE.height) / (fontPx(layer, SQUARE) * (layer.lineHeight ?? 1))) - 1;
        const estimate = textAdvance(layer.text ?? "", layer.fontId!, layer.fontWeight!, layer.letterSpacing ?? 0) * fontPx(layer, SQUARE);
        expect(estimate / Math.max(1, lines), `${locale} ${layer.text}`).toBeLessThanOrEqual(widthPx(layer, SQUARE));
      }
    }
    const short = texts(comboLayers(PAIR, { canvas: SQUARE, ink: "#111111", text: () => "Oi" }))[0];
    const long = texts(comboLayers(PAIR, { canvas: SQUARE, ink: "#111111", text: () => "Uma frase bem mais comprida do que o exemplo" }))[0];
    expect(long.fontSize!).toBeLessThan(short.fontSize!);
  });

  it("gives every text box one spare line so a wider render wraps instead of losing words", () => {
    const [title] = texts(comboLayers(PAIR, { canvas: SQUARE, ink: "#111111", text: sample("en") }));
    const linePx = fontPx(title, SQUARE) * (title.lineHeight ?? 1);
    expect(title.transform.h * SQUARE.height).toBeCloseTo(2 * linePx, 3);
  });

  it("styles the accent word from the words actually inserted", () => {
    const [title] = texts(comboLayers(PAIR, { canvas: SQUARE, ink: "#111111", text: (slot) => (slot.id === "title" ? "Promoção de verão" : "x") }));
    expect(title.runs).toEqual([{ start: 12, end: 17, italic: true }]);
  });

  it("uses the editor ink and softens secondary text with opacity, never a gray", () => {
    const layers = texts(comboLayers(PAIR, { canvas: SQUARE, ink: "#ffffff", text: sample("pt") }));
    expect(layers.map((layer) => layer.fill)).toEqual(["#ffffff", "#ffffff"]);
    expect(layers[1].transform.opacity).toBe(0.72);
  });

  it("keeps its proportions on any canvas and centers itself", () => {
    for (const canvas of [SQUARE, STORY]) {
      const layers = comboLayers(PAIR, { canvas, ink: "#111111", text: sample("pt") });
      const left = Math.min(...layers.map((layer) => (layer.transform.x - layer.transform.w / 2) * canvas.width));
      const right = Math.max(...layers.map((layer) => (layer.transform.x + layer.transform.w / 2) * canvas.width));
      expect((left + right) / 2).toBeCloseTo(canvas.width / 2, 3);
    }
    const square = texts(comboLayers(PAIR, { canvas: SQUARE, ink: "#111111", text: sample("pt") }));
    const story = texts(comboLayers(PAIR, { canvas: STORY, ink: "#111111", text: sample("pt") }));
    expect(fontPx(story[0], STORY) / widthPx(story[0], STORY)).toBeCloseTo(fontPx(square[0], SQUARE) / widthPx(square[0], SQUARE), 6);
    expect(comboRatio(PAIR)).toBeGreaterThan(1);
  });

  it("scales strokes and effects with the type and rotates the whole sticker about its center", () => {
    const [burst, title] = comboLayers(BADGE, { canvas: SQUARE, ink: "#111111", text: sample("pt") });
    const size = fontPx(title, SQUARE);
    expect(title.strokes?.[0].width).toBeCloseTo(0.08 * size, 6);
    expect(title.strokes?.[0].align).toBe("outside");
    expect(title.effects?.[0]).toMatchObject({ type: "drop-shadow", blur: expect.closeTo(0.08 * size, 6), y: expect.closeTo(0.04 * size, 6) });
    expect(title.fill).toBeUndefined();
    expect(title.fills).toEqual([{ type: "solid", color: "#ffffff", opacity: 1 }]);
    expect(burst.transform.rotation).toBe(-8);
    expect(title.transform.rotation).toBe(-8);
    expect(burst.transform.w * SQUARE.width).toBeCloseTo(burst.transform.h * SQUARE.height, 6);
  });
});
