import { takesArrowheads } from "../arrowheads";
import { BLEND_MODES, FILL_RULES, GRADIENT_KINDS, LINE_CAPS, LINE_JOINS, MAX_DASH_VALUES, newPathLayer, newShapeLayer, RADIAL_RADIUS_RANGE, SHAPE_KINDS, type BlendMode, type CanvasSize, type FillRule, type Gradient, type LineCap, type LineJoin, type Highlight, type Layer, type Shadow, type ShapeKind, type TextAlign, type Transform } from "../document";
import { FONT_IDS, type FontId } from "../fonts";
import { DEFAULT_HIGHLIGHT, DEFAULT_SHADOW } from "../layer-effects";
import { LAYER_RANGES, type Range } from "../layer-ranges";
import { isValidColor } from "../validate";
import { isValidPath } from "../vector-path";
import { isVectorPreset, VECTOR_PRESET_IDS, VECTOR_PRESETS, vectorPresetLayer } from "../vector-presets";

export interface AgentBox {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  rotation?: number;
  opacity?: number;
}

export interface AgentShadow {
  color?: string;
  blur?: number;
  x?: number;
  y?: number;
}

export interface AgentGradient {
  kind?: string;
  from?: string;
  via?: string;
  to?: string;
  angle?: number;
  cx?: number;
  cy?: number;
  radius?: number;
}

export interface AgentHighlight {
  color?: string;
  radius?: number;
}

export interface AgentStyle {
  text?: string;
  fill?: string;
  stroke?: string;
  stroke_width?: number;
  font_id?: string;
  font_size?: number;
  font_weight?: number;
  align?: TextAlign;
  shape?: string;
  path?: string;
  path_preset?: string;
  fill_rule?: string;
  line_cap?: string;
  line_join?: string;
  miter_limit?: number;
  dash_array?: number[];
  dash_offset?: number;
  points?: number;
  inner?: number;
  italic?: boolean;
  line_height?: number;
  letter_spacing?: number;
  radius?: number;
  dash?: boolean;
  arrow_start?: boolean;
  arrow_end?: boolean;
  shadow?: AgentShadow;
  gradient?: AgentGradient;
  highlight?: AgentHighlight;
  curve?: number;
  blend_mode?: string;
  clear?: string[];
}

export type Patched<T> = { ok: true; value: T } | { ok: false; reason: string };

export type Noted<T> = { ok: true; value: T; ignored: string[] } | { ok: false; reason: string };

const BOX_KEYS = ["x", "y", "w", "h", "rotation", "opacity"] as const;
const STYLE_KEYS = [
  "text",
  "fill",
  "stroke",
  "stroke_width",
  "font_id",
  "font_size",
  "font_weight",
  "align",
  "italic",
  "line_height",
  "letter_spacing",
  "radius",
  "dash",
  "arrow_start",
  "arrow_end",
  "shadow",
  "clear",
  "path",
  "fill_rule",
  "line_cap",
  "line_join",
  "miter_limit",
  "dash_array",
  "dash_offset",
  "points",
  "inner",
  "gradient",
  "highlight",
  "curve",
  "blend_mode",
] as const;

const CLEAR_PATCHES = {
  shadow: { shadow: undefined },
  stroke: { strokeWidth: 0 },
  gradient: { gradient: undefined },
  highlight: { highlight: undefined },
  curve: { curve: undefined },
  filters: { filters: undefined },
  frame: { frame: undefined },
  clip: { clip: undefined },
  blend_mode: { blendMode: undefined },
  crop: {},
} satisfies Record<string, Partial<Layer>>;

export type ClearableEffect = keyof typeof CLEAR_PATCHES;

export const SHARED_CLEARS: readonly ClearableEffect[] = ["shadow", "stroke"];

export const LAYER_CLEARS: readonly ClearableEffect[] = [...SHARED_CLEARS, "gradient", "highlight", "curve", "blend_mode"];

export const IMAGE_CLEARS: readonly ClearableEffect[] = [...LAYER_CLEARS, "crop", "filters", "frame", "clip"];

export function hasBox(op: AgentBox): boolean {
  return BOX_KEYS.some((key) => op[key] !== undefined);
}

export function hasStyle(op: AgentStyle): boolean {
  return STYLE_KEYS.some((key) => op[key] !== undefined);
}

export function boxPatch(op: AgentBox): Partial<Transform> {
  const patch: Partial<Transform> = {};
  for (const key of BOX_KEYS) {
    const value = op[key];
    if (typeof value === "number" && Number.isFinite(value)) patch[key] = value;
  }
  return patch;
}

export function withBox(base: Transform, op: AgentBox): Transform {
  return { ...base, ...boxPatch(op) };
}

const PATH_HELP = "path precisa ser um caminho SVG que comece com M, com os comandos M, L, H, V, C, S, Q, T, A e Z e números separados por espaço, em coordenadas de 0 a 1 dentro da caixa da camada";

export function shapeLayerOf(op: AgentStyle, canvas: CanvasSize): Noted<Layer> {
  if (op.path_preset !== undefined) {
    if (!isVectorPreset(op.path_preset)) return { ok: false, reason: `a forma pronta ${op.path_preset} não existe; use uma de: ${VECTOR_PRESET_IDS.join(", ")}` };
    const kind = VECTOR_PRESETS[op.path_preset].kind;
    const ignored = op.shape !== undefined && op.shape !== kind ? [`shape ${op.shape} ignorado, path_preset ${op.path_preset} define a forma`] : [];
    return { ok: true, value: vectorPresetLayer(op.path_preset, canvas), ignored };
  }
  const shape = op.shape ?? "rect";
  if (!(SHAPE_KINDS as readonly string[]).includes(shape)) return { ok: false, reason: `a forma ${shape} não existe; use uma de: ${SHAPE_KINDS.join(", ")}` };
  if (shape !== "path") return { ok: true, value: newShapeLayer(shape as Exclude<ShapeKind, "path">), ignored: [] };
  if (op.path === undefined) return { ok: false, reason: `shape path precisa de path ou de path_preset; ${PATH_HELP}` };
  return { ok: true, value: newPathLayer(op.path), ignored: [] };
}

export function outOfRange(name: string, value: number | undefined, [lo, hi]: Range): string | null {
  if (value === undefined || (Number.isFinite(value) && value >= lo && value <= hi)) return null;
  return `${name} vai de ${lo} a ${hi}`;
}

function firstProblem(...problems: (string | null)[]): string | null {
  return problems.find((problem) => problem !== null) ?? null;
}

export function shadowOf(input: AgentShadow): Patched<Shadow> {
  const shadow: Shadow = { ...DEFAULT_SHADOW, ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) };
  if (!isValidColor(shadow.color, true)) return { ok: false, reason: "shadow.color precisa ser uma cor #rrggbb ou #rrggbbaa" };
  const problem = firstProblem(
    outOfRange("shadow.blur", shadow.blur, LAYER_RANGES.shadowBlur),
    outOfRange("shadow.x", shadow.x, LAYER_RANGES.shadowOffset),
    outOfRange("shadow.y", shadow.y, LAYER_RANGES.shadowOffset),
  );
  return problem ? { ok: false, reason: problem } : { ok: true, value: shadow };
}

export function gradientOf(input: AgentGradient): Patched<Gradient> {
  const kind = input.kind ?? "linear";
  if (!(GRADIENT_KINDS as readonly string[]).includes(kind)) return { ok: false, reason: `gradient.kind precisa ser ${GRADIENT_KINDS.join(", ")}` };
  if (!input.from || !input.to || !isValidColor(input.from, true) || !isValidColor(input.to, true)) {
    return { ok: false, reason: "gradient precisa de from e to, cada um uma cor #rrggbb ou #rrggbbaa" };
  }
  if (input.via !== undefined && !isValidColor(input.via, true)) return { ok: false, reason: "gradient.via precisa ser uma cor #rrggbb ou #rrggbbaa" };
  const angle = input.angle ?? 0;
  const colors = { from: input.from, to: input.to, ...(input.via ? { via: input.via } : {}) };
  if (kind === "linear") {
    const problem = outOfRange("gradient.angle", angle, [-360, 360]);
    return problem ? { ok: false, reason: problem } : { ok: true, value: { ...colors, angle } };
  }
  const radial = { kind: "radial" as const, ...colors, angle: 0, cx: input.cx ?? 0.5, cy: input.cy ?? 0.5, radius: input.radius ?? 1 };
  const problem = firstProblem(outOfRange("gradient.cx", radial.cx, [0, 1]), outOfRange("gradient.cy", radial.cy, [0, 1]), outOfRange("gradient.radius", radial.radius, RADIAL_RADIUS_RANGE));
  return problem ? { ok: false, reason: problem } : { ok: true, value: radial };
}

export function highlightOf(input: AgentHighlight): Patched<Highlight> {
  if (!input.color || !isValidColor(input.color, true)) return { ok: false, reason: "highlight precisa de color, uma cor #rrggbb ou #rrggbbaa" };
  const highlight = { color: input.color, radius: input.radius ?? DEFAULT_HIGHLIGHT.radius };
  const problem = outOfRange("highlight.radius", highlight.radius, LAYER_RANGES.radius);
  return problem ? { ok: false, reason: problem } : { ok: true, value: highlight };
}

export function clearPatch(names: readonly string[] | undefined, allowed: readonly ClearableEffect[]): Patched<Partial<Layer>> {
  const patch: Partial<Layer> = {};
  for (const name of names ?? []) {
    if (!(allowed as readonly string[]).includes(name)) return { ok: false, reason: `clear aceita: ${allowed.join(", ")}` };
    Object.assign(patch, CLEAR_PATCHES[name as ClearableEffect]);
  }
  return { ok: true, value: patch };
}

export function stylePatch(op: AgentStyle, clears: readonly ClearableEffect[] = SHARED_CLEARS): Patched<Partial<Layer>> {
  const cleared = clearPatch(op.clear, clears);
  if (!cleared.ok) return cleared;
  const patch: Partial<Layer> = { ...cleared.value };
  if (op.text !== undefined) {
    if (op.text.trim() === "") return { ok: false, reason: "o texto não pode ficar vazio" };
    patch.text = op.text;
  }
  for (const [key, field] of [["fill", "fill"], ["stroke", "stroke"]] as const) {
    const color = op[key];
    if (color === undefined) continue;
    if (!isValidColor(color, true)) return { ok: false, reason: `${key} precisa ser uma cor #rrggbb ou #rrggbbaa` };
    patch[field] = color;
  }
  if (op.path !== undefined) {
    if (!isValidPath(op.path)) return { ok: false, reason: PATH_HELP };
    patch.path = op.path;
  }
  if (op.line_cap !== undefined) {
    if (!(LINE_CAPS as readonly string[]).includes(op.line_cap)) return { ok: false, reason: `line_cap precisa ser um de: ${LINE_CAPS.join(", ")}` };
    patch.lineCap = op.line_cap as LineCap;
  }
  if (op.line_join !== undefined) {
    if (!(LINE_JOINS as readonly string[]).includes(op.line_join)) return { ok: false, reason: `line_join precisa ser um de: ${LINE_JOINS.join(", ")}` };
    patch.lineJoin = op.line_join as LineJoin;
  }
  if (op.dash_array !== undefined) {
    const dashes = op.dash_array;
    if (dashes.length > MAX_DASH_VALUES || dashes.some((v) => outOfRange("dash_array", v, LAYER_RANGES.dashValue) !== null) || (dashes.length > 0 && dashes.every((v) => v === 0))) {
      return { ok: false, reason: `dash_array leva até ${MAX_DASH_VALUES} valores de 0 a ${LAYER_RANGES.dashValue[1]}, nem todos zero; [] volta ao traço contínuo` };
    }
    patch.dashArray = dashes.length > 0 ? dashes : undefined;
    if (dashes.length === 0) patch.dash = undefined;
  }
  if (op.fill_rule !== undefined) {
    if (!(FILL_RULES as readonly string[]).includes(op.fill_rule)) return { ok: false, reason: `fill_rule precisa ser um de: ${FILL_RULES.join(", ")}` };
    patch.fillRule = op.fill_rule === "nonzero" ? undefined : (op.fill_rule as FillRule);
  }
  if (op.points !== undefined && (!Number.isInteger(op.points) || outOfRange("points", op.points, LAYER_RANGES.starPoints))) {
    return { ok: false, reason: `points vai de ${LAYER_RANGES.starPoints[0]} a ${LAYER_RANGES.starPoints[1]}, em número inteiro` };
  }
  if (op.font_id !== undefined) {
    if (!(FONT_IDS as readonly string[]).includes(op.font_id)) return { ok: false, reason: `a fonte ${op.font_id} não existe; use uma de: ${FONT_IDS.join(", ")}` };
    patch.fontId = op.font_id as FontId;
  }
  const problem = firstProblem(
    outOfRange("stroke_width", op.stroke_width, LAYER_RANGES.strokeWidth),
    outOfRange("font_size", op.font_size, LAYER_RANGES.fontSize),
    outOfRange("line_height", op.line_height, LAYER_RANGES.lineHeight),
    outOfRange("letter_spacing", op.letter_spacing, LAYER_RANGES.letterSpacing),
    outOfRange("radius", op.radius, LAYER_RANGES.radius),
    outOfRange("inner", op.inner, LAYER_RANGES.starInner),
    outOfRange("miter_limit", op.miter_limit, LAYER_RANGES.miterLimit),
    outOfRange("dash_offset", op.dash_offset, LAYER_RANGES.dashOffset),
  );
  if (problem) return { ok: false, reason: problem };
  if (op.stroke_width !== undefined) patch.strokeWidth = op.stroke_width;
  if (op.font_size !== undefined) patch.fontSize = op.font_size;
  if (op.font_weight !== undefined) patch.fontWeight = op.font_weight;
  if (op.align !== undefined) patch.align = op.align;
  if (op.italic !== undefined) patch.italic = op.italic;
  if (op.line_height !== undefined) patch.lineHeight = op.line_height;
  if (op.letter_spacing !== undefined) patch.letterSpacing = op.letter_spacing;
  if (op.radius !== undefined) patch.radius = op.radius;
  if (op.dash !== undefined) patch.dash = op.dash;
  if (op.arrow_start !== undefined) patch.arrowStart = op.arrow_start;
  if (op.arrow_end !== undefined) patch.arrowEnd = op.arrow_end;
  if (op.points !== undefined) patch.points = op.points;
  if (op.miter_limit !== undefined) patch.miterLimit = op.miter_limit;
  if (op.dash_offset !== undefined) patch.dashOffset = op.dash_offset;
  if (op.inner !== undefined) patch.inner = op.inner;
  if (op.shadow !== undefined) {
    const shadow = shadowOf(op.shadow);
    if (!shadow.ok) return shadow;
    patch.shadow = shadow.value;
  }
  const effects = effectsOf(op);
  return effects.ok ? { ok: true, value: { ...patch, ...effects.value } } : effects;
}

function effectsOf(op: AgentStyle): Patched<Partial<Layer>> {
  const patch: Partial<Layer> = {};
  if (op.gradient !== undefined) {
    const gradient = gradientOf(op.gradient);
    if (!gradient.ok) return gradient;
    patch.gradient = gradient.value;
  } else if (op.fill !== undefined) {
    patch.gradient = undefined;
  }
  if (op.highlight !== undefined) {
    const highlight = highlightOf(op.highlight);
    if (!highlight.ok) return highlight;
    patch.highlight = highlight.value;
  }
  const curve = outOfRange("curve", op.curve, [-1, 1]);
  if (curve) return { ok: false, reason: curve };
  if (op.curve !== undefined) patch.curve = op.curve;
  if (op.blend_mode !== undefined) {
    if (!(BLEND_MODES as readonly string[]).includes(op.blend_mode)) return { ok: false, reason: `blend_mode precisa ser um de: ${BLEND_MODES.join(", ")}` };
    patch.blendMode = op.blend_mode === "normal" ? undefined : (op.blend_mode as BlendMode);
  }
  return { ok: true, value: patch };
}

type Rule = { fits: (layer: Layer) => boolean; reason: string };

const textRule: Rule = { fits: (l) => l.type === "text", reason: "só vale para camadas de texto" };
const imageRule: Rule = { fits: (l) => l.type === "image", reason: "só vale para imagens" };
const arrowheadRule: Rule = { fits: takesArrowheads, reason: "só vale para linhas, setas e caminhos abertos" };
const starRule: Rule = { fits: (l) => l.type === "shape" && l.shape === "star", reason: "só vale para estrelas" };
const strokeRule: Rule = { fits: (l) => l.type !== "icon", reason: "não vale para ícones" };
const pathRule: Rule = { fits: (l) => l.type === "shape" && l.shape === "path", reason: "só vale para formas vetoriais (shape path)" };

const RULES: { [K in keyof Layer]?: Rule } = {
  text: textRule,
  fontId: textRule,
  fontSize: textRule,
  fontWeight: textRule,
  align: textRule,
  italic: textRule,
  lineHeight: textRule,
  letterSpacing: textRule,
  highlight: textRule,
  curve: textRule,
  fill: { fits: (l) => l.type !== "image", reason: "não vale para imagens; use filters" },
  gradient: { fits: (l) => l.type === "text" || l.type === "shape", reason: "só vale para textos e formas" },
  radius: { fits: (l) => l.type === "image" || (l.type === "shape" && l.shape === "rect"), reason: "só vale para imagens e retângulos" },
  dash: { fits: (l) => l.type === "shape" || l.type === "text", reason: "só vale para formas e contornos de texto" },
  arrowStart: arrowheadRule,
  arrowEnd: arrowheadRule,
  points: starRule,
  inner: starRule,
  path: pathRule,
  fillRule: pathRule,
  lineCap: strokeRule,
  lineJoin: strokeRule,
  miterLimit: strokeRule,
  dashArray: strokeRule,
  dashOffset: strokeRule,
  crop: imageRule,
  flipX: imageRule,
  flipY: imageRule,
  filters: imageRule,
  frame: imageRule,
};

const AGENT_NAMES: { [K in keyof Layer]?: string } = {
  fontId: "font_id",
  fontSize: "font_size",
  fontWeight: "font_weight",
  lineHeight: "line_height",
  letterSpacing: "letter_spacing",
  strokeWidth: "stroke_width",
  arrowStart: "arrow_start",
  arrowEnd: "arrow_end",
  flipX: "flip_x",
  flipY: "flip_y",
  blendMode: "blend_mode",
  fillRule: "fill_rule",
  lineCap: "line_cap",
  lineJoin: "line_join",
  miterLimit: "miter_limit",
  dashArray: "dash_array",
  dashOffset: "dash_offset",
};

function sets(value: unknown): boolean {
  return value !== undefined && value !== false && value !== 0;
}

export function fitsLayer(layer: Layer | undefined, patch: Partial<Layer>): Noted<Partial<Layer>> {
  if (!layer) {
    const names = (Object.entries(patch) as [keyof Layer, unknown][]).filter(([, field]) => field !== undefined).map(([key]) => AGENT_NAMES[key] ?? key);
    return { ok: true, value: {}, ignored: names.length > 0 ? [`${names.join(", ")} só ${names.length > 1 ? "valem" : "vale"} para textos e formas sobre o vídeo`] : [] };
  }
  const next = { ...layer, ...patch };
  const value: Partial<Layer> = {};
  const ignored: string[] = [];
  for (const [key, field] of Object.entries(patch) as [keyof Layer, unknown][]) {
    const rule = RULES[key];
    if (rule && sets(field) && !rule.fits(next)) ignored.push(`${AGENT_NAMES[key] ?? key} ${rule.reason}`);
    else Object.assign(value, { [key]: field });
  }
  return { ok: true, value, ignored };
}

export const ISSUE_TEXT: Record<string, string> = {
  required: "falta um valor obrigatório",
  invalid: "há um valor inválido",
  unknown: "há um valor desconhecido",
  out_of_range: "um valor está fora dos limites (posição e tamanho de 0 a 1 do quadro, tamanho da letra de 0,005 a 0,5, peso de 100 a 900)",
  too_large: "o conteúdo ficou grande demais",
  too_many: "o limite de itens foi atingido",
  overlap: "dois clipes ficariam sobrepostos na mesma faixa",
  duplicate: "há ids repetidos",
};

export function issueText(code: string): string {
  return ISSUE_TEXT[code] ?? code;
}
