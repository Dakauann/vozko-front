import { localizedText as t } from "../model";
import type { EmojiPart } from "../sets/format";
import { circle, num, openCurve, polyline, type Spot } from "./geometry";
import type { DecorSpec } from "./packs";
import { art, filled, stroked } from "./parts";

const FRAME_W = 300;
const FRAME_H = 200;
const TITLE_GAP = 56;
const DIAL = 200;
const CORAL = "#ff7a59";
const MINT = "#2dd4a7";
const SKY = "#4f9dff";

type Corner = readonly [flipX: boolean, flipY: boolean];

const CORNERS: readonly Corner[] = [
  [false, false],
  [true, false],
  [false, true],
  [true, true],
];

function mirrored(corner: Corner, points: readonly Spot[]): Spot[] {
  const [flipX, flipY] = corner;
  return points.map((point) => ({ x: flipX ? FRAME_W - point.x : point.x, y: flipY ? FRAME_H - point.y : point.y }));
}

function eachCorner(draw: (corner: Corner) => string): string {
  return CORNERS.map(draw).join(" ");
}

function gappedBorder(inset: number): string {
  const [left, top, right, bottom] = [inset, inset, FRAME_W - inset, FRAME_H - inset];
  return polyline([
    { x: FRAME_W / 2 + TITLE_GAP, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
    { x: left, y: top },
    { x: FRAME_W / 2 - TITLE_GAP, y: top },
  ]);
}

function gapEnds(draw: (x: number) => string): string {
  return [FRAME_W / 2 - TITLE_GAP, FRAME_W / 2 + TITLE_GAP].map(draw).join(" ");
}

function diamond(cx: number, cy: number, r: number): string {
  return polyline([{ x: cx, y: cy - r }, { x: cx + r, y: cy }, { x: cx, y: cy + r }, { x: cx - r, y: cy }], true);
}

function spiral(cx: number, cy: number, radius: number, turns: number, start: number, direction: 1 | -1): Spot[] {
  const steps = Math.round(turns * 12);
  return Array.from({ length: steps + 1 }, (_, i) => {
    const angle = start + direction * (i / steps) * turns * Math.PI * 2;
    const r = radius * (1 - (i / steps) * 0.82);
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  });
}

function leaf(base: Spot, angle: number, length: number, width: number): string {
  const tip = { x: base.x + Math.cos(angle) * length, y: base.y + Math.sin(angle) * length };
  const mid = { x: (base.x + tip.x) / 2, y: (base.y + tip.y) / 2 };
  const side = { x: -Math.sin(angle) * width, y: Math.cos(angle) * width };
  return `M${num(base.x)} ${num(base.y)} Q${num(mid.x + side.x)} ${num(mid.y + side.y)} ${num(tip.x)} ${num(tip.y)} Q${num(mid.x - side.x)} ${num(mid.y - side.y)} ${num(base.x)} ${num(base.y)} Z`;
}

function decoCorners(ink: string): EmojiPart[] {
  const steps = eachCorner((corner) =>
    [
      polyline(mirrored(corner, [{ x: 18, y: 44 }, { x: 28, y: 44 }, { x: 28, y: 28 }, { x: 44, y: 28 }, { x: 44, y: 18 }])),
      polyline(mirrored(corner, [{ x: 18, y: 60 }, { x: 36, y: 60 }, { x: 36, y: 36 }, { x: 60, y: 36 }, { x: 60, y: 18 }])),
      polyline(mirrored(corner, [{ x: 18, y: 18 }, { x: 28, y: 28 }])),
    ].join(" "),
  );
  const fans = eachCorner((corner) => polyline(mirrored(corner, [{ x: 46, y: 46 }, { x: 52, y: 40 }, { x: 58, y: 46 }, { x: 52, y: 52 }]), true));
  const bars = gapEnds((x) => `${polyline([{ x, y: 2 }, { x, y: 18 }])} ${diamond(x + Math.sign(x - FRAME_W / 2) * 9, 10, 4)}`);
  return [stroked(gappedBorder(10), ink, 2.4), stroked(gappedBorder(18), ink, 1.1), stroked(`${steps} ${bars}`, ink, 1.4), filled(fans, ink)];
}

function fileteSwirls(ink: string): EmojiPart[] {
  const scrolls = eachCorner((corner) => openCurve(mirrored(corner, [{ x: 14, y: 70 }, ...spiral(40, 40, 22, 1.6, Math.PI, 1)])));
  const counter = eachCorner((corner) => openCurve(mirrored(corner, [{ x: 70, y: 14 }, ...spiral(64, 30, 10, 1.2, -Math.PI / 2, -1)])));
  const curls = gapEnds((x) => openCurve(spiral(x + Math.sign(x - FRAME_W / 2) * 10, 14, 9, 1.3, Math.PI / 2, x < FRAME_W / 2 ? 1 : -1)));
  const drops = eachCorner((corner) => leaf(mirrored(corner, [{ x: 30, y: 62 }])[0], corner[1] ? -Math.PI / 2.4 : Math.PI / 2.4, 16, 5));
  return [stroked(gappedBorder(14), ink, 1.6), stroked(`${scrolls} ${counter} ${curls}`, ink, 2), filled(drops, ink)];
}

function doubleLine(ink: string): EmojiPart[] {
  const corners = eachCorner((corner) => polyline(mirrored(corner, [{ x: 16, y: 16 }, { x: 24, y: 16 }, { x: 24, y: 24 }, { x: 16, y: 24 }]), true));
  const ends = gapEnds((x) => diamond(x + Math.sign(x - FRAME_W / 2) * 8, 12, 4.5));
  return [stroked(gappedBorder(8), ink, 2.8), stroked(gappedBorder(16), ink, 1), filled(`${corners} ${ends}`, ink)];
}

function botanical(ink: string): EmojiPart[] {
  const stem = (corner: Corner) => mirrored(corner, [{ x: 14, y: 78 }, { x: 22, y: 40 }, { x: 40, y: 22 }, { x: 78, y: 14 }]);
  const stems = eachCorner((corner) => openCurve(stem(corner)));
  const leaves = eachCorner((corner) => {
    const [flipX, flipY] = corner;
    const along = mirrored(corner, [{ x: 17, y: 60 }, { x: 24, y: 36 }, { x: 36, y: 24 }, { x: 60, y: 17 }]);
    const outward = Math.atan2(flipY ? -1 : 1, flipX ? -1 : 1);
    return along.map((spot, i) => leaf(spot, outward + (i % 2 === 0 ? 0.9 : -0.9), 13, 4.5)).join(" ");
  });
  const buds = gapEnds((x) => leaf({ x, y: 14 }, x < FRAME_W / 2 ? Math.PI * 0.85 : Math.PI * 0.15, 12, 4));
  return [stroked(gappedBorder(14), ink, 1.2), stroked(stems, ink, 1.4), filled(`${leaves} ${buds}`, ink)];
}

function ornament(id: string, name: ReturnType<typeof t>, tags: DecorSpec["tags"], parts: (ink: string) => EmojiPart[]): DecorSpec {
  return { id, subcategory: "ornaments", name, tags, ratio: FRAME_W / FRAME_H, share: 0.7, draw: ({ ink }) => art(FRAME_W, FRAME_H, parts(ink)) };
}

export const ORNAMENT_SPECS: readonly DecorSpec[] = [
  ornament("graphic-ornament-deco", t("Moldura art déco", "Art deco frame", "Marco art déco", "Art-déco-Rahmen"), { pt: ["moldura", "art déco", "título", "elegante"], en: ["frame", "art deco", "title", "elegant"] }, decoCorners),
  ornament("graphic-ornament-filete", t("Moldura de filete", "Filete swirl frame", "Marco de filete", "Filete-Rahmen"), { pt: ["moldura", "filete", "arabesco", "título"], en: ["frame", "swirl", "scroll", "title"] }, fileteSwirls),
  ornament("graphic-ornament-double-line", t("Moldura de linha dupla", "Double line frame", "Marco de línea doble", "Doppellinienrahmen"), { pt: ["moldura", "clássico", "borda", "título"], en: ["frame", "classic", "border", "title"] }, doubleLine),
  ornament("graphic-ornament-botanical", t("Moldura botânica", "Botanical frame", "Marco botánico", "Botanischer Rahmen"), { pt: ["moldura", "folhas", "natural", "título"], en: ["frame", "leaves", "natural", "title"] }, botanical),
];

function point(angle: number, radius: number): Spot {
  return { x: DIAL / 2 + Math.cos(angle) * radius, y: DIAL / 2 + Math.sin(angle) * radius };
}

function arc(from: number, to: number, radius: number): string {
  const start = point(from, radius);
  const end = point(to, radius);
  return `M${num(start.x)} ${num(start.y)} A${num(radius)} ${num(radius)} 0 ${to - from > Math.PI ? 1 : 0} 1 ${num(end.x)} ${num(end.y)}`;
}

function ticks(from: number, to: number, count: number, inner: number, outer: number): Spot[][] {
  return Array.from({ length: count }, (_, i) => {
    const angle = from + ((to - from) * i) / (count - 1);
    return [point(angle, inner), point(angle, outer)];
  });
}

const DEG = Math.PI / 180;

function spendingGauge(ink: string): EmojiPart[] {
  const [from, to] = [150 * DEG, 390 * DEG];
  const value = from + (to - from) * 0.65;
  const marks = ticks(from, to, 11, 58, 66).map((line) => polyline(line)).join(" ");
  return [
    stroked(arc(from, to, 80), ink, 14, 0.18),
    stroked(arc(from, value, 80), CORAL, 14),
    stroked(marks, ink, 2),
    stroked(polyline([point(value + Math.PI, 10), point(value, 62)]), ink, 4),
    filled(circle(DIAL / 2, DIAL / 2, 8), ink),
  ];
}

function progressRing(ink: string): EmojiPart[] {
  const from = -90 * DEG;
  return [stroked(circle(DIAL / 2, DIAL / 2, 76), ink, 16, 0.18), stroked(arc(from, from + 0.72 * Math.PI * 2, 76), MINT, 16), stroked(circle(DIAL / 2, DIAL / 2, 58), ink, 1.5, 0.5)];
}

function radialMeter(ink: string): EmojiPart[] {
  const lines = ticks(135 * DEG, 405 * DEG, 28, 62, 84).map((line) => polyline(line));
  const lit = 18;
  return [stroked(lines.slice(0, lit).join(" "), SKY, 6), stroked(lines.slice(lit).join(" "), ink, 6, 0.22), stroked(circle(DIAL / 2, DIAL / 2, 44), ink, 2), filled(circle(DIAL / 2, DIAL / 2, 6), ink)];
}

function dial(id: string, name: ReturnType<typeof t>, tags: DecorSpec["tags"], parts: (ink: string) => EmojiPart[]): DecorSpec {
  return { id, subcategory: "dials", name, tags, ratio: 1, share: 0.4, draw: ({ ink }) => art(DIAL, DIAL, parts(ink)) };
}

export const DIAL_SPECS: readonly DecorSpec[] = [
  dial("graphic-dial-gauge", t("Medidor de gastos", "Spending gauge", "Indicador de gastos", "Ausgabenanzeige"), { pt: ["medidor", "gastos", "velocímetro", "painel"], en: ["gauge", "spending", "speedometer", "dashboard"] }, spendingGauge),
  dial("graphic-dial-ring", t("Anel de progresso", "Progress ring", "Anillo de progreso", "Fortschrittsring"), { pt: ["progresso", "anel", "meta", "porcentagem"], en: ["progress", "ring", "goal", "percent"] }, progressRing),
  dial("graphic-dial-meter", t("Medidor radial", "Radial meter", "Medidor radial", "Rundinstrument"), { pt: ["medidor", "nível", "radial", "painel"], en: ["meter", "level", "radial", "dashboard"] }, radialMeter),
];
