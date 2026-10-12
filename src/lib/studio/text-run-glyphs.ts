import { COUNTER_DIGITS, counterCells, counterTokens, type Counter, type CounterToken } from "./counter";
import type { Layer } from "./document";
import type { GlyphContent } from "./glyph-layout";
import { lineText, type GlyphFrame } from "./text-glyphs";
import { collapsedSpans, counterRunStyles, drawnText, hasRuns, type RunStyle } from "./text-runs";

const SLOT_CELLS = COUNTER_DIGITS.map((_, index) => index);

export interface GlyphCells {
  cells: string[];
  styles?: RunStyle[];
  content: GlyphContent;
}

interface Piece {
  text: string;
  style: RunStyle;
}

function sameLook(a: RunStyle, b: RunStyle): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function pieces(text: string, styles: readonly RunStyle[]): Piece[] {
  const out: Piece[] = [];
  [...text].forEach((char, i) => {
    const last = out[out.length - 1];
    if (last && sameLook(last.style, styles[i])) last.text += char;
    else out.push({ text: char, style: styles[i] });
  });
  return out.map((piece) => ({ text: drawnText(piece.text, piece.style), style: piece.style }));
}

function counterGlyphs(layer: Layer, counter: Counter, value: number): GlyphCells {
  const styles = counterRunStyles(layer, counter);
  const bare = { ...counter, prefix: undefined, suffix: undefined };
  const numberCells = counterCells(bare);
  const before = pieces(counter.prefix ?? "", styles.prefix);
  const after = pieces(counter.suffix ?? "", styles.suffix);
  const cells = [...numberCells, ...before.map((p) => p.text), ...after.map((p) => p.text)];
  const tokenOf = (index: number): CounterToken => ({ cell: index, digit: false });
  const tokens = [...before.map((_, i) => tokenOf(numberCells.length + i)), ...counterTokens(bare, value), ...after.map((_, i) => tokenOf(numberCells.length + before.length + i))];
  return { cells, styles: [...numberCells.map(() => styles.number), ...before.map((p) => p.style), ...after.map((p) => p.style)], content: { kind: "counter", tokens, slotCells: SLOT_CELLS } };
}

export function glyphCells(frame: GlyphFrame, layer: Layer): GlyphCells {
  const counted = frame.counter;
  if (counted) {
    if (hasRuns(layer)) return counterGlyphs(layer, counted.counter, counted.value);
    return { cells: counterCells(counted.counter), content: { kind: "counter", tokens: counterTokens(counted.counter, counted.value), slotCells: SLOT_CELLS } };
  }
  if (!hasRuns(layer)) return { cells: [lineText(layer)], content: { kind: "text", cells: [0] } };
  const spans = collapsedSpans(layer);
  return { cells: spans.map((span) => drawnText(span.text, span.style)), styles: spans.map((span) => span.style), content: { kind: "text", cells: spans.map((_, i) => i) } };
}
