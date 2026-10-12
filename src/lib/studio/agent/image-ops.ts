import { produce } from "immer";

import { cropFrame, applyCropBox, applyFramedCrop, centeredFramedBox, framedRatio } from "../crop";
import { fillFrame, fillTargetOf } from "../frame-fill";
import { isPlaceholderSlot } from "../library/frame-shapes";
import {
  FRAME_KINDS,
  newIconLayer,
  newImageLayer,
  newTextLayer,
  STUDIO_LIMITS,
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
import { activeArtboard, addArtboard, artboardById, artboardOfLayer, deleteArtboards, duplicateArtboard, editArtboard, layerOf, moveLayersToArtboard, updateArtboard } from "../artboards";
import { ARRANGE_ALIGNS, ARRANGE_LAYOUTS, ARRANGE_ORDERS, arrangeArtboards, arrangeIssue, MAX_ARRANGE_GAP, type ArrangeAlign, type ArrangeIssue, type ArrangeLayout, type ArrangeOrder } from "../artboard-arrange";
import { fitInside, fittedTransform } from "../geometry";
import { dropItem, groupLayerIds } from "../groups";
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
  pasteLayers,
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
import { combineShapes, mergeLive, type ShapeCombine, type ShapeOpIssue } from "../shape-ops";
import { MERGE_MODES, takesPathOps, type MergeMode } from "../path-ops";
import { pathOpsPatch } from "../path-op-edits";
import { pathOpsFrom, type AgentPathOp } from "./path-op-ops";
import { canvasSizeIssue, isValidColor, layerIssue } from "../validate";
import { missingTarget, type AgentFocus, type AgentOutcome, type SpreadPart } from "./batch";
import { gradeChangeOf, type AgentColorFields } from "./color-op";
import { chromaPatchOf, wantsDetectedKey, type AgentChromaFields } from "./chroma-ops";
import { layerKeySource } from "../chroma-detect";
import { layerChroma } from "../chroma-edit";
import type { ChromaKey } from "../chroma-key";
import { paintPatch, type AgentPaintFields } from "./paint-ops";
import { repeatOf, type AgentRepeat } from "./repeat-ops";
import { applyPixelOperation, type AgentPixelFields } from "./pixel-ops";
import { componentOperation, flaggedComponent, isComponentOperation, moveRefusal, partRefusal, type AgentComponentFields } from "./component-ops";
import { settleImage } from "../image-settle";
import type { HugMeasure } from "../auto-layout";
import { isStyleOperation, styleOperation, type AgentStyleFields } from "./style-ops";
import { isLayoutOperation, layoutOperation, type AgentLayoutFields } from "./auto-layout-ops";
import { expandRepeat, repeatConflict, repeatLayers, setRepeat, sourceBox } from "../repeat-edits";
import { importSvg, isSvgText, SVG_IMPORT_SHARE } from "../svg-import";
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
import { styledText, type AgentTextRunFields } from "./text-run-ops";
import { elementPlan, iconPlan, unusedColorNotes, type AgentElementFields, type LibraryLookup } from "./element-ops";
import { imageContent, insertImageContent } from "../library/instantiate";
import { isStillVfxOperation, STILL_VFX_OPERATIONS, stillVfxOperation, type AgentStillVfxFields, type StillVfxOpName } from "./still-vfx-ops";
import type { StillVfxTarget } from "../still-vfx-edit";
import { CHART_IMAGE_OPERATIONS, chartChangeRequested, chartPartRefusal, chartSpecFrom, isChartImageOperation, type AgentChartFields, type ChartImageOpName } from "./chart-ops";
import { chartTransform, expandChart, newChartLayer } from "../chart-edits";
import { stylePalette } from "../chart";
import { LIBRARY_INK } from "../library/model";
import { isTableOperation, tableCellStyle, tableCellText, tableChangeRequested, tableSpecFrom, TABLE_OPERATIONS, type AgentTableFields, type TableOpName } from "./table-ops";
import { isQrOperation, qrChangeRequested, qrSpecFrom, QR_OPERATIONS, type AgentQrFields, type QrOpName } from "./qr-ops";
import { newQrLayer, newTableLayer, qrTransform, tableTransform } from "../generated-edits";

export const IMAGE_OPERATIONS = [
  "add_text",
  "add_shape",
  "add_image",
  "add_icon",
  "add_element",
  "update_layer",
  "style_text",
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
  "fill_frame",
  "update_artboard",
  "add_artboard",
  "duplicate_artboard",
  "delete_artboard",
  "move_to_artboard",
  "arrange_artboards",
  "select",
  "combine_shapes",
  "set_path_ops",
  "set_color",
  "set_chroma_key",
  "remove_chroma_key",
  "import_svg",
  "repeat_layers",
  "set_repeat",
  "clear_repeat",
  "expand_repeat",
  "create_component",
  "add_instance",
  "set_overrides",
  "reset_overrides",
  "detach_instance",
  "swap_component",
  "create_style",
  "update_style",
  "apply_style",
  "detach_style",
  "delete_style",
  "set_layout",
  "remove_layout",
  "set_layout_item",
  "add_paint_layer",
  "paint_area",
  "crop_to_area",
  "copy_area_to_layer",
  ...STILL_VFX_OPERATIONS,
  ...CHART_IMAGE_OPERATIONS,
  ...TABLE_OPERATIONS,
  ...QR_OPERATIONS,
] as const;

export type ImageOpName = (typeof IMAGE_OPERATIONS)[number];

export const IMAGE_ID_FIELDS = ["layer_id", "layer_ids", "above_id", "below_id", "artboard_id", "artboard_ids", "group_id", "component_id", "part_id", "style_id", "vfx_id"] as const;

export interface AgentFilters {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  blur?: number;
}

export interface ImageOperation extends AgentBox, AgentStyle, AgentColorFields, AgentPaintFields, AgentComponentFields, AgentStyleFields, AgentLayoutFields, Omit<AgentChromaFields, "chroma_property">, AgentPixelFields, AgentElementFields, AgentTextRunFields, AgentStillVfxFields, AgentChartFields, AgentTableFields, AgentQrFields {
  op: ImageOpName;
  ref?: string;
  layer_id?: string;
  layer_ids?: string[];
  artboard_id?: string;
  artboard_ids?: string[];
  artboard_x?: number;
  artboard_y?: number;
  arrange_layout?: ArrangeLayout;
  arrange_gap?: number;
  arrange_order?: ArrangeOrder;
  arrange_align?: ArrangeAlign;
  arrange_columns?: number;
  arrange_by_size?: boolean;
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
  svg?: string;
  group_id?: string;
  repeat?: AgentRepeat;
  path_ops?: AgentPathOp[];
  live?: boolean;
}

export interface ImageOpContext {
  naturalSize: (mediaId: string) => CanvasSize | undefined;
  icons: readonly string[];
  activeArtboard: string;
  keyColor?: (layer: Layer) => string | undefined;
  measure?: HugMeasure;
  library?: LibraryLookup;
  isLut?: (mediaId: string) => boolean;
  shortLinkUrl?: (id: string) => string | undefined;
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
const POSITION_RANGE = `artboard_x e artboard_y vão de -${STUDIO_LIMITS.maxArtboardCoordinate} a ${STUDIO_LIMITS.maxArtboardCoordinate} pixels`;
const CREATES: ReadonlySet<ImageOpName> = new Set(["add_text", "add_shape", "add_image", "add_icon", "add_element", "add_paint_layer"]);

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
  if (ids.length === 0) return missingTarget("layer_id", "informe layer_id ou layer_ids");
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
  if (layer.clip) return { ok: true, value: applyFramedCrop(layer, frame, crop === FULL_CROP ? centeredFramedBox(frame, framedRatio(layer, canvas)) : box, canvas) };
  return { ok: true, value: applyCropBox(layer, frame, box, canvas) };
}

function layerPatch(op: ImageOperation, layer: Layer, doc: ImageSurface, ctx: ImageOpContext): Noted<LayerPatch> {
  const style = hasStyle(op) ? stylePatch(op, IMAGE_CLEARS) : ({ ok: true, value: {} } as const);
  if (!style.ok) return style;
  const effects = hasImageEffects(op) ? effectsPatch(op, layer, doc) : ({ ok: true, value: {} } as const);
  if (!effects.ok) return effects;
  const fitted = fitsLayer(layer, { ...style.value, ...effects.value });
  if (!fitted.ok) return fitted;
  const paint = paintPatch(op, { ...layer, ...fitted.value }, (mediaId) => ctx.naturalSize(mediaId) !== undefined);
  if (!paint.ok) return paint;
  const ignored = [...fitted.ignored, ...paint.ignored];
  const patch: LayerPatch = { ...fitted.value, ...paint.value, ...(hasBox(op) ? { transform: withBox(layer.transform, op) } : {}) };
  const crop = op.crop ?? (op.clear?.includes("crop") ? FULL_CROP : undefined);
  if (!crop) return { ok: true, value: patch, ignored };
  if (layer.type !== "image") return { ok: true, value: patch, ignored: [...ignored, "crop só vale para imagens"] };
  const cut = cropped({ ...layer, ...patch }, crop, doc.canvas);
  return cut.ok ? { ok: true, value: { ...patch, ...cut.value }, ignored } : cut;
}

function insert(doc: ImageSurface, layer: Layer, label: string, notes: readonly string[]): Outcome {
  const next = addLayers(doc, [layer]);
  return checked(next, [layer.id]) ?? done(next, label, layer.id, { created: [layer.id], notes: [...notes] });
}

function styled(doc: ImageSurface, base: Layer, op: ImageOperation, ctx: ImageOpContext, label: string, ignored: readonly string[] = []): Outcome {
  const patch = layerPatch(op, { ...base, transform: withBox(base.transform, op) }, doc, ctx);
  if (!patch.ok) return refuse(patch.reason);
  return insert(doc, { ...base, ...patch.value, transform: patch.value.transform ?? withBox(base.transform, op) }, label, [...ignored, ...patch.ignored]);
}

function addText(doc: ImageSurface, op: ImageOperation, ctx: ImageOpContext): Outcome {
  if (!op.text || op.text.trim() === "") return refuse("add_text precisa de text");
  const preset = op.style ?? "heading";
  if (!(preset in TEXT_PRESETS)) return refuse(`o estilo ${preset} não existe; use heading, subheading ou body`);
  return styled(doc, newTextLayer(op.text, preset), op, ctx, "add_text");
}

function addShape(doc: ImageSurface, op: ImageOperation, ctx: ImageOpContext): Outcome {
  const base = shapeLayerOf(op, doc.canvas);
  if (!base.ok) return refuse(base.reason);
  return styled(doc, base.value, op, ctx, "add_shape", base.ignored);
}

function addIcon(doc: ImageSurface, op: ImageOperation, ctx: ImageOpContext): Outcome {
  const plan = iconPlan(op.icon_id, ctx.icons, "image", ctx.library, op.fill);
  if (!plan.ok) return refuse(plan.reason);
  if (plan.kind === "catalog") return styled(doc, newIconLayer(plan.iconId), op, ctx, "add_icon");
  return addElement(doc, { ...op, ...plan.element, fill: undefined }, ctx);
}

function addElement(doc: ImageSurface, op: ImageOperation, ctx: ImageOpContext): Outcome {
  const plan = elementPlan(op, "image", ctx.library);
  if (!plan.ok) return refuse(plan.reason);
  const request = { canvas: doc.canvas, locale: plan.locale, text: plan.text, box: plan.box, name: plan.name };
  const content = imageContent(plan.item, { ...request, colors: plan.colors });
  if (!content) return refuse(`o item ${plan.item.id} não entra no editor de imagem`);
  const placed = insertImageContent(doc, content);
  const slots = content.layers.filter(isPlaceholderSlot).map((layer) => placed.ids[content.layers.indexOf(layer)]);
  const notes = [...plan.notes, ...unusedColorNotes(plan.colors, imageContent(plan.item, request)?.layers ?? []), ...(slots.length > 0 ? [`molduras vazias para fotos: ${slots.join(", ")}; preencha cada uma com fill_frame(layer_id, media_id)`] : [])];
  return checked(placed.document, placed.ids) ?? done(placed.document, "add_element", placed.ids[0] ?? null, { created: placed.ids, notes });
}

function addImage(doc: ImageSurface, op: ImageOperation, ctx: ImageOpContext): Outcome {
  const natural = op.media_id ? ctx.naturalSize(op.media_id) : undefined;
  if (!op.media_id || !natural) return refuse(`a imagem ${op.media_id ?? "(sem media_id)"} não está na biblioteca`);
  const fitted = fittedTransform(natural.width, natural.height, doc.canvas);
  const transform = hasBox(op) ? fitInside(natural.width, natural.height, withBox(fitted, op), doc.canvas) : fitted;
  const base = newImageLayer(op.media_id, transform);
  const patch = layerPatch({ ...op, x: undefined, y: undefined, w: undefined, h: undefined, rotation: undefined, opacity: undefined }, base, doc, ctx);
  if (!patch.ok) return refuse(patch.reason);
  const opacity = op.opacity !== undefined || op.rotation !== undefined ? { transform: { ...(patch.value.transform ?? transform), ...(op.opacity !== undefined ? { opacity: op.opacity } : {}), ...(op.rotation !== undefined ? { rotation: op.rotation } : {}) } } : {};
  return insert(doc, { ...base, ...patch.value, ...opacity }, "add_image", patch.ignored);
}

function update(doc: ImageSurface, op: ImageOperation, ctx: ImageOpContext): Outcome {
  const ids = targets(op);
  const problem = missing(doc, ids) ?? locked(doc, ids);
  if (problem) return problem;
  let next = doc;
  const changed: string[] = [];
  const notes: string[] = [];
  for (const id of ids) {
    const patch = layerPatch(op, layerById(next, id)!, next, ctx);
    if (!patch.ok) return refuse(`camada ${id}: ${patch.reason}`);
    notes.push(...patch.ignored.map((note) => `camada ${id}: ${note}`));
    if (Object.keys(patch.value).length === 0) continue;
    next = updateLayers(next, [id], patch.value);
    changed.push(id);
  }
  if (changed.length === 0) return refuse(notes.length > 0 ? `nada foi aplicado: ${notes.join("; ")}` : "update_layer precisa de algum campo para mudar");
  return checked(next, changed) ?? done(next, "update_layer", changed[0], { changed, notes });
}

function styleText(doc: ImageSurface, op: ImageOperation): Outcome {
  const ids = op.layer_id ? [op.layer_id] : [];
  const problem = missing(doc, ids) ?? locked(doc, ids);
  if (problem) return problem;
  const layer = layerById(doc, ids[0])!;
  if (layer.type === "table" && layer.table) {
    const table = tableCellStyle(layer.table, op);
    if (!table.ok) return refuse(table.reason);
    const next = updateLayers(doc, [layer.id], { table: table.value });
    return checked(next, [layer.id]) ?? done(next, "style_text", layer.id, { changed: [layer.id] });
  }
  if (layer.type !== "text") return refuse(`a camada ${layer.id} não é um texto; style_text vale para camadas de texto e para células de tabela (com table_row e table_column)`);
  const styled = styledText(layer, layer.text ?? "", op);
  if (!styled.ok) return refuse(styled.reason);
  const next = updateLayers(doc, [layer.id], styled.value.patch);
  return checked(next, [layer.id]) ?? done(next, "style_text", layer.id, { changed: [layer.id] });
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

const FILL_REFUSALS = {
  noFrame: "fill_frame precisa de layer_id de uma moldura: uma forma fechada (retângulo, elipse, triângulo, estrela ou caminho fechado) que não seja a base de um grupo, ou a foto já recortada nela",
  locked: "a moldura ou a foto dela está travada; destrave com set_locked antes",
} as const;

function fillFrameOp(doc: ImageSurface, op: ImageOperation, ctx: ImageOpContext): Outcome {
  const target = op.layer_id ? fillTargetOf(doc, op.layer_id) : null;
  if (!op.layer_id || !layerById(doc, op.layer_id)) return absentLayer(op.layer_id);
  if (!target) return refuse(`${FILL_REFUSALS.noFrame}; ${op.layer_id} não é`);
  const natural = op.media_id ? ctx.naturalSize(op.media_id) : undefined;
  if (!op.media_id || !natural) return refuse(`a imagem ${op.media_id ?? "(sem media_id)"} não está na biblioteca`);
  const outcome = fillFrame(doc, target, op.media_id, natural);
  if (!outcome.ok) return refuse(FILL_REFUSALS[outcome.reason]);
  const extra = target.photoId ? { changed: [outcome.photoId] } : { created: [outcome.photoId] };
  return checked(outcome.document, [outcome.photoId]) ?? done(outcome.document, "fill_frame", outcome.photoId, extra);
}

const SVG_REFUSALS = {
  invalid: "o svg não pôde ser lido; mande o código completo de um <svg> válido",
  empty: "o svg não tem formas que virem camadas (path, rect, circle, ellipse, line, polyline ou polygon)",
} as const;

function importSvgOp(doc: ImageSurface, op: ImageOperation): Outcome {
  if (!op.svg || !isSvgText(op.svg)) return refuse("import_svg precisa de svg com o código de um <svg>");
  const { width, height } = doc.canvas;
  const side = Math.min(width, height) * SVG_IMPORT_SHARE;
  const box = withBox({ x: 0.5, y: 0.5, w: side / width, h: side / height, rotation: 0, opacity: 1 }, op);
  const target = { center: { x: box.x * width, y: box.y * height }, width: box.w * width, height: box.h * height, rotation: box.rotation };
  const result = importSvg(op.svg, doc.canvas, { target, name: op.name });
  if (!result.ok) return refuse(SVG_REFUSALS[result.reason]);
  const pasted = pasteLayers(doc, result.value.layers, 0, result.value.groups);
  const notes = result.value.skipped > 0 ? [`${result.value.skipped} elementos do svg não viraram camadas (texto, imagem ou filtro)`] : [];
  return checked(pasted.document, pasted.ids) ?? done(pasted.document, "import_svg", pasted.ids[0] ?? null, { created: pasted.ids, notes });
}

function colorLayers(doc: ImageSurface, op: ImageOperation, ctx: ImageOpContext): Outcome {
  const change = gradeChangeOf(op, ctx.isLut);
  if (!change.ok) return refuse(change.reason);
  const ids = targets(op);
  const problem = missing(doc, ids);
  if (problem) return problem;
  const notImage = ids.find((id) => doc.layers.find((l) => l.id === id)?.type !== "image");
  if (notImage) return refuse(`a camada ${notImage} não é uma imagem; a correção de cor vale só para imagens`);
  const applied = new Map(doc.layers.filter((layer) => ids.includes(layer.id)).map((layer) => [layer.id, change.apply({ color: layer.color, gradientMap: layer.gradientMap })]));
  const failed = [...applied.values()].find((value) => typeof value === "string");
  if (typeof failed === "string") return refuse(failed);
  return bulk(doc, op, (d, chosen) => updateLayers(d, chosen, (layer) => {
    const next = applied.get(layer.id);
    return next && typeof next !== "string" ? { color: next.color, gradientMap: next.gradientMap } : {};
  }), null);
}

export function autoKeySources(doc: ImageDocument, operations: readonly ImageOperation[]): Map<string, Pick<Layer, "assetId" | "crop">> {
  const created = new Map<string, string>(operations.flatMap((op) => (op.op === "add_image" && op.ref && op.media_id ? [[`@${op.ref}`, op.media_id] as const] : [])));
  const sources = new Map<string, Pick<Layer, "assetId" | "crop">>();
  for (const op of operations) {
    if (!wantsDetectedKey(op)) continue;
    for (const id of targets(op)) {
      const mediaId = created.get(id);
      const layer: Pick<Layer, "type" | "assetId" | "crop"> | undefined = mediaId ? { type: "image", assetId: mediaId } : layerOf(doc, id);
      const source = layer ? layerKeySource(layer) : null;
      if (layer && source) sources.set(source, { assetId: layer.assetId, ...(layer.crop ? { crop: layer.crop } : {}) });
    }
  }
  return sources;
}

function chromaLayers(doc: ImageSurface, op: ImageOperation, ctx: ImageOpContext): Outcome {
  const ids = targets(op);
  const problem = missing(doc, ids);
  if (problem) return problem;
  const layers = ids.map((id) => doc.layers.find((l) => l.id === id)!);
  const notImage = layers.find((layer) => layer.type !== "image");
  if (notImage) return refuse(`a camada ${notImage.id} não é uma imagem; o recorte de fundo vale só para imagens`);
  if (op.op === "remove_chroma_key") {
    const bare = layers.find((layer) => !layer.chromaKey);
    if (bare) return refuse(`a camada ${bare.id} não tem recorte de fundo`);
    return bulk(doc, op, (d, chosen) => updateLayers(d, chosen, { chromaKey: undefined }), null);
  }
  const keys = new Map<string, ChromaKey>();
  for (const layer of layers) {
    const patch = chromaPatchOf(op, () => ctx.keyColor?.(layer));
    if (typeof patch === "string") return refuse(patch);
    const key = layerChroma(layer, patch);
    if (typeof key === "string") return refuse("o recorte ficaria inválido; confira chroma_color e os valores");
    keys.set(layer.id, key);
  }
  return bulk(doc, op, (d, chosen) => updateLayers(d, chosen, (layer) => ({ chromaKey: keys.get(layer.id) })), null);
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
  if (op.live) {
    if (!(MERGE_MODES as readonly string[]).includes(op.mode)) return refuse(`combine_shapes com live aceita mode: ${MERGE_MODES.join(", ")}`);
    const merged = mergeLive(doc, ids, op.mode as MergeMode);
    if (!merged.ok) return refuse(merged.issue === "unsupported" ? "combine_shapes com live precisa de uma forma embaixo (retângulo, elipse, triângulo, estrela ou caminho) e formas vetoriais em cima" : COMBINE_REFUSALS[merged.issue]);
    return done(merged.document, "combine_shapes", merged.ids[0], { changed: merged.ids });
  }
  const result = combineShapes(doc, ids, op.mode);
  if (!result.ok) return refuse(COMBINE_REFUSALS[result.issue]);
  return done(result.document, "combine_shapes", result.ids[0], { created: result.ids });
}

function setPathOpsOp(doc: ImageSurface, op: ImageOperation): Outcome {
  const ids = targets(op);
  const problem = missing(doc, ids) ?? locked(doc, ids);
  if (problem) return problem;
  if (!op.path_ops) return refuse("set_path_ops precisa de path_ops: a pilha inteira de operadores, ou [] para tirar todos");
  const patches = new Map<string, ReturnType<typeof pathOpsPatch>>();
  for (const layer of doc.layers.filter((l) => ids.includes(l.id))) {
    if (!takesPathOps(layer)) return refuse(`a camada ${layer.id} não aceita operadores de caminho: eles valem para formas (retângulo, elipse, triângulo, estrela e caminho), não para linhas, setas, textos, ícones ou imagens`);
    const result = pathOpsFrom(op.path_ops, layer.pathOps, null);
    if (!result.ok) return refuse(result.reason);
    patches.set(layer.id, pathOpsPatch(result.ops));
  }
  return done(updateLayers(doc, ids, (layer) => patches.get(layer.id) ?? {}), "set_path_ops", ids[0] ?? null, { changed: ids });
}

const NESTED_REPEAT = "repetição dentro de repetição não é suportada; tire a repetição do grupo de fora ou de dentro antes";

function repeatLayersOp(doc: ImageSurface, op: ImageOperation): Outcome {
  const ids = targets(op);
  const problem = missing(doc, ids) ?? locked(doc, ids);
  if (problem) return problem;
  if (!op.repeat) return refuse("repeat_layers precisa de repeat com mode: radial, grid ou mirror");
  const repeat = repeatOf(op.repeat, undefined, sourceBox(doc.layers.filter((l) => ids.includes(l.id)), doc.canvas));
  if (!repeat.ok) return refuse(repeat.reason);
  const result = repeatLayers(doc, ids, repeat.value);
  if (!result.groupId) return refuse(NESTED_REPEAT);
  return done(result.document, "repeat_layers", ids[0], { created: [result.groupId], changed: ids });
}

function repeatGroupOp(doc: ImageSurface, op: ImageOperation): Outcome {
  const group = op.group_id ? doc.groups?.find((g) => g.id === op.group_id) : undefined;
  if (!group) return refuse(`o grupo ${op.group_id ?? "(sem group_id)"} não existe; leia o projeto de novo com studio_read`);
  const memberIds = groupLayerIds(doc, group.id);
  const members = doc.layers.filter((l) => memberIds.includes(l.id));
  const problem = locked(doc, memberIds);
  if (problem) return problem;
  if (op.op === "clear_repeat") {
    if (!group.repeat) return refuse(`o grupo ${group.id} não tem repetição`);
    return done(setRepeat(doc, group.id, undefined), "clear_repeat", members[0]?.id ?? null, { changed: [group.id] });
  }
  if (op.op === "expand_repeat") {
    const expanded = expandRepeat(doc, group.id);
    if (!expanded.ok) return refuse(expanded.reason === "missing" ? `o grupo ${group.id} não tem repetição` : "algumas cópias ficariam longe demais da prancheta; diminua a repetição antes de expandir");
    return done(expanded.document, "expand_repeat", members[0]?.id ?? null, { created: expanded.created, changed: [group.id] });
  }
  if (!op.repeat) return refuse("set_repeat precisa de repeat");
  if (repeatConflict(doc, group.id)) return refuse(NESTED_REPEAT);
  const repeat = repeatOf(op.repeat, group.repeat, sourceBox(members, doc.canvas));
  if (!repeat.ok) return refuse(repeat.reason);
  return done(setRepeat(doc, group.id, repeat.value), "set_repeat", members[0]?.id ?? null, { changed: [group.id] });
}

function dispatch(doc: ImageSurface, op: ImageOperation, ctx: ImageOpContext): Outcome {
  switch (op.op) {
    case "add_text":
      return addText(doc, op, ctx);
    case "add_shape":
      return addShape(doc, op, ctx);
    case "add_image":
      return addImage(doc, op, ctx);
    case "add_icon":
      return addIcon(doc, op, ctx);
    case "add_element":
      return addElement(doc, op, ctx);
    case "update_layer":
      return update(doc, op, ctx);
    case "style_text":
      return styleText(doc, op);
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
    case "set_color":
      return colorLayers(doc, op, ctx);
    case "set_chroma_key":
    case "remove_chroma_key":
      return chromaLayers(doc, op, ctx);
    case "import_svg":
      return importSvgOp(doc, op);
    case "set_hidden":
      if (op.hidden === undefined) return refuse("set_hidden precisa de hidden");
      return bulk(doc, op, (d, ids) => setLayersHidden(d, ids, op.hidden!), null);
    case "set_locked":
      if (op.locked === undefined) return refuse("set_locked precisa de locked");
      return bulk(doc, op, (d, ids) => setLayersLocked(d, ids, op.locked!), null);
    case "replace_image":
      return replaceImage(doc, op, ctx);
    case "fill_frame":
      return fillFrameOp(doc, op, ctx);
    case "combine_shapes":
      return combine(doc, op);
    case "set_path_ops":
      return setPathOpsOp(doc, op);
    case "repeat_layers":
      return repeatLayersOp(doc, op);
    case "set_repeat":
    case "clear_repeat":
    case "expand_repeat":
      return repeatGroupOp(doc, op);
    case "add_paint_layer":
    case "paint_area":
    case "crop_to_area":
    case "copy_area_to_layer":
      return applyPixelOperation(doc, { ...op, op: op.op });
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

function targetHomes(doc: ImageDocument, op: ImageOperation): Artboard[] {
  const ids = [...targets(op), ...(op.above_id ? [op.above_id] : []), ...(op.below_id ? [op.below_id] : []), ...(op.group_id ? [op.group_id] : [])];
  return [...new Set(ids.map((id) => homeOf(doc, id)).filter((a): a is Artboard => a !== undefined))];
}

function layerHome(doc: ImageDocument, op: ImageOperation, ctx: ImageOpContext): Found {
  const homes = targetHomes(doc, op);
  if (homes.length > 1) {
    return refuse(
      `as camadas estão em pranchetas diferentes (${homes.map((a) => a.id).join(", ")}); ${op.op} depende da prancheta onde as camadas estão e mexe numa prancheta só: mande uma operação por prancheta ou junte as camadas antes com move_to_artboard`,
    );
  }
  return homes.length === 1 ? { ok: true, artboard: homes[0] } : namedArtboard(doc, { ...op, artboard_id: undefined }, ctx);
}

const SPREADS: ReadonlySet<ImageOpName> = new Set(["update_layer", "delete_layers", "duplicate_layers", "order_layers", "set_hidden", "set_locked", "set_color", "set_chroma_key", "remove_chroma_key", "set_path_ops"]);

function spreads(doc: ImageDocument, op: ImageOperation): boolean {
  return SPREADS.has(op.op) && op.above_id === undefined && op.below_id === undefined && op.group_id === undefined && targetHomes(doc, op).length > 1;
}

function spreadAcross(doc: ImageDocument, op: ImageOperation, ctx: ImageOpContext): DocumentOutcome {
  const ids = targets(op);
  const absent = ids.find((id) => !homeOf(doc, id));
  if (absent) return absentLayer(absent);
  let next = doc;
  let focus: AgentFocus | null = null;
  const created: string[] = [];
  const changed: string[] = [];
  const notes: string[] = [];
  const parts: SpreadPart[] = [];
  for (const artboard of doc.artboards) {
    const mine = ids.filter((id) => homeOf(doc, id)?.id === artboard.id);
    if (mine.length === 0) continue;
    const outcome = dispatch(artboardById(next, artboard.id)!, { ...op, layer_id: undefined, layer_ids: mine }, ctx);
    if (!outcome.ok) return refuse(`prancheta ${artboard.id}: ${outcome.reason}`);
    next = editArtboard(next, artboard.id, () => outcome.document);
    created.push(...(outcome.created ?? []));
    changed.push(...(outcome.changed ?? []));
    notes.push(...(outcome.notes ?? []).map((note) => `prancheta ${artboard.id}: ${note}`));
    parts.push({ artboard: artboard.id, ids: [...(outcome.created ?? []), ...(outcome.changed ?? [])] });
    focus ??= outcome.focus.kind === "canvas" ? { kind: "artboard", artboardId: artboard.id } : outcome.focus;
  }
  return { ok: true, document: next, focus: focus ?? { kind: "canvas" }, label: op.op, created, changed, notes, spread: parts };
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
  const moves = op.artboard_x !== undefined || op.artboard_y !== undefined;
  if (op.name === undefined && op.width === undefined && op.height === undefined && op.background === undefined && op.gradient === undefined && op.component === undefined && !moves) {
    const layerPlace = op.x !== undefined || op.y !== undefined ? "; x e y são das camadas: para mover a prancheta use artboard_x e artboard_y, em pixels como em studio_read" : "";
    return refuse(`update_artboard precisa de name, width, height, background, gradient, component, artboard_x ou artboard_y${layerPlace}`);
  }
  const place = [op.artboard_x, op.artboard_y].find((value) => value !== undefined && !(Number.isFinite(value) && Math.abs(value) <= STUDIO_LIMITS.maxArtboardCoordinate));
  if (place !== undefined) return refuse(POSITION_RANGE);
  const painted = paintedCanvas(target.artboard, op);
  if (!painted.ok) return refuse(painted.reason);
  const id = target.artboard.id;
  const flagged = op.component !== undefined ? flaggedComponent(doc, id, op.component) : ({ ok: true, document: doc } as const);
  if (!flagged.ok) return flagged;
  const renamed = op.name !== undefined || moves ? updateArtboard(flagged.document, id, { name: op.name, x: op.artboard_x, y: op.artboard_y }) : flagged.document;
  return artboardDone(editArtboard(renamed, id, () => painted.value), id, "update_artboard", { changed: [id] });
}

const ARRANGE_REFUSALS: Record<Exclude<ArrangeIssue, "unknown">, string> = {
  too_few: "arrange_artboards precisa de pelo menos 2 pranchetas diferentes em artboard_ids, ou de nenhuma para organizar todas",
  gap: `arrange_gap vai de 0 a ${MAX_ARRANGE_GAP} pixels`,
  columns: "arrange_columns precisa ser um número inteiro a partir de 1",
};

function choiceRefusal(field: string, value: string | undefined, allowed: readonly string[]): Refusal | null {
  return value !== undefined && !allowed.includes(value) ? refuse(`${field} precisa ser um de: ${allowed.join(", ")}`) : null;
}

function arrangeArtboardsOp(doc: ImageDocument, op: ImageOperation): DocumentOutcome {
  if (op.arrange_layout === undefined) return refuse(`arrange_artboards precisa de arrange_layout: ${ARRANGE_LAYOUTS.join(", ")}`);
  const choice = choiceRefusal("arrange_layout", op.arrange_layout, ARRANGE_LAYOUTS) ?? choiceRefusal("arrange_order", op.arrange_order, ARRANGE_ORDERS) ?? choiceRefusal("arrange_align", op.arrange_align, ARRANGE_ALIGNS);
  if (choice) return choice;
  const ids = op.artboard_ids ?? (op.artboard_id ? [op.artboard_id] : doc.artboards.map((a) => a.id));
  const absent = ids.find((id) => !artboardById(doc, id));
  if (absent) return absentArtboard(absent);
  const options = { layout: op.arrange_layout, gap: op.arrange_gap, order: op.arrange_order, align: op.arrange_align, columns: op.arrange_columns, bySize: op.arrange_by_size };
  const issue = arrangeIssue(doc, ids, options);
  if (issue && issue !== "unknown") return refuse(ARRANGE_REFUSALS[issue]);
  const next = arrangeArtboards(doc, ids, options);
  const moved = [...new Set(ids)].filter((id) => artboardById(next, id) !== artboardById(doc, id));
  const notes = moved.length === 0 ? ["as pranchetas já estavam nesse arranjo; nenhuma mudou de lugar"] : [];
  return { ok: true, document: next, focus: { kind: "canvas" }, label: "arrange_artboards", changed: moved, notes };
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
  const nesting = moveRefusal(destination, home.artboard.layers.filter((l) => ids.includes(l.id)));
  if (nesting) return nesting;
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

function chartDefaults(doc: ImageDocument, ctx: ImageOpContext) {
  return { locale: ctx.library?.locale ?? "pt", ink: LIBRARY_INK.image, palette: stylePalette(doc.styles) };
}

function chartOp(doc: ImageDocument, op: ImageOperation & { op: ChartImageOpName }, ctx: ImageOpContext): DocumentOutcome {
  if (op.op === "add_chart") {
    const home = namedArtboard(doc, op, ctx);
    if (!home.ok) return home;
    const spec = chartSpecFrom(op, null, chartDefaults(doc, ctx));
    if (!spec.ok) return refuse(spec.reason);
    const base = newChartLayer(spec.value, chartTransform(home.artboard.canvas, spec.value.kind), op.name?.trim() || undefined);
    return onArtboard(doc, home.artboard, insert(home.artboard, { ...base, transform: withBox(base.transform, op) }, "add_chart", []));
  }
  const home = layerHome(doc, op, ctx);
  if (!home.ok) return home;
  const layer = op.layer_id ? layerById(home.artboard, op.layer_id) : undefined;
  if (!layer) return absentLayer(op.layer_id);
  if (layer.type !== "chart" || !layer.chart) return refuse(`a camada ${layer.id} não é um gráfico; crie um com add_chart`);
  const held = locked(home.artboard, [layer.id]);
  if (held) return held;
  if (op.op === "expand_chart") {
    const expanded = expandChart(home.artboard, layer.id);
    if (!expanded.ok) return refuse(`o gráfico ${layer.id} não pôde ser desagrupado`);
    return onArtboard(doc, home.artboard, done(expanded.document, "expand_chart", expanded.ids[0] ?? null, { created: expanded.ids, changed: [layer.id] }));
  }
  if (!chartChangeRequested(op)) return refuse("update_chart_data precisa de chart_labels, chart_series, chart_kind, chart_style ou chart_format");
  const spec = chartSpecFrom(op, layer.chart, chartDefaults(doc, ctx));
  if (!spec.ok) return refuse(spec.reason);
  return onArtboard(doc, home.artboard, done(updateLayers(home.artboard, [layer.id], { chart: spec.value }), "update_chart_data", layer.id, { changed: [layer.id] }));
}

function stillVfxOp(doc: ImageDocument, op: ImageOperation & { op: StillVfxOpName }, ctx: ImageOpContext): DocumentOutcome {
  const home = op.layer_id ? layerHome(doc, op, ctx) : namedArtboard(doc, op, ctx);
  if (!home.ok) return home;
  const target: StillVfxTarget = op.layer_id ? { kind: "layer", layerId: op.layer_id } : { kind: "canvas" };
  const holder = op.layer_id
    ? { name: `a camada ${op.layer_id}`, missing: `o efeito ${op.vfx_id} não existe na camada ${op.layer_id}; leia o projeto de novo com studio_read` }
    : { name: `a prancheta ${home.artboard.id}`, missing: `o efeito ${op.vfx_id} não existe na prancheta ${home.artboard.id}; leia o projeto de novo com studio_read` };
  const result = stillVfxOperation(home.artboard, op, target, holder);
  if (!result.ok) return refuse(result.reason);
  const extra = op.op === "add_vfx" ? { created: [result.vfxId] } : { changed: [op.layer_id ?? home.artboard.id] };
  return onArtboard(doc, home.artboard, done(result.surface, op.op, op.layer_id ?? null, extra));
}

function qrContext(ctx: ImageOpContext) {
  return { shortLinkUrl: ctx.shortLinkUrl ?? (() => undefined), naturalSize: ctx.naturalSize };
}

function generatedOp(doc: ImageDocument, op: ImageOperation & { op: TableOpName | QrOpName }, ctx: ImageOpContext): DocumentOutcome {
  if (op.op === "add_table" || op.op === "add_qr_code") {
    const home = namedArtboard(doc, op, ctx);
    if (!home.ok) return home;
    const name = op.name?.trim() || undefined;
    if (op.op === "add_table") {
      const spec = tableSpecFrom(op, null, LIBRARY_INK.image);
      if (!spec.ok) return refuse(spec.reason);
      const base = newTableLayer(spec.value, tableTransform(home.artboard.canvas, spec.value), name);
      return onArtboard(doc, home.artboard, insert(home.artboard, { ...base, transform: withBox(base.transform, op) }, "add_table", []));
    }
    const spec = qrSpecFrom(op, null, qrContext(ctx));
    if (!spec.ok) return refuse(spec.reason);
    const base = newQrLayer(spec.value, qrTransform(home.artboard.canvas), name);
    return onArtboard(doc, home.artboard, insert(home.artboard, { ...base, transform: withBox(base.transform, op) }, "add_qr_code", []));
  }
  const home = layerHome(doc, op, ctx);
  if (!home.ok) return home;
  const layer = op.layer_id ? layerById(home.artboard, op.layer_id) : undefined;
  if (!layer) return absentLayer(op.layer_id);
  const held = locked(home.artboard, [layer.id]);
  if (held) return held;
  if (op.op === "update_table") {
    if (layer.type !== "table" || !layer.table) return refuse(`a camada ${layer.id} não é uma tabela; crie uma com add_table`);
    const cellEdit = op.text !== undefined && (op.table_row !== undefined || op.table_column !== undefined);
    if (!cellEdit && !tableChangeRequested(op)) return refuse("update_table precisa de table_rows, table_header, table_columns, table_style ou de table_row, table_column e text para uma célula");
    const spec = cellEdit ? tableCellText(layer.table, op, op.text ?? "") : tableSpecFrom(op, layer.table, LIBRARY_INK.image);
    if (!spec.ok) return refuse(spec.reason);
    return onArtboard(doc, home.artboard, done(updateLayers(home.artboard, [layer.id], { table: spec.value }), "update_table", layer.id, { changed: [layer.id] }));
  }
  if (layer.type !== "qr" || !layer.qr) return refuse(`a camada ${layer.id} não é um QR Code; crie um com add_qr_code`);
  if (!qrChangeRequested(op)) return refuse("update_qr_code precisa de algum campo do QR Code para mudar");
  const spec = qrSpecFrom(op, layer.qr, qrContext(ctx));
  if (!spec.ok) return refuse(spec.reason);
  return onArtboard(doc, home.artboard, done(updateLayers(home.artboard, [layer.id], { qr: spec.value }), "update_qr_code", layer.id, { changed: [layer.id] }));
}

function operate(doc: ImageDocument, op: ImageOperation, ctx: ImageOpContext): DocumentOutcome {
  if (isComponentOperation(op.op)) return componentOperation(doc, op, ctx);
  if (isStyleOperation(op.op)) return styleOperation(doc, op);
  if (isLayoutOperation(op.op)) return layoutOperation(doc, op, ctx);
  const part = chartPartRefusal(doc, [...targets(op), ...(op.above_id ? [op.above_id] : []), ...(op.below_id ? [op.below_id] : [])]) ?? partRefusal(op);
  if (part) return part;
  if (isStillVfxOperation(op.op)) return stillVfxOp(doc, { ...op, op: op.op }, ctx);
  if (isChartImageOperation(op.op)) return chartOp(doc, { ...op, op: op.op }, ctx);
  if (isTableOperation(op.op) || isQrOperation(op.op)) return generatedOp(doc, { ...op, op: op.op }, ctx);
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
    case "arrange_artboards":
      return arrangeArtboardsOp(doc, op);
    case "select":
      return selectOp(doc, op, ctx);
  }
  if (!CREATES.has(op.op) && spreads(doc, op)) return spreadAcross(doc, op, ctx);
  const home = CREATES.has(op.op) ? namedArtboard(doc, op, ctx) : layerHome(doc, op, ctx);
  return home.ok ? onArtboard(doc, home.artboard, dispatch(home.artboard, op, ctx)) : home;
}

export function applyImageOperation(doc: ImageDocument, op: ImageOperation, ctx: ImageOpContext): DocumentOutcome {
  const outcome = operate(doc, op, ctx);
  if (!outcome.ok) return outcome;
  const settled = settleImage(doc, outcome.document, ctx.measure);
  if (settled === doc && outcome.document !== doc) return refuse("a mudança deixaria um layout automático inválido: a base não pode girar e as camadas precisam caber perto da prancheta; diminua o espaço ou o tamanho");
  return { ...outcome, document: settled };
}

export function imageIds(doc: ImageDocument): string[] {
  return [
    ...doc.artboards.flatMap((a) => [a.id, ...a.layers.map((l) => l.id), ...(a.groups ?? []).map((g) => g.id), ...(a.canvas.vfx ?? []).map((v) => v.id), ...a.layers.flatMap((l) => (l.vfx ?? []).map((v) => v.id))]),
    ...(doc.styles ?? []).map((s) => s.id),
  ];
}
