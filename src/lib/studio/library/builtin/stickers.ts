import type { Behavior } from "../../behaviors";
import { msOfFrame, newOverlayClip, newPathLayer, newShapeLayer, newStudioId, newTextLayer, type Clip, type Layer, type Transform } from "../../document";
import type { Easing, Keyframe, Keyframes } from "../../keyframes";
import { scalePath } from "../../vector-path";
import { VECTOR_PRESETS } from "../../vector-presets";
import { OWN_SOURCE, type LibraryCategory, type LibraryItem, type LibrarySlot, type LibraryStickerContext, type LocalizedText } from "../model";
import { previewSvg } from "../preview";

type Subcategory = "circles" | "underlines" | "arrows" | "marks" | "bursts" | "words";

type Tags = Partial<Record<"pt" | "en" | "es" | "de", string[]>>;

const RED = "#ff3b30";
const YELLOW = "#ffd60a";
const PINK = "#ff2d78";
const BLUE = "#2f80ff";
const GREEN = "#22c55e";
const WHITE = "#ffffff";
const HIGHLIGHT = "#ffd60a99";

const VIEW = 40;
const ROOM = 30;
const LAST_FRAME = msOfFrame(1);

function text(pt: string, en: string, es: string, de: string): LocalizedText {
  return { pt, en, es, de };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function side(ctx: LibraryStickerContext): number {
  return Math.min(ctx.canvas.width, ctx.canvas.height);
}

function px(ctx: LibraryStickerContext, share: number): number {
  return share * side(ctx);
}

function within(ctx: LibraryStickerContext, ms: number): number {
  return Math.max(0, Math.min(Math.round(ms), ctx.durationMs - LAST_FRAME));
}

function key(ctx: LibraryStickerContext, atMs: number, value: number, easing: Easing = "linear"): Keyframe {
  return { atMs: within(ctx, atMs), value, easing };
}

function lane(ctx: LibraryStickerContext, frames: readonly [number, number, Easing?][]): Keyframe[] {
  const keys = frames.map(([at, value, easing]) => key(ctx, at, value, easing));
  return keys.filter((frame, index) => index === 0 || frame.atMs > keys[index - 1].atMs);
}

function placed(ctx: LibraryStickerContext, cx: number, cy: number, w: number, h: number, rotation = 0): Transform {
  return { x: cx, y: cy, w: px(ctx, w) / ctx.canvas.width, h: px(ctx, h) / ctx.canvas.height, rotation, opacity: 1 };
}

function overlay(ctx: LibraryStickerContext, layer: Layer, transform: Transform, keyframes?: Keyframes, extra: Partial<Clip> = {}): Clip {
  return { ...newOverlayClip(layer, ctx.atMs, ctx.durationMs, transform), ...(keyframes ? { keyframes } : {}), ...extra };
}

interface Stroke {
  path: string;
  color: string;
  width: number;
  sequential?: boolean;
}

function drawn(ctx: LibraryStickerContext, stroke: Stroke, transform: Transform, fromMs: number, toMs: number, extra: Keyframes = {}, behaviors?: Behavior[]): Clip {
  const layer: Layer = { ...newPathLayer(stroke.path, transform, true), stroke: stroke.color, strokeWidth: px(ctx, stroke.width), lineCap: "round", lineJoin: "round" };
  const keyframes: Keyframes = { ...extra, trimEnd: lane(ctx, [[fromMs, 0, "easeInOut"], [toMs, 1]]) };
  return overlay(ctx, layer, transform, keyframes, { line: { trim: { start: 0, end: 1, offset: 0, ...(stroke.sequential ? { sequential: true } : {}) } }, ...(behaviors ? { behaviors } : {}) });
}

function wobble(degrees: number, periodMs: number): (ctx: LibraryStickerContext) => { keys: Keyframes; behaviors: Behavior[] } {
  return (ctx) => ({
    keys: { rotation: lane(ctx, [[0, -degrees, "easeInOut"], [periodMs, degrees, "easeInOut"]]) },
    behaviors: [{ id: newStudioId("b"), kind: "loop", property: "rotation", mode: "pingpong", side: "out" }],
  });
}

function popIn(ctx: LibraryStickerContext, fromMs = 0, toMs = 450): Keyframes {
  return { scale: lane(ctx, [[fromMs, 0.2, "backOut"], [toMs, 1]]), opacity: lane(ctx, [[fromMs, 0, "easeOut"], [fromMs + 120, 1]]) };
}

function svg(body: string): string {
  return previewSvg(body, VIEW);
}

function strokeMarkup(path: string, ratio: number, width = 2.5): string {
  const w = ratio >= 1 ? ROOM : ROOM * ratio;
  const h = ratio >= 1 ? ROOM / ratio : ROOM;
  return svg(`<g transform="translate(${round((VIEW - w) / 2)} ${round((VIEW - h) / 2)})"><path d="${scalePath(path, w, h)}" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/></g>`);
}

function fillMarkup(path: string, ratio: number): string {
  const w = ratio >= 1 ? ROOM : ROOM * ratio;
  const h = ratio >= 1 ? ROOM / ratio : ROOM;
  return svg(`<g transform="translate(${round((VIEW - w) / 2)} ${round((VIEW - h) / 2)})"><path d="${scalePath(path, w, h)}" fill="currentColor"/></g>`);
}

function wordMarkup(word: string): string {
  return svg(`<text x="20" y="24" text-anchor="middle" font-size="${Math.min(12, 44 / Math.max(word.length, 1))}" font-weight="900" font-family="sans-serif" fill="currentColor">${word}</text>`);
}

interface StickerSpec {
  id: string;
  subcategory: Subcategory;
  ratio: number;
  name: LocalizedText;
  tags?: Tags;
  durationMs?: number;
  slots?: readonly LibrarySlot[];
  markup: string;
  build: (ctx: LibraryStickerContext) => Clip[];
}

const DEFAULT_MS = 2500;

function sticker(spec: StickerSpec): LibraryItem {
  return {
    id: spec.id,
    category: "stickers",
    subcategory: spec.subcategory,
    editors: ["image", "video"],
    ratio: spec.ratio,
    label: { text: spec.name },
    ...(spec.tags ? { tags: spec.tags } : {}),
    preview: { kind: "svg", markup: spec.markup },
    source: OWN_SOURCE,
    template: { kind: "sticker", durationMs: spec.durationMs ?? DEFAULT_MS, ...(spec.slots ? { slots: spec.slots } : {}), build: spec.build },
  };
}

interface DrawnSpec {
  id: string;
  subcategory: Subcategory;
  name: LocalizedText;
  tags?: Tags;
  path: string;
  ratio: number;
  share: number;
  width: number;
  color: (ctx: LibraryStickerContext) => string;
  drawMs: number;
  sequential?: boolean;
  wobble?: boolean;
}

function drawnSticker(spec: DrawnSpec): LibraryItem {
  const w = spec.ratio >= 1 ? spec.share : spec.share * spec.ratio;
  const h = w / spec.ratio;
  return sticker({
    id: spec.id,
    subcategory: spec.subcategory,
    ratio: spec.ratio,
    name: spec.name,
    tags: spec.tags,
    markup: strokeMarkup(spec.path, spec.ratio),
    build: (ctx) => {
      const motion = spec.wobble ? wobble(3, 500)(ctx) : null;
      return [drawn(ctx, { path: spec.path, color: spec.color(ctx), width: spec.width, sequential: spec.sequential }, placed(ctx, 0.5, 0.5, w, h), 0, spec.drawMs, motion?.keys ?? {}, motion?.behaviors)];
    },
  });
}

const ink = (ctx: LibraryStickerContext) => ctx.ink;
const red = () => RED;
const yellow = () => YELLOW;
const highlight = () => HIGHLIGHT;

const PATHS = {
  circle: "M0.62 0.08 C0.3 0.02 0.04 0.2 0.04 0.5 C0.04 0.82 0.3 0.97 0.55 0.96 C0.82 0.95 0.97 0.75 0.96 0.48 C0.95 0.22 0.72 0.06 0.42 0.12",
  roundCircle: "M0.56 0.06 C0.26 0.04 0.05 0.24 0.05 0.5 C0.05 0.78 0.28 0.95 0.52 0.95 C0.78 0.95 0.95 0.76 0.95 0.5 C0.95 0.26 0.76 0.07 0.5 0.06 C0.4 0.06 0.32 0.09 0.26 0.13",
  doubleCircle: "M0.6 0.1 C0.3 0.04 0.05 0.22 0.06 0.5 C0.07 0.8 0.32 0.95 0.56 0.94 C0.82 0.93 0.96 0.74 0.95 0.48 C0.94 0.24 0.74 0.08 0.46 0.08 C0.22 0.08 0.03 0.28 0.05 0.54 C0.07 0.84 0.36 0.98 0.62 0.94",
  scribbleCircle: "M0.66 0.12 C0.36 0 0.06 0.16 0.04 0.46 C0.02 0.78 0.3 0.98 0.58 0.95 C0.86 0.92 1 0.66 0.95 0.42 C0.9 0.16 0.62 0.04 0.38 0.1 C0.16 0.16 0.06 0.36 0.1 0.58 C0.14 0.8 0.36 0.9 0.6 0.88 C0.8 0.86 0.92 0.7 0.9 0.5",
  box: "M0.05 0.14 C0.35 0.08 0.65 0.07 0.95 0.08 C0.96 0.38 0.97 0.62 0.96 0.9 C0.65 0.94 0.35 0.95 0.04 0.93 C0.03 0.65 0.04 0.38 0.07 0.06",
  underline: "M0.02 0.62 C0.3 0.42 0.7 0.36 0.98 0.46",
  doubleUnderline: "M0.02 0.34 C0.35 0.18 0.66 0.16 0.98 0.28 M0.1 0.82 C0.4 0.66 0.7 0.64 0.92 0.72",
  zigzag: "M0.02 0.7 L0.12 0.3 L0.22 0.7 L0.32 0.3 L0.42 0.7 L0.52 0.3 L0.62 0.7 L0.72 0.3 L0.82 0.7 L0.92 0.3 L0.98 0.55",
  swoosh: "M0.02 0.86 C0.28 0.3 0.66 0.1 0.98 0.36",
  marker: "M0.03 0.5 L0.97 0.5",
  arrow: "M0.04 0.5 L0.94 0.5 M0.74 0.24 L0.95 0.5 L0.74 0.76",
  curvedArrow: "M0.06 0.88 C0.3 0.24 0.62 0.12 0.9 0.34 M0.7 0.4 L0.92 0.36 L0.88 0.12",
  loopArrow: "M0.03 0.78 C0.3 0.78 0.46 0.22 0.32 0.16 C0.16 0.1 0.18 0.62 0.56 0.62 L0.94 0.62 M0.8 0.46 L0.95 0.62 L0.8 0.78",
  downArrow: "M0.5 0.04 C0.34 0.38 0.66 0.58 0.5 0.92 M0.28 0.72 L0.5 0.94 L0.72 0.74",
  bentArrow: "M0.08 0.08 L0.08 0.66 L0.9 0.66 M0.72 0.46 L0.92 0.66 L0.72 0.86",
  doubleArrow: "M0.08 0.5 L0.92 0.5 M0.26 0.26 L0.06 0.5 L0.26 0.74 M0.74 0.26 L0.94 0.5 L0.74 0.74",
  check: "M0.08 0.56 L0.38 0.86 L0.92 0.12",
  cross: "M0.12 0.12 L0.88 0.88 M0.88 0.12 L0.12 0.88",
  ticks: "M0.2 0.62 L0.04 0.38 M0.5 0.5 L0.5 0.06 M0.8 0.62 L0.96 0.38",
  rays: "M0.5 0.02 L0.5 0.24 M0.84 0.16 L0.69 0.31 M0.98 0.5 L0.76 0.5 M0.84 0.84 L0.69 0.69 M0.5 0.98 L0.5 0.76 M0.16 0.84 L0.31 0.69 M0.02 0.5 L0.24 0.5 M0.16 0.16 L0.31 0.31",
  spiral: "M0.5 0.5 C0.56 0.44 0.62 0.52 0.56 0.6 C0.48 0.7 0.32 0.6 0.36 0.44 C0.4 0.26 0.66 0.24 0.74 0.44 C0.84 0.68 0.6 0.9 0.36 0.84 C0.1 0.76 0.06 0.4 0.24 0.2 C0.44 -0.02 0.86 0.06 0.94 0.4",
  sparkle: "M0.5 0 C0.54 0.34 0.66 0.46 1 0.5 C0.66 0.54 0.54 0.66 0.5 1 C0.46 0.66 0.34 0.54 0 0.5 C0.34 0.46 0.46 0.34 0.5 0 Z",
  bracket: "M0.3 0.04 C0.1 0.06 0.08 0.2 0.1 0.5 C0.12 0.8 0.1 0.94 0.3 0.96 M0.7 0.04 C0.9 0.06 0.92 0.2 0.9 0.5 C0.88 0.8 0.9 0.94 0.7 0.96",
} as const;

const DRAWN: DrawnSpec[] = [
  { id: "sticker-circle", subcategory: "circles", name: text("Círculo à mão", "Hand drawn circle", "Círculo a mano", "Handgezeichneter Kreis"), tags: { pt: ["destaque", "rabisco"], en: ["highlight", "scribble"], es: ["destacar"], de: ["markieren"] }, path: PATHS.circle, ratio: 1.6, share: 0.6, width: 0.012, color: red, drawMs: 700 },
  { id: "sticker-circle-round", subcategory: "circles", name: text("Círculo redondo", "Round circle", "Círculo redondo", "Runder Kreis"), path: PATHS.roundCircle, ratio: 1, share: 0.45, width: 0.012, color: red, drawMs: 700 },
  { id: "sticker-circle-double", subcategory: "circles", name: text("Círculo duplo", "Double circle", "Círculo doble", "Doppelkreis"), path: PATHS.doubleCircle, ratio: 1.6, share: 0.6, width: 0.01, color: ink, drawMs: 900 },
  { id: "sticker-circle-scribble", subcategory: "circles", name: text("Círculo rabiscado", "Scribbled circle", "Círculo garabateado", "Gekritzelter Kreis"), path: PATHS.scribbleCircle, ratio: 1.4, share: 0.55, width: 0.009, color: yellow, drawMs: 1000 },
  { id: "sticker-box", subcategory: "circles", name: text("Retângulo à mão", "Hand drawn box", "Recuadro a mano", "Handgezeichneter Rahmen"), path: PATHS.box, ratio: 1.8, share: 0.6, width: 0.01, color: ink, drawMs: 900 },
  { id: "sticker-brackets", subcategory: "circles", name: text("Colchetes", "Brackets", "Corchetes", "Klammern"), path: PATHS.bracket, ratio: 2, share: 0.55, width: 0.01, color: yellow, drawMs: 700 },
  { id: "sticker-underline", subcategory: "underlines", name: text("Sublinhado", "Underline", "Subrayado", "Unterstreichung"), tags: { pt: ["traço", "destaque"], en: ["stroke", "highlight"], es: ["trazo"], de: ["strich"] }, path: PATHS.underline, ratio: 8, share: 0.6, width: 0.012, color: red, drawMs: 500 },
  { id: "sticker-underline-double", subcategory: "underlines", name: text("Sublinhado duplo", "Double underline", "Subrayado doble", "Doppelte Unterstreichung"), path: PATHS.doubleUnderline, ratio: 6, share: 0.6, width: 0.01, color: ink, drawMs: 700, sequential: true },
  { id: "sticker-underline-wavy", subcategory: "underlines", name: text("Sublinhado ondulado", "Wavy underline", "Subrayado ondulado", "Wellenlinie"), path: VECTOR_PRESETS.squiggle.kind === "path" ? VECTOR_PRESETS.squiggle.data : PATHS.underline, ratio: 6, share: 0.6, width: 0.011, color: yellow, drawMs: 800 },
  { id: "sticker-underline-zigzag", subcategory: "underlines", name: text("Ziguezague", "Zigzag", "Zigzag", "Zickzack"), path: PATHS.zigzag, ratio: 7, share: 0.6, width: 0.009, color: red, drawMs: 800 },
  { id: "sticker-swoosh", subcategory: "underlines", name: text("Pincelada", "Swoosh", "Pincelada", "Schwung"), path: PATHS.swoosh, ratio: 3, share: 0.6, width: 0.014, color: ink, drawMs: 500 },
  { id: "sticker-marker", subcategory: "underlines", name: text("Marca-texto", "Highlighter", "Marcador", "Textmarker"), tags: { pt: ["realce"], en: ["marker"], es: ["resaltador"], de: ["hervorheben"] }, path: PATHS.marker, ratio: 10, share: 0.6, width: 0.05, color: highlight, drawMs: 600 },
  { id: "sticker-arrow", subcategory: "arrows", name: text("Seta desenhada", "Drawn arrow", "Flecha dibujada", "Gezeichneter Pfeil"), tags: { pt: ["apontar"], en: ["point"], es: ["señalar"], de: ["zeigen"] }, path: PATHS.arrow, ratio: 2.5, share: 0.45, width: 0.012, color: ink, drawMs: 700, sequential: true },
  { id: "sticker-arrow-curved", subcategory: "arrows", name: text("Seta curva", "Curved arrow", "Flecha curva", "Gebogener Pfeil"), path: PATHS.curvedArrow, ratio: 1.5, share: 0.4, width: 0.012, color: red, drawMs: 800, sequential: true },
  { id: "sticker-arrow-loop", subcategory: "arrows", name: text("Seta com laço", "Loop arrow", "Flecha con bucle", "Schleifenpfeil"), path: PATHS.loopArrow, ratio: 2, share: 0.45, width: 0.011, color: yellow, drawMs: 1000, sequential: true },
  { id: "sticker-arrow-down", subcategory: "arrows", name: text("Seta para baixo", "Arrow down", "Flecha abajo", "Pfeil nach unten"), path: PATHS.downArrow, ratio: 0.5, share: 0.4, width: 0.012, color: ink, drawMs: 700, sequential: true },
  { id: "sticker-arrow-bent", subcategory: "arrows", name: text("Seta dobrada", "Bent arrow", "Flecha doblada", "Abgewinkelter Pfeil"), path: PATHS.bentArrow, ratio: 1.4, share: 0.4, width: 0.012, color: red, drawMs: 800, sequential: true },
  { id: "sticker-arrow-double", subcategory: "arrows", name: text("Seta de ida e volta", "Two way arrow", "Flecha de ida y vuelta", "Doppelpfeil"), path: PATHS.doubleArrow, ratio: 2.5, share: 0.45, width: 0.012, color: ink, drawMs: 700 },
  { id: "sticker-check", subcategory: "marks", name: text("Visto", "Check mark", "Marca de verificación", "Häkchen"), tags: { pt: ["certo", "ok"], en: ["tick", "ok"], es: ["correcto"], de: ["richtig"] }, path: PATHS.check, ratio: 1.2, share: 0.3, width: 0.016, color: () => GREEN, drawMs: 500, sequential: true },
  { id: "sticker-cross", subcategory: "marks", name: text("Xis", "Cross", "Cruz", "Kreuz"), tags: { pt: ["errado"], en: ["wrong"], es: ["incorrecto"], de: ["falsch"] }, path: PATHS.cross, ratio: 1, share: 0.28, width: 0.016, color: red, drawMs: 600, sequential: true },
  { id: "sticker-ticks", subcategory: "marks", name: text("Traços de ênfase", "Emphasis lines", "Líneas de énfasis", "Betonungslinien"), tags: { pt: ["atenção", "surpresa"], en: ["attention", "surprise"], es: ["atención"], de: ["achtung"] }, path: PATHS.ticks, ratio: 1.6, share: 0.3, width: 0.012, color: yellow, drawMs: 400, wobble: true },
  { id: "sticker-spiral", subcategory: "marks", name: text("Espiral", "Spiral", "Espiral", "Spirale"), path: PATHS.spiral, ratio: 1, share: 0.35, width: 0.01, color: ink, drawMs: 1100 },
  { id: "sticker-rays", subcategory: "bursts", name: text("Raios", "Rays", "Rayos", "Strahlen"), tags: { pt: ["brilho", "explosão"], en: ["shine", "burst"], es: ["brillo"], de: ["glanz"] }, path: PATHS.rays, ratio: 1, share: 0.4, width: 0.012, color: yellow, drawMs: 450 },
];

function shapeLayer(path: string, transform: Transform, fill: string): Layer {
  return { ...newPathLayer(path, transform), fill };
}

function popShape(id: string, name: LocalizedText, path: string, color: string, share: number, tags?: Tags, spin?: number): LibraryItem {
  return sticker({
    id,
    subcategory: id.includes("burst") || id.includes("star") ? "bursts" : "marks",
    ratio: 1,
    name,
    tags,
    markup: fillMarkup(path, 1),
    build: (ctx) => {
      const transform = placed(ctx, 0.5, 0.5, share, share);
      const motion = spin === undefined ? wobble(6, 600)(ctx) : { keys: {}, behaviors: [{ id: newStudioId("b"), kind: "drift", property: "rotation", rate: spin } satisfies Behavior] };
      return [overlay(ctx, shapeLayer(path, transform, color), transform, { ...popIn(ctx), ...motion.keys }, { behaviors: motion.behaviors })];
    },
  });
}

function starPath(points: number, inner: number): string {
  const corners = Array.from({ length: points * 2 }, (_, i) => {
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    const r = i % 2 === 0 ? 0.5 : 0.5 * inner;
    return `${i === 0 ? "M" : "L"}${round(0.5 + Math.cos(angle) * r)} ${round(0.5 + Math.sin(angle) * r)}`;
  });
  return `${corners.join(" ")} Z`;
}

const HEART = VECTOR_PRESETS.heart.kind === "path" ? VECTOR_PRESETS.heart.data : starPath(5, 0.5);

const POPS: LibraryItem[] = [
  popShape("sticker-sparkle", text("Brilho", "Sparkle", "Destello", "Funkeln"), PATHS.sparkle, YELLOW, 0.22, { pt: ["estrela", "mágica"], en: ["star", "magic"], es: ["estrella"], de: ["stern"] }),
  popShape("sticker-heart", text("Coração pulsando", "Heart pop", "Corazón", "Herz"), HEART, PINK, 0.24, { pt: ["amor", "curtir"], en: ["love", "like"], es: ["amor"], de: ["liebe"] }),
  popShape("sticker-star", text("Estrela", "Star pop", "Estrella", "Stern"), starPath(5, 0.45), YELLOW, 0.24),
  popShape("sticker-burst", text("Explosão", "Burst", "Explosión", "Explosion"), starPath(16, 0.72), RED, 0.32, { pt: ["selo", "estouro"], en: ["badge", "pop"], es: ["sello"], de: ["siegel"] }, 40),
  popShape("sticker-burst-sharp", text("Explosão pontuda", "Sharp burst", "Explosión puntiaguda", "Spitze Explosion"), starPath(12, 0.5), YELLOW, 0.32, { pt: ["estouro"], en: ["pop"], es: ["estallido"], de: ["knall"] }, -30),
];

function confetti(): LibraryItem {
  const pieces = [
    { x: 0.2, y: 0.25, color: RED, turn: 140 },
    { x: 0.45, y: 0.15, color: YELLOW, turn: -120 },
    { x: 0.7, y: 0.3, color: BLUE, turn: 200 },
    { x: 0.85, y: 0.6, color: GREEN, turn: -160 },
    { x: 0.3, y: 0.65, color: PINK, turn: 110 },
    { x: 0.58, y: 0.75, color: YELLOW, turn: -90 },
    { x: 0.12, y: 0.85, color: BLUE, turn: 180 },
    { x: 0.8, y: 0.88, color: RED, turn: -200 },
  ];
  return sticker({
    id: "sticker-confetti",
    subcategory: "bursts",
    ratio: 1,
    name: text("Confete", "Confetti", "Confeti", "Konfetti"),
    tags: { pt: ["festa", "comemoração"], en: ["party", "celebration"], es: ["fiesta"], de: ["party"] },
    markup: svg(pieces.map((piece, i) => `<rect x="${round(5 + piece.x * 30)}" y="${round(5 + piece.y * 30)}" width="3" height="${i % 2 ? 3 : 5}" fill="currentColor" transform="rotate(${piece.turn / 4} ${round(6 + piece.x * 30)} ${round(7 + piece.y * 30)})"/>`).join("")),
    build: (ctx) => {
      const area = px(ctx, 0.5);
      return pieces.map((piece, i) => {
        const cx = (ctx.canvas.width - area) / 2 / ctx.canvas.width + (piece.x * area) / ctx.canvas.width;
        const cy = (ctx.canvas.height - area) / 2 / ctx.canvas.height + (piece.y * area) / ctx.canvas.height;
        const transform = placed(ctx, cx, cy, 0.022, i % 2 ? 0.022 : 0.04);
        const layer = { ...newShapeLayer(i % 3 === 0 ? "ellipse" : "rect", transform), fill: piece.color };
        const start = i * 60;
        const keys: Keyframes = { y: lane(ctx, [[start, cy - px(ctx, 0.25) / ctx.canvas.height, "easeOut"], [start + 900, cy, "bounce"]]), rotation: lane(ctx, [[start, 0, "easeOut"], [start + 900, piece.turn]]), opacity: lane(ctx, [[start, 0], [start + 100, 1]]) };
        return overlay(ctx, layer, transform, keys);
      });
    },
  });
}

interface WordSpec {
  id: string;
  word: LocalizedText;
  name: LocalizedText;
  tags?: Tags;
  style: "pop" | "rise" | "typewriter" | "slide";
  unit: "char" | "word";
  badge?: { path: string; color: string; ratio: number };
  color?: string;
  wobble?: boolean;
  underline?: boolean;
}

function wordSticker(spec: WordSpec): LibraryItem {
  const slot: LibrarySlot = { id: "text", sample: { text: spec.word } };
  const ratio = spec.badge ? spec.badge.ratio : 3;
  return sticker({
    id: spec.id,
    subcategory: "words",
    ratio,
    name: spec.name,
    tags: spec.tags,
    durationMs: 3000,
    slots: [slot],
    markup: spec.badge ? fillMarkup(spec.badge.path, spec.badge.ratio) : wordMarkup(spec.word.pt),
    build: (ctx) => {
      const word = ctx.text(slot);
      const units = Math.max(1, spec.unit === "char" ? [...word].length : word.split(/\s+/).filter(Boolean).length);
      const staggerMs = Math.round(Math.min(spec.unit === "char" ? 60 : 120, (ctx.durationMs * 0.35) / units));
      const width = spec.badge ? 0.6 * Math.min(1, spec.badge.ratio / 2.2) : 0.7;
      const height = spec.badge ? width / spec.badge.ratio : 0.2;
      const box = placed(ctx, 0.5, 0.5, width, height);
      const fontShare = spec.badge ? height * 0.34 : 0.13;
      const textLayer: Layer = {
        ...newTextLayer(word, "heading", box),
        fontSize: px(ctx, fontShare) / ctx.canvas.height,
        fontWeight: 900,
        fill: spec.badge ? WHITE : (spec.color ?? ctx.ink),
        letterSpacing: 0.02,
      };
      const motion = spec.wobble ? wobble(3, 450)(ctx) : null;
      const words = overlay(ctx, textLayer, box, motion?.keys, { textIn: { unit: spec.unit, style: spec.style, durationMs: spec.style === "typewriter" ? 0 : 400, staggerMs, easing: spec.style === "pop" ? "backOut" : "easeOut" }, ...(motion ? { behaviors: motion.behaviors } : {}) });
      const parts: Clip[] = [];
      if (spec.badge) {
        const back = placed(ctx, 0.5, 0.5, width * 1.12, height * 1.12);
        parts.push(overlay(ctx, shapeLayer(spec.badge.path, back, spec.badge.color), back, popIn(ctx, 0, 400)));
      }
      parts.push(words);
      if (spec.underline) {
        const line = placed(ctx, 0.5, 0.5 + px(ctx, 0.11) / ctx.canvas.height, width * 0.9, width * 0.9 / 8);
        parts.push(drawn(ctx, { path: PATHS.underline, color: RED, width: 0.012 }, line, units * staggerMs + 200, units * staggerMs + 700));
      }
      return parts;
    },
  });
}

const RIBBON = VECTOR_PRESETS.ribbon.kind === "path" ? VECTOR_PRESETS.ribbon.data : "M0 0 L1 0 L1 1 L0 1 Z";
const PILL = "M0.12 0 L0.88 0 C1.04 0 1.04 1 0.88 1 L0.12 1 C-0.04 1 -0.04 0 0.12 0 Z";

const WORDS: WordSpec[] = [
  { id: "sticker-word-thanks", word: text("OBRIGADO", "THANK YOU", "GRACIAS", "DANKE"), name: text("Obrigado", "Thank you", "Gracias", "Danke"), tags: { pt: ["agradecimento"], en: ["thanks"], es: ["agradecimiento"], de: ["dank"] }, style: "pop", unit: "char", wobble: true },
  { id: "sticker-word-new", word: text("NOVO", "NEW", "NUEVO", "NEU"), name: text("Novo", "New", "Nuevo", "Neu"), tags: { pt: ["lançamento", "novidade"], en: ["launch"], es: ["novedad"], de: ["neuheit"] }, style: "pop", unit: "char", badge: { path: starPath(16, 0.78), color: RED, ratio: 1 } },
  { id: "sticker-word-sale", word: text("PROMOÇÃO", "SALE", "OFERTA", "ANGEBOT"), name: text("Promoção", "Sale", "Oferta", "Angebot"), tags: { pt: ["desconto", "oferta"], en: ["discount", "deal"], es: ["descuento"], de: ["rabatt"] }, style: "rise", unit: "char", badge: { path: RIBBON, color: RED, ratio: 4 } },
  { id: "sticker-word-deal", word: text("OFERTA", "DEAL", "CHOLLO", "DEAL"), name: text("Oferta", "Deal", "Chollo", "Deal"), tags: { pt: ["promoção", "desconto"], en: ["sale"], es: ["oferta"], de: ["angebot"] }, style: "pop", unit: "char", badge: { path: PILL, color: YELLOW, ratio: 3 } },
  { id: "sticker-word-free", word: text("GRÁTIS", "FREE", "GRATIS", "GRATIS"), name: text("Grátis", "Free", "Gratis", "Gratis"), style: "pop", unit: "char", badge: { path: starPath(12, 0.8), color: GREEN, ratio: 1 } },
  { id: "sticker-word-wow", word: text("UAU!", "WOW!", "¡GUAU!", "WOW!"), name: text("Uau", "Wow", "Guau", "Wow"), tags: { pt: ["surpresa"], en: ["surprise"], es: ["sorpresa"], de: ["überraschung"] }, style: "pop", unit: "char", color: YELLOW, wobble: true },
  { id: "sticker-word-buy", word: text("COMPRE JÁ", "BUY NOW", "COMPRA YA", "JETZT KAUFEN"), name: text("Compre já", "Buy now", "Compra ya", "Jetzt kaufen"), tags: { pt: ["chamada", "comprar"], en: ["call to action", "shop"], es: ["comprar"], de: ["kaufen"] }, style: "typewriter", unit: "char", underline: true },
  { id: "sticker-word-follow", word: text("SIGA", "FOLLOW", "SÍGUENOS", "FOLGEN"), name: text("Siga", "Follow", "Síguenos", "Folgen"), tags: { pt: ["seguir", "redes sociais"], en: ["social"], es: ["redes sociales"], de: ["social media"] }, style: "rise", unit: "char", badge: { path: PILL, color: BLUE, ratio: 3 } },
  { id: "sticker-word-unmissable", word: text("IMPERDÍVEL", "DON'T MISS IT", "IMPERDIBLE", "NICHT VERPASSEN"), name: text("Imperdível", "Don't miss it", "Imperdible", "Nicht verpassen"), style: "slide", unit: "word", color: RED, wobble: true },
  { id: "sticker-word-last", word: text("ÚLTIMAS UNIDADES", "LAST UNITS", "ÚLTIMAS UNIDADES", "LETZTE STÜCKE"), name: text("Últimas unidades", "Last units", "Últimas unidades", "Letzte Stücke"), tags: { pt: ["estoque", "urgência"], en: ["stock", "urgency"], es: ["urgencia"], de: ["dringend"] }, style: "rise", unit: "word", badge: { path: RIBBON, color: PINK, ratio: 4.5 } },
  { id: "sticker-word-launch", word: text("LANÇAMENTO", "JUST LAUNCHED", "LANZAMIENTO", "BRANDNEU"), name: text("Lançamento", "Just launched", "Lanzamiento", "Brandneu"), style: "pop", unit: "char", underline: true },
];

const STICKER_ITEMS: readonly LibraryItem[] = [...DRAWN.map(drawnSticker), ...POPS, confetti(), ...WORDS.map(wordSticker)];

const SUBCATEGORIES: readonly Subcategory[] = ["circles", "underlines", "arrows", "marks", "bursts", "words"];

export const STICKERS_CATEGORY: LibraryCategory = {
  id: "stickers",
  panel: "elements",
  label: { key: "studio.library.categories.stickers" },
  tile: "square",
  notes: { image: { key: "studio.library.notes.stickersImage" } },
  subcategories: SUBCATEGORIES.map((id) => ({ id, label: { key: `studio.library.subcategories.stickers.${id}` } })),
  items: () => STICKER_ITEMS,
};
