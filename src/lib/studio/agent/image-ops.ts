import { produce } from "immer";

import { cropFrame, applyCropBox } from "../crop";
import {
  FRAME_KINDS,
  newIconLayer,
  newImageLayer,
  newTextLayer,
  TEXT_PRESETS,
  type CanvasSize,
  type Crop,
  type Filters,
  type Artboard,
  type FrameKind,
  type ImageDocument,
  type ImageSurface,
  type Layer,
  type TextPreset,
} from "../document";
import { activeArtboard, addArtboard, artboardById, artboardOfLayer, deleteArtboards, duplicateArtboard, editArtboard, moveLayersToArtboard, updateArtboard } from "../artboards";
import { fitInside, fittedTransform } from "../geometry";
import { dropItem } from "../groups";
import { DEFAULT_FILTERS, FILTER_PRESETS, replaceImageAsset, type FilterPresetId } from "../image-edits";
import { LAYER_RANGES } from "../layer-ranges";
import {
  addLayers,
  alignLayers,
  createScaffold,
  deleteLayers,
  distributeLayers,
  duplicateLayers,
  groupLayers,
  layerById,
  reorderLayers,
  resizeCanvas,
  setLayersHidden,
  setLayersLocked,
  ungroupLayers,
  updateLayers,
  type Alignment,
  type DistributeAxis,
  type LayerPatch,
  type OrderDirection,
} from "../layers";
import { combineShapes, type ShapeCombine, type ShapeOpIssue } from "../shape-ops";
import { canvasSizeIssue, isValidColor, layerIssue } from "../validate";
import type { AgentOutcome } from "./batch";
import {
  fitsLayer,
  gradientOf,
  hasBox,
  hasStyle,
  IMAGE_CLEARS,
  issueText,
  outOfRange,
  shapeLayerOf,
  stylePatch,
  withBox,
  type AgentBox,
  type AgentGradient,
  type AgentHighlight,
  type AgentStyle,
  type Noted,
  type Patched,
} from "./layer-style";

export const IMAGE_OPERATIONS = [
  "add_text",
  "add_shape",
  "add_image",
  "add_icon",
  "update_layer",
  "delete_layers",
  "duplicate_layers",
  "order_layers",
  "align_layers",
  "distribute_layers",
  "group_layers",
  "ungroup_layers",
  "scaffold_layers",
  "set_hidden",
  "set_locked",
  "replace_image",
  "update_artboard",
  "add_artboard",
  "duplicate_artboard",
  "delete_artboard",
  "move_to_artboard",
  "select",
  "combine_shapes",
] as const;

export type ImageOpName = (typeof IMAGE_OPERATIONS)[number];

export const IMAGE_ID_FIELDS = ["layer_id", "layer_ids", "above_id", "below_id", "artboard_id"] as const;

export interface AgentFilters {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  blur?: number;
}

export interface ImageOperation extends AgentBox, AgentStyle {
  op: ImageOpName;
  ref?: string;
  layer_id?: string;
  layer_ids?: string[];
  artboard_id?: string;
  media_id?: string;
  icon_id?: string;
  style?: TextPreset;
  direction?: OrderDirection;
  above_id?: string;
  below_id?: string;
  alignment?: Alignment;
  axis?: DistributeAxis;
  gradient?: AgentGradient;
  highlight?: AgentHighlight;
  curve?: number;
  blend_mode?: string;
  frame?: string;
  clip?: boolean;
  flip_x?: boolean;
  flip_y?: boolean;
  filters?: AgentFilters;
  filter_preset?: string;
  crop?: Crop;
  hidden?: boolean;
  locked?: boolean;
  width?: number;
  height?: number;
  background?: string;
  name?: string;
  mode?: ShapeCombine;
}

export interface ImageOpContext {
  naturalSize: (mediaId: string) => CanvasSize | undefined;
  icons: readonly string[];
  activeArtboard: string;
}

type Outcome = AgentOutcome<ImageSurface>;
type DocumentOutcome = AgentOutcome<ImageDocument>;
type Refusal = { ok: false; reason: string };
type Found = { ok: true; artboard: Artboard } | Refusal;

const NO_FRAME = "none";
const CROP_EPSILON = 1e-6;
const FULL_CROP: Crop = { x: 0, y: 0, w: 1, h: 1 };
const IMAGE_ONLY_KEYS = ["frame", "clip", "flip_x", "flip_y", "filters", "filter_preset", "crop", "name"] as const;

const TRANSPARENT = "transparent";
const SIZE_RANGE = "o tamanho da prancheta vai de 100 a 4096 pixels por lado";
const CREATES: ReadonlySet<ImageOpName> = new Set(["add_text", "add_shape", "add_image", "add_icon"]);

function refuse(reason: string): Refusal {
  return { ok: false, reason };
}

function targets(op: ImageOperation): string[] {
  if (op.layer_ids && op.layer_ids.length > 0) return op.layer_ids;
  return op.layer_id ? [op.layer_id] : [];
}

function absentLayer(id: string | undefined): Refusal {
  return refuse(`a camada ${id ?? "(sem id)"} não existe; leia o projeto de novo com studio_read`);
}

function missing(doc: ImageSurface, ids: readonly string[]): Refusal | null {
  if (ids.length === 0) return refuse("informe layer_id ou layer_ids");
  const absent = ids.find((id) => !layerById(doc, id));
  return absent ? absentLayer(absent) : null;
}

function locked(doc: ImageSurface, ids: readonly string[]): Refusal | null {
  const held = ids.find((id) => layerById(doc, id)?.locked);
  return held ? refuse(`a camada ${held} está travada; destrave com set_locked antes`) : null;
}

function checked(doc: ImageSurface, ids: readonly string[]): Refusal | null {
  for (const id of ids) {
    const layer = layerById(doc, id);
    const code = layer ? layerIssue(layer) : null;
    if (code) return refuse(`a camada ${id} ficaria inválida: ${issueText(code)}`);
  }
  return null;
}

function done(document: ImageSurface, label: string, focusId: string | null, extra: Partial<Extract<Outcome, { ok: true }>> = {}): Outcome {
  return { ok: true, document, focus: focusId ? { kind: "layer", layerId: focusId } : { kind: "canvas" }, label, ...extra };
}

function hasImageEffects(op: ImageOperation): boolean {
  return IMAGE_ONLY_KEYS.some((key) => op[key] !== undefined);
}

function filtersOf(op: ImageOperation, current: Filters | undefined): Patched<Filters | undefined> {
  if (op.filter_preset === undefined && op.filters === undefined) return { ok: true, value: current };
  let filters: Filters = current ?? DEFAULT_FILTERS;
  if (op.filter_preset !== undefined) {
    const preset = FILTER_PRESETS.find((p) => p.id === (op.filter_preset as FilterPresetId));
    if (!preset) return { ok: false, reason: `filter_preset precisa ser um de: ${FILTER_PRESETS.map((p) => p.id).join(", ")}` };
    filters = preset.filters;
  }
  const merged: Filters = { ...filters, ...Object.fromEntries(Object.entries(op.filters ?? {}).filter(([, v]) => v !== undefined)) };
  const problem =
    outOfRange("filters.brightness", merged.brightness, LAYER_RANGES.brightness) ??
    outOfRange("filters.contrast", merged.contrast, LAYER_RANGES.contrast) ??
    outOfRange("filters.saturation", merged.saturation, LAYER_RANGES.saturation) ??
    outOfRange("filters.blur", merged.blur, LAYER_RANGES.blur);
  return problem ? { ok: false, reason: problem } : { ok: true, value: merged };
}

function effectsPatch(op: ImageOperation, layer: Layer, doc: ImageSurface): Patched<LayerPatch> {
  const patch: LayerPatch = {};
  if (op.frame !== undefined) {
    if (op.frame !== NO_FRAME && !(FRAME_KINDS as readonly string[]).includes(op.frame)) return { ok: false, reason: `frame precisa ser um de: ${[...FRAME_KINDS, NO_FRAME].join(", ")}` };
    patch.frame = op.frame === NO_FRAME ? undefined : (op.frame as FrameKind);
  }
  if (op.clip !== undefined) {
    if (op.clip && doc.layers.findIndex((l) => l.id === layer.id) === 0) {
      return { ok: false, reason: "clip precisa de uma camada logo abaixo para servir de máscara; coloque a forma embaixo com order_layers e below_id antes" };
    }
    patch.clip = op.clip || undefined;
  }
  if (op.flip_x !== undefined) patch.flipX = op.flip_x || undefined;
  if (op.flip_y !== undefined) patch.flipY = op.flip_y || undefined;
  const filters = filtersOf(op, layer.filters);
  if (!filters.ok) return filters;
  if (filters.value !== layer.filters) patch.filters = filters.value;
  if (op.name !== undefined) patch.name = op.name.trim() || undefined;
  return { ok: true, value: patch };
}

function cropIssue(crop: Crop): string | null {
  const side = outOfRange("crop.w", crop.w, LAYER_RANGES.cropSide) ?? outOfRange("crop.h", crop.h, LAYER_RANGES.cropSide);
  if (side) return side;
  if (crop.x < 0 || crop.y < 0 || crop.x + crop.w > 1 + CROP_EPSILON || crop.y + crop.h > 1 + CROP_EPSILON) return "crop passa da imagem: x e y começam em 0, e x + w e y + h vão até 1";
  return null;
}

function cropped(layer: Layer, crop: Crop, canvas: CanvasSize): Patched<LayerPatch> {
  if (layer.type !== "image") return { ok: false, reason: "crop só vale para imagens" };
  const problem = cropIssue(crop);
  if (problem) return { ok: false, reason: problem };
  const frame = cropFrame(layer, canvas);
  const box = { left: crop.x * frame.width, top: crop.y * frame.height, width: crop.w * frame.width, height: crop.h * frame.height };
  return { ok: true, value: applyCropBox(layer, frame, box, canvas) };
}

function layerPatch(op: ImageOperation, layer: Layer, doc: ImageSurface): Noted<LayerPatch> {
  const style = hasStyle(op) ? stylePatch(op, IMAGE_CLEARS) : ({ ok: true, value: {} } as const);
  if (!style.ok) return style;
  const effects = hasImageEffects(op) ? effectsPatch(op, layer, doc) : ({ ok: true, value: {} } as const);
  if (!effects.ok) return effects;
  const fitted = fitsLayer(layer, { ...style.value, ...effects.value });
  if (!fitted.ok) return fitted;
  const patch: LayerPatch = { ...fitted.value, ...(hasBox(op) ? { transform: withBox(layer.transform, op) } : {}) };
  const crop = op.crop ?? (op.clear?.includes("crop") ? FULL_CROP : undefined);
  if (!crop) return { ok: true, value: patch, ignored: fitted.ignored };
  if (layer.type !== "image") return { ok: true, value: patch, ignored: [...fitted.ignored, "crop só vale para imagens"] };
  const cut = cropped({ ...layer, ...patch }, crop, doc.canvas);
  return cut.ok ? { ok: true, value: { ...patch, ...cut.value }, ignored: fitted.ignored } : cut;
}

function insert(doc: ImageSurface, layer: Layer, label: string, notes: readonly string[]): Outcome {
  const next = addLayers(doc, [layer]);
  return checked(next, [layer.id]) ?? done(next, label, layer.id, { created: [layer.id], notes: [...notes] });
}

function styled(doc: ImageSurface, base: Layer, op: ImageOperation, label: string, ignored: readonly string[] = []): Outcome {
  const patch = layerPatch(op, { ...base, transform: withBox(base.transform, op) }, doc);
  if (!patch.ok) return refuse(patch.reason);
  return insert(doc, { ...base, ...patch.value, transform: patch.value.transform ?? withBox(base.transform, op) }, label, [...ignored, ...patch.ignored]);
}

function addText(doc: ImageSurface, op: ImageOperation): Outcome {
  if (!op.text || op.text.trim() === "") return refuse("add_text precisa de text");
  const preset = op.style ?? "heading";
  if (!(preset in TEXT_PRESETS)) return refuse(`o estilo ${preset} não existe; use heading, subheading ou body`);
  return styled(doc, newTextLayer(op.text, preset), op, "add_text");
}

function addShape(doc: ImageSurface, op: ImageOperation): Outcome {
  const base = shapeLayerOf(op, doc.canvas);
  if (!base.ok) return refuse(base.reason);
  return styled(doc, base.value, op, "add_shape", base.ignored);
}

function addIcon(doc: ImageSurface, op: ImageOperation, ctx: ImageOpContext): Outcome {
  if (!op.icon_id || !ctx.icons.includes(op.icon_id)) return refuse(`o ícone ${op.icon_id ?? "(sem icon_id)"} não existe; use um de: ${ctx.icons.join(", ")}`);
  return styled(doc, newIconLayer(op.icon_id), op, "add_icon");
}

function addImage(doc: ImageSurface, op: ImageOperation, ctx: ImageOpContext): Outcome {
  const natural = op.media_id ? ctx.naturalSize(op.media_id) : undefined;
  if (!op.media_id || !natural) return refuse(`a imagem ${op.media_id ?? "(sem media_id)"} não está na biblioteca`);
  const fitted = fittedTransform(natural.width, natural.height, doc.canvas);
  const transform = hasBox(op) ? fitInside(natural.width, natural.height, withBox(fitted, op), doc.canvas) : fitted;
  const base = newImageLayer(op.media_id, transform);
  const patch = layerPatch({ ...op, x: undefined, y: undefined, w: undefined, h: undefined, rotation: undefined, opacity: undefined }, base, doc);
  if (!patch.ok) return refuse(patch.reason);
  const opacity = op.opacity !== undefined || op.rotation !== undefined ? { transform: { ...(patch.value.transform ?? transform), ...(op.opacity !== undefined ? { opacity: op.opacity } : {}), ...(op.rotation !== undefined ? { rotation: op.rotation } : {}) } } : {};
  return insert(doc, { ...base, ...patch.value, ...opacity }, "add_image", patch.ignored);
}

function update(doc: ImageSurface, op: ImageOperation): Outcome {
  const ids = targets(op);
  const problem = missing(doc, ids) ?? locked(doc, ids);
  if (problem) return problem;
  let next = doc;
  const changed: string[] = [];
  const notes: string[] = [];
  for (const id of ids) {
    const patch = layerPatch(op, layerById(next, id)!, next);
    if (!patch.ok) return refuse(`camada ${id}: ${patch.reason}`);
    notes.push(...patch.ignored.map((note) => `camada ${id}: ${note}`));
    if (Object.keys(patch.value).length === 0) continue;
    next = updateLayers(next, [id], patch.value);
    changed.push(id);
  }
  if (changed.length === 0) return refuse(notes.length > 0 ? `nada foi aplicado: ${notes.join("; ")}` : "update_layer precisa de algum campo para mudar");
  return checked(next, changed) ?? done(next, "update_layer", changed[0], { changed, notes });
}

function zIndex(doc: ImageSurface, id: string): number {
  return doc.layers.findIndex((l) => l.id === id);
}

function place(doc: ImageSurface, op: ImageOperation, ids: readonly string[]): Outcome {
  const position = op.above_id !== undefined ? "above" : "below";
  const target = op.above_id ?? op.below_id!;
  if (!layerById(doc, target)) return absentLayer(target);
  if (ids.includes(target)) return refuse("uma camada não pode ir acima ou abaixo dela mesma");
  const bottomFirst = [...ids].sort((a, b) => zIndex(doc, a) - zIndex(doc, b));
  const sequence = position === "above" ? bottomFirst.reverse() : bottomFirst;
  const next = sequence.reduce((current, id) => dropItem(current, { kind: "layer", id }, { kind: "layer", id: target }, position), doc);
  return done(next, "order_layers", ids[0], { changed: [...ids] });
}

function orderLayers(doc: ImageSurface, op: ImageOperation): Outcome {
  const ids = targets(op);
  const problem = missing(doc, ids);
  if (problem) return problem;
  if (op.above_id !== undefined && op.below_id !== undefined) return refuse("order_layers usa above_id ou below_id, não os dois");
  if (op.above_id !== undefined || op.below_id !== undefined) return place(doc, op, ids);
  if (!op.direction) return refuse("order_layers precisa de direction, above_id ou below_id");
  return done(reorderLayers(doc, ids, op.direction), "order_layers", ids[0], { changed: ids });
}

function replaceImage(doc: ImageSurface, op: ImageOperation, ctx: ImageOpContext): Outcome {
  const layer = op.layer_id ? layerById(doc, op.layer_id) : undefined;
  if (!layer) return absentLayer(op.layer_id);
  if (layer.type !== "image") return refuse("replace_image só vale para camadas de imagem");
  const natural = op.media_id ? ctx.naturalSize(op.media_id) : undefined;
  if (!op.media_id || !natural) return refuse(`a imagem ${op.media_id ?? "(sem media_id)"} não está na biblioteca`);
  const next = updateLayers(doc, [layer.id], replaceImageAsset(layer, op.media_id, natural, doc.canvas));
  if (next === doc) return refuse(`a camada ${layer.id} está travada`);
  return done(next, "replace_image", layer.id, { changed: [layer.id] });
}

function bulk(doc: ImageSurface, op: ImageOperation, apply: (d: ImageSurface, ids: string[]) => ImageSurface, unchanged: string | null): Outcome {
  const ids = targets(op);
  const problem = missing(doc, ids);
  if (problem) return problem;
  const next = apply(doc, ids);
  if (next === doc && unchanged !== null) return refuse(unchanged);
  return done(next, op.op, ids[0], { changed: ids });
}

function backgroundOf(op: ImageOperation): Patched<string | undefined> {
  if (op.background === undefined) return { ok: true, value: undefined };
  if (op.background === TRANSPARENT) return { ok: true, value: "" };
  return isValidColor(op.background, true) ? { ok: true, value: op.background } : { ok: false, reason: `background precisa ser uma cor #rrggbb ou "${TRANSPARENT}"` };
}

function paintedCanvas(surface: ImageSurface, op: ImageOperation): Patched<ImageSurface> {
  let next = surface;
  if (op.width !== undefined || op.height !== undefined) {
    const size = { width: op.width ?? surface.canvas.width, height: op.height ?? surface.canvas.height };
    if (canvasSizeIssue(size)) return { ok: false, reason: SIZE_RANGE };
    next = resizeCanvas(next, size);
  }
  const background = backgroundOf(op);
  if (!background.ok) return background;
  const gradient = op.gradient !== undefined ? gradientOf(op.gradient) : null;
  if (gradient && !gradient.ok) return gradient;
  if (background.value === undefined && !gradient) return { ok: true, value: next };
  return {
    ok: true,
    value: produce(next, (draft) => {
      if (background.value !== undefined) draft.canvas.background = background.value;
      if (gradient?.ok) draft.canvas.gradient = gradient.value;
      else if (background.value !== undefined) delete draft.canvas.gradient;
    }),
  };
}

const COMBINE_MODES: readonly ShapeCombine[] = ["union", "subtract", "intersect", "exclude", "flatten"];

const COMBINE_REFUSALS: Record<ShapeOpIssue, string> = {
  too_few: "combine_shapes precisa de pelo menos 2 camadas em layer_ids",
  unsupported: "combine_shapes só aceita formas preenchidas e caminhos vetoriais; linhas, setas, textos, ícones e imagens ficam de fora",
  locked: "há camada travada; destrave com set_locked antes",
  empty: "o resultado ficaria vazio: as formas não se sobrepõem",
  failed: "não foi possível calcular essa combinação; simplifique as formas e tente de novo",
  too_large: "o resultado ficaria grande demais para o projeto",
  invalid: "o resultado ficaria inválido",
  unchanged: "nada mudou",
};

function combine(doc: ImageSurface, op: ImageOperation): Outcome {
  if (!op.mode || !COMBINE_MODES.includes(op.mode)) return refuse(`combine_shapes precisa de mode: ${COMBINE_MODES.join(", ")}`);
  const ids = targets(op);
  const problem = missing(doc, ids) ?? locked(doc, ids);
  if (problem) return problem;
  const result = combineShapes(doc, ids, op.mode);
  if (!result.ok) return refuse(COMBINE_REFUSALS[result.issue]);
  return done(result.document, "combine_shapes", result.ids[0], { created: result.ids });
}

function dispatch(doc: ImageSurface, op: ImageOperation, ctx: ImageOpContext): Outcome {
  switch (op.op) {
    case "add_text":
      return addText(doc, op);
    case "add_shape":
      return addShape(doc, op);
    case "add_image":
      return addImage(doc, op, ctx);
    case "add_icon":
      return addIcon(doc, op, ctx);
    case "update_layer":
      return update(doc, op);
    case "delete_layers":
      return bulk(doc, op, deleteLayers, "nada foi apagado: as camadas estão travadas");
    case "duplicate_layers": {
      const ids = targets(op);
      const problem = missing(doc, ids);
      if (problem) return problem;
      const result = duplicateLayers(doc, ids);
      return done(result.document, "duplicate_layers", result.ids[0], { created: result.ids });
    }
    case "order_layers":
      return orderLayers(doc, op);
    case "align_layers":
      if (!op.alignment) return refuse("align_layers precisa de alignment");
      return locked(doc, targets(op)) ?? bulk(doc, op, (d, ids) => alignLayers(d, ids, op.alignment!), null);
    case "distribute_layers":
      if (!op.axis) return refuse("distribute_layers precisa de axis");
      return bulk(doc, op, (d, ids) => distributeLayers(d, ids, op.axis!), "distribuir precisa de pelo menos 3 camadas destravadas");
    case "group_layers": {
      const ids = targets(op);
      const problem = missing(doc, ids);
      if (problem) return problem;
      const result = groupLayers(doc, ids);
      if (!result.groupId) return refuse("agrupar precisa de pelo menos 2 camadas ou grupos diferentes");
      return done(result.document, "group_layers", ids[0], { created: [result.groupId], changed: ids });
    }
    case "ungroup_layers":
      return bulk(doc, op, ungroupLayers, "essas camadas não estão em grupo nem numa estrutura");
    case "scaffold_layers": {
      const ids = targets(op);
      const problem = missing(doc, ids);
      if (problem) return problem;
      const result = createScaffold(doc, ids);
      if (!result.scaffoldId) return refuse("a estrutura precisa de pelo menos 2 camadas no mesmo nível, e a de baixo vira o elemento pai");
      return done(result.document, "scaffold_layers", ids[0], { created: [result.scaffoldId], changed: ids });
    }
    case "set_hidden":
      if (op.hidden === undefined) return refuse("set_hidden precisa de hidden");
      return bulk(doc, op, (d, ids) => setLayersHidden(d, ids, op.hidden!), null);
    case "set_locked":
      if (op.locked === undefined) return refuse("set_locked precisa de locked");
      return bulk(doc, op, (d, ids) => setLayersLocked(d, ids, op.locked!), null);
    case "replace_image":
      return replaceImage(doc, op, ctx);
    case "combine_shapes":
      return combine(doc, op);
  }
  return refuse(`a operação ${String((op as { op: unknown }).op)} não existe`);
}

function absentArtboard(id: string): Refusal {
  return refuse(`a prancheta ${id} não existe; leia o projeto de novo com studio_read`);
}

function namedArtboard(doc: ImageDocument, op: ImageOperation, ctx: ImageOpContext): Found {
  const id = op.artboard_id ?? ctx.activeArtboard;
  const artboard = op.artboard_id === undefined ? activeArtboard(doc, id) : artboardById(doc, id);
  return artboard ? { ok: true, artboard } : absentArtboard(id);
}

function homeOf(doc: ImageDocument, id: string): Artboard | undefined {
  return artboardOfLayer(doc, id) ?? doc.artboards.find((a) => a.groups?.some((g) => g.id === id));
}

function layerHome(doc: ImageDocument, op: ImageOperation, ctx: ImageOpContext): Found {
  const ids = [...targets(op), ...(op.above_id ? [op.above_id] : []), ...(op.below_id ? [op.below_id] : [])];
  const homes = [...new Set(ids.map((id) => homeOf(doc, id)).filter((a): a is Artboard => a !== undefined))];
  if (homes.length > 1) {
    return refuse(`as camadas estão em pranchetas diferentes (${homes.map((a) => a.id).join(", ")}); cada operação mexe numa prancheta só: separe as operações ou junte as camadas antes com move_to_artboard`);
  }
  return homes.length === 1 ? { ok: true, artboard: homes[0] } : namedArtboard(doc, { ...op, artboard_id: undefined }, ctx);
}

function onArtboard(doc: ImageDocument, artboard: Artboard, outcome: Outcome): DocumentOutcome {
  if (!outcome.ok) return outcome;
  const focus = outcome.focus.kind === "canvas" ? { kind: "artboard" as const, artboardId: artboard.id } : outcome.focus;
  return { ...outcome, document: editArtboard(doc, artboard.id, () => outcome.document), focus };
}

function artboardDone(document: ImageDocument, artboardId: string, label: string, extra: Partial<Extract<DocumentOutcome, { ok: true }>> = {}): DocumentOutcome {
  return { ok: true, document, focus: { kind: "artboard", artboardId }, label, ...extra };
}

function addArtboardOp(doc: ImageDocument, op: ImageOperation, ctx: ImageOpContext): DocumentOutcome {
  if (op.width === undefined || op.height === undefined) return refuse("add_artboard precisa de width e height em pixels");
  const size = { width: op.width, height: op.height };
  if (canvasSizeIssue(size)) return refuse(SIZE_RANGE);
  const background = backgroundOf(op);
  if (!background.ok) return refuse(background.reason);
  const gradient = op.gradient !== undefined ? gradientOf(op.gradient) : null;
  if (gradient && !gradient.ok) return refuse(gradient.reason);
  const added = addArtboard(doc, size, { name: op.name, background: background.value, gradient: gradient?.ok ? gradient.value : undefined, after: activeArtboard(doc, ctx.activeArtboard).id });
  return artboardDone(added.document, added.id, "add_artboard", { created: [added.id], select: [added.id] });
}

function duplicateArtboardOp(doc: ImageDocument, op: ImageOperation, ctx: ImageOpContext): DocumentOutcome {
  const source = namedArtboard(doc, op, ctx);
  if (!source.ok) return source;
  const { canvas } = source.artboard;
  const size = op.width !== undefined || op.height !== undefined ? { width: op.width ?? canvas.width, height: op.height ?? canvas.height } : undefined;
  if (size && canvasSizeIssue(size)) return refuse(SIZE_RANGE);
  const copy = duplicateArtboard(doc, source.artboard.id, { name: op.name, size });
  return artboardDone(copy.document, copy.id, "duplicate_artboard", { created: [copy.id], copies: copy.copies, select: [copy.id] });
}

function updateArtboardOp(doc: ImageDocument, op: ImageOperation, ctx: ImageOpContext): DocumentOutcome {
  const target = namedArtboard(doc, op, ctx);
  if (!target.ok) return target;
  if (op.name === undefined && op.width === undefined && op.height === undefined && op.background === undefined && op.gradient === undefined) {
    return refuse("update_artboard precisa de name, width, height, background ou gradient");
  }
  const painted = paintedCanvas(target.artboard, op);
  if (!painted.ok) return refuse(painted.reason);
  const id = target.artboard.id;
  const renamed = op.name !== undefined ? updateArtboard(doc, id, { name: op.name }) : doc;
  return artboardDone(editArtboard(renamed, id, () => painted.value), id, "update_artboard", { changed: [id] });
}

function deleteArtboardOp(doc: ImageDocument, op: ImageOperation): DocumentOutcome {
  if (!op.artboard_id) return refuse("delete_artboard precisa de artboard_id");
  if (!artboardById(doc, op.artboard_id)) return absentArtboard(op.artboard_id);
  if (doc.artboards.length === 1) return refuse("não dá para apagar a última prancheta do projeto");
  return { ok: true, document: deleteArtboards(doc, [op.artboard_id]), focus: { kind: "canvas" }, label: "delete_artboard", changed: [op.artboard_id] };
}

function moveToArtboardOp(doc: ImageDocument, op: ImageOperation, ctx: ImageOpContext): DocumentOutcome {
  const ids = targets(op);
  if (ids.length === 0) return refuse("move_to_artboard precisa de layer_ids");
  if (!op.artboard_id) return refuse("move_to_artboard precisa de artboard_id, a prancheta de destino");
  const destination = artboardById(doc, op.artboard_id);
  if (!destination) return absentArtboard(op.artboard_id);
  const home = layerHome(doc, op, ctx);
  if (!home.ok) return home;
  const problem = missing(home.artboard, ids) ?? locked(home.artboard, ids);
  if (problem) return problem;
  if (home.artboard.id === destination.id) return refuse(`essas camadas já estão na prancheta ${destination.id}`);
  return { ok: true, document: moveLayersToArtboard(doc, ids, destination.id, "keep-relative"), focus: { kind: "layer", layerId: ids[0] }, label: "move_to_artboard", changed: ids };
}

function selectOp(doc: ImageDocument, op: ImageOperation, ctx: ImageOpContext): DocumentOutcome {
  if (op.artboard_id !== undefined && targets(op).length === 0) {
    const target = namedArtboard(doc, op, ctx);
    return target.ok ? artboardDone(doc, target.artboard.id, "select", { select: [target.artboard.id] }) : target;
  }
  const home = layerHome(doc, op, ctx);
  if (!home.ok) return home;
  const ids = targets(op);
  const problem = ids.length > 0 ? missing(home.artboard, ids) : null;
  if (problem) return problem;
  return onArtboard(doc, home.artboard, done(home.artboard, "select", ids[0] ?? null, { select: ids }));
}

export function applyImageOperation(doc: ImageDocument, op: ImageOperation, ctx: ImageOpContext): DocumentOutcome {
  switch (op.op) {
    case "add_artboard":
      return addArtboardOp(doc, op, ctx);
    case "duplicate_artboard":
      return duplicateArtboardOp(doc, op, ctx);
    case "update_artboard":
      return updateArtboardOp(doc, op, ctx);
    case "delete_artboard":
      return deleteArtboardOp(doc, op);
    case "move_to_artboard":
      return moveToArtboardOp(doc, op, ctx);
    case "select":
      return selectOp(doc, op, ctx);
  }
  const home = CREATES.has(op.op) ? namedArtboard(doc, op, ctx) : layerHome(doc, op, ctx);
  return home.ok ? onArtboard(doc, home.artboard, dispatch(home.artboard, op, ctx)) : home;
}

export function imageIds(doc: ImageDocument): string[] {
  return doc.artboards.flatMap((a) => [a.id, ...a.layers.map((l) => l.id), ...(a.groups ?? []).map((g) => g.id)]);
}
