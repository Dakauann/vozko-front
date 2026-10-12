import { boxCorners } from "../arrange";
import type { Point } from "../convex";
import type { Layer } from "../document";
import { textAnchor, unitBounds, type Box, type SceneElement, type SceneGround } from "./scene";

export type TextMeasure = ((text: string, layer: Layer, fontPx: number) => number) & { approximate?: boolean };

export type TextElement = SceneElement & { layer: Layer };

export interface MeasuredWord {
  text: string;
  width: number;
}

export interface TextLayout {
  paragraphs: string[][];
  lines: number;
  widestWord: MeasuredWord;
  widestLine: number;
}

export interface TextFit {
  fontPx: number;
  layout: TextLayout;
  lineHeightPx: number;
  visible: number;
}

export interface ClippedText {
  fit: TextFit;
  hidden: string[];
  certain: boolean;
}

const DEFAULT_LINE_HEIGHT = 1.2;
const LINE_SLACK = 0.01;
const FIT_STEPS = 24;
const FONT_SIZE_SCALE = 1000;

export function isText(el: SceneElement): el is TextElement {
  return el.layer?.type === "text" && Boolean(el.layer.text?.trim());
}

function estimatedWidth(text: string, layer: Layer, fontPx: number): number {
  const letters = [...text];
  const upper = letters.filter((c) => c !== c.toLowerCase()).length / Math.max(1, letters.length);
  const factor = (0.54 + ((layer.fontWeight ?? 400) >= 700 ? 0.05 : 0)) * (upper > 0.6 ? 1.18 : 1);
  return letters.length * fontPx * (factor + (layer.letterSpacing ?? 0));
}

export const estimateTextWidth: TextMeasure = Object.assign(estimatedWidth, { approximate: true });

function splitWord(word: string, layer: Layer, fontPx: number, widthPx: number, measure: TextMeasure): string[] {
  const letters = [...word];
  const pieces: string[] = [];
  let start = 0;
  while (start < letters.length) {
    let end = start + 1;
    while (end < letters.length && measure(letters.slice(start, end + 1).join(""), layer, fontPx) <= widthPx) end++;
    pieces.push(letters.slice(start, end).join(""));
    start = end;
  }
  return pieces;
}

function layoutText(layer: Layer, fontPx: number, widthPx: number, measure: TextMeasure): TextLayout {
  let widestWord: MeasuredWord = { text: "", width: 0 };
  const paragraphs = (layer.text ?? "").split("\n").map((paragraph) => {
    const lines: string[] = [];
    let current = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const width = measure(word, layer, fontPx);
      if (width > widestWord.width) widestWord = { text: word, width };
      const candidate = current ? `${current} ${word}` : word;
      if (!current || measure(candidate, layer, fontPx) > widthPx) {
        if (current) lines.push(current);
        const pieces = width > widthPx ? splitWord(word, layer, fontPx, widthPx, measure) : [word];
        lines.push(...pieces.slice(0, -1));
        current = pieces[pieces.length - 1];
      } else {
        current = candidate;
      }
    }
    lines.push(current);
    return lines;
  });
  const all = paragraphs.flat();
  return { paragraphs, lines: all.length, widestWord, widestLine: Math.max(0, ...all.map((line) => measure(line, layer, fontPx))) };
}

export function textLayoutOf(scene: Pick<SceneGround, "canvas">, el: TextElement, measure: TextMeasure): TextFit {
  const { canvas } = scene;
  const fontPx = (el.layer.fontSize ?? 0) * canvas.height;
  const layout = layoutText(el.layer, fontPx, el.transform.w * canvas.width, measure);
  const lineHeightPx = (el.layer.lineHeight || DEFAULT_LINE_HEIGHT) * fontPx;
  const fits = lineHeightPx > 0 ? Math.floor((el.transform.h * canvas.height) / lineHeightPx + LINE_SLACK) : layout.lines;
  return { fontPx, layout, lineHeightPx, visible: Math.min(layout.lines, Math.max(1, fits)) };
}

export function clippedText(scene: Pick<SceneGround, "canvas">, el: TextElement, measure: TextMeasure): ClippedText {
  const fit = textLayoutOf(scene, el, measure);
  return {
    fit,
    hidden: fit.layout.paragraphs
      .flat()
      .slice(fit.visible)
      .filter((line) => line.trim()),
    certain: !measure.approximate,
  };
}

export function wideWord(scene: Pick<SceneGround, "canvas">, el: TextElement, fit: TextFit): MeasuredWord | null {
  return fit.layout.widestWord.width > el.transform.w * scene.canvas.width ? fit.layout.widestWord : null;
}

function shownWhole(scene: Pick<SceneGround, "canvas">, el: TextElement, measure: TextMeasure, fontSize: number): boolean {
  const sized = { ...el, layer: { ...el.layer, fontSize } };
  const { fit, hidden } = clippedText(scene, sized, measure);
  return hidden.length === 0 && wideWord(scene, sized, fit) === null;
}

export function fittingFontSize(scene: Pick<SceneGround, "canvas">, el: TextElement, measure: TextMeasure): number {
  const current = el.layer.fontSize ?? 0;
  if (shownWhole(scene, el, measure, current)) return current;
  let low = 0;
  let high = current;
  for (let step = 0; step < FIT_STEPS; step++) {
    const middle = (low + high) / 2;
    if (shownWhole(scene, el, measure, middle)) low = middle;
    else high = middle;
  }
  return Math.floor(low * FONT_SIZE_SCALE) / FONT_SIZE_SCALE;
}

export function inkCorners(scene: Pick<SceneGround, "canvas">, el: TextElement, measure: TextMeasure): Point[] {
  const { canvas } = scene;
  const { layout, lineHeightPx, visible } = textLayoutOf(scene, el, measure);
  const t = el.transform;
  const boxWidth = t.w * canvas.width;
  const width = Math.min(boxWidth, layout.widestLine);
  const anchor = textAnchor(el.layer);
  const shift = anchor === "left" ? (width - boxWidth) / 2 : anchor === "right" ? (boxWidth - width) / 2 : 0;
  const radians = (t.rotation * Math.PI) / 180;
  const x = (t.x * canvas.width + shift * Math.cos(radians)) / canvas.width;
  const y = (t.y * canvas.height + shift * Math.sin(radians)) / canvas.height;
  return boxCorners({ ...t, x, y, w: width / canvas.width, h: (visible * lineHeightPx) / canvas.height }, canvas);
}

export function inkBox(scene: Pick<SceneGround, "canvas">, el: TextElement, measure: TextMeasure): Box {
  return unitBounds(inkCorners(scene, el, measure), scene.canvas);
}
