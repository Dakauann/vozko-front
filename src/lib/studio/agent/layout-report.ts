import { luminance, parseColor } from "../color";
import { convexArea, convexIntersection, type Point } from "../convex";
import type { CanvasSize, ImageSurface, Layer } from "../document";
import { alignmentMisses, bleeds, clearBetween, isVerticalEdge, layoutItems, nested, symmetry, type AlignmentMiss, type LayoutItem } from "./alignment";
import { clippedFinding, MARGIN_SHARE, OVERLAP_SHARE } from "./design-check";
import { emptyBands } from "./empty-bands";
import { guideReport, nearParallel } from "./look-views";
import { rounded, type PerceptionFinding, type PerceptionShape, type PerceptionTone, type UnitPoint } from "./perception";
import { area, cornersOf, EDGES, imageScene, overlapShare, paintOf, type Box, type EdgeName, type SceneGround } from "./scene";
import { STROKE_NOUNS, strokeCrossings } from "./strokes";
import { estimateTextWidth, isText, type TextMeasure } from "./text-ink";

export interface LayoutReport {
  margins: string;
  levels: string | null;
  reading: string | null;
  balance: string;
  findings: PerceptionFinding[];
  shapes: PerceptionShape[];
}

type Shaped = PerceptionFinding & { shapes: PerceptionShape[] };

const TANGENT_SHARE = 0.008;
const SPILL: readonly [number, number] = [0.1, 0.85];
const COLLIDE: readonly [number, number] = [0.03, 0.7];
const SAME_LEVEL = 0.03;
const MIN_HERO_RATIO = 1.25;
const STRONG_HERO_RATIO = 1.5;
const FOCAL_FONT = 0.08;
const FOCAL_MEDIA = 0.12;
const GUIDE_MARGIN = 0.01;
const EDGE_WORDS: Record<EdgeName, string> = { left: "pela esquerda", center: "pelo centro", right: "pela direita", top: "pelo topo", middle: "pelo meio", bottom: "pela base" };
const SIDE_WORDS = ["esquerda", "direita", "topo", "base"] as const;

function px(edge: EdgeName, distance: number, canvas: CanvasSize): number {
  return Math.round(distance * (isVerticalEdge(edge) ? canvas.width : canvas.height));
}

function edgeGuide(edge: EdgeName, at: number, members: readonly LayoutItem[], tone: PerceptionTone): PerceptionShape {
  const vertical = isVerticalEdge(edge);
  const low = Math.max(0, Math.min(...members.map((m) => (vertical ? m.box.top : m.box.left))) - GUIDE_MARGIN);
  const high = Math.min(1, Math.max(...members.map((m) => (vertical ? m.box.bottom : m.box.right))) + GUIDE_MARGIN);
  return vertical ? { kind: "guide", from: [at, low], to: [at, high], tone } : { kind: "guide", from: [low, at], to: [high, at], tone };
}

export function alignmentGuides({ off, edge, neighbor }: AlignmentMiss, items: readonly LayoutItem[]): PerceptionShape[] {
  const span = clearBetween(off, neighbor, edge, items) ? [off, neighbor] : [neighbor];
  return [edgeGuide(edge, EDGES[edge](neighbor.box), span, "ok"), edgeGuide(edge, EDGES[edge](off.box), [off], "bad")];
}

function misalignments(items: readonly LayoutItem[], canvas: CanvasSize): Shaped[] {
  return alignmentMisses(items).map((miss) => ({
    kind: "misalign",
    level: "aviso",
    ids: [miss.off.el.id, ...miss.partners],
    text: `${miss.off.el.id} está ${px(miss.edge, miss.distance, canvas)} px fora da linha de ${miss.partners.join(", ")} ${EDGE_WORDS[miss.edge]}; alinhe pelo mesmo ponto ou afaste de propósito`,
    shapes: alignmentGuides(miss, items),
  }));
}

function strokeOverlaps(scene: SceneGround, measure: TextMeasure): Shaped[] {
  return strokeCrossings(scene, measure).map(({ stroke, text, kind, area }) => ({
    kind: "overlap",
    level: "aviso",
    ids: [stroke.id, text.id],
    text: `${STROKE_NOUNS[kind]} ${stroke.id} atravessa o texto ${text.id}; mova um dos dois para que não se cruzem, a menos que o risco seja de propósito`,
    shapes: unitArea(area, scene.canvas),
  }));
}

function sideSegment(b: Box, side: number): PerceptionShape {
  const ends: [UnitPoint, UnitPoint][] = [
    [
      [b.left, b.top],
      [b.left, b.bottom],
    ],
    [
      [b.right, b.top],
      [b.right, b.bottom],
    ],
    [
      [b.left, b.top],
      [b.right, b.top],
    ],
    [
      [b.left, b.bottom],
      [b.right, b.bottom],
    ],
  ];
  return { kind: "segment", from: ends[side][0], to: ends[side][1], tone: "bad" };
}

function sideGaps(b: Box, canvas: CanvasSize): number[] {
  return [b.left * canvas.width, (1 - b.right) * canvas.width, b.top * canvas.height, (1 - b.bottom) * canvas.height];
}

function marginFindings(items: readonly LayoutItem[], canvas: CanvasSize): Shaped[] {
  const wanted = MARGIN_SHARE * Math.min(canvas.width, canvas.height);
  return items.flatMap((item) => {
    const gaps = sideGaps(item.box, canvas);
    if (bleeds(item.box) > 0) return [];
    const tight = gaps.map((gap, i) => [gap, i] as const).filter(([gap]) => gap < wanted);
    if (tight.length === 0) return [];
    const words = tight.map(([gap, i]) => `${SIDE_WORDS[i]} ${Math.round(gap)} px`).join(", ");
    return [{ kind: "crowded_margin", level: "aviso", ids: [item.el.id], text: `${item.el.id} encosta na borda da arte (${words}); deixe pelo menos ${Math.round(wanted)} px ou sangre de verdade`, shapes: tight.map(([, i]) => sideSegment(item.box, i)) }];
  });
}

function marginsLine(items: readonly LayoutItem[], canvas: CanvasSize): string {
  const inside = items.filter((item) => sideGaps(item.box, canvas).every((gap) => gap >= 0));
  if (inside.length === 0) return "menor respiro: nada fica inteiro dentro da arte";
  const parts = SIDE_WORDS.map((word, i) => {
    const gaps = inside.map((item) => ({ id: item.el.id, gap: Math.round(sideGaps(item.box, canvas)[i]) }));
    const least = Math.min(...gaps.map((g) => g.gap));
    return `${word} ${least} px (${gaps.filter((g) => g.gap === least).map((g) => g.id).join(", ")})`;
  });
  return `menor respiro: ${parts.join(", ")}`;
}

function middle(low: number, high: number): number {
  return (low + high) / 2;
}

function gapPoint(a: Box, b: Box, across: boolean): UnitPoint {
  if (across) return [middle(Math.max(a.left, b.left), Math.min(a.right, b.right)), a.bottom < b.top ? middle(a.bottom, b.top) : middle(b.bottom, a.top)];
  return [a.right < b.left ? middle(a.right, b.left) : middle(b.right, a.left), middle(Math.max(a.top, b.top), Math.min(a.bottom, b.bottom))];
}

function tangents(items: readonly LayoutItem[], canvas: CanvasSize): Shaped[] {
  const limit = TANGENT_SHARE * Math.min(canvas.width, canvas.height);
  const upright = items.filter((item) => item.upright);
  return upright.flatMap((a, i) =>
    upright.slice(i + 1).flatMap((b): Shaped[] => {
      if (nested(a, b)) return [];
      const gapX = Math.max(a.box.left - b.box.right, b.box.left - a.box.right) * canvas.width;
      const gapY = Math.max(a.box.top - b.box.bottom, b.box.top - a.box.bottom) * canvas.height;
      const gap = gapX < 0 && gapY > 0 ? gapY : gapY < 0 && gapX > 0 ? gapX : null;
      if (gap === null || gap > limit) return [];
      return [{ kind: "tangent", level: "aviso", ids: [b.el.id, a.el.id], text: `${b.el.id} e ${a.el.id} quase se encostam (${Math.round(gap)} px); encoste de vez, sobreponha de propósito ou afaste`, shapes: [{ kind: "ring", at: gapPoint(a.box, b.box, gapX < 0), tone: "bad" }] }];
    }),
  );
}

function solid(layer: Layer | undefined): boolean {
  if (!layer) return false;
  if (layer.type === "image") return true;
  return layer.type === "shape" && layer.shape !== "line" && layer.shape !== "arrow" && paintOf(layer) !== null;
}

function panelKind(item: LayoutItem): string | null {
  const layer = item.el.layer;
  if (!layer || item.text || !solid(layer)) return null;
  return layer.type === "image" ? "image" : `shape:${layer.shape}`;
}

function unitArea(points: readonly Point[], canvas: CanvasSize): PerceptionShape[] {
  return points.length === 0 ? [] : [{ kind: "area", points: points.map(([x, y]): UnitPoint => [x / canvas.width, y / canvas.height]), tone: "bad" }];
}

function overlaps(items: readonly LayoutItem[], canvas: CanvasSize): Shaped[] {
  const findings: Shaped[] = [];
  items.forEach((a, i) => {
    for (const b of items.slice(i + 1)) {
      const [lower, upper] = [a, b];
      if (a.text && b.text) {
        if (overlapShare(a.corners, b.corners) >= OVERLAP_SHARE) findings.push({ kind: "overlap", level: "erro", ids: [upper.el.id, lower.el.id], text: `os textos ${upper.el.id} e ${lower.el.id} se sobrepõem; afaste um do outro`, shapes: unitArea(convexIntersection(a.corners, b.corners), canvas) });
        continue;
      }
      const [textItem, panel] = a.text ? [a, b] : b.text ? [b, a] : [null, null];
      if (textItem && panel && solid(panel.el.layer)) {
        const ink = textItem.corners;
        const shared = convexIntersection(ink, panel.corners);
        const share = convexArea(shared) / Math.max(1, convexArea(ink));
        if (share > SPILL[0] && share < SPILL[1]) findings.push({ kind: "overlap", level: "aviso", ids: [textItem.el.id, panel.el.id], text: `o texto ${textItem.el.id} fica ${Math.round(share * 100)}% dentro de ${panel.el.id} e o resto sai pela borda; ponha o texto inteiro dentro ou inteiro fora`, shapes: unitArea(shared, canvas) });
        continue;
      }
      const kind = panelKind(a);
      if (!kind || kind !== panelKind(b) || nested(a, b)) continue;
      const shared = convexIntersection(a.corners, b.corners);
      const share = overlapShare(a.corners, b.corners);
      if (share > COLLIDE[0] && share < COLLIDE[1]) findings.push({ kind: "overlap", level: "aviso", ids: [upper.el.id, lower.el.id], text: `${upper.el.id} invade ${Math.round(share * 100)}% de ${lower.el.id}; separe os dois ou sobreponha bem mais, de propósito`, shapes: unitArea(shared, canvas) });
    }
  });
  return findings;
}

interface Level {
  size: number;
  ids: string[];
}

function textLevels(items: readonly LayoutItem[]): Level[] {
  const texts = items.filter((item) => item.text).sort((a, b) => (b.el.layer!.fontSize ?? 0) - (a.el.layer!.fontSize ?? 0));
  const levels: Level[] = [];
  for (const item of texts) {
    const size = item.el.layer!.fontSize ?? 0;
    const last = levels[levels.length - 1];
    if (last && size >= last.size * (1 - SAME_LEVEL)) last.ids.push(item.el.id);
    else levels.push({ size, ids: [item.el.id] });
  }
  return levels;
}

function levelsLine(levels: readonly Level[]): string | null {
  if (levels.length === 0) return null;
  const parts = levels.map((level, i) => `${rounded(level.size, 3)} (${level.ids.join(", ")})${i > 0 ? ` ${rounded(levels[i - 1].size / level.size, 2)}x` : ""}`);
  return `texto em ${levels.length} ${levels.length === 1 ? "nível" : "níveis"}: ${parts.join(" > ")}`;
}

function hierarchy(levels: readonly Level[]): Shaped[] {
  if (levels.length < 2) return [];
  const [hero, next] = levels;
  const ratio = hero.size / next.size;
  if (ratio >= MIN_HERO_RATIO) return [];
  return [{ kind: "hierarchy", level: "aviso", ids: [...next.ids, ...hero.ids], text: `os dois maiores tamanhos de texto ficam perto demais: ${hero.ids.join(", ")} (${rounded(hero.size, 3)}) e ${next.ids.join(", ")} (${rounded(next.size, 3)}), ${rounded(ratio, 2)}x; do herói ao nível seguinte use pelo menos 1.5x`, shapes: [] }];
}

function readingLine(items: readonly LayoutItem[]): string | null {
  const texts = items.filter((item) => item.text).sort((a, b) => Math.round(a.box.top * 50) - Math.round(b.box.top * 50) || a.box.left - b.box.left);
  return texts.length === 0 ? null : `ordem de leitura: ${texts.map((item) => item.el.id).join(", ")}`;
}

function balanceLine(items: readonly LayoutItem[], scene: SceneGround): string {
  const ground = scene.background ? luminance(scene.background) : 0.5;
  let total = 0;
  let sx = 0;
  let sy = 0;
  for (const item of items) {
    const layer = item.el.layer;
    const ink = layer?.type === "image" ? null : layer ? (paintOf(layer) ?? parseColor(layer.stroke)) : null;
    const contrast = layer?.type === "image" ? 0.5 : ink ? Math.abs(luminance(ink) - ground) + 0.05 : 0.05;
    const weight = area(item.box) * item.el.opacity * contrast * (item.text ? 2 : 1);
    total += weight;
    sx += weight * ((item.box.left + item.box.right) / 2);
    sy += weight * ((item.box.top + item.box.bottom) / 2);
  }
  if (total === 0) return "peso visual: nada medido";
  return `peso visual centrado em x ${rounded(sx / total, 2)}, y ${rounded(sy / total, 2)} (o centro do quadro é 0.5, 0.5)`;
}

function clippedTexts(scene: SceneGround, measure: TextMeasure): Shaped[] {
  return scene.elements.filter(isText).flatMap((el): Shaped[] => {
    if (el.opacity <= 0) return [];
    const clipped = clippedFinding(scene, el, measure);
    if (!clipped) return [];
    return [{ kind: "text_clipped", level: clipped.level, ids: [el.id], text: `o texto ${el.id} ${clipped.text}`, shapes: unitArea(cornersOf(el, scene.canvas), scene.canvas) }];
  });
}

function focalIds(items: readonly LayoutItem[], levels: readonly Level[]): Set<string> {
  const [hero, next] = levels;
  const strongHero = hero && hero.size >= FOCAL_FONT && (!next || hero.size / next.size >= STRONG_HERO_RATIO) ? hero.ids : [];
  const bigMedia = items.filter((item) => item.el.media && area(item.box) >= FOCAL_MEDIA).map((item) => item.el.id);
  return new Set([...strongHero, ...bigMedia]);
}

function bandFindings(scene: SceneGround, measure: TextMeasure, focal: ReadonlySet<string>): Shaped[] {
  if (!scene.still) return [];
  return emptyBands(scene, measure, focal).map(({ axis, from, to }): Shaped => {
    const points: UnitPoint[] = axis === "y" ? [[0, from], [1, from], [1, to], [0, to]] : [[from, 0], [to, 0], [to, 1], [from, 1]];
    const side = axis === "y" ? "altura" : "largura";
    return { kind: "empty_band", level: "aviso", ids: [], text: `faixa vazia de ${axis} ${rounded(from, 2)} a ${rounded(to, 2)} (${Math.round((to - from) * 100)}% da ${side}): só o fundo aparece ali; leve a imagem, o cenário, uma forma ou um padrão até essa área (zona segura só tira dali texto, logo e chamada) ou recomponha para ocupar o quadro`, shapes: [{ kind: "area", points, tone: "bad" }] };
  });
}

function symmetryFindings(scene: SceneGround, items: readonly LayoutItem[]): Shaped[] {
  const found = scene.still ? symmetry(items) : null;
  if (!found) return [];
  const ids = items.map((item) => item.el.id);
  const named = (list: readonly LayoutItem[]) => list.map((item) => item.el.id).join(", ");
  const arrangement = found.pairs.length === 0 ? `toda centrada no eixo vertical (${named(items)})` : `espelhada entre esquerda e direita (${found.pairs.map(([a, b]) => `${a.el.id} e ${b.el.id}`).join(", ")}${found.axis.length > 0 ? `; no eixo: ${named(found.axis)}` : ""})`;
  return [{ kind: "symmetry", level: "aviso", ids, text: `a composição está ${arrangement}; isso tende a ler estático, pode ser intencional`, shapes: [] }];
}

function angleFindings(scene: SceneGround): Shaped[] {
  const { angles } = guideReport(
    scene.elements.map((el, index) => ({ n: index + 1, id: el.id, transform: el.transform })),
    scene.canvas,
  );
  return nearParallel(angles).map(([a, b]) => ({ kind: "near_parallel", level: "aviso", ids: [...a.ids, ...b.ids].sort(), text: `${a.ids.join(", ")} a ${a.degrees}° e ${b.ids.join(", ")} a ${b.degrees}° ficam quase paralelas; iguale o ângulo ou afaste de propósito`, shapes: [] }));
}

export function layoutReport(doc: ImageSurface, measure: TextMeasure = estimateTextWidth): LayoutReport {
  return sceneLayout(imageScene(doc), measure);
}

export function sceneLayout(scene: SceneGround, measure: TextMeasure = estimateTextWidth): LayoutReport {
  const canvas = scene.canvas;
  const items = layoutItems(scene, measure);
  const levels = textLevels(items);
  const shaped = [...clippedTexts(scene, measure), ...overlaps(items, canvas), ...strokeOverlaps(scene, measure), ...hierarchy(levels), ...misalignments(items, canvas), ...marginFindings(items, canvas), ...tangents(items, canvas), ...angleFindings(scene), ...bandFindings(scene, measure, focalIds(items, levels)), ...symmetryFindings(scene, items)];
  return {
    margins: marginsLine(items, canvas),
    levels: levelsLine(levels),
    reading: readingLine(items),
    balance: balanceLine(items, scene),
    findings: shaped.map(({ kind, level, ids, text }) => ({ kind, level, ids, text })),
    shapes: shaped.flatMap((finding) => finding.shapes),
  };
}
