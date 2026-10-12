import { newPathLayer, newShapeLayer, newStudioId, type CanvasSize, type Layer, type Transform } from "../../document";
import { scalePath } from "../../vector-path";
import { VECTOR_PRESETS } from "../../vector-presets";
import { frameSlotLayer, type FrameShape } from "../frame-shapes";
import { OWN_SOURCE, type LibraryCategory, type LibraryContext, type LibraryItem, type LibraryLayers, type LocalizedText } from "../model";
import { previewSvg } from "../preview";

type Subcategory = "basic" | "organic" | "photo";

const VIEW = 40;
const ROOM = 30;
const SHARE = 0.5;

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function polygon(points: readonly [number, number][]): string {
  return `${points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${round(x)} ${round(y)}`).join(" ")} Z`;
}

function polar(count: number, radius: (angle: number) => number, turn = -Math.PI / 2): [number, number][] {
  return Array.from({ length: count }, (_, i) => {
    const angle = turn + (i * 2 * Math.PI) / count;
    const r = radius(angle - turn);
    return [0.5 + Math.cos(angle) * r, 0.5 + Math.sin(angle) * r];
  });
}

const SMOOTH = 144;

const SHAPES = {
  hexagon: polygon(polar(6, () => 0.5, 0)),
  star: polygon(polar(10, (angle) => (Math.round(angle / (Math.PI / 5)) % 2 === 0 ? 0.5 : 0.24))),
  scallop: polygon(polar(SMOOTH, (angle) => 0.46 + 0.04 * Math.cos(16 * angle))),
  flower: polygon(polar(SMOOTH, (angle) => 0.36 + 0.14 * Math.abs(Math.cos(3 * angle)))),
  diamond: "M0.5 0 L1 0.5 L0.5 1 L0 0.5 Z",
  triangle: "M0.5 0 L1 1 L0 1 Z",
  wave: "M0.5 0.02 C0.7 0.02 0.78 0.14 0.9 0.24 C1 0.34 0.98 0.52 0.94 0.66 C0.9 0.84 0.74 0.98 0.52 0.98 C0.32 0.98 0.14 0.9 0.06 0.72 C0 0.56 0.04 0.42 0.12 0.3 C0.22 0.12 0.32 0.02 0.5 0.02 Z",
  pebble: "M0.42 0.04 C0.66 0 0.92 0.12 0.97 0.4 C1 0.64 0.88 0.9 0.6 0.96 C0.34 1 0.08 0.9 0.03 0.62 C0 0.38 0.14 0.08 0.42 0.04 Z",
} as const;

function presetPath(id: "arch" | "heart" | "blob" | "speechBubble"): string {
  const preset = VECTOR_PRESETS[id];
  if (preset.kind !== "path") throw new Error(`${id} is not a path preset`);
  return preset.data;
}

function text(pt: string, en: string, es: string, de: string): LocalizedText {
  return { pt, en, es, de };
}

function svg(body: string): string {
  return previewSvg(body, VIEW);
}

function fitted(ratio: number): { width: number; height: number; x: number; y: number } {
  const width = ratio >= 1 ? ROOM : ROOM * ratio;
  const height = ratio >= 1 ? ROOM / ratio : ROOM;
  return { width, height, x: (VIEW - width) / 2, y: (VIEW - height) / 2 };
}

export function frameMarkup(shape: FrameShape, ratio: number): string {
  const { width, height, x, y } = fitted(ratio);
  if (shape.kind === "ellipse") return svg(`<ellipse cx="20" cy="20" rx="${round(width / 2)}" ry="${round(height / 2)}" fill="currentColor"/>`);
  if (shape.kind === "rect") return svg(`<rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(height)}" rx="${round((shape.radius * Math.min(width, height)) / 2)}" fill="currentColor"/>`);
  return svg(`<g transform="translate(${round(x)} ${round(y)})"><path d="${scalePath(shape.path, width, height)}" fill="currentColor"/></g>`);
}

interface PlainFrame {
  id: string;
  subcategory: Subcategory;
  ratio: number;
  shape: FrameShape;
  name: LocalizedText;
  tags: Partial<Record<"pt" | "en" | "es" | "de", string[]>>;
}

const PLAIN_FRAMES: PlainFrame[] = [
  { id: "frame-circle", subcategory: "basic", ratio: 1, shape: { kind: "ellipse" }, name: text("Círculo", "Circle", "Círculo", "Kreis"), tags: { pt: ["redondo", "foto de perfil"], en: ["round", "avatar"], es: ["redondo"], de: ["rund"] } },
  { id: "frame-oval", subcategory: "basic", ratio: 0.8, shape: { kind: "ellipse" }, name: text("Oval", "Oval", "Óvalo", "Oval"), tags: { pt: ["retrato"], en: ["portrait"], es: ["retrato"], de: ["porträt"] } },
  { id: "frame-square", subcategory: "basic", ratio: 1, shape: { kind: "rect", radius: 0 }, name: text("Quadrado", "Square", "Cuadrado", "Quadrat"), tags: {} },
  { id: "frame-rounded", subcategory: "basic", ratio: 1, shape: { kind: "rect", radius: 0.2 }, name: text("Quadrado arredondado", "Rounded square", "Cuadrado redondeado", "Abgerundetes Quadrat"), tags: { pt: ["cantos"], en: ["corners"], es: ["esquinas"], de: ["ecken"] } },
  { id: "frame-portrait", subcategory: "basic", ratio: 0.8, shape: { kind: "rect", radius: 0.12 }, name: text("Retrato", "Portrait", "Vertical", "Hochformat"), tags: { pt: ["vertical"], en: ["vertical"], es: ["retrato"], de: ["vertikal"] } },
  { id: "frame-landscape", subcategory: "basic", ratio: 1.5, shape: { kind: "rect", radius: 0.12 }, name: text("Paisagem", "Landscape", "Horizontal", "Querformat"), tags: { pt: ["horizontal"], en: ["horizontal"], es: ["paisaje"], de: ["horizontal"] } },
  { id: "frame-pill", subcategory: "basic", ratio: 2, shape: { kind: "rect", radius: 1 }, name: text("Pílula", "Pill", "Píldora", "Pille"), tags: { pt: ["cápsula"], en: ["capsule"], es: ["cápsula"], de: ["kapsel"] } },
  { id: "frame-arch", subcategory: "basic", ratio: 0.8, shape: { kind: "path", path: presetPath("arch") }, name: text("Arco", "Arch", "Arco", "Bogen"), tags: { pt: ["janela"], en: ["window"], es: ["ventana"], de: ["fenster"] } },
  { id: "frame-hexagon", subcategory: "basic", ratio: 1, shape: { kind: "path", path: SHAPES.hexagon }, name: text("Hexágono", "Hexagon", "Hexágono", "Sechseck"), tags: {} },
  { id: "frame-diamond", subcategory: "basic", ratio: 1, shape: { kind: "path", path: SHAPES.diamond }, name: text("Losango", "Diamond", "Rombo", "Raute"), tags: {} },
  { id: "frame-triangle", subcategory: "basic", ratio: 1, shape: { kind: "path", path: SHAPES.triangle }, name: text("Triângulo", "Triangle", "Triángulo", "Dreieck"), tags: {} },
  { id: "frame-heart", subcategory: "organic", ratio: 1, shape: { kind: "path", path: presetPath("heart") }, name: text("Coração", "Heart", "Corazón", "Herz"), tags: { pt: ["amor"], en: ["love"], es: ["amor"], de: ["liebe"] } },
  { id: "frame-star", subcategory: "organic", ratio: 1, shape: { kind: "path", path: SHAPES.star }, name: text("Estrela", "Star", "Estrella", "Stern"), tags: {} },
  { id: "frame-blob", subcategory: "organic", ratio: 1, shape: { kind: "path", path: presetPath("blob") }, name: text("Bolha", "Blob", "Mancha", "Klecks"), tags: { pt: ["orgânico"], en: ["organic"], es: ["orgánico"], de: ["organisch"] } },
  { id: "frame-blob-wave", subcategory: "organic", ratio: 1, shape: { kind: "path", path: SHAPES.wave }, name: text("Bolha suave", "Soft blob", "Mancha suave", "Weicher Klecks"), tags: { pt: ["orgânico"], en: ["organic"], es: ["orgánico"], de: ["organisch"] } },
  { id: "frame-pebble", subcategory: "organic", ratio: 1, shape: { kind: "path", path: SHAPES.pebble }, name: text("Seixo", "Pebble", "Guijarro", "Kiesel"), tags: { pt: ["pedra", "orgânico"], en: ["stone", "organic"], es: ["piedra"], de: ["stein"] } },
  { id: "frame-scallop", subcategory: "organic", ratio: 1, shape: { kind: "path", path: SHAPES.scallop }, name: text("Selo ondulado", "Scalloped", "Ondulado", "Gewellt"), tags: { pt: ["selo"], en: ["badge"], es: ["sello"], de: ["siegel"] } },
  { id: "frame-flower", subcategory: "organic", ratio: 1, shape: { kind: "path", path: SHAPES.flower }, name: text("Flor", "Flower", "Flor", "Blume"), tags: {} },
  { id: "frame-speech", subcategory: "organic", ratio: VECTOR_PRESETS.speechBubble.ratio, shape: { kind: "path", path: presetPath("speechBubble") }, name: text("Balão", "Speech bubble", "Bocadillo", "Sprechblase"), tags: { pt: ["fala"], en: ["chat"], es: ["diálogo"], de: ["chat"] } },
];

function plainItem(frame: PlainFrame): LibraryItem {
  return {
    id: frame.id,
    category: "frames",
    subcategory: frame.subcategory,
    editors: ["image", "video"],
    ratio: frame.ratio,
    label: { text: frame.name },
    tags: frame.tags,
    preview: { kind: "svg", markup: frameMarkup(frame.shape, frame.ratio) },
    source: OWN_SOURCE,
    template: { kind: "frame", shape: frame.shape },
  };
}

interface Px {
  canvas: CanvasSize;
  side: number;
}

function pxOf(ctx: LibraryContext): Px {
  return { canvas: ctx.canvas, side: Math.min(ctx.canvas.width, ctx.canvas.height) };
}

function box(px: Px, cx: number, cy: number, width: number, height: number, rotation = 0): Transform {
  return { x: cx / px.canvas.width, y: cy / px.canvas.height, w: width / px.canvas.width, h: height / px.canvas.height, rotation, opacity: 1 };
}

interface Card {
  width: number;
  height: number;
  cx: number;
  cy: number;
}

function card(px: Px, ratio: number): Card {
  const width = ratio >= 1 ? px.side * SHARE : px.side * SHARE * ratio;
  const height = width / ratio;
  return { width, height, cx: px.canvas.width / 2, cy: px.canvas.height / 2 };
}

function scaffold(layers: Layer[]): LibraryLayers {
  const group = { id: newStudioId("g"), baseId: layers[0].id };
  return { layers: layers.map((layer) => ({ ...layer, groupId: group.id })), groups: [group] };
}

function polaroid(rotation: number) {
  return (ctx: LibraryContext): LibraryLayers => {
    const px = pxOf(ctx);
    const c = card(px, 0.82);
    const margin = c.width * 0.06;
    const slotHeight = c.height - margin - c.height * 0.2;
    const radians = (rotation * Math.PI) / 180;
    const dy = margin + slotHeight / 2 - c.height / 2;
    const base: Layer = { ...newShapeLayer("rect", box(px, c.cx, c.cy, c.width, c.height, rotation)), fill: "#ffffff", shadow: { color: "#00000040", blur: px.side * 0.025, x: 0, y: px.side * 0.008 } };
    const slot = frameSlotLayer({ kind: "rect", radius: 0 }, box(px, c.cx - Math.sin(radians) * dy, c.cy + Math.cos(radians) * dy, c.width - 2 * margin, slotHeight, rotation));
    return scaffold([base, slot]);
  };
}

function stamp(ctx: LibraryContext): LibraryLayers {
  const px = pxOf(ctx);
  const c = card(px, 0.8);
  const teeth = 18;
  const edge = (i: number, of: number) => i / of;
  const top = Array.from({ length: teeth + 1 }, (_, i) => `L${round(edge(i, teeth))} ${i % 2 === 0 ? 0 : 0.02}`).join(" ");
  const right = Array.from({ length: teeth + 1 }, (_, i) => `L${i % 2 === 0 ? 1 : 0.98} ${round(edge(i, teeth))}`).join(" ");
  const bottom = Array.from({ length: teeth + 1 }, (_, i) => `L${round(1 - edge(i, teeth))} ${i % 2 === 0 ? 1 : 0.98}`).join(" ");
  const left = Array.from({ length: teeth + 1 }, (_, i) => `L${i % 2 === 0 ? 0 : 0.02} ${round(1 - edge(i, teeth))}`).join(" ");
  const paper: Layer = { ...newPathLayer(`M0 0 ${top} ${right} ${bottom} ${left} Z`, box(px, c.cx, c.cy, c.width, c.height)), fill: "#ffffff", shadow: { color: "#00000033", blur: px.side * 0.02, x: 0, y: px.side * 0.006 } };
  const slot = frameSlotLayer({ kind: "rect", radius: 0 }, box(px, c.cx, c.cy, c.width * 0.84, c.height * 0.86));
  return scaffold([paper, slot]);
}

interface DecoratedFrame {
  id: string;
  subcategory: Subcategory;
  ratio: number;
  name: LocalizedText;
  tags: Partial<Record<"pt" | "en" | "es" | "de", string[]>>;
  markup: string;
  build: (ctx: LibraryContext) => LibraryLayers;
}

const DECORATED_FRAMES: DecoratedFrame[] = [
  {
    id: "frame-polaroid",
    subcategory: "photo",
    ratio: 0.82,
    name: text("Polaroide", "Polaroid", "Polaroid", "Polaroid"),
    tags: { pt: ["foto instantânea", "retrô"], en: ["instant photo", "retro"], es: ["foto instantánea"], de: ["sofortbild"] },
    markup: svg(`<path fill-rule="evenodd" fill="currentColor" d="M8 4h24a1 1 0 0 1 1 1v30a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm2.5 3v20h19V7Z"/>`),
    build: polaroid(0),
  },
  {
    id: "frame-polaroid-tilted",
    subcategory: "photo",
    ratio: 0.82,
    name: text("Polaroide inclinada", "Tilted polaroid", "Polaroid inclinada", "Schräges Polaroid"),
    tags: { pt: ["foto instantânea", "retrô"], en: ["instant photo", "retro"], es: ["foto instantánea"], de: ["sofortbild"] },
    markup: svg(`<g transform="rotate(-8 20 20)"><path fill-rule="evenodd" fill="currentColor" d="M8 4h24a1 1 0 0 1 1 1v30a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm2.5 3v20h19V7Z"/></g>`),
    build: polaroid(-6),
  },
  {
    id: "frame-stamp",
    subcategory: "photo",
    ratio: 0.8,
    name: text("Selo postal", "Postage stamp", "Sello postal", "Briefmarke"),
    tags: { pt: ["carta"], en: ["mail"], es: ["correo"], de: ["post"] },
    markup: svg(`<path fill-rule="evenodd" fill="currentColor" d="M8 5h3l1 1 1-1h3l1 1 1-1h3l1 1 1-1h3l1 1 1-1h3v3l-1 1 1 1v3l-1 1 1 1v3l-1 1 1 1v3l-1 1 1 1v3l-1 1 1 1v3h-3l-1-1-1 1h-3l-1-1-1 1h-3l-1-1-1 1h-3l-1-1-1 1H8v-3l1-1-1-1v-3l1-1-1-1v-3l1-1-1-1v-3l1-1-1-1v-3l1-1-1-1Zm3 3v24h18V8Z"/>`),
    build: stamp,
  },
];

function decoratedItem(frame: DecoratedFrame): LibraryItem {
  return {
    id: frame.id,
    category: "frames",
    subcategory: frame.subcategory,
    editors: ["image"],
    ratio: frame.ratio,
    label: { text: frame.name },
    tags: frame.tags,
    preview: { kind: "svg", markup: frame.markup },
    source: OWN_SOURCE,
    template: { kind: "layers", build: frame.build },
  };
}

const FRAME_ITEMS: readonly LibraryItem[] = [...PLAIN_FRAMES.map(plainItem), ...DECORATED_FRAMES.map(decoratedItem)];

const SUBCATEGORIES: readonly Subcategory[] = ["basic", "organic", "photo"];

export const FRAMES_CATEGORY: LibraryCategory = {
  id: "frames",
  panel: "elements",
  label: { key: "studio.library.categories.frames" },
  tile: "square",
  notes: { image: { key: "studio.library.notes.framesImage" }, video: { key: "studio.library.notes.framesVideo" } },
  subcategories: SUBCATEGORIES.map((id) => ({ id, label: { key: `studio.library.subcategories.frames.${id}` } })),
  items: () => FRAME_ITEMS,
};
