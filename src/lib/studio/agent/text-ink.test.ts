import { describe, expect, it } from "vitest";

import { newTextLayer, type CanvasSize, type Layer } from "../document";
import { layoutRichText, type RichMeasure } from "../rich-text-layout";
import { textSpans } from "../text-runs";
import { clippedText, fittingFontSize, textLayoutOf, type TextElement, type TextMeasure } from "./text-ink";

const canvas: CanvasSize = { width: 1000, height: 1000 };
const ADVANCE = 0.6;

const measure: TextMeasure = (text, layer, fontPx) => [...text].length * fontPx * (ADVANCE + (layer.letterSpacing ?? 0));
const rich: RichMeasure = { width: (text, font) => [...text].length * font.sizePx * ADVANCE, metrics: (font) => ({ ascent: font.sizePx * 0.8, descent: font.sizePx * 0.2 }) };

function element(text: string, w: number, h: number, extra: Partial<Layer> = {}): TextElement {
  const transform = { x: 0.5, y: 0.5, w, h, rotation: 0, opacity: 1 };
  const layer: Layer = { ...newTextLayer(text), id: "t", transform, fontId: "inter", fontWeight: 400, fontSize: 0.1, lineHeight: 1.2, letterSpacing: 0, align: "center", ...extra };
  return { id: "t", layer, media: false, transform, box: { left: 0.5 - w / 2, top: 0.5 - h / 2, right: 0.5 + w / 2, bottom: 0.5 + h / 2 }, opacity: 1, rotation: 0 };
}

function editorLines(el: TextElement): string[] {
  const layout = layoutRichText({ spans: textSpans(el.layer), box: { x: 0, y: 0, width: el.transform.w * canvas.width, height: el.transform.h * canvas.height }, align: "center", lineHeight: 1.2, fontBasePx: canvas.height, measure: rich, wrap: true, truncate: false });
  return layout.lines.map((line) => line.segments.map((segment) => segment.text).join(""));
}

describe("text measured like the editor draws it", () => {
  it.each([
    ["ELORA", 0.28],
    ["CASA AURORA", 0.5],
    ["xy ELORA", 0.25],
    ["ELORA xy", 0.25],
    ["um texto comprido que quebra em várias linhas", 0.45],
    ["MARKETPLACE de verdade", 0.3],
  ])("breaks %s in a box %f wide at the same points as the editor", (text, w) => {
    const el = element(text, w, 0.5);
    expect(textLayoutOf({ canvas }, el, measure).layout.paragraphs.flat()).toEqual(editorLines(el));
  });

  it("splits a word wider than its box mid-word, so the box hides the letters that fall to the next line", () => {
    const el = element("ELORA", 0.28, 0.12);
    const { fit, hidden } = clippedText({ canvas }, el, measure);
    expect(fit.layout.paragraphs).toEqual([["ELOR", "A"]]);
    expect(hidden).toEqual(["A"]);
    expect(fit.layout.widestWord).toEqual({ text: "ELORA", width: 300 });
  });

  it("finds the largest font size that shows every letter in the box and never grows the text", () => {
    const clipped = element("CASA AURORA", 0.5, 0.12);
    const size = fittingFontSize({ canvas }, clipped, measure);
    expect(size).toBeLessThan(0.1);
    const fitted = element("CASA AURORA", 0.5, 0.12, { fontSize: size });
    expect(clippedText({ canvas }, fitted, measure).hidden).toEqual([]);
    expect(fittingFontSize({ canvas }, element("CASA AURORA", 0.5, 0.12, { fontSize: size + 0.002 }), measure)).toBeLessThan(size + 0.002);
    expect(fittingFontSize({ canvas }, element("Oi", 0.5, 0.12), measure)).toBe(0.1);
  });
});
