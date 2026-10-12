import type { TextAlign } from "./document";
import type { FontId } from "./fonts";
import { cachedPath } from "./glyph-layout";
import { sampleAt } from "./line-geometry";
import type { LaidChar, LaidLine } from "./text-animation";
import { drawnText, type RunStyle, type TextSpan } from "./text-runs";

export interface RunFont {
  fontId: FontId;
  weight: number;
  italic: boolean;
  sizePx: number;
  letterSpacingPx: number;
}

export interface FontMetrics {
  ascent: number;
  descent: number;
}

export interface RichMeasure {
  width: (text: string, font: RunFont) => number;
  metrics: (font: RunFont) => FontMetrics;
}

export interface RichBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RichLayoutInput {
  spans: readonly TextSpan[];
  box: RichBox;
  align: TextAlign;
  lineHeight: number;
  fontBasePx: number;
  measure: RichMeasure;
  wrap: boolean;
  truncate: boolean;
}

export interface RichSegment {
  start: number;
  end: number;
  text: string;
  x: number;
  width: number;
  style: RunStyle;
  font: RunFont;
  chars: LaidChar[];
}

export interface RichLine {
  top: number;
  height: number;
  baseline: number;
  x: number;
  width: number;
  segments: RichSegment[];
}

export interface RichLayout {
  lines: RichLine[];
  width: number;
  height: number;
}

interface Unit {
  index: number;
  char: string;
  draw: string;
  span: number;
}

interface Range {
  units: Unit[];
  heightSpan: number;
}

const BLANK = /\s/;

export function runFont(style: RunStyle, fontBasePx: number): RunFont {
  const sizePx = style.fontSize * fontBasePx;
  return { fontId: style.fontId, weight: style.fontWeight, italic: style.italic, sizePx, letterSpacingPx: style.letterSpacing * sizePx };
}

export function baselineShift(font: RunFont, lineHeight: number, measure: RichMeasure): number {
  const metrics = measure.metrics(font);
  return (metrics.ascent - metrics.descent) / 2 + (lineHeight * font.sizePx) / 2;
}

function unitsOf(spans: readonly TextSpan[]): Unit[] {
  return spans.flatMap((span, spanIndex) => [...span.text].map((char, i) => ({ index: span.start + i, char, draw: drawnText(char, span.style), span: spanIndex })));
}

function groups(units: readonly Unit[]): Unit[][] {
  const out: Unit[][] = [];
  for (const unit of units) {
    const last = out[out.length - 1];
    if (last && last[0].span === unit.span) last.push(unit);
    else out.push([unit]);
  }
  return out;
}

function makeWidth(spans: readonly TextSpan[], fonts: readonly RunFont[], measure: RichMeasure): (units: readonly Unit[]) => number {
  return (units) =>
    groups(units).reduce((sum, group) => {
      const font = fonts[group[0].span];
      return sum + measure.width(group.map((u) => u.draw).join(""), font) + font.letterSpacingPx * group.length;
    }, 0);
}

function isBreak(unit: Unit): boolean {
  return unit.char === " " || unit.char === "-";
}

function trimmedEnd(units: readonly Unit[]): Unit[] {
  let end = units.length;
  while (end > 0 && BLANK.test(units[end - 1].char)) end--;
  return units.slice(0, end);
}

function wrapParagraph(units: readonly Unit[], maxWidth: number, width: (units: readonly Unit[]) => number): Unit[][] {
  const length = units.length;
  const total = width(units);
  if (total <= maxWidth) return [units.slice()];
  const lines: Unit[][] = [];
  const perLine = Math.max(1, Math.ceil((length * maxWidth) / total));
  let start = 0;
  while (start < length) {
    const fits = (end: number) => width(units.slice(start, end)) <= maxWidth;
    let low = start;
    let high = Math.min(length, start + perLine);
    while (fits(high)) {
      low = high;
      if (high === length) break;
      high = Math.min(length, high + (high - start));
    }
    while (high - low > 1) {
      const mid = (low + high) >>> 1;
      if (fits(mid)) low = mid;
      else high = mid;
    }
    if (low === start) break;
    if (low === length) {
      lines.push(units.slice(start, length));
      break;
    }
    if (!isBreak(units[low])) {
      let wrapIndex = low - 1;
      while (wrapIndex >= start && !isBreak(units[wrapIndex])) wrapIndex--;
      if (wrapIndex >= start) low = wrapIndex + 1;
    }
    lines.push(trimmedEnd(units.slice(start, low)));
    start = low;
    while (start < length && BLANK.test(units[start].char)) start++;
  }
  return lines;
}

function paragraphs(units: readonly Unit[], fallbackSpan: number): Range[] {
  const out: Range[] = [];
  let current: Unit[] = [];
  let before: Unit | null = null;
  for (const unit of units) {
    if (unit.char === "\n") {
      out.push({ units: current, heightSpan: current[0]?.span ?? before?.span ?? unit.span });
      current = [];
      before = unit;
      continue;
    }
    current.push(unit);
  }
  out.push({ units: current, heightSpan: current[0]?.span ?? before?.span ?? fallbackSpan });
  return out;
}

function charsOf(group: readonly Unit[], x: number, font: RunFont, measure: RichMeasure): LaidChar[] {
  if (font.letterSpacingPx === 0) {
    const draws = group.map((u) => u.draw);
    return draws.map((char, i) => {
      const left = x + measure.width(draws.slice(0, i).join(""), font);
      return { char, left, right: left + measure.width(char, font) };
    });
  }
  let pen = x;
  return group.map((u) => {
    const advance = measure.width(u.draw, font);
    const placed = { char: u.draw, left: pen, right: pen + advance };
    pen += advance + font.letterSpacingPx;
    return placed;
  });
}

function lineStart(align: TextAlign, box: RichBox, width: number): number {
  if (align === "center") return box.x + (box.width - width) / 2;
  if (align === "right") return box.x + box.width - width;
  return box.x;
}

export function layoutRichText(input: RichLayoutInput): RichLayout {
  const { spans, box, measure, lineHeight } = input;
  if (spans.length === 0) return { lines: [], width: 0, height: 0 };
  const fonts = spans.map((span) => runFont(span.style, input.fontBasePx));
  const width = makeWidth(spans, fonts, measure);
  const shift = (span: number) => baselineShift(fonts[span], lineHeight, measure);
  const rows = paragraphs(unitsOf(spans), spans.length - 1).flatMap((paragraph) => {
    const wrapped = paragraph.units.length > 0 && input.wrap ? wrapParagraph(paragraph.units, box.width, width) : [paragraph.units];
    return wrapped.map((units) => ({ units, heightSpan: paragraph.heightSpan }));
  });
  const sized = rows.map((row) => {
    const used = row.units.length > 0 ? [...new Set(row.units.map((u) => u.span))] : [row.heightSpan];
    return { ...row, height: Math.max(...used.map((span) => lineHeight * fonts[span].sizePx)), shift: Math.max(...used.map(shift)) };
  });
  const kept: typeof sized = [];
  let used = 0;
  for (const row of sized) {
    if (input.truncate && kept.length > 0 && used + row.height > box.height) break;
    kept.push(row);
    used += row.height;
  }
  let top = box.y + (box.height - used) / 2;
  const lines = kept.map((row): RichLine => {
    const lineWidth = width(row.units);
    const x = lineStart(input.align, box, lineWidth);
    let pen = x;
    const segments = groups(row.units).map((group): RichSegment => {
      const span = spans[group[0].span];
      const font = fonts[group[0].span];
      const segmentWidth = width(group);
      const segment = { start: group[0].index, end: group[group.length - 1].index + 1, text: group.map((u) => u.draw).join(""), x: pen, width: segmentWidth, style: span.style, font, chars: charsOf(group, pen, font, measure) };
      pen += segmentWidth;
      return segment;
    });
    const line = { top, height: row.height, baseline: top + row.shift, x, width: lineWidth, segments };
    top += row.height;
    return line;
  });
  return { lines, width: Math.max(0, ...lines.map((line) => line.width)), height: used };
}

export function richLaidLines(layout: RichLayout): LaidLine[] {
  return layout.lines.map((line) => ({ top: line.top, height: line.height, chars: line.segments.flatMap((segment) => segment.chars) }));
}

export interface CurvedGlyphInput {
  spans: readonly TextSpan[];
  path: string;
  lineHeight: number;
  fontBasePx: number;
  measure: RichMeasure;
}

export interface CurvedGlyph {
  text: string;
  x: number;
  y: number;
  rotation: number;
  width: number;
  style: RunStyle;
  font: RunFont;
  lineHeightPx: number;
}

const DEGREES = 180 / Math.PI;

export function curvedGlyphs(input: CurvedGlyphInput): CurvedGlyph[] {
  const base = cachedPath(input.path);
  if (!base) return [];
  const fonts = input.spans.map((span) => runFont(span.style, input.fontBasePx));
  const units = unitsOf(input.spans);
  const widths = units.map((unit) => input.measure.width(unit.draw, fonts[unit.span]));
  const spacing = units.map((unit, i) => (i < units.length - 1 ? fonts[unit.span].letterSpacingPx : 0));
  const textWidth = Math.max(0, widths.reduce((sum, w, i) => sum + w + spacing[i], 0));
  let offset = Math.max(0, base.length / 2 - textWidth / 2);
  return units.map((unit, i) => {
    const font = fonts[unit.span];
    const glyphWidth = widths[i] + spacing[i];
    const from = sampleAt(base, Math.min(base.length, offset));
    const to = sampleAt(base, Math.min(base.length, offset + glyphWidth));
    offset += glyphWidth;
    return { text: unit.draw, x: from.x, y: from.y, rotation: Math.atan2(to.y - from.y, to.x - from.x) * DEGREES, width: widths[i], style: input.spans[unit.span].style, font, lineHeightPx: input.lineHeight * font.sizePx };
  });
}
