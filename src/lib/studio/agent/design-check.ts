import { contrastRatio, hexOf, luminance, mixColors, parseColor, type Rgba } from "../color";
import { videoCanvasSize, type CanvasSize, type Gradient, type ImageSurface, type Layer, type Transform, type VideoDocument } from "../document";
import { visualPlan, type VisualItem } from "../playback";

export const MAX_CHECK_LINES = 12;

export type TextMeasure = (text: string, layer: Layer, fontPx: number) => number;

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface Element {
  id: string;
  layer?: Layer;
  media: boolean;
  box: Box;
  opacity: number;
}

interface Scene {
  canvas: CanvasSize;
  background: Rgba | null;
  elements: Element[];
  safe: Box | null;
  prefix: string;
}

type Level = "erro" | "aviso";

interface Finding {
  level: Level;
  key: string;
  text: string;
}

const STORY_SAFE: Box = { left: 0.06, top: 0.14, right: 0.94, bottom: 0.65 };
const STORY_RATIO = 1.7;
const EDGE_TOLERANCE = 0.005;
const COVERED_SHARE = 0.5;
const OVERLAP_SHARE = 0.15;
const MIN_FONT_ERROR = 0.026;
const MIN_FONT_WARNING = 0.037;
const LARGE_FONT = 0.045;
const LARGE_BOLD_FONT = 0.035;
const HEAVY_SHADOW_ALPHA = 0.75;
const HEAVY_SHADOW_BLUR = 0.35;
const HEAVY_SHADOW_OFFSET = 0.12;
const DARK = 0.05;
const OUTLINE_SHARE = 0.05;
const FIT_SLACK = 1.08;
const WORDS_PER_SECOND = 3.3;
const READING_LEAD_SECONDS = 0.4;
const MIN_READING_SECONDS = 1;
const SUBTITLE_RUN = 3;
const SUBTITLE_GAP_MS = 300;

function round(value: number, digits = 1): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function boxOf(t: Transform, canvas: CanvasSize): Box {
  const radians = (t.rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const halfW = (t.w * canvas.width) / 2;
  const halfH = (t.h * canvas.height) / 2;
  const spanX = (cos * halfW + sin * halfH) / canvas.width;
  const spanY = (sin * halfW + cos * halfH) / canvas.height;
  return { left: t.x - spanX, right: t.x + spanX, top: t.y - spanY, bottom: t.y + spanY };
}

function nested(outer: Transform, inner: Transform): Transform {
  return {
    x: outer.x + (inner.x - 0.5) * outer.w,
    y: outer.y + (inner.y - 0.5) * outer.h,
    w: inner.w * outer.w,
    h: inner.h * outer.h,
    rotation: outer.rotation + inner.rotation,
    opacity: outer.opacity * inner.opacity,
  };
}

function area(b: Box): number {
  return Math.max(0, b.right - b.left) * Math.max(0, b.bottom - b.top);
}

function intersection(a: Box, b: Box): number {
  return area({ left: Math.max(a.left, b.left), top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) });
}

function contains(b: Box, x: number, y: number): boolean {
  return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;
}

function gradientColor(gradient: Gradient): Rgba | null {
  const stops = [gradient.from, gradient.via, gradient.to].map(parseColor).filter((c): c is Rgba => c !== null);
  if (stops.length === 0) return null;
  const sum = stops.reduce((acc, c) => ({ r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b, a: acc.a + c.a }), { r: 0, g: 0, b: 0, a: 0 });
  return { r: Math.round(sum.r / stops.length), g: Math.round(sum.g / stops.length), b: Math.round(sum.b / stops.length), a: sum.a / stops.length };
}

function paintOf(layer: Layer): Rgba | null {
  return layer.gradient ? gradientColor(layer.gradient) : parseColor(layer.fill);
}

function isText(el: Element): el is Element & { layer: Layer } {
  return el.layer?.type === "text" && Boolean(el.layer.text?.trim());
}

function covers(el: Element): boolean {
  if (el.opacity < 0.99) return false;
  if (el.media) return true;
  const layer = el.layer;
  if (layer?.type !== "shape" || layer.shape !== "rect") return false;
  const paint = paintOf(layer);
  return paint !== null && paint.a >= 0.99;
}

function backdrop(scene: Scene, index: number, x: number, y: number): Rgba | null {
  let color = scene.background;
  for (const el of scene.elements.slice(0, index)) {
    if (!contains(el.box, x, y)) continue;
    if (el.media) {
      color = el.opacity >= 0.99 ? null : color;
      continue;
    }
    const layer = el.layer;
    if (layer?.type !== "shape" || layer.shape === "line" || layer.shape === "arrow") continue;
    const paint = paintOf(layer);
    if (!paint) continue;
    const alpha = paint.a * el.opacity;
    color = alpha >= 0.99 ? { ...paint, a: 1 } : color ? mixColors(color, paint, alpha) : null;
  }
  return color;
}

function snippet(layer: Layer): string {
  const words = (layer.text ?? "").replace(/\s+/g, " ").trim();
  return words.length > 24 ? `${words.slice(0, 24)}…` : words;
}

export function estimateTextWidth(text: string, layer: Layer, fontPx: number): number {
  const letters = [...text];
  const upper = letters.filter((c) => c !== c.toLowerCase()).length / Math.max(1, letters.length);
  const factor = (0.54 + ((layer.fontWeight ?? 400) >= 700 ? 0.05 : 0)) * (upper > 0.6 ? 1.18 : 1);
  return letters.length * fontPx * (factor + (layer.letterSpacing ?? 0));
}

function linesNeeded(layer: Layer, fontPx: number, widthPx: number, measure: TextMeasure): { lines: number; widest: number } {
  let lines = 0;
  let widest = 0;
  for (const paragraph of (layer.text ?? "").split("\n")) {
    let current = "";
    lines += 1;
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      widest = Math.max(widest, measure(word, layer, fontPx));
      const candidate = current ? `${current} ${word}` : word;
      if (current && measure(candidate, layer, fontPx) > widthPx) {
        lines += 1;
        current = word;
      } else {
        current = candidate;
      }
    }
  }
  return { lines, widest };
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

  const cover = scene.elements.slice(index + 1).find((above) => covers(above) && intersection(el.box, above.box) >= COVERED_SHARE * area(el.box));
  if (cover) push("erro", `covered:${cover.id}`, `${name} fica escondido atrás de ${cover.id}; coloque ${cover.id} numa faixa ou camada abaixo do texto`);

  const outside = el.box.left < -EDGE_TOLERANCE || el.box.top < -EDGE_TOLERANCE || el.box.right > 1 + EDGE_TOLERANCE || el.box.bottom > 1 + EDGE_TOLERANCE;
  if (outside) push("erro", "outside", `${name} sai da arte; traga a caixa para dentro do quadro`);
  else if (scene.safe && (el.box.left < scene.safe.left || el.box.top < scene.safe.top || el.box.right > scene.safe.right || el.box.bottom > scene.safe.bottom)) {
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
  const stroke = (layer.strokeWidth ?? 0) >= OUTLINE_SHARE * fontPx ? parseColor(layer.stroke) : null;
  if (ground && ink) {
    const ratio = Math.max(contrastRatio(ink, ground), stroke ? contrastRatio(stroke, ground) : 0);
    const large = fontPx >= LARGE_FONT * canvas.height || ((layer.fontWeight ?? 400) >= 700 && fontPx >= LARGE_BOLD_FONT * canvas.height);
    const needed = large ? 3 : 4.5;
    if (ratio < needed) {
      const level: Level = ratio < (large ? 2.2 : 3) ? "erro" : "aviso";
      push(level, "contrast", `contraste baixo em ${name}: ${round(ratio)}:1 contra o fundo ${hexOf(ground)}, precisa de ${needed}:1; mude a cor do texto ou ponha uma caixa atrás`);
    }
  } else if (!ground && !stroke && !highlight && !layer.shadow) {
    push("aviso", "busy", `${name} está sobre imagem ou vídeo sem caixa, contorno ou sombra; confira a leitura com studio_look`);
  }

  const shadow = layer.shadow;
  const shade = parseColor(shadow?.color);
  if (shadow && shade) {
    const heavy = shade.a >= HEAVY_SHADOW_ALPHA && (shadow.blur > HEAVY_SHADOW_BLUR * fontPx || Math.hypot(shadow.x, shadow.y) > HEAVY_SHADOW_OFFSET * fontPx);
    const lost = ground !== null && luminance(ground) < DARK && luminance(shade) < DARK;
    if (lost) push("aviso", "shadow", `a sombra escura de ${name} não aparece sobre o fundo escuro e só suja as letras; tire com clear ["shadow"]`);
    else if (heavy) push("aviso", "shadow", `sombra pesada em ${name} (opaca, blur ${shadow.blur}); use cor como #00000059 com blur perto de ${Math.round(0.2 * fontPx)} e y perto de ${Math.max(1, Math.round(0.06 * fontPx))}`);
  }

  const widthPx = (el.box.right - el.box.left) * canvas.width;
  const heightPx = (el.box.bottom - el.box.top) * canvas.height;
  const { lines, widest } = linesNeeded(layer, fontPx, widthPx, measure);
  if (widest > widthPx * FIT_SLACK) push("erro", "word", `uma palavra de ${name} é mais larga que a caixa; aumente w ou diminua font_size`);
  else if (lines * (layer.lineHeight || 1.2) * fontPx > heightPx * FIT_SLACK) {
    push("aviso", "fit", `${name} não cabe na caixa: precisa de cerca de ${lines} linhas; aumente h, diminua font_size ou encurte o texto`);
  }
  return findings;
}

function overlapFindings(scene: Scene): Finding[] {
  const texts = scene.elements.filter(isText);
  const findings: Finding[] = [];
  texts.forEach((a, i) => {
    for (const b of texts.slice(i + 1)) {
      if (intersection(a.box, b.box) >= OVERLAP_SHARE * Math.min(area(a.box), area(b.box))) {
        findings.push({ level: "erro", key: `overlap:${a.id}:${b.id}`, text: `${scene.prefix}os textos ${a.id} e ${b.id} se sobrepõem; afaste um do outro ou mostre em momentos diferentes` });
      }
    }
  });
  return findings;
}

function sceneFindings(scene: Scene, measure: TextMeasure): Finding[] {
  return [...scene.elements.flatMap((_, i) => textFindings(scene, i, measure)), ...overlapFindings(scene)];
}

function report(findings: readonly Finding[]): string[] {
  const unique = [...new Map(findings.map((f) => [f.key, f])).values()];
  const ordered = [...unique.filter((f) => f.level === "erro"), ...unique.filter((f) => f.level === "aviso")];
  const lines = ordered.slice(0, MAX_CHECK_LINES).map((f) => `${f.level}: ${f.text}`);
  return ordered.length > MAX_CHECK_LINES ? [...lines, `e mais ${ordered.length - MAX_CHECK_LINES} pontos parecidos`] : lines;
}

function canvasPaint(background: string, gradient: Gradient | undefined): Rgba | null {
  return gradient ? gradientColor(gradient) : parseColor(background);
}

export function imageDesignChecks(doc: ImageSurface, measure: TextMeasure = estimateTextWidth): string[] {
  const canvas = { width: doc.canvas.width, height: doc.canvas.height };
  const elements = doc.layers
    .filter((layer) => !layer.hidden)
    .map((layer) => ({ id: layer.id, layer, media: layer.type === "image", box: boxOf(layer.transform, canvas), opacity: layer.transform.opacity }));
  const scene: Scene = {
    canvas,
    background: canvasPaint(doc.canvas.background || "#ffffff", doc.canvas.gradient),
    elements,
    safe: canvas.height / canvas.width >= STORY_RATIO ? STORY_SAFE : null,
    prefix: "",
  };
  return report(sceneFindings(scene, measure));
}

function itemElement(item: VisualItem, canvas: CanvasSize): Element {
  const transform = item.layer ? nested(item.transform, item.layer.transform) : item.transform;
  return { id: item.clipId, layer: item.layer, media: !item.layer, box: boxOf(transform, canvas), opacity: item.opacity * (item.layer ? item.layer.transform.opacity : 1) };
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

function sampleTimes(doc: VideoDocument): number[] {
  const times = new Set<number>();
  for (const track of doc.tracks) {
    if (track.kind !== "visual" || track.hidden) continue;
    for (const clip of track.clips) {
      if (clip.layer?.type === "text" && !clip.disabled) times.add(Math.round(clip.startMs + clip.durationMs / 2));
    }
  }
  return [...times].sort((a, b) => a - b);
}

export function videoDesignChecks(doc: VideoDocument, measure: TextMeasure = estimateTextWidth): string[] {
  const canvas = videoCanvasSize(doc);
  const findings = sampleTimes(doc).flatMap((atMs) => {
    const elements = visualPlan(doc, atMs, 0)
      .filter((item) => item.active && item.opacity > 0)
      .map((item) => itemElement(item, canvas));
    const scene: Scene = { canvas, background: parseColor(doc.canvas.background), elements, safe: doc.canvas.aspect === "story" ? STORY_SAFE : null, prefix: `em ${round(atMs / 1000)} s: ` };
    return sceneFindings(scene, measure);
  });
  return report([...findings, ...readingFindings(doc)]);
}
