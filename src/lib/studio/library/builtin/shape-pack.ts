import type { Layer, LineEndKind } from "../../document";
import { DASH_PRESETS } from "../../stroke-presets";
import type { VectorPreset } from "../../vector-presets";
import { localizedText as t, type LocalizedText } from "../model";

export type ShapeSubcategory = "lines" | "basic" | "polygons" | "stars" | "arrows" | "flowchart" | "bubbles" | "banners";

export const SHAPE_SUBCATEGORIES: readonly ShapeSubcategory[] = ["lines", "basic", "polygons", "stars", "arrows", "flowchart", "bubbles", "banners"];

export interface LineEnds {
  start?: LineEndKind;
  end?: LineEndKind;
}

export type PackShape =
  | VectorPreset
  | { kind: "polygon"; points: number; ratio: number }
  | { kind: "rect"; radius: number; ratio: number }
  | { kind: "ellipse"; ratio: number }
  | { kind: "line"; ends?: LineEnds; dash?: readonly number[]; cap?: Layer["lineCap"] };

export interface PackItem {
  id: string;
  subcategory: ShapeSubcategory;
  name: LocalizedText;
  shape: PackShape;
  evenOdd?: boolean;
  ends?: LineEnds;
  tags?: { pt?: readonly string[]; en?: readonly string[] };
}

type Point = readonly [number, number];

function polygon(points: readonly Point[]): string {
  return `${points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ")} Z`;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function turned(points: readonly Point[], map: (point: Point) => Point): Point[] {
  return points.map((point) => map(point).map(round) as unknown as Point);
}

function starPoints(count: number, inner: number, cx: number, cy: number, rx: number, ry: number): Point[] {
  return Array.from({ length: count * 2 }, (_, i) => {
    const radius = i % 2 === 0 ? 1 : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / count;
    return [round(cx + Math.cos(angle) * rx * radius), round(cy + Math.sin(angle) * ry * radius)] as const;
  });
}

const RIGHT: Point[] = [[0, 0.3], [0.6, 0.3], [0.6, 0], [1, 0.5], [0.6, 1], [0.6, 0.7], [0, 0.7]];
const BOTH_WAYS: Point[] = [[0, 0.5], [0.3, 0], [0.3, 0.3], [0.7, 0.3], [0.7, 0], [1, 0.5], [0.7, 1], [0.7, 0.7], [0.3, 0.7], [0.3, 1]];
const FOUR_WAYS: Point[] = [
  [0.5, 0], [0.66, 0.2], [0.58, 0.2], [0.58, 0.42], [0.8, 0.42], [0.8, 0.34], [1, 0.5], [0.8, 0.66], [0.8, 0.58], [0.58, 0.58], [0.58, 0.8], [0.66, 0.8],
  [0.5, 1], [0.34, 0.8], [0.42, 0.8], [0.42, 0.58], [0.2, 0.58], [0.2, 0.66], [0, 0.5], [0.2, 0.34], [0.2, 0.42], [0.42, 0.42], [0.42, 0.2], [0.34, 0.2],
];
const SHOUT: Point[] = [
  [0.5, 0], [0.6, 0.14], [0.78, 0.05], [0.78, 0.22], [0.98, 0.2], [0.88, 0.36], [1, 0.5], [0.86, 0.6], [0.95, 0.78], [0.75, 0.74], [0.7, 0.92], [0.56, 0.78],
  [0.42, 0.95], [0.38, 0.76], [0.15, 1], [0.24, 0.7], [0.04, 0.7], [0.14, 0.55], [0, 0.42], [0.15, 0.34], [0.06, 0.16], [0.25, 0.18], [0.28, 0.02], [0.42, 0.14],
];

const up = ([x, y]: Point): Point => [y, 1 - x];
const down = ([x, y]: Point): Point => [1 - y, x];
const left = ([x, y]: Point): Point => [1 - x, y];
const circle = (cx: number, cy: number, r: number) => `M${round(cx - r)} ${cy} A${r} ${r} 0 1 0 ${round(cx + r)} ${cy} A${r} ${r} 0 1 0 ${round(cx - r)} ${cy} Z`;

const path = (data: string, ratio: number, open?: boolean): VectorPreset => ({ kind: "path", data, ratio, ...(open ? { open } : {}) });
const line = (ends?: LineEnds, dash?: readonly number[], cap?: Layer["lineCap"]): PackShape => ({ kind: "line", ...(ends ? { ends } : {}), ...(dash ? { dash } : {}), ...(cap ? { cap } : {}) });

export const SHAPE_PACK: readonly PackItem[] = [
  { id: "shape-line-dashed", subcategory: "lines", name: t("Linha tracejada", "Dashed line", "Línea discontinua", "Gestrichelte Linie"), shape: line(undefined, DASH_PRESETS.dashed) },
  { id: "shape-line-dotted", subcategory: "lines", name: t("Linha pontilhada", "Dotted line", "Línea punteada", "Gepunktete Linie"), shape: line(undefined, DASH_PRESETS.dotted, "round") },
  { id: "shape-line-dash-dot", subcategory: "lines", name: t("Linha traço e ponto", "Dash dot line", "Línea de raya y punto", "Strichpunktlinie"), shape: line(undefined, DASH_PRESETS.dashDot) },
  { id: "shape-line-round", subcategory: "lines", name: t("Linha arredondada", "Rounded line", "Línea redondeada", "Abgerundete Linie"), shape: line({ start: "round", end: "round" }) },
  { id: "shape-arrow-dashed", subcategory: "lines", name: t("Seta tracejada", "Dashed arrow", "Flecha discontinua", "Gestrichelter Pfeil"), shape: line({ end: "arrow" }, DASH_PRESETS.dashed) },
  { id: "shape-arrow-dotted", subcategory: "lines", name: t("Seta pontilhada", "Dotted arrow", "Flecha punteada", "Gepunkteter Pfeil"), shape: line({ end: "arrow" }, DASH_PRESETS.dotted, "round") },
  { id: "shape-arrow-open", subcategory: "lines", name: t("Seta aberta", "Open arrow", "Flecha abierta", "Offener Pfeil"), shape: line({ end: "openArrow" }, undefined, "round") },
  { id: "shape-arrow-open-double", subcategory: "lines", name: t("Seta aberta dupla", "Double open arrow", "Flecha abierta doble", "Offener Doppelpfeil"), shape: line({ start: "openArrow", end: "openArrow" }, undefined, "round") },
  { id: "shape-line-dots", subcategory: "lines", name: t("Linha com bolinhas", "Line with dots", "Línea con puntos", "Linie mit Punkten"), shape: line({ start: "dot", end: "dot" }) },
  { id: "shape-arrow-dot", subcategory: "lines", name: t("Seta com bolinha", "Arrow with a dot", "Flecha con punto", "Pfeil mit Punkt"), shape: line({ start: "dot", end: "arrow" }) },
  { id: "shape-line-bars", subcategory: "lines", name: t("Linha de medida", "Measure line", "Línea de medida", "Maßlinie"), shape: line({ start: "bar", end: "bar" }), tags: { pt: ["cota", "dimensão"], en: ["dimension"] } },
  { id: "shape-line-squares", subcategory: "lines", name: t("Linha com quadrados", "Line with squares", "Línea con cuadrados", "Linie mit Quadraten"), shape: line({ start: "square", end: "square" }) },
  { id: "shape-arrow-diamond", subcategory: "lines", name: t("Seta com losango", "Arrow with a diamond", "Flecha con rombo", "Pfeil mit Raute"), shape: line({ start: "diamond", end: "arrow" }) },
  { id: "shape-connector-elbow", subcategory: "lines", name: t("Conector em cotovelo", "Elbow connector", "Conector en codo", "Winkelverbinder"), shape: path("M0 0.05 L0.5 0.05 L0.5 0.95 L1 0.95", 1.5, true), ends: { end: "arrow" }, tags: { pt: ["fluxograma"], en: ["flowchart"] } },
  { id: "shape-arrow-curved", subcategory: "lines", name: t("Seta curva", "Curved arrow", "Flecha curva", "Gebogener Pfeil"), shape: path("M0 0.9 C0.3 0.05 0.7 0.05 1 0.6", 2, true), ends: { end: "arrow" } },

  { id: "shape-right-triangle", subcategory: "basic", name: t("Triângulo retângulo", "Right triangle", "Triángulo rectángulo", "Rechtwinkliges Dreieck"), shape: path("M0 0 L0 1 L1 1 Z", 1) },
  { id: "shape-semicircle", subcategory: "basic", name: t("Semicírculo", "Semicircle", "Semicírculo", "Halbkreis"), shape: path("M0 1 A0.5 1 0 0 1 1 1 Z", 2) },
  { id: "shape-quarter-circle", subcategory: "basic", name: t("Quarto de círculo", "Quarter circle", "Cuarto de círculo", "Viertelkreis"), shape: path("M0 0 A1 1 0 0 1 1 1 L0 1 Z", 1) },
  { id: "shape-rhombus", subcategory: "basic", name: t("Losango", "Diamond", "Rombo", "Raute"), shape: path(polygon([[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]]), 1) },
  { id: "shape-parallelogram", subcategory: "basic", name: t("Paralelogramo", "Parallelogram", "Paralelogramo", "Parallelogramm"), shape: path(polygon([[0.25, 0], [1, 0], [0.75, 1], [0, 1]]), 1.6) },
  { id: "shape-trapezoid", subcategory: "basic", name: t("Trapézio", "Trapezoid", "Trapecio", "Trapez"), shape: path(polygon([[0.2, 0], [0.8, 0], [1, 1], [0, 1]]), 1.5) },
  { id: "shape-cross", subcategory: "basic", name: t("Cruz", "Cross", "Cruz", "Kreuz"), shape: path("M0.35 0 H0.65 V0.35 H1 V0.65 H0.65 V1 H0.35 V0.65 H0 V0.35 H0.35 Z", 1), tags: { pt: ["mais", "soma"], en: ["plus"] } },
  { id: "shape-ring", subcategory: "basic", name: t("Anel", "Ring", "Anillo", "Ring"), shape: path(`${circle(0.5, 0.5, 0.5)} ${circle(0.5, 0.5, 0.3)}`, 1), evenOdd: true, tags: { pt: ["rosca", "círculo vazado"], en: ["donut"] } },
  { id: "shape-square-frame", subcategory: "basic", name: t("Quadro vazado", "Square frame", "Marco cuadrado", "Quadratischer Rahmen"), shape: path("M0 0 H1 V1 H0 Z M0.12 0.12 V0.88 H0.88 V0.12 Z", 1), tags: { pt: ["borda", "moldura"], en: ["border"] } },
  { id: "shape-pill", subcategory: "basic", name: t("Pílula", "Pill", "Píldora", "Pille"), shape: { kind: "rect", radius: 1, ratio: 2.2 }, tags: { pt: ["botão", "cápsula"], en: ["button", "capsule"] } },
  { id: "shape-oval", subcategory: "basic", name: t("Oval", "Oval", "Óvalo", "Oval"), shape: { kind: "ellipse", ratio: 1.5 } },
  { id: "shape-cloud", subcategory: "basic", name: t("Nuvem", "Cloud", "Nube", "Wolke"), shape: path("M0.24 0.92 C0.08 0.92 0 0.8 0 0.68 C0 0.54 0.11 0.44 0.24 0.45 C0.25 0.24 0.4 0.1 0.58 0.1 C0.76 0.1 0.88 0.24 0.9 0.4 C0.97 0.44 1 0.52 1 0.64 C1 0.8 0.9 0.92 0.76 0.92 Z", 1.5) },
  { id: "shape-crescent", subcategory: "basic", name: t("Lua crescente", "Crescent moon", "Luna creciente", "Mondsichel"), shape: path("M0.62 0.02 C0.3 0.06 0.06 0.32 0.06 0.62 C0.06 0.84 0.24 1 0.5 1 C0.74 1 0.92 0.88 1 0.72 C0.9 0.76 0.8 0.78 0.7 0.78 C0.48 0.78 0.32 0.6 0.32 0.4 C0.32 0.24 0.44 0.1 0.62 0.02 Z", 0.95) },

  { id: "shape-pentagon", subcategory: "polygons", name: t("Pentágono", "Pentagon", "Pentágono", "Fünfeck"), shape: { kind: "polygon", points: 5, ratio: 1 } },
  { id: "shape-hexagon", subcategory: "polygons", name: t("Hexágono", "Hexagon", "Hexágono", "Sechseck"), shape: { kind: "polygon", points: 6, ratio: 1 } },
  { id: "shape-heptagon", subcategory: "polygons", name: t("Heptágono", "Heptagon", "Heptágono", "Siebeneck"), shape: { kind: "polygon", points: 7, ratio: 1 } },
  { id: "shape-octagon", subcategory: "polygons", name: t("Octógono", "Octagon", "Octágono", "Achteck"), shape: { kind: "polygon", points: 8, ratio: 1 } },
  { id: "shape-decagon", subcategory: "polygons", name: t("Decágono", "Decagon", "Decágono", "Zehneck"), shape: { kind: "polygon", points: 10, ratio: 1 } },
  { id: "shape-dodecagon", subcategory: "polygons", name: t("Dodecágono", "Dodecagon", "Dodecágono", "Zwölfeck"), shape: { kind: "polygon", points: 12, ratio: 1 } },

  { id: "shape-star-4", subcategory: "stars", name: t("Estrela de 4 pontas", "4 point star", "Estrella de 4 puntas", "Stern mit 4 Zacken"), shape: { kind: "star", points: 4, inner: 0.4, ratio: 1 } },
  { id: "shape-star-6", subcategory: "stars", name: t("Estrela de 6 pontas", "6 point star", "Estrella de 6 puntas", "Stern mit 6 Zacken"), shape: { kind: "star", points: 6, inner: 0.55, ratio: 1 } },
  { id: "shape-star-8", subcategory: "stars", name: t("Estrela de 8 pontas", "8 point star", "Estrella de 8 puntas", "Stern mit 8 Zacken"), shape: { kind: "star", points: 8, inner: 0.55, ratio: 1 } },
  { id: "shape-star-12", subcategory: "stars", name: t("Estrela de 12 pontas", "12 point star", "Estrella de 12 puntas", "Stern mit 12 Zacken"), shape: { kind: "star", points: 12, inner: 0.7, ratio: 1 } },
  { id: "shape-star-slim", subcategory: "stars", name: t("Estrela fina", "Slim star", "Estrella fina", "Schlanker Stern"), shape: { kind: "star", points: 5, inner: 0.3, ratio: 1 } },
  { id: "shape-sparkle", subcategory: "stars", name: t("Brilho", "Sparkle", "Destello", "Funkeln"), shape: { kind: "star", points: 4, inner: 0.18, ratio: 1 }, tags: { pt: ["cintilar", "estrela"], en: ["twinkle", "star"] } },

  { id: "shape-block-arrow-right", subcategory: "arrows", name: t("Seta para a direita", "Right arrow", "Flecha a la derecha", "Pfeil nach rechts"), shape: path(polygon(RIGHT), 1.6) },
  { id: "shape-block-arrow-left", subcategory: "arrows", name: t("Seta para a esquerda", "Left arrow", "Flecha a la izquierda", "Pfeil nach links"), shape: path(polygon(turned(RIGHT, left)), 1.6) },
  { id: "shape-block-arrow-up", subcategory: "arrows", name: t("Seta para cima", "Up arrow", "Flecha hacia arriba", "Pfeil nach oben"), shape: path(polygon(turned(RIGHT, up)), 1 / 1.6) },
  { id: "shape-block-arrow-down", subcategory: "arrows", name: t("Seta para baixo", "Down arrow", "Flecha hacia abajo", "Pfeil nach unten"), shape: path(polygon(turned(RIGHT, down)), 1 / 1.6) },
  { id: "shape-block-arrow-left-right", subcategory: "arrows", name: t("Seta dupla horizontal", "Left right arrow", "Flecha doble horizontal", "Doppelpfeil waagerecht"), shape: path(polygon(BOTH_WAYS), 2.2) },
  { id: "shape-block-arrow-up-down", subcategory: "arrows", name: t("Seta dupla vertical", "Up down arrow", "Flecha doble vertical", "Doppelpfeil senkrecht"), shape: path(polygon(turned(BOTH_WAYS, up)), 1 / 2.2) },
  { id: "shape-block-arrow-four", subcategory: "arrows", name: t("Seta em quatro direções", "Four way arrow", "Flecha en cuatro direcciones", "Pfeil in vier Richtungen"), shape: path(polygon(FOUR_WAYS), 1) },
  { id: "shape-block-arrow-notched", subcategory: "arrows", name: t("Seta com entalhe", "Notched arrow", "Flecha con muesca", "Gekerbter Pfeil"), shape: path(polygon([...RIGHT, [0.15, 0.5]]), 1.6) },
  { id: "shape-block-arrow-pentagon", subcategory: "arrows", name: t("Seta pentágono", "Pentagon arrow", "Flecha pentágono", "Fünfeckpfeil"), shape: path(polygon([[0, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0, 1]]), 2.2), tags: { pt: ["etapa", "passo"], en: ["step", "homeplate"] } },
  { id: "shape-block-arrow-bent", subcategory: "arrows", name: t("Seta dobrada", "Bent arrow", "Flecha doblada", "Abgeknickter Pfeil"), shape: path("M0 1 L0 0.5 Q0 0.3 0.2 0.3 L0.65 0.3 L0.65 0.05 L1 0.42 L0.65 0.8 L0.65 0.55 L0.25 0.55 L0.25 1 Z", 1.2) },
  { id: "shape-block-arrow-u-turn", subcategory: "arrows", name: t("Seta de retorno", "U turn arrow", "Flecha de retorno", "Wendepfeil"), shape: path("M0.1 1 L0.1 0.45 A0.35 0.35 0 0 1 0.8 0.45 L0.8 0.6 L0.95 0.6 L0.68 0.95 L0.41 0.6 L0.56 0.6 L0.56 0.45 A0.11 0.11 0 0 0 0.34 0.45 L0.34 1 Z", 1) },

  { id: "shape-flow-process", subcategory: "flowchart", name: t("Processo", "Process", "Proceso", "Prozess"), shape: { kind: "rect", radius: 0, ratio: 1.6 }, tags: { pt: ["fluxograma"], en: ["flowchart"] } },
  { id: "shape-flow-alternate", subcategory: "flowchart", name: t("Processo alternativo", "Alternate process", "Proceso alternativo", "Alternativer Prozess"), shape: { kind: "rect", radius: 0.3, ratio: 1.6 }, tags: { pt: ["fluxograma"], en: ["flowchart"] } },
  { id: "shape-flow-decision", subcategory: "flowchart", name: t("Decisão", "Decision", "Decisión", "Entscheidung"), shape: path(polygon([[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]]), 1.6), tags: { pt: ["fluxograma", "losango"], en: ["flowchart"] } },
  { id: "shape-flow-data", subcategory: "flowchart", name: t("Dados", "Data", "Datos", "Daten"), shape: path(polygon([[0.2, 0], [1, 0], [0.8, 1], [0, 1]]), 1.6), tags: { pt: ["fluxograma", "entrada", "saída"], en: ["flowchart", "input", "output"] } },
  { id: "shape-flow-terminator", subcategory: "flowchart", name: t("Início ou fim", "Terminator", "Inicio o fin", "Start oder Ende"), shape: { kind: "rect", radius: 1, ratio: 2.4 }, tags: { pt: ["fluxograma", "terminal"], en: ["flowchart", "start", "end"] } },
  { id: "shape-flow-document", subcategory: "flowchart", name: t("Documento", "Document", "Documento", "Dokument"), shape: path("M0 0 L1 0 L1 0.8 C0.8 0.7 0.7 0.7 0.5 0.85 C0.3 1 0.15 0.95 0 0.88 Z", 1.5), tags: { pt: ["fluxograma"], en: ["flowchart"] } },
  { id: "shape-flow-predefined", subcategory: "flowchart", name: t("Processo predefinido", "Predefined process", "Proceso predefinido", "Vordefinierter Prozess"), shape: path("M0 0 H1 V1 H0 Z M0.1 0 H0.13 V1 H0.1 Z M0.87 0 H0.9 V1 H0.87 Z", 1.6), evenOdd: true, tags: { pt: ["fluxograma", "sub-rotina"], en: ["flowchart", "subroutine"] } },
  { id: "shape-flow-manual-input", subcategory: "flowchart", name: t("Entrada manual", "Manual input", "Entrada manual", "Manuelle Eingabe"), shape: path(polygon([[0, 0.3], [1, 0], [1, 1], [0, 1]]), 1.6), tags: { pt: ["fluxograma"], en: ["flowchart"] } },
  { id: "shape-flow-preparation", subcategory: "flowchart", name: t("Preparação", "Preparation", "Preparación", "Vorbereitung"), shape: path(polygon([[0.15, 0], [0.85, 0], [1, 0.5], [0.85, 1], [0.15, 1], [0, 0.5]]), 1.8), tags: { pt: ["fluxograma"], en: ["flowchart"] } },
  { id: "shape-flow-database", subcategory: "flowchart", name: t("Banco de dados", "Database", "Base de datos", "Datenbank"), shape: path("M0 0.15 A0.5 0.15 0 0 1 1 0.15 L1 0.85 A0.5 0.15 0 0 1 0 0.85 Z M0 0.15 A0.5 0.15 0 0 0 1 0.15 A0.5 0.11 0 0 1 0 0.15 Z", 0.8), evenOdd: true, tags: { pt: ["fluxograma", "cilindro"], en: ["flowchart", "cylinder"] } },
  { id: "shape-flow-connector", subcategory: "flowchart", name: t("Conector", "Connector", "Conector", "Verbinder"), shape: { kind: "ellipse", ratio: 1 }, tags: { pt: ["fluxograma", "círculo"], en: ["flowchart", "circle"] } },
  { id: "shape-flow-off-page", subcategory: "flowchart", name: t("Conector de página", "Off page connector", "Conector de página", "Seitenverbinder"), shape: path(polygon([[0, 0], [1, 0], [1, 0.65], [0.5, 1], [0, 0.65]]), 0.9), tags: { pt: ["fluxograma"], en: ["flowchart"] } },
  { id: "shape-flow-delay", subcategory: "flowchart", name: t("Espera", "Delay", "Retraso", "Verzögerung"), shape: path("M0 0 L0.6 0 C0.82 0 1 0.22 1 0.5 C1 0.78 0.82 1 0.6 1 L0 1 Z", 1.4), tags: { pt: ["fluxograma", "atraso"], en: ["flowchart"] } },
  { id: "shape-flow-manual-operation", subcategory: "flowchart", name: t("Operação manual", "Manual operation", "Operación manual", "Manueller Vorgang"), shape: path(polygon([[0, 0], [1, 0], [0.8, 1], [0.2, 1]]), 1.6), tags: { pt: ["fluxograma"], en: ["flowchart"] } },
  { id: "shape-flow-merge", subcategory: "flowchart", name: t("Junção", "Merge", "Combinar", "Zusammenführen"), shape: path(polygon([[0, 0], [1, 0], [0.5, 1]]), 1.15), tags: { pt: ["fluxograma"], en: ["flowchart"] } },
  { id: "shape-flow-card", subcategory: "flowchart", name: t("Cartão", "Card", "Tarjeta", "Karte"), shape: path(polygon([[0.2, 0], [1, 0], [1, 1], [0, 1], [0, 0.25]]), 1.4), tags: { pt: ["fluxograma"], en: ["flowchart"] } },

  { id: "shape-bubble-oval", subcategory: "bubbles", name: t("Balão oval", "Oval bubble", "Bocadillo ovalado", "Ovale Sprechblase"), shape: path("M0.5 0 C0.78 0 1 0.17 1 0.38 C1 0.59 0.78 0.76 0.5 0.76 C0.45 0.76 0.4 0.75 0.36 0.74 L0.12 0.95 L0.2 0.68 C0.08 0.61 0 0.5 0 0.38 C0 0.17 0.22 0 0.5 0 Z", 1.3), tags: { pt: ["fala", "conversa"], en: ["speech", "chat"] } },
  { id: "shape-bubble-thought", subcategory: "bubbles", name: t("Balão de pensamento", "Thought bubble", "Bocadillo de pensamiento", "Gedankenblase"), shape: path(`M0.3 0.62 C0.12 0.66 0.02 0.5 0.1 0.38 C0.04 0.2 0.22 0.06 0.38 0.12 C0.48 0 0.68 0 0.74 0.12 C0.92 0.1 1 0.3 0.92 0.42 C1 0.58 0.84 0.7 0.7 0.64 C0.62 0.74 0.4 0.74 0.3 0.62 Z ${circle(0.28, 0.8, 0.06)} ${circle(0.135, 0.94, 0.035)}`, 1.3), tags: { pt: ["pensar", "ideia"], en: ["think", "idea"] } },
  { id: "shape-bubble-side", subcategory: "bubbles", name: t("Balão lateral", "Side bubble", "Bocadillo lateral", "Seitliche Sprechblase"), shape: path("M0.12 0 H1 V0.8 H0.12 V0.52 L0 0.42 L0.12 0.32 Z", 1.6), tags: { pt: ["fala", "mensagem"], en: ["speech", "message"] } },
  { id: "shape-bubble-right", subcategory: "bubbles", name: t("Balão à direita", "Right speech bubble", "Bocadillo a la derecha", "Sprechblase rechts"), shape: path("M0.1 0 L0.9 0 Q1 0 1 0.1 L1 0.62 Q1 0.72 0.9 0.72 L0.74 0.72 L0.8 1 L0.58 0.72 L0.1 0.72 Q0 0.72 0 0.62 L0 0.1 Q0 0 0.1 0 Z", 1.3), tags: { pt: ["fala", "conversa"], en: ["speech", "chat"] } },
  { id: "shape-bubble-square", subcategory: "bubbles", name: t("Balão quadrado", "Square bubble", "Bocadillo cuadrado", "Eckige Sprechblase"), shape: path(polygon([[0, 0], [1, 0], [1, 0.75], [0.6, 0.75], [0.5, 1], [0.4, 0.75], [0, 0.75]]), 1.4), tags: { pt: ["fala", "aviso"], en: ["speech", "callout"] } },
  { id: "shape-bubble-shout", subcategory: "bubbles", name: t("Balão de grito", "Shout bubble", "Bocadillo de grito", "Schreiblase"), shape: path(polygon(SHOUT), 1.2), tags: { pt: ["explosão", "grito", "pow"], en: ["burst", "pow"] } },

  { id: "shape-banner-flag", subcategory: "banners", name: t("Faixa com corte", "Swallowtail banner", "Banda con corte", "Schwalbenschwanzband"), shape: path(polygon([[0, 0], [1, 0], [0.88, 0.5], [1, 1], [0, 1]]), 3.5) },
  { id: "shape-banner-pennant", subcategory: "banners", name: t("Flâmula", "Pennant", "Banderín", "Wimpel"), shape: path(polygon([[0, 0], [1, 0.5], [0, 1]]), 2.5), tags: { pt: ["bandeirinha"], en: ["flag"] } },
  { id: "shape-banner-bookmark", subcategory: "banners", name: t("Marcador", "Bookmark", "Marcador", "Lesezeichen"), shape: path(polygon([[0, 0], [1, 0], [1, 1], [0.5, 0.78], [0, 1]]), 0.6) },
  { id: "shape-banner-folded", subcategory: "banners", name: t("Faixa com pontas", "Folded ribbon", "Cinta con puntas", "Gefaltetes Band"), shape: path("M0.1 0 H0.9 V0.7 H0.1 Z M0 0.3 H0.16 V1 H0 L0.06 0.65 Z M1 0.3 H0.84 V1 H1 L0.94 0.65 Z", 4) },
  { id: "shape-badge-shield", subcategory: "banners", name: t("Escudo", "Shield", "Escudo", "Schild"), shape: path("M0.5 0 L1 0.15 L1 0.5 C1 0.78 0.75 0.93 0.5 1 C0.25 0.93 0 0.78 0 0.5 L0 0.15 Z", 0.85), tags: { pt: ["selo", "garantia"], en: ["badge", "security"] } },
  { id: "shape-badge-ring", subcategory: "banners", name: t("Selo com aro", "Ring badge", "Sello con aro", "Ringabzeichen"), shape: path(`${circle(0.5, 0.5, 0.5)} ${circle(0.5, 0.5, 0.44)} ${circle(0.5, 0.5, 0.38)}`, 1), evenOdd: true, tags: { pt: ["selo", "carimbo"], en: ["badge", "stamp"] } },
  { id: "shape-badge-rosette", subcategory: "banners", name: t("Roseta", "Rosette", "Escarapela", "Rosette"), shape: path(`${polygon(starPoints(24, 0.88, 0.5, 0.38, 0.4, 0.4 * 0.8))} M0.3 0.6 L0.18 1 L0.32 0.92 L0.4 1 L0.48 0.7 Z M0.7 0.6 L0.82 1 L0.68 0.92 L0.6 1 L0.52 0.7 Z`, 0.8), tags: { pt: ["prêmio", "medalha", "selo"], en: ["award", "medal"] } },
  { id: "shape-badge-price-tag", subcategory: "banners", name: t("Etiqueta de preço", "Price tag", "Etiqueta de precio", "Preisschild"), shape: path(`M0 0.5 L0.28 0 H1 V1 H0.28 Z ${circle(0.22, 0.5, 0.06)}`, 1.8), evenOdd: true, tags: { pt: ["preço", "oferta", "promoção"], en: ["price", "sale", "label"] } },
  { id: "shape-badge-ticket", subcategory: "banners", name: t("Ingresso", "Ticket", "Entrada", "Ticket"), shape: path("M0 0 H1 V0.35 A0.075 0.15 0 0 0 1 0.65 V1 H0 V0.65 A0.075 0.15 0 0 0 0 0.35 Z", 2), tags: { pt: ["cupom", "bilhete"], en: ["coupon"] } },
];
