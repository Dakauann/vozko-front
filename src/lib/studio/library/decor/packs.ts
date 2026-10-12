import type { CanvasSize } from "../../document";
import type { GraphicsSubcategory } from "../builtin/graphics";
import { localizedText as t, type LibraryLocale, type LocalizedText } from "../model";
import type { EmojiArt, EmojiPart } from "../sets/format";
import { DIAL_SPECS, ORNAMENT_SPECS } from "./ornaments";
import { art, filled, stroked } from "./parts";
import { between, blob, blobPoints, chance, circle, closedCurve, curvePoints, jitter, num, openCurve, polyline, radial, rect, sparkle, star, sine, taperedStroke, type Spot } from "./geometry";

export interface DecorPaint {
  ink: string;
  canvas: CanvasSize;
}

export interface DecorSpec {
  id: string;
  subcategory: GraphicsSubcategory;
  name: LocalizedText;
  tags?: Partial<Record<LibraryLocale, readonly string[]>>;
  ratio: number;
  share?: number;
  fills?: "canvas";
  draw: (paint: DecorPaint) => EmojiArt;
}

const CORAL = "#ff7a59";
const SUN = "#ffc83d";
const MINT = "#2dd4a7";
const SKY = "#4f9dff";
const VIOLET = "#8b5cf6";
const PINK = "#ff6fb5";
const WHITE = "#ffffff";
const PARTY = [CORAL, SUN, MINT, SKY, VIOLET, PINK];
const GOLD = ["#f5b301", "#ffd76a", "#c98a00", "#fff1b8"];
const PASTEL = ["#fbcfe8", "#bfdbfe", "#bbf7d0", "#fde68a", "#ddd6fe"];
const BLUES = ["#bfdbfe", "#60a5fa", "#2563eb"];

function grouped(entries: readonly { color: string; path: string }[]): EmojiPart[] {
  const byColor = new Map<string, string[]>();
  for (const entry of entries) byColor.set(entry.color, [...(byColor.get(entry.color) ?? []), entry.path]);
  return [...byColor].map(([color, paths]) => filled(paths.join(" "), color));
}

function curveSegments(points: readonly Spot[]): string {
  return openCurve(points).replace(/^M[^C]*/, "");
}

function arrowHead(tip: Spot, from: Spot, size: number): string {
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x);
  const wing = (turn: number): Spot => ({ x: tip.x - Math.cos(angle + turn) * size, y: tip.y - Math.sin(angle + turn) * size });
  return polyline([wing(0.5), tip, wing(-0.5)]);
}

function wavyBand(width: number, baseline: number, amplitude: number, waves: number, phase: number, bottom: number): string {
  const top = sine(0, width, baseline, amplitude, waves, phase);
  return `${openCurve(top)} L${width} ${bottom} L0 ${bottom} Z`;
}

interface ConfettiStyle {
  seed: number;
  count: number;
  colors: readonly string[];
  shapes: readonly ("rect" | "dot" | "triangle" | "squiggle")[];
}

function confettiPieces(style: ConfettiStyle, place: (index: number) => Spot, size: number, turnOf?: (index: number, spot: Spot) => number): EmojiPart[] {
  const fills: { color: string; path: string }[] = [];
  const strokes: EmojiPart[] = [];
  for (let i = 0; i < style.count; i++) {
    const spot = place(i);
    const color = style.colors[i % style.colors.length];
    const shape = style.shapes[Math.floor(chance(style.seed, 7, i) * style.shapes.length)];
    const turn = turnOf ? turnOf(i, spot) : between(style.seed, 8, i, 0, Math.PI);
    const scale = size * between(style.seed, 9, i, 0.7, 1.25);
    if (shape === "rect") fills.push({ color, path: rect(spot.x, spot.y, scale * 2.2, scale, turn) });
    else if (shape === "dot") fills.push({ color, path: circle(spot.x, spot.y, scale * 0.6) });
    else if (shape === "triangle") fills.push({ color, path: polyline(radial(spot.x, spot.y, 3, () => scale * 0.9, turn), true) });
    else {
      const points = sine(-scale * 1.6, scale * 1.6, 0, scale * 0.45, 1.5).map((p) => ({ x: spot.x + p.x * Math.cos(turn) - p.y * Math.sin(turn), y: spot.y + p.x * Math.sin(turn) + p.y * Math.cos(turn) }));
      strokes.push(stroked(openCurve(points), color, scale * 0.38));
    }
  }
  return [...grouped(fills), ...strokes];
}

function scattered(seed: number, w: number, h: number, margin: number): (index: number) => Spot {
  return (i) => ({ x: between(seed, 10, i, margin, w - margin), y: between(seed, 11, i, margin, h - margin) });
}

function dotsAlong(points: readonly Spot[], radius: (index: number) => number): string {
  return points.map((point, i) => circle(point.x, point.y, radius(i))).join(" ");
}

function halftone(corner: Spot, step: number, cells: number, maxRadius: number, dx: 1 | -1, dy: 1 | -1): string {
  const dots: string[] = [];
  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < cells - i; j++) {
      const r = maxRadius * (1 - (i + j) / cells);
      if (r > maxRadius * 0.12) dots.push(circle(corner.x + dx * (i + 0.5) * step, corner.y + dy * (j + 0.5) * step, r));
    }
  }
  return dots.join(" ");
}

function ellipseLoop(cx: number, cy: number, rx: number, ry: number, from: number, turns: number, seed: number, count = 14): Spot[] {
  return Array.from({ length: count + 1 }, (_, i) => {
    const angle = from + (i / count) * turns * 2 * Math.PI;
    const grow = 1 + (i / count) * 0.06 + between(seed, 12, i, -0.025, 0.025);
    return { x: cx + Math.cos(angle) * rx * grow, y: cy + Math.sin(angle) * ry * grow };
  });
}

function heartPoints(cx: number, cy: number, size: number, seed: number): Spot[] {
  return Array.from({ length: 27 }, (_, i) => {
    const angle = (i / 24) * 2 * Math.PI;
    const x = 16 * Math.sin(angle) ** 3;
    const y = 13 * Math.cos(angle) - 5 * Math.cos(2 * angle) - 2 * Math.cos(3 * angle) - Math.cos(4 * angle);
    return { x: cx + (x / 17) * size + between(seed, 13, i, -0.8, 0.8), y: cy - (y / 17) * size + between(seed, 14, i, -0.8, 0.8) };
  });
}

function spiralPoints(cx: number, cy: number, turns: number, radius: number): Spot[] {
  const count = Math.round(turns * 12);
  return Array.from({ length: count + 1 }, (_, i) => {
    const angle = (i / count) * turns * 2 * Math.PI;
    const r = (i / count) * radius;
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  });
}

function loops(width: number, height: number, count: number): Spot[] {
  const a = width / (count * 2 * Math.PI);
  const b = a * 2.2;
  const steps = count * 16;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const angle = (i / steps) * count * 2 * Math.PI;
    return { x: a * angle - b * Math.sin(angle) + b, y: height / 2 - b * Math.cos(angle) * 0.9 };
  });
}

function canvasFrame(canvas: CanvasSize): { w: number; h: number; s: number } {
  return { w: canvas.width, h: canvas.height, s: Math.min(canvas.width, canvas.height) };
}

const SIDES = [0, 1, 2, 3] as const;

function edgeSpot(seed: number, index: number, w: number, h: number, band: number, side: number): Spot {
  const along = chance(seed, 16, index);
  const depth = between(seed, 17, index, 0.02, band);
  if (side === 0) return { x: along * w, y: depth * h };
  if (side === 1) return { x: w - depth * w, y: along * h };
  if (side === 2) return { x: along * w, y: h - depth * h };
  return { x: depth * w, y: along * h };
}

const BLOBS: DecorSpec[] = [
  { id: "graphic-blob-coral", subcategory: "blobs", name: t("Bolha orgânica", "Organic blob", "Mancha orgánica", "Organischer Klecks"), tags: { pt: ["forma orgânica", "mancha"], en: ["organic shape"] }, ratio: 1, draw: () => art(100, 100, [filled(blob(50, 50, 46, 46, 11), CORAL)]) },
  { id: "graphic-blob-sky", subcategory: "blobs", name: t("Bolha suave", "Soft blob", "Mancha suave", "Weicher Klecks"), tags: { pt: ["forma orgânica"], en: ["organic shape"] }, ratio: 1, draw: () => art(100, 100, [filled(blob(50, 50, 46, 44, 23, 7, 0.26), SKY)]) },
  { id: "graphic-blob-long", subcategory: "blobs", name: t("Bolha alongada", "Long blob", "Mancha alargada", "Länglicher Klecks"), ratio: 1.5, draw: () => art(150, 100, [filled(blob(75, 50, 70, 45, 37), MINT)]) },
  { id: "graphic-blob-duo", subcategory: "blobs", name: t("Bolhas sobrepostas", "Overlapping blobs", "Manchas superpuestas", "Überlappende Kleckse"), ratio: 1, draw: () => art(100, 100, [filled(blob(44, 46, 40, 40, 41), VIOLET), filled(blob(60, 58, 34, 34, 43), PINK, 0.85)]) },
  { id: "graphic-blob-outlined", subcategory: "blobs", name: t("Bolha com contorno", "Outlined blob", "Mancha con contorno", "Klecks mit Kontur"), ratio: 1, draw: ({ ink }) => art(100, 100, [filled(blob(52, 53, 40, 40, 51), SUN), stroked(blob(47, 47, 41, 41, 53), ink, 2.5)]) },
  { id: "graphic-blob-line", subcategory: "blobs", name: t("Contorno orgânico", "Organic outline", "Contorno orgánico", "Organische Kontur"), ratio: 1, draw: ({ ink }) => art(100, 100, [stroked(blob(50, 50, 44, 42, 61, 9), ink, 3)]) },
  {
    id: "graphic-blob-dotted",
    subcategory: "blobs",
    name: t("Bolha com bolinhas", "Dotted blob", "Mancha con puntos", "Gepunkteter Klecks"),
    ratio: 1,
    draw: () => {
      const dots: Spot[] = [];
      for (let x = 22; x <= 78; x += 9) for (let y = 22; y <= 78; y += 9) if (Math.hypot(x - 50, y - 50) < 27) dots.push({ x, y });
      return art(100, 100, [filled(blob(50, 50, 46, 46, 71), CORAL), filled(dotsAlong(dots, () => 1.7), WHITE)]);
    },
  },
  { id: "graphic-blob-trio", subcategory: "blobs", name: t("Trio de bolhas", "Blob trio", "Trío de manchas", "Klecks-Trio"), ratio: 1.3, draw: () => art(130, 100, [filled(blob(40, 55, 34, 34, 81), MINT), filled(blob(96, 34, 24, 24, 83), SKY), filled(blob(98, 80, 16, 16, 85), SUN)]) },
];

const WAVES: DecorSpec[] = [
  { id: "graphic-wave-band", subcategory: "waves", name: t("Onda", "Wave", "Ola", "Welle"), tags: { pt: ["rodapé"], en: ["footer"] }, ratio: 3, share: 0.8, draw: () => art(300, 100, [filled(wavyBand(300, 40, 12, 2, 0, 100), SKY)]) },
  { id: "graphic-wave-layers", subcategory: "waves", name: t("Ondas em camadas", "Layered waves", "Olas en capas", "Wellen in Schichten"), ratio: 3, share: 0.8, draw: () => art(300, 100, BLUES.map((color, i) => filled(wavyBand(300, 28 + i * 22, 9, 1.5 + i * 0.5, i * 1.7, 100), color))) },
  { id: "graphic-wave-line", subcategory: "waves", name: t("Linha ondulada", "Wavy line", "Línea ondulada", "Wellenlinie"), ratio: 4, share: 0.6, draw: ({ ink }) => art(400, 100, [stroked(openCurve(sine(8, 392, 50, 30, 3)), ink, 7)]) },
  { id: "graphic-wave-lines", subcategory: "waves", name: t("Linhas onduladas", "Wavy lines", "Líneas onduladas", "Wellenlinien"), ratio: 4, share: 0.6, draw: ({ ink }) => art(400, 100, [stroked([20, 50, 80].map((y) => openCurve(sine(8, 392, y, 11, 4))).join(" "), ink, 5)]) },
  {
    id: "graphic-wave-zigzag",
    subcategory: "waves",
    name: t("Zigue-zague", "Zigzag", "Zigzag", "Zickzack"),
    ratio: 4,
    share: 0.6,
    draw: ({ ink }) => art(400, 100, [stroked(polyline(Array.from({ length: 13 }, (_, i) => ({ x: 10 + i * 31.67, y: i % 2 === 0 ? 75 : 25 }))), ink, 7)]),
  },
  { id: "graphic-wave-divider", subcategory: "waves", name: t("Divisor ondulado", "Wavy divider", "Divisor ondulado", "Wellentrenner"), tags: { pt: ["cabeçalho", "seção"], en: ["header", "section"] }, ratio: 4, share: 0.8, draw: () => {
      const edge = sine(400, 0, 60, 18, 2.5, 0.6);
      return art(400, 100, [filled(`M0 0 L400 0 L${num(edge[0].x)} ${num(edge[0].y)} ${curveSegments(edge)} Z`, VIOLET)]);
    } },
  { id: "graphic-wave-dotted", subcategory: "waves", name: t("Onda pontilhada", "Dotted wave", "Ola punteada", "Gepunktete Welle"), ratio: 4, share: 0.6, draw: ({ ink }) => art(400, 100, [filled(dotsAlong(sine(12, 388, 50, 28, 2, 0, 9), () => 5), ink)]) },
  { id: "graphic-wave-loops", subcategory: "waves", name: t("Laços", "Loops", "Bucles", "Schleifen"), ratio: 4, share: 0.6, draw: ({ ink }) => art(400, 100, [stroked(openCurve(loops(360, 100, 5).map((p) => ({ x: p.x + 4, y: p.y }))), ink, 5)]) },
];

const CONFETTI: DecorSpec[] = [
  { id: "graphic-confetti-party", subcategory: "confetti", name: t("Confete colorido", "Party confetti", "Confeti de colores", "Buntes Konfetti"), tags: { pt: ["festa", "comemoração"], en: ["party", "celebration"] }, ratio: 1.4, share: 0.6, draw: () => art(140, 100, confettiPieces({ seed: 101, count: 40, colors: PARTY, shapes: ["rect", "dot", "triangle", "squiggle"] }, scattered(101, 140, 100, 6), 3.4)) },
  { id: "graphic-confetti-gold", subcategory: "confetti", name: t("Confete dourado", "Gold confetti", "Confeti dorado", "Goldenes Konfetti"), tags: { pt: ["festa", "luxo"], en: ["party", "luxury"] }, ratio: 1.4, share: 0.6, draw: () => art(140, 100, confettiPieces({ seed: 102, count: 40, colors: GOLD, shapes: ["rect", "dot", "squiggle"] }, scattered(102, 140, 100, 6), 3.4)) },
  { id: "graphic-confetti-pastel", subcategory: "confetti", name: t("Confete pastel", "Pastel confetti", "Confeti pastel", "Pastell-Konfetti"), tags: { pt: ["festa", "chá de bebê"], en: ["party", "baby shower"] }, ratio: 1.4, share: 0.6, draw: () => art(140, 100, confettiPieces({ seed: 103, count: 40, colors: PASTEL, shapes: ["rect", "dot", "triangle"] }, scattered(103, 140, 100, 6), 3.4)) },
  {
    id: "graphic-confetti-streamers",
    subcategory: "confetti",
    name: t("Serpentinas", "Streamers", "Serpentinas", "Luftschlangen"),
    tags: { pt: ["carnaval", "festa"], en: ["carnival", "party"] },
    ratio: 1.4,
    share: 0.6,
    draw: () =>
      art(
        140,
        100,
        PARTY.map((color, i) => {
          const x = 14 + i * 22;
          return stroked(openCurve(Array.from({ length: 9 }, (_, k) => ({ x: x + Math.sin(k * 1.4 + i) * 7, y: 8 + k * 10.5 }))), color, 2.6);
        }),
      ),
  },
  {
    id: "graphic-confetti-burst",
    subcategory: "confetti",
    name: t("Explosão de confete", "Confetti burst", "Explosión de confeti", "Konfettiexplosion"),
    ratio: 1,
    share: 0.5,
    draw: () => {
      const place = (i: number): Spot => {
        const angle = between(104, 18, i, 0, 2 * Math.PI);
        const distance = between(104, 19, i, 14, 47);
        return { x: 50 + Math.cos(angle) * distance, y: 50 + Math.sin(angle) * distance };
      };
      return art(100, 100, confettiPieces({ seed: 104, count: 36, colors: PARTY, shapes: ["rect", "dot", "triangle"] }, place, 2.8, (_, spot) => Math.atan2(spot.y - 50, spot.x - 50)));
    },
  },
  { id: "graphic-confetti-dots", subcategory: "confetti", name: t("Chuva de bolinhas", "Dot shower", "Lluvia de puntos", "Punkteregen"), ratio: 1.4, share: 0.6, draw: () => art(140, 100, confettiPieces({ seed: 105, count: 46, colors: PARTY, shapes: ["dot"] }, scattered(105, 140, 100, 5), 4)) },
];

const SPARKLES: DecorSpec[] = [
  { id: "graphic-sparkle", subcategory: "sparkles", name: t("Brilho", "Sparkle", "Destello", "Funkeln"), tags: { pt: ["estrela", "destaque"], en: ["star", "highlight"] }, ratio: 1, share: 0.25, draw: () => art(100, 100, [filled(sparkle(50, 50, 48, 0.17), SUN)]) },
  { id: "graphic-sparkle-trio", subcategory: "sparkles", name: t("Trio de brilhos", "Sparkle trio", "Trío de destellos", "Funkel-Trio"), tags: { pt: ["estrela", "mágico"], en: ["star", "magic"] }, ratio: 1, share: 0.3, draw: () => art(100, 100, [filled([sparkle(38, 60, 36, 0.17), sparkle(78, 24, 19, 0.2), sparkle(82, 82, 12, 0.2)].join(" "), SUN)]) },
  { id: "graphic-sparkle-ink", subcategory: "sparkles", name: t("Brilho simples", "Simple sparkle", "Destello simple", "Einfaches Funkeln"), ratio: 1, share: 0.2, draw: ({ ink }) => art(100, 100, [filled(sparkle(50, 50, 48, 0.12), ink)]) },
  { id: "graphic-sparkle-outline", subcategory: "sparkles", name: t("Brilho contornado", "Outlined sparkle", "Destello con contorno", "Funkeln mit Kontur"), ratio: 1, share: 0.25, draw: ({ ink }) => art(100, 100, [stroked(sparkle(50, 50, 44, 0.2), ink, 3)]) },
  {
    id: "graphic-sparkle-shine",
    subcategory: "sparkles",
    name: t("Traços de brilho", "Shine marks", "Trazos de brillo", "Glanzstriche"),
    tags: { pt: ["destaque", "ênfase"], en: ["emphasis"] },
    ratio: 1,
    share: 0.2,
    draw: ({ ink }) => art(100, 100, [stroked([-80, -45, -10].map((deg) => {
      const angle = (deg * Math.PI) / 180;
      return polyline([{ x: 18 + Math.cos(angle) * 30, y: 84 + Math.sin(angle) * 30 }, { x: 18 + Math.cos(angle) * 70, y: 84 + Math.sin(angle) * 70 }]);
    }).join(" "), ink, 7)]),
  },
  {
    id: "graphic-sparkle-rays",
    subcategory: "sparkles",
    name: t("Raios de destaque", "Emphasis rays", "Rayos de énfasis", "Betonungsstrahlen"),
    tags: { pt: ["explosão", "atenção"], en: ["burst", "attention"] },
    ratio: 1,
    share: 0.4,
    draw: ({ ink }) => {
      const inner = radial(50, 50, 14, () => 32, 0);
      const outer = radial(50, 50, 14, (i) => (i % 2 === 0 ? 47 : 42), 0);
      return art(100, 100, [stroked(inner.map((from, i) => polyline([from, outer[i]])).join(" "), ink, 3.2)]);
    },
  },
  {
    id: "graphic-sparkle-stars",
    subcategory: "sparkles",
    name: t("Estrelinhas", "Little stars", "Estrellitas", "Sternchen"),
    ratio: 1.4,
    share: 0.5,
    draw: () => {
      const spots = scattered(106, 140, 100, 12);
      const shapes = Array.from({ length: 9 }, (_, i) => {
        const spot = spots(i);
        const size = between(106, 20, i, 5, 11);
        return { color: i % 3 === 0 ? PINK : SUN, path: i % 2 === 0 ? star(spot.x, spot.y, 5, size, size * 0.45) : sparkle(spot.x, spot.y, size, 0.2) };
      });
      return art(140, 100, grouped(shapes));
    },
  },
  {
    id: "graphic-sparkle-twinkle",
    subcategory: "sparkles",
    name: t("Cintilar", "Twinkle", "Centelleo", "Glitzern"),
    ratio: 1,
    share: 0.25,
    draw: ({ ink }) => art(100, 100, [filled([sparkle(40, 56, 34, 0.14), circle(80, 82, 5)].join(" "), ink), stroked(`${polyline([{ x: 78, y: 12 }, { x: 78, y: 36 }])} ${polyline([{ x: 66, y: 24 }, { x: 90, y: 24 }])}`, ink, 4.5)]),
  },
];

function doodle(id: string, name: LocalizedText, ratio: number, draw: (ink: string) => EmojiPart[], tags?: DecorSpec["tags"]): DecorSpec {
  const height = 100;
  const width = Math.round(height * ratio);
  return { id, subcategory: "doodles", name, ratio, share: ratio > 2 ? 0.6 : 0.35, tags: { pt: ["desenho à mão", ...(tags?.pt ?? [])], en: ["hand drawn", ...(tags?.en ?? [])] }, draw: ({ ink }) => art(width, height, draw(ink)) };
}

const DOODLES: DecorSpec[] = [
  doodle("graphic-doodle-underline", t("Sublinhado à mão", "Hand drawn underline", "Subrayado a mano", "Handgezeichnete Unterstreichung"), 5, (ink) => [stroked(openCurve([{ x: 10, y: 58 }, { x: 130, y: 48 }, { x: 260, y: 56 }, { x: 390, y: 46 }, { x: 490, y: 52 }, { x: 460, y: 66 }, { x: 300, y: 64 }, { x: 150, y: 70 }, { x: 40, y: 72 }]), ink, 8)], { pt: ["destaque"], en: ["highlight"] }),
  doodle("graphic-doodle-circle", t("Círculo à mão", "Hand drawn circle", "Círculo a mano", "Handgezeichneter Kreis"), 1.6, (ink) => [stroked(openCurve(ellipseLoop(80, 50, 70, 40, -1.9, 1.1, 201)), ink, 4)], { pt: ["destaque", "marcar"], en: ["highlight", "mark"] }),
  doodle("graphic-doodle-arrow-loop", t("Seta com laço", "Loop arrow", "Flecha con bucle", "Schleifenpfeil"), 1.6, (ink) => {
    const points = [{ x: 8, y: 72 }, { x: 46, y: 80 }, { x: 78, y: 62 }, { x: 74, y: 34 }, { x: 54, y: 32 }, { x: 54, y: 56 }, { x: 88, y: 70 }, { x: 150, y: 44 }];
    return [stroked(`${openCurve(points)} ${arrowHead(points[7], { x: 136, y: 52 }, 16)}`, ink, 4)];
  }),
  doodle("graphic-doodle-arrow-curve", t("Seta curva à mão", "Hand drawn curved arrow", "Flecha curva a mano", "Handgezeichneter Bogenpfeil"), 1.6, (ink) => {
    const points = [{ x: 10, y: 82 }, { x: 46, y: 34 }, { x: 104, y: 22 }, { x: 150, y: 50 }];
    return [stroked(`${openCurve(points)} ${arrowHead(points[3], { x: 136, y: 36 }, 16)}`, ink, 4)];
  }),
  doodle("graphic-doodle-spiral", t("Espiral", "Spiral", "Espiral", "Spirale"), 1, (ink) => [stroked(openCurve(spiralPoints(50, 50, 3.2, 44)), ink, 3.5)]),
  doodle("graphic-doodle-heart", t("Coração à mão", "Hand drawn heart", "Corazón a mano", "Handgezeichnetes Herz"), 1, (ink) => [stroked(openCurve(heartPoints(50, 46, 42, 202)), ink, 4)], { pt: ["amor"], en: ["love"] }),
  doodle("graphic-doodle-star", t("Estrela à mão", "Hand drawn star", "Estrella a mano", "Handgezeichneter Stern"), 1, (ink) => {
    const tips = radial(50, 54, 5, () => 44);
    const order = [0, 2, 4, 1, 3, 0, 2].map((i) => tips[i]);
    return [stroked(polyline(jitter(order, 1.5, 203)), ink, 4)];
  }),
  doodle("graphic-doodle-crown", t("Coroa à mão", "Hand drawn crown", "Corona a mano", "Handgezeichnete Krone"), 1.2, (ink) => [stroked(polyline(jitter([{ x: 14, y: 78 }, { x: 12, y: 30 }, { x: 36, y: 56 }, { x: 60, y: 18 }, { x: 84, y: 56 }, { x: 108, y: 30 }, { x: 106, y: 78 }, { x: 12, y: 80 }], 1.2, 204)), ink, 4)], { pt: ["rei", "rainha", "vip"], en: ["king", "queen", "vip"] }),
  doodle("graphic-doodle-scribble", t("Rabisco", "Scribble", "Garabato", "Gekritzel"), 2, (ink) => [stroked(openCurve(Array.from({ length: 15 }, (_, i) => ({ x: 14 + i * 12.3 + between(205, 21, i, -3, 3), y: i % 2 === 0 ? 76 + between(205, 22, i, -4, 4) : 24 + between(205, 23, i, -4, 4) })), 0.8), ink, 5)]),
  doodle("graphic-doodle-check", t("Visto à mão", "Hand drawn check", "Visto a mano", "Handgezeichneter Haken"), 1, (ink) => [stroked(openCurve([{ x: 14, y: 56 }, { x: 28, y: 66 }, { x: 40, y: 82 }, { x: 62, y: 46 }, { x: 88, y: 16 }], 0.7), ink, 8)], { pt: ["certo", "feito"], en: ["done", "tick"] }),
  doodle("graphic-doodle-cross", t("X à mão", "Hand drawn cross", "Cruz a mano", "Handgezeichnetes Kreuz"), 1, (ink) => [stroked(`${openCurve([{ x: 18, y: 16 }, { x: 52, y: 52 }, { x: 84, y: 86 }])} ${openCurve([{ x: 82, y: 14 }, { x: 50, y: 48 }, { x: 16, y: 84 }])}`, ink, 8)], { pt: ["errado"], en: ["wrong"] }),
  doodle("graphic-doodle-exclaim", t("Marcas de surpresa", "Surprise marks", "Marcas de sorpresa", "Überraschungsstriche"), 1, (ink) => [stroked([[{ x: 26, y: 66 }, { x: 16, y: 22 }], [{ x: 50, y: 60 }, { x: 52, y: 12 }], [{ x: 74, y: 66 }, { x: 86, y: 24 }]].map((line) => polyline(line)).join(" "), ink, 7)], { pt: ["ênfase", "atenção"], en: ["emphasis", "attention"] }),
];

const DOT_FRAMES: DecorSpec[] = [
  { id: "graphic-dots-ring", subcategory: "dotFrames", name: t("Círculo de pontos", "Dotted circle", "Círculo de puntos", "Punktkreis"), ratio: 1, share: 0.5, draw: ({ ink }) => art(100, 100, [filled(dotsAlong(radial(50, 50, 28, () => 44), () => 2.4), ink)]) },
  {
    id: "graphic-dots-square",
    subcategory: "dotFrames",
    name: t("Moldura de pontos", "Dotted frame", "Marco de puntos", "Punktrahmen"),
    ratio: 1,
    share: 0.5,
    draw: ({ ink }) => {
      const dots: Spot[] = [];
      for (let i = 0; i <= 12; i++) dots.push({ x: 6 + i * 7.33, y: 6 }, { x: 6 + i * 7.33, y: 94 });
      for (let i = 1; i < 12; i++) dots.push({ x: 6, y: 6 + i * 7.33 }, { x: 94, y: 6 + i * 7.33 });
      return art(100, 100, [filled(dotsAlong(dots, () => 2.1), ink)]);
    },
  },
  {
    id: "graphic-dots-grid",
    subcategory: "dotFrames",
    name: t("Grade de pontos", "Dot grid", "Cuadrícula de puntos", "Punktraster"),
    ratio: 1,
    share: 0.3,
    draw: ({ ink }) => {
      const dots: Spot[] = [];
      for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) dots.push({ x: 15 + i * 14, y: 15 + j * 14 });
      return art(100, 100, [filled(dotsAlong(dots, () => 3), ink)]);
    },
  },
  { id: "graphic-dots-halftone", subcategory: "dotFrames", name: t("Meio-tom", "Halftone", "Semitono", "Rasterpunkte"), tags: { pt: ["retícula"], en: ["dots"] }, ratio: 1, share: 0.35, draw: ({ ink }) => art(100, 100, [filled(halftone({ x: 0, y: 0 }, 10, 10, 4.4, 1, 1), ink)]) },
  { id: "graphic-dots-arc", subcategory: "dotFrames", name: t("Arco de pontos", "Dot arc", "Arco de puntos", "Punktbogen"), ratio: 2, share: 0.5, draw: ({ ink }) => art(200, 100, [filled(dotsAlong(radial(100, 96, 28, () => 84, Math.PI).filter((p) => p.y <= 96.01), (i) => 2 + i * 0.35), ink)]) },
  { id: "graphic-dots-double-ring", subcategory: "dotFrames", name: t("Anel duplo de pontos", "Double dot ring", "Anillo doble de puntos", "Doppelter Punktring"), ratio: 1, share: 0.5, draw: ({ ink }) => art(100, 100, [filled(`${dotsAlong(radial(50, 50, 32, () => 45), () => 1.8)} ${dotsAlong(radial(50, 50, 22, () => 35, -Math.PI / 2 + Math.PI / 22), () => 1.4)}`, ink)]) },
];

const BRUSHES: DecorSpec[] = [
  { id: "graphic-brush-swash", subcategory: "brushes", name: t("Pincelada", "Brush stroke", "Pincelada", "Pinselstrich"), tags: { pt: ["pincel", "tinta"], en: ["paint"] }, ratio: 4, share: 0.6, draw: ({ ink }) => art(400, 100, [filled(taperedStroke(curvePoints([{ x: 12, y: 62 }, { x: 140, y: 42 }, { x: 280, y: 46 }, { x: 388, y: 34 }]), 52, 2.6, 301), ink)]) },
  {
    id: "graphic-brush-marker",
    subcategory: "brushes",
    name: t("Marca-texto", "Highlighter", "Rotulador", "Textmarker"),
    tags: { pt: ["destaque", "grifo"], en: ["highlight", "marker"] },
    ratio: 4,
    share: 0.6,
    draw: () => {
      const top = Array.from({ length: 9 }, (_, i) => ({ x: 8 + i * 48, y: 22 + between(302, 24, i, -3, 3) }));
      const bottom = Array.from({ length: 9 }, (_, i) => ({ x: 392 - i * 48, y: 78 + between(302, 25, i, -3, 3) }));
      return art(400, 100, [filled(closedCurve([{ x: 2, y: 48 }, ...top, { x: 398, y: 52 }, ...bottom], 0.5), SUN, 0.9)]);
    },
  },
  { id: "graphic-brush-circle", subcategory: "brushes", name: t("Círculo de pincel", "Brush circle", "Círculo de pincel", "Pinselkreis"), ratio: 1.3, share: 0.45, draw: ({ ink }) => art(130, 100, [filled(taperedStroke(ellipseLoop(65, 50, 56, 40, -1.6, 1.05, 303, 20), 11, 1.1, 303, 60), ink)]) },
  { id: "graphic-brush-dab", subcategory: "brushes", name: t("Mancha de tinta", "Paint dab", "Mancha de pintura", "Farbklecks"), ratio: 1, share: 0.35, draw: ({ ink }) => art(100, 100, [filled(closedCurve(blobPoints(50, 50, 44, 40, 304, 22, 0.14)), ink)]) },
  { id: "graphic-brush-double", subcategory: "brushes", name: t("Pincelada dupla", "Double brush stroke", "Pincelada doble", "Doppelter Pinselstrich"), ratio: 3, share: 0.6, draw: ({ ink }) => art(300, 100, [filled(`${taperedStroke(curvePoints([{ x: 10, y: 34 }, { x: 150, y: 24 }, { x: 290, y: 30 }]), 30, 1.8, 305)} ${taperedStroke(curvePoints([{ x: 30, y: 72 }, { x: 160, y: 66 }, { x: 280, y: 74 }]), 24, 1.6, 306)}`, ink)]) },
  {
    id: "graphic-brush-splash",
    subcategory: "brushes",
    name: t("Respingo", "Splash", "Salpicadura", "Spritzer"),
    ratio: 1,
    share: 0.4,
    draw: ({ ink }) => {
      const drops = Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * 2 * Math.PI + between(307, 26, i, -0.2, 0.2);
        const distance = between(307, 27, i, 36, 47);
        return circle(50 + Math.cos(angle) * distance, 50 + Math.sin(angle) * distance, between(307, 28, i, 1.5, 3.6));
      });
      return art(100, 100, [filled([closedCurve(blobPoints(50, 50, 28, 28, 307, 16, 0.3)), ...drops].join(" "), ink)]);
    },
  },
];

function background(id: string, name: LocalizedText, draw: (frame: { w: number; h: number; s: number }, ink: string) => EmojiPart[], tags?: DecorSpec["tags"]): DecorSpec {
  return {
    id,
    subcategory: "backgrounds",
    name,
    ratio: 1,
    fills: "canvas",
    tags: { pt: ["fundo", "cantos", ...(tags?.pt ?? [])], en: ["background", "corners", ...(tags?.en ?? [])] },
    draw: ({ canvas, ink }) => {
      const frame = canvasFrame(canvas);
      return art(frame.w, frame.h, draw(frame, ink));
    },
  };
}

const BACKGROUNDS: DecorSpec[] = [
  background("graphic-bg-corner-blobs", t("Bolhas nos cantos", "Corner blobs", "Manchas en las esquinas", "Kleckse in den Ecken"), ({ w, h, s }) => [
    filled(blob(s * 0.08, s * 0.08, s * 0.3, s * 0.3, 401), CORAL),
    filled(blob(w - s * 0.1, h - s * 0.1, s * 0.33, s * 0.33, 402), SKY),
    filled(blob(w - s * 0.1, s * 0.1, s * 0.07, s * 0.07, 403), SUN),
    filled(blob(s * 0.12, h - s * 0.14, s * 0.05, s * 0.05, 404), MINT),
  ]),
  background("graphic-bg-waves", t("Ondas no rodapé", "Footer waves", "Olas al pie", "Wellen am Fuß"), ({ w, h, s }) => BLUES.map((color, i) => {
    const baseline = h - s * (0.2 - i * 0.055);
    return filled(`${openCurve(sine(0, w, baseline, s * 0.025, 1.5 + i * 0.6, i * 1.3))} L${w} ${h} L0 ${h} Z`, color);
  })),
  background("graphic-bg-memphis", t("Formas geométricas", "Geometric shapes", "Formas geométricas", "Geometrische Formen"), ({ w, h, s }, ink) =>
    SIDES.flatMap((side) => {
      const fills: { color: string; path: string }[] = [];
      const lines: string[] = [];
      for (let k = 0; k < 6; k++) {
        const i = side * 6 + k;
        const spot = edgeSpot(405, i, w, h, 0.14, side);
        const size = s * between(405, 29, i, 0.018, 0.04);
        const kind = i % 4;
        if (kind === 0) fills.push({ color: PARTY[i % PARTY.length], path: circle(spot.x, spot.y, size) });
        else if (kind === 1) fills.push({ color: PARTY[(i + 2) % PARTY.length], path: polyline(radial(spot.x, spot.y, 3, () => size * 1.2, between(405, 30, i, 0, Math.PI)), true) });
        else if (kind === 2) lines.push(openCurve(sine(spot.x - size * 1.5, spot.x + size * 1.5, spot.y, size * 0.4, 1.5)));
        else lines.push(`${polyline([{ x: spot.x - size, y: spot.y }, { x: spot.x + size, y: spot.y }])} ${polyline([{ x: spot.x, y: spot.y - size }, { x: spot.x, y: spot.y + size }])}`);
      }
      return [...grouped(fills), stroked(lines.join(" "), ink, s * 0.008)];
    }), { pt: ["memphis", "anos 80"], en: ["memphis", "80s"] }),
  background("graphic-bg-halftone", t("Meio-tom nos cantos", "Halftone corners", "Semitono en las esquinas", "Rasterecken"), ({ w, h, s }) => [
    filled(halftone({ x: 0, y: 0 }, s * 0.035, 9, s * 0.014, 1, 1), VIOLET),
    filled(halftone({ x: w, y: h }, s * 0.035, 9, s * 0.014, -1, -1), VIOLET),
  ]),
  background("graphic-bg-confetti", t("Confete nas bordas", "Confetti border", "Confeti en los bordes", "Konfettirand"), ({ w, h, s }) => SIDES.flatMap((side) => confettiPieces({ seed: 406 + side, count: 15, colors: PARTY, shapes: ["rect", "dot", "triangle", "squiggle"] }, (i) => edgeSpot(406 + side, i, w, h, 0.12, side), s * 0.012)), { pt: ["festa"], en: ["party"] }),
  background("graphic-bg-arcs", t("Arcos concêntricos", "Concentric arcs", "Arcos concéntricos", "Konzentrische Bögen"), ({ w, h, s }) => [
    stroked([0.12, 0.18, 0.24].map((r) => openCurve(Array.from({ length: 9 }, (_, i) => ({ x: Math.cos((i / 8) * (Math.PI / 2)) * s * r, y: h - Math.sin((i / 8) * (Math.PI / 2)) * s * r })))).join(" "), CORAL, s * 0.014),
    stroked([0.12, 0.18, 0.24].map((r) => openCurve(Array.from({ length: 9 }, (_, i) => ({ x: w - Math.cos((i / 8) * (Math.PI / 2)) * s * r, y: Math.sin((i / 8) * (Math.PI / 2)) * s * r })))).join(" "), SKY, s * 0.014),
  ]),
  background("graphic-bg-stripes", t("Faixas diagonais", "Diagonal stripes", "Franjas diagonales", "Diagonale Streifen"), ({ w, h, s }) => {
    const corner = (x: number, y: number, dx: 1 | -1, dy: 1 | -1) => Array.from({ length: 6 }, (_, i) => {
      const reach = s * (0.08 + i * 0.045);
      return polyline([{ x: x + dx * reach, y }, { x, y: y + dy * reach }]);
    }).join(" ");
    return [stroked(corner(w, 0, -1, 1), MINT, s * 0.012), stroked(corner(0, h, 1, -1), PINK, s * 0.012)];
  }),
];

export const DECOR_SPECS: readonly DecorSpec[] = [...BLOBS, ...WAVES, ...CONFETTI, ...SPARKLES, ...DOODLES, ...DOT_FRAMES, ...BRUSHES, ...BACKGROUNDS, ...ORNAMENT_SPECS, ...DIAL_SPECS];
