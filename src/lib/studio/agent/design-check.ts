import { contrastRatio, hexOf, luminance, mixColors, parseColor, type Rgba } from "../color";
import { FRAMES_PER_SECOND, videoCanvasSize, type CanvasSize, type ImageSurface, type Layer, type VideoDocument } from "../document";
import { alignmentMisses, layoutItems } from "./alignment";
import { convexArea } from "../convex";
import { backdrop, cornersOf, covers, EDGES, imageScene, insideElement, overlapShare, paintOf, sharedArea, textAnchor, videoSceneAt, type Box, type EdgeName, type SceneElement, type SceneGround } from "./scene";
import { STROKE_NOUNS, strokeCrossings } from "./strokes";
import { clippedText, estimateTextWidth, fittingFontSize, inkBox, isText, textLayoutOf, wideWord, type MeasuredWord, type TextElement, type TextFit, type TextMeasure } from "./text-ink";
import { clipEnd } from "../timeline";
import { cutMiddles, keyTimes } from "./frames";
import { isHeavyTextShadow, textShadowFor } from "../layer-effects";
import { modulePixels, QR_LIMITS } from "../qr";
import { VERTICAL_SAFE_ZONE } from "@/lib/advertising/placement-frames";

export const MAX_CHECK_LINES = 12;

type Element = SceneElement;

interface Scene extends SceneGround {
  safe: Box | null;
  prefix: string;
}

type Level = "erro" | "aviso";

interface Finding {
  level: Level;
  key: string;
  text: string;
}

const STORY_SAFE: Box = { left: VERTICAL_SAFE_ZONE.side, top: VERTICAL_SAFE_ZONE.top, right: 1 - VERTICAL_SAFE_ZONE.side, bottom: 1 - VERTICAL_SAFE_ZONE.bottom };
const STORY_RATIO = 1.7;
const EDGE_TOLERANCE = 0.005;
const COVERED_SHARE = 0.5;
export const OVERLAP_SHARE = 0.15;
const MIN_FONT_ERROR = 0.026;
const MIN_FONT_WARNING = 0.037;
const LARGE_FONT = 0.045;
const LARGE_BOLD_FONT = 0.035;
const DARK = 0.05;
const OUTLINE_SHARE = 0.05;
const FIT_SLACK = 1.08;
const WORDS_PER_SECOND = 3.3;
const READING_LEAD_SECONDS = 0.4;
const MIN_READING_SECONDS = 1;
const SUBTITLE_RUN = 3;
const SUBTITLE_GAP_MS = 300;
export const MARGIN_SHARE = 0.03;
const NEAR_MIN = 0.003;
const NEAR_CENTER_MAX = 0.015;
const REST_MS = 500;
const COVERING_MEDIA = 0.6;
const HIDDEN_WORDS_MAX = 40;
const WIDTH_SCALE = 1000;
const EDGE_INSET = 0.005;
const EDGE_POINTS: readonly [number, number][] = [
  [EDGE_INSET, EDGE_INSET],
  [0.5, EDGE_INSET],
  [1 - EDGE_INSET, EDGE_INSET],
  [EDGE_INSET, 0.5],
  [1 - EDGE_INSET, 0.5],
  [EDGE_INSET, 1 - EDGE_INSET],
  [0.5, 1 - EDGE_INSET],
  [1 - EDGE_INSET, 1 - EDGE_INSET],
];

function round(value: number, digits = 1): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

export { paintOf };

export function outlineInk(layer: Layer, fontPx: number): Rgba | null {
  return (layer.strokeWidth ?? 0) >= OUTLINE_SHARE * fontPx ? parseColor(layer.stroke) : null;
}

export function neededContrast(layer: Layer, fontPx: number, canvasHeight: number): number {
  const large = fontPx >= LARGE_FONT * canvasHeight || ((layer.fontWeight ?? 400) >= 700 && fontPx >= LARGE_BOLD_FONT * canvasHeight);
  return large ? 3 : 4.5;
}

export function snippet(layer: Layer): string {
  const words = (layer.text ?? "").replace(/\s+/g, " ").trim();
  return words.length > 24 ? `${words.slice(0, 24)}…` : words;
}

function fitAdvice(fitting: number): string {
  return fitting > 0 ? `use font_size ${fitting} (o maior que mostra tudo nesta caixa)` : "diminua font_size";
}

function hiddenLinesText(hidden: readonly string[], fit: TextFit, fitting: number): string {
  const words = hidden.join(" ").replace(/\s+/g, " ");
  const quoted = words.length > HIDDEN_WORDS_MAX ? `${words.slice(0, HIDDEN_WORDS_MAX)}…` : words;
  return `esconde ${hidden.length === 1 ? "a linha" : `${hidden.length} linhas`} "${quoted}": a caixa só mostra ${fit.visible} de ${fit.layout.lines} linhas e o resto some da arte; aumente h, alargue w, ${fitAdvice(fitting)} ou encurte o texto`;
}

function wideWordText(word: MeasuredWord, boxPx: number, canvas: CanvasSize, fitting: number): string {
  const width = Math.ceil((word.width / canvas.width) * WIDTH_SCALE) / WIDTH_SCALE;
  return `tem a palavra "${word.text}" mais larga que a caixa (${Math.round(word.width)} px numa caixa de ${Math.round(boxPx)} px), e a arte parte a palavra no meio; ${fitAdvice(fitting)} ou alargue w para pelo menos ${width}`;
}

export interface ClippedFinding {
  level: Level;
  key: "word" | "fit";
  text: string;
}

export function clippedFinding(scene: Pick<SceneGround, "canvas">, el: TextElement, measure: TextMeasure): ClippedFinding | null {
  const { fit, hidden, certain } = clippedText(scene, el, measure);
  const word = wideWord(scene, el, fit);
  if (!word && hidden.length === 0) return null;
  const fitting = fittingFontSize(scene, el, measure);
  if (!word) return { level: certain ? "erro" : "aviso", key: "fit", text: hiddenLinesText(hidden, fit, fitting) };
  const boxPx = el.transform.w * scene.canvas.width;
  return { level: certain || word.width > boxPx * FIT_SLACK ? "erro" : "aviso", key: "word", text: wideWordText(word, boxPx, scene.canvas, fitting) };
}

function upright(el: Element): boolean {
  return Math.abs(el.rotation) < 0.5;
}

function near(distance: number, max: number): boolean {
  return distance > NEAR_MIN && distance <= max;
}

function layoutFindings(scene: Scene, el: Element & { layer: Layer }, measure: TextMeasure, name: string): Finding[] {
  const findings: Finding[] = [];
  const push = (key: string, text: string) => findings.push({ level: "aviso", key: `${key}:${el.id}`, text: `${scene.prefix}${text}` });
  const { canvas } = scene;
  if (upright(el)) {
    const ink = inkBox(scene, el, measure);
    const gapPx = Math.min(ink.left * canvas.width, (1 - ink.right) * canvas.width, ink.top * canvas.height, (1 - ink.bottom) * canvas.height);
    const wanted = MARGIN_SHARE * Math.min(canvas.width, canvas.height);
    if (gapPx >= 0 && gapPx < wanted) push("margin", `${name} encosta na borda da arte (${Math.round(gapPx)} px de respiro); deixe pelo menos ${Math.round(wanted)} px`);
    const offCenter = Math.abs(EDGES.center(ink) - 0.5);
    if (textAnchor(el.layer) === "center" && near(offCenter, NEAR_CENTER_MAX)) push("center", `${name} está quase no centro, ${Math.round(offCenter * canvas.width)} px fora; centralize com x 0.5 ou afaste de propósito`);
  }
  const { layout } = textLayoutOf(scene, el, measure);
  const lone = layout.paragraphs.find((lines) => lines.length > 1 && !lines[lines.length - 1].includes(" ") && lines[lines.length - 2].includes(" "));
  if (lone) push("orphan", `${name} termina com uma palavra sozinha na última linha ("${lone[lone.length - 1]}"); ajuste w ou font_size, ou quebre a frase em outro ponto`);
  return findings;
}

function textFindings(scene: Scene, index: number, measure: TextMeasure): Finding[] {
  const el = scene.elements[index];
  if (!isText(el)) return [];
  const layer = el.layer;
  const { canvas, prefix } = scene;
  const fontPx = (layer.fontSize ?? 0) * canvas.height;
  const name = `o texto ${el.id} ("${snippet(layer)}")`;
  const findings: Finding[] = [];
  const push = (level: Level, key: string, text: string) => findings.push({ level, key: `${key}:${el.id}`, text: `${prefix}${text}` });

  const own = cornersOf(el, canvas);
  const cover = scene.elements.slice(index + 1).find((above) => covers(above) && sharedArea(own, cornersOf(above, canvas)) >= COVERED_SHARE * convexArea(own));
  if (cover) push("erro", `covered:${cover.id}`, `${name} fica escondido atrás de ${cover.id}; coloque ${cover.id} numa faixa ou camada abaixo do texto`);

  const letters = inkBox(scene, el, measure);
  const outside = letters.left < -EDGE_TOLERANCE || letters.top < -EDGE_TOLERANCE || letters.right > 1 + EDGE_TOLERANCE || letters.bottom > 1 + EDGE_TOLERANCE;
  if (outside) push("erro", "outside", `${name} sai da arte; traga a caixa para dentro do quadro`);
  else if (scene.safe && (letters.left < scene.safe.left || letters.top < scene.safe.top || letters.right > scene.safe.right || letters.bottom > scene.safe.bottom)) {
    push("aviso", "safe", `${name} entra na faixa que a interface do Instagram cobre (topo 14%, base 35%, laterais 6%)`);
  }

  const share = fontPx / canvas.width;
  const minimum = round((MIN_FONT_WARNING * canvas.width) / canvas.height, 3);
  if (share < MIN_FONT_ERROR) push("erro", "small", `${name} está pequeno demais para ler no celular (${Math.round(fontPx)} px numa arte de ${canvas.width} px); use font_size de pelo menos ${minimum}`);
  else if (share < MIN_FONT_WARNING) push("aviso", "small", `${name} está pequeno para o celular (${Math.round(fontPx)} px); prefira font_size de pelo menos ${minimum}`);

  const cx = (el.box.left + el.box.right) / 2;
  const cy = (el.box.top + el.box.bottom) / 2;
  const behind = backdrop(scene, index, cx, cy);
  const highlight = parseColor(layer.highlight?.color);
  const ground = highlight ? (behind ? mixColors(behind, highlight, highlight.a) : highlight.a >= 0.99 ? highlight : null) : behind;
  const ink = paintOf(layer);
  const stroke = outlineInk(layer, fontPx);
  if (ground && ink) {
    const ratio = Math.max(contrastRatio(ink, ground), stroke ? contrastRatio(stroke, ground) : 0);
    const needed = neededContrast(layer, fontPx, canvas.height);
    if (ratio < needed) {
      const level: Level = ratio < (needed === 3 ? 2.2 : 3) ? "erro" : "aviso";
      push(level, "contrast", `contraste baixo em ${name}: ${round(ratio)}:1 contra o fundo ${hexOf(ground)}, precisa de ${needed}:1; mude a cor do texto ou ponha uma caixa atrás`);
    }
  } else if (!ground && !stroke && !highlight && !layer.shadow) {
    push("aviso", "busy", `${name} está sobre imagem ou vídeo sem caixa, contorno ou sombra; confira a leitura com studio_look`);
  }

  const shadow = layer.shadow;
  const shade = parseColor(shadow?.color);
  if (shadow && shade) {
    const lost = ground !== null && luminance(ground) < DARK && luminance(shade) < DARK;
    const suggested = textShadowFor(fontPx);
    if (lost) push("aviso", "shadow", `a sombra escura de ${name} não aparece sobre o fundo escuro e só suja as letras; tire com clear ["shadow"]`);
    else if (isHeavyTextShadow(shadow, fontPx)) push("aviso", "shadow", `sombra pesada em ${name} (opaca, blur ${shadow.blur}); use cor como ${suggested.color} com blur perto de ${suggested.blur} e y perto de ${suggested.y}`);
  }

  const clipped = clippedFinding(scene, el, measure);
  if (clipped) push(clipped.level, clipped.key, `${name} ${clipped.text}`);
  return outside ? findings : [...findings, ...layoutFindings(scene, el, measure, name)];
}

const EDGE_NAMES: Partial<Record<EdgeName, string>> = { left: "na borda esquerda", right: "na borda direita", center: "no centro" };

function listed(ids: readonly string[]): string {
  return ids.length < 2 ? ids.join("") : `${ids.slice(0, -1).join(", ")} e ${ids[ids.length - 1]}`;
}

function alignmentFindings(scene: Scene, measure: TextMeasure): Finding[] {
  const order = new Map(scene.elements.map((el, index) => [el.id, index]));
  return alignmentMisses(layoutItems(scene, measure)).flatMap(({ off, edge, distance, members }): Finding[] => {
    const words = EDGE_NAMES[edge];
    const texts = members.filter((member) => member.text);
    if (!words || !off.text || texts.length === 0) return [];
    const ids = [off, ...texts].map((item) => item.el.id).sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
    const px = Math.round(distance * scene.canvas.width);
    return [{ level: "aviso", key: `align:${ids.join(":")}`, text: `${scene.prefix}os textos ${listed(ids)} estão quase alinhados ${words} (${px} px de diferença); alinhe pelo mesmo ponto` }];
  });
}

function overlapFindings(scene: Scene): Finding[] {
  const texts = scene.elements.filter(isText).map((el) => ({ el, corners: cornersOf(el, scene.canvas) }));
  return texts.flatMap((a, i) =>
    texts
      .slice(i + 1)
      .filter((b) => overlapShare(a.corners, b.corners) >= OVERLAP_SHARE)
      .map((b): Finding => ({ level: "erro", key: `overlap:${a.el.id}:${b.el.id}`, text: `${scene.prefix}os textos ${a.el.id} e ${b.el.id} se sobrepõem; afaste um do outro ou mostre em momentos diferentes` })),
  );
}

function qrFindings(layers: readonly { id: string; layer: Layer; sidePx: number }[], prefix: string): Finding[] {
  return layers.flatMap(({ id, layer, sidePx }) => {
    const pixels = layer.qr ? modulePixels(layer.qr, sidePx) : null;
    if (pixels === null || pixels >= QR_LIMITS.minModulePx) return [];
    return [{ level: "aviso" as const, key: `qr:${id}`, text: `${prefix}o QR Code ${id} tem módulos de ${round(pixels)} px; aumente o código para pelo menos ${QR_LIMITS.minModulePx} px por módulo para ler bem` }];
  });
}

export function imageQrChecks(doc: ImageSurface): string[] {
  const canvas = doc.canvas;
  const codes = doc.layers.filter((layer) => !layer.hidden && layer.qr).map((layer) => ({ id: layer.id, layer, sidePx: Math.min(layer.transform.w * canvas.width, layer.transform.h * canvas.height) }));
  return report(qrFindings(codes, ""));
}

function strokeFindings(scene: Scene, measure: TextMeasure): Finding[] {
  return strokeCrossings(scene, measure).map(({ stroke, text, kind }) => ({
    level: "aviso",
    key: `stroke:${stroke.id}:${text.id}`,
    text: `${scene.prefix}${STROKE_NOUNS[kind]} ${stroke.id} atravessa o texto ${text.id} ("${snippet(text.layer)}"); mova um dos dois ou, se for um risco de propósito, deixe assim`,
  }));
}

function sceneFindings(scene: Scene, measure: TextMeasure): Finding[] {
  return [...scene.elements.flatMap((_, i) => textFindings(scene, i, measure)), ...overlapFindings(scene), ...strokeFindings(scene, measure), ...alignmentFindings(scene, measure)];
}

function report(findings: readonly Finding[]): string[] {
  const unique = [...new Map(findings.map((f) => [f.key, f])).values()];
  const ordered = [...unique.filter((f) => f.level === "erro"), ...unique.filter((f) => f.level === "aviso")];
  const lines = ordered.slice(0, MAX_CHECK_LINES).map((f) => `${f.level}: ${f.text}`);
  return ordered.length > MAX_CHECK_LINES ? [...lines, `e mais ${ordered.length - MAX_CHECK_LINES} pontos parecidos`] : lines;
}

export function imageDesignChecks(doc: ImageSurface, measure: TextMeasure = estimateTextWidth): string[] {
  const ground = imageScene(doc);
  const scene: Scene = { ...ground, safe: ground.canvas.height / ground.canvas.width >= STORY_RATIO ? STORY_SAFE : null, prefix: "" };
  return report(sceneFindings(scene, measure));
}

function subtitleTrack(track: VideoDocument["tracks"][number]): boolean {
  const texts = track.clips.filter((clip) => clip.layer?.type === "text").sort((a, b) => a.startMs - b.startMs);
  let run = 1;
  for (let i = 1; i < texts.length; i++) {
    run = texts[i].startMs - (texts[i - 1].startMs + texts[i - 1].durationMs) <= SUBTITLE_GAP_MS ? run + 1 : 1;
    if (run >= SUBTITLE_RUN) return true;
  }
  return false;
}

function readingFindings(doc: VideoDocument): Finding[] {
  const findings: Finding[] = [];
  for (const track of doc.tracks) {
    if (track.kind !== "visual" || track.hidden || subtitleTrack(track)) continue;
    for (const clip of track.clips) {
      const words = clip.layer?.type === "text" ? (clip.layer.text ?? "").split(/\s+/).filter(Boolean).length : 0;
      if (words === 0 || clip.disabled) continue;
      const needed = Math.max(MIN_READING_SECONDS, READING_LEAD_SECONDS + words / WORDS_PER_SECOND);
      if (clip.durationMs < needed * 1000) {
        findings.push({ level: "aviso", key: `reading:${clip.id}`, text: `o texto ${clip.id} ("${snippet(clip.layer!)}") fica pouco tempo na tela: ${round(clip.durationMs / 1000)} s, e precisa de cerca de ${round(needed)} s para ler` });
      }
    }
  }
  return findings;
}

function visualClips(doc: VideoDocument): VideoDocument["tracks"][number]["clips"] {
  return doc.tracks.flatMap((track) => (track.kind === "visual" && !track.hidden ? track.clips.filter((clip) => !clip.disabled && clip.type !== "audio") : []));
}

function sampleTimes(doc: VideoDocument): number[] {
  const times = new Set<number>();
  for (const clip of visualClips(doc)) {
    if (clip.layer?.type !== "text") continue;
    times.add(Math.round(clip.startMs + clip.durationMs / 2));
    const rest = keyTimes(clip).at(-1);
    if (rest !== undefined && rest <= clip.durationMs - REST_MS) times.add(clip.startMs + rest);
  }
  return [...times].sort((a, b) => a - b);
}

function showsFrame(fromMs: number, toMs: number): boolean {
  const first = Math.ceil((fromMs * FRAMES_PER_SECOND) / 1000 - 1e-9);
  return (first * 1000) / FRAMES_PER_SECOND < toMs;
}

function gapFindings(doc: VideoDocument): Finding[] {
  const spans = visualClips(doc)
    .map((clip) => [clip.startMs, clipEnd(clip)] as const)
    .sort((a, b) => a[0] - b[0]);
  const findings: Finding[] = [];
  let covered = 0;
  for (const [start, end] of [...spans, [doc.durationMs, doc.durationMs] as const]) {
    const gapEnd = Math.min(start, doc.durationMs);
    if (gapEnd > covered && showsFrame(covered, gapEnd)) {
      findings.push({ level: "erro", key: `gap:${covered}`, text: `de ${round(covered / 1000)} s a ${round(gapEnd / 1000)} s não há nenhum clipe visual e o vídeo mostra só o fundo; estenda um clipe ou feche o buraco` });
    }
    covered = Math.max(covered, end);
  }
  return findings;
}

function edgeFindings(scene: Scene): Finding[] {
  const { canvas } = scene;
  const frame = cornersOf({ transform: { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 } }, canvas);
  const main = scene.elements.filter((el) => el.media && el.opacity >= 0.99).find((el) => sharedArea(cornersOf(el, canvas), frame) >= COVERING_MEDIA * canvas.width * canvas.height);
  if (!main) return [];
  const bare = EDGE_POINTS.some(([x, y]) => !scene.elements.some((el) => covers(el) && insideElement(el, canvas, x, y)));
  return bare ? [{ level: "aviso", key: `edges:${main.id}`, text: `${scene.prefix}o fundo aparece nas bordas do quadro: o clipe ${main.id} não cobre a tela toda; aumente a escala ou ajuste x, y, w e h` }] : [];
}

export function videoDesignChecks(doc: VideoDocument, measure: TextMeasure = estimateTextWidth): string[] {
  const canvas = videoCanvasSize(doc);
  const sceneAt = (atMs: number): Scene => ({ ...videoSceneAt(doc, atMs), safe: doc.canvas.aspect === "story" ? STORY_SAFE : null, prefix: `em ${round(atMs / 1000)} s: ` });
  const findings = sampleTimes(doc).flatMap((atMs) => sceneFindings(sceneAt(atMs), measure));
  const edges = cutMiddles(doc).flatMap((atMs) => edgeFindings(sceneAt(atMs)));
  const codes = visualClips(doc).flatMap((clip) => (clip.layer?.qr ? [{ id: clip.id, layer: clip.layer, sidePx: Math.min(clip.transform.w * canvas.width, clip.transform.h * canvas.height) }] : []));
  return report([...gapFindings(doc), ...findings, ...edges, ...readingFindings(doc), ...qrFindings(codes, "")]);
}
