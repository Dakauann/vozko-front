import { newShapeLayer, newStudioId, type CanvasSize, type Layer, type TextAlign, type Transform } from "../document";
import { textAdvance } from "../font-metrics";
import type { FontId } from "../fonts";
import type { Effect, EffectType, Paint, StrokePaint } from "../layer-paint";
import { clampTo, LAYER_RANGES } from "../layer-ranges";
import { baseRunStyle, runLength, styleRuns, type TextRange, type TextRun, type TextRunStyle } from "../text-runs";
import { vectorPresetLayer, type VectorPresetId } from "../vector-presets";
import type { LibraryLocale, LibrarySlot, LocalizedText } from "./model";

export type ComboColor = "ink" | `#${string}`;

export interface ComboStroke {
  color: ComboColor;
  width: number;
}

export interface ComboEffect {
  type: EffectType;
  color: `#${string}`;
  opacity: number;
  x: number;
  y: number;
  blur: number;
}

export interface ComboPill {
  color: ComboColor;
  padX: number;
  padY: number;
  radius: number;
}

export interface ComboAccent {
  word: "first" | "last";
  style: TextRunStyle;
}

export interface ComboText {
  kind: "text";
  slot: string;
  sample: LocalizedText;
  font: FontId;
  weight: number;
  size: number;
  color: ComboColor | null;
  lines?: number;
  italic?: boolean;
  lineHeight?: number;
  spacing?: number;
  caps?: boolean;
  opacity?: number;
  gap?: number;
  accent?: ComboAccent;
  strokes?: readonly ComboStroke[];
  effects?: readonly ComboEffect[];
  pill?: ComboPill;
  curve?: number;
}

export interface ComboRule {
  kind: "rule";
  width: number;
  thickness: number;
  color: ComboColor;
  gap?: number;
}

export type ComboPart = ComboText | ComboRule;

export type ComboShape = "rect" | "ellipse" | VectorPresetId;

export interface ComboSurface {
  shape: ComboShape;
  fill?: ComboColor;
  stroke?: { color: ComboColor; width: number; dash?: readonly number[] };
  radius?: number;
  effects?: readonly ComboEffect[];
}

export interface ComboBackdrop extends ComboSurface {
  pad: readonly [number, number];
  square?: boolean;
}

export type ComboAlign = Exclude<TextAlign, "right">;

export interface TextCombo {
  id: string;
  subcategory: string;
  name: LocalizedText;
  tags?: Partial<Record<LibraryLocale, readonly string[]>>;
  align: ComboAlign;
  rotation?: number;
  backdrop?: ComboBackdrop;
  parts: readonly ComboPart[];
}

export interface ComboContext {
  canvas: CanvasSize;
  ink: string;
  text: (slot: LibrarySlot) => string;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TextSpan {
  left: number;
  top: number;
  width: number;
  room: number;
}

export interface PlacedText {
  part: ComboText;
  text: string;
  size: number;
  lines: number;
  visual: Box;
  box: Box;
}

interface PlacedRule {
  part: ComboRule;
  visual: Box;
}

type Placed = PlacedText | PlacedRule;

interface Layout {
  placed: Placed[];
  backdrop: Box | null;
  bounds: Box;
}

const FIT = 0.9;
const WRAP_FILL = 0.82;
const DEFAULT_LINE_HEIGHT = 1.15;
const PILL_LINE_HEIGHT = 1;
const SHARE = 0.72;
const SAMPLE_LOCALE: LibraryLocale = "pt";

export function textSlots(texts: readonly ComboText[]): LibrarySlot[] {
  return texts.map((part) => ({ id: part.slot, sample: { text: part.sample } }));
}

export function comboSlots(combo: TextCombo): LibrarySlot[] {
  return textSlots(combo.parts.flatMap((part) => (part.kind === "text" ? [part] : [])));
}

function drawn(part: ComboText, text: string): string {
  return part.caps ? text.toLocaleUpperCase() : text;
}

function advanceOf(part: ComboText, text: string): number {
  return Math.max(textAdvance(drawn(part, text), part.font, part.weight, part.spacing ?? 0), 1e-6);
}

function lineHeightOf(part: ComboText): number {
  return part.lineHeight ?? (part.pill ? PILL_LINE_HEIGHT : DEFAULT_LINE_HEIGHT);
}

function fitted(part: ComboText, text: string, width: number): { size: number; lines: number } {
  const room = part.pill ? width - 2 * part.pill.padX * part.size : width;
  const advance = advanceOf(part, text);
  const most = Math.max(1, part.curve ? 1 : (part.lines ?? 1));
  if (most === 1) return { size: Math.min(part.size, room / advance), lines: 1 };
  const needed = Math.ceil((advance * part.size) / (room * WRAP_FILL));
  if (needed <= most) return { size: part.size, lines: needed };
  return { size: (room * WRAP_FILL * most) / advance, lines: most };
}

function sagitta(part: ComboText): number {
  return (Math.abs(part.curve ?? 0) * FIT) / 2;
}

function textHeight(part: ComboText, size: number, lines: number): number {
  const line = size * lineHeightOf(part);
  if (part.pill) return line + 2 * part.pill.padY * size;
  return lines * line + sagitta(part);
}

function anchoredX(span: TextSpan, width: number, align: TextAlign): number {
  if (align === "center") return span.left + span.width / 2;
  if (align === "right") return span.left + span.width - width / 2;
  return span.left + width / 2;
}

export function placeTextIn(part: ComboText, text: string, span: TextSpan, align: TextAlign): PlacedText {
  const { size, lines } = fitted(part, text, span.room);
  const height = textHeight(part, size, lines);
  const line = size * lineHeightOf(part);
  const width = part.pill ? advanceOf(part, text) * size + 2 * part.pill.padX * size : span.width;
  const visual = { x: anchoredX(span, width, align), y: span.top + height / 2, w: width, h: height };
  const spare = part.pill || part.curve ? 0 : line;
  return { part, text, size, lines, visual, box: { ...visual, h: height + spare } };
}

function placeText(part: ComboText, text: string, top: number, align: ComboAlign): PlacedText {
  return placeTextIn(part, text, { left: 0, top, width: 1, room: FIT }, align);
}

function placeRule(part: ComboRule, top: number, align: ComboAlign): PlacedRule {
  const x = align === "center" ? 0.5 : part.width / 2;
  return { part, visual: { x, y: top + part.thickness / 2, w: part.width, h: part.thickness } };
}

function union(boxes: readonly Box[]): Box {
  const left = Math.min(...boxes.map((b) => b.x - b.w / 2));
  const right = Math.max(...boxes.map((b) => b.x + b.w / 2));
  const top = Math.min(...boxes.map((b) => b.y - b.h / 2));
  const bottom = Math.max(...boxes.map((b) => b.y + b.h / 2));
  return { x: (left + right) / 2, y: (top + bottom) / 2, w: right - left, h: bottom - top };
}

function layout(combo: TextCombo, textOf: (part: ComboText) => string): Layout {
  let top = 0;
  const placed = combo.parts.map((part) => {
    const next = part.kind === "text" ? placeText(part, textOf(part), top, combo.align) : placeRule(part, top, combo.align);
    top = next.visual.y + next.visual.h / 2 + (part.gap ?? 0);
    return next;
  });
  const content = union(placed.map((p) => p.visual));
  const backdrop = combo.backdrop ? backdropBox(combo.backdrop, content) : null;
  return { placed, backdrop, bounds: backdrop ? union([content, backdrop]) : content };
}

function backdropBox(backdrop: ComboBackdrop, content: Box): Box {
  const w = content.w + 2 * backdrop.pad[0];
  const h = content.h + 2 * backdrop.pad[1];
  const side = Math.max(w, h);
  return backdrop.square ? { x: content.x, y: content.y, w: side, h: side } : { x: content.x, y: content.y, w, h };
}

function sampleText(part: ComboText): string {
  return part.sample[SAMPLE_LOCALE];
}

export function comboRatio(combo: TextCombo): number {
  const { bounds } = layout(combo, sampleText);
  return bounds.w / bounds.h;
}

export interface Frame {
  scale: number;
  center: { x: number; y: number };
  canvas: CanvasSize;
  rotation: number;
}

export function frameOf(bounds: Box, canvas: CanvasSize, rotation: number): Frame {
  const side = SHARE * Math.min(canvas.width, canvas.height);
  return { scale: side / Math.max(bounds.w, bounds.h), center: { x: bounds.x, y: bounds.y }, canvas, rotation };
}

export function transformOf(box: Box, frame: Frame, opacity: number = 1): Transform {
  const radians = (frame.rotation * Math.PI) / 180;
  const dx = box.x - frame.center.x;
  const dy = box.y - frame.center.y;
  const rx = dx * Math.cos(radians) - dy * Math.sin(radians);
  const ry = dx * Math.sin(radians) + dy * Math.cos(radians);
  const { width, height } = frame.canvas;
  return {
    x: 0.5 + (rx * frame.scale) / width,
    y: 0.5 + (ry * frame.scale) / height,
    w: clampTo((box.w * frame.scale) / width, LAYER_RANGES.size),
    h: clampTo((box.h * frame.scale) / height, LAYER_RANGES.size),
    rotation: frame.rotation,
    opacity,
  };
}

export function colorOf(color: ComboColor, ink: string): string {
  return color === "ink" ? ink : color;
}

function wordRange(text: string, word: ComboAccent["word"]): TextRange | null {
  const chars = [...text];
  const words: TextRange[] = [];
  let start = -1;
  chars.forEach((char, i) => {
    const space = /\s/u.test(char);
    if (!space && start < 0) start = i;
    if (space && start >= 0) {
      words.push({ start, end: i });
      start = -1;
    }
  });
  if (start >= 0) words.push({ start, end: chars.length });
  if (words.length < 2) return null;
  return word === "first" ? words[0] : words[words.length - 1];
}

function runsOf(part: ComboText, layer: Layer, text: string): TextRun[] {
  const length = runLength({ text });
  const base = baseRunStyle(layer);
  const caps = part.caps ? styleRuns([], length, base, { start: 0, end: length }, { caps: true }) : [];
  const range = part.accent ? wordRange(text, part.accent.word) : null;
  return range && part.accent ? styleRuns(caps, length, base, range, part.accent.style) : caps;
}

function effectsOf(effects: readonly ComboEffect[], scale: number): Effect[] {
  return effects.map((effect, i) => ({ id: `fx${i + 1}`, type: effect.type, color: effect.color, opacity: effect.opacity, x: effect.x * scale, y: effect.y * scale, blur: effect.blur * scale, spread: 0 }));
}

function paintsOf(part: ComboText, ink: string, sizePx: number): Partial<Layer> {
  const fill = part.color ? colorOf(part.color, ink) : undefined;
  const rich = (part.strokes?.length ?? 0) > 0 || (part.effects?.length ?? 0) > 0;
  if (!rich) return fill ? { fill } : {};
  const fills: Paint[] = fill ? [{ type: "solid", color: fill, opacity: 1 }] : [];
  const strokes: StrokePaint[] = (part.strokes ?? []).map((stroke) => ({ type: "solid", color: colorOf(stroke.color, ink), opacity: 1, width: clampTo(stroke.width * sizePx, LAYER_RANGES.strokeWidth), align: "outside" }));
  const effects = effectsOf(part.effects ?? [], sizePx);
  return { ...(fills.length > 0 ? { fills } : {}), ...(strokes.length > 0 ? { strokes } : {}), ...(effects.length > 0 ? { effects } : {}) };
}

export function textLayer(placed: PlacedText, frame: Frame, align: TextAlign, ink: string): Layer {
  const { part, text, size } = placed;
  const sizePx = size * frame.scale;
  const layer: Layer = {
    id: newStudioId("l"),
    type: "text",
    transform: transformOf(placed.box, frame, part.opacity ?? 1),
    text,
    fontId: part.font,
    fontSize: clampTo(sizePx / frame.canvas.height, LAYER_RANGES.fontSize),
    fontWeight: part.weight,
    align: part.pill ? "center" : align,
    lineHeight: lineHeightOf(part),
    ...(part.italic ? { italic: true } : {}),
    ...(part.spacing ? { letterSpacing: part.spacing } : {}),
    ...(part.curve ? { curve: part.curve } : {}),
    ...(part.pill ? { highlight: { color: colorOf(part.pill.color, ink), radius: part.pill.radius } } : {}),
    ...paintsOf(part, ink, sizePx),
  };
  const runs = runsOf(part, layer, text);
  return runs.length > 0 ? { ...layer, runs } : layer;
}

function ruleLayer(placed: PlacedRule, frame: Frame, ink: string): Layer {
  return { ...newShapeLayer("rect", transformOf(placed.visual, frame)), fill: colorOf(placed.part.color, ink) };
}

function backdropGeometry(shape: ComboShape, canvas: CanvasSize): Pick<Layer, "shape" | "path" | "points" | "inner"> {
  if (shape === "rect" || shape === "ellipse") return { shape };
  const preset = vectorPresetLayer(shape, canvas);
  return { shape: preset.shape, ...(preset.path ? { path: preset.path } : {}), ...(preset.points ? { points: preset.points, inner: preset.inner } : {}) };
}

export function surfaceLayer(surface: ComboSurface, box: Box, frame: Frame, ink: string): Layer {
  const stroke = surface.stroke;
  return {
    id: newStudioId("l"),
    type: "shape",
    transform: transformOf(box, frame),
    ...backdropGeometry(surface.shape, frame.canvas),
    ...(surface.fill ? { fill: colorOf(surface.fill, ink) } : {}),
    ...(surface.radius !== undefined ? { radius: surface.radius } : {}),
    ...(stroke ? { stroke: colorOf(stroke.color, ink), strokeWidth: clampTo(stroke.width * frame.scale, LAYER_RANGES.strokeWidth), ...(stroke.dash ? { dashArray: [...stroke.dash] } : {}) } : {}),
    ...(surface.effects && surface.effects.length > 0 ? { effects: effectsOf(surface.effects, frame.scale) } : {}),
  };
}

export function comboLayers(combo: TextCombo, ctx: ComboContext): Layer[] {
  const slots = new Map(comboSlots(combo).map((slot) => [slot.id, slot]));
  const { placed, backdrop, bounds } = layout(combo, (part) => ctx.text(slots.get(part.slot)!));
  const frame = frameOf(bounds, ctx.canvas, combo.rotation ?? 0);
  const parts = placed.map((p) => ("text" in p ? textLayer(p, frame, combo.align, ctx.ink) : ruleLayer(p, frame, ctx.ink)));
  return combo.backdrop && backdrop ? [surfaceLayer(combo.backdrop, backdrop, frame, ctx.ink), ...parts] : parts;
}
