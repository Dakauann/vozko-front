import { fullFrame, type CanvasSize, type ImageSurface, type Layer } from "../document";
import { addPaintLayer, copySelectionToLayer, cropToSelection, paintSelection, PIXEL_ACTIONS, type PixelAction, type PixelEdit, type PixelEditIssue } from "../pixel-edits";
import { ellipsePoints, rectPoints, type PixelSelection } from "../pixel-selection";
import { paintedBounds, PIXEL_RANGES, type PixelSurface } from "../pixel-surface";
import { isValidColor } from "../validate";
import type { AgentOutcome } from "./batch";
import { hasBox, outOfRange, withBox, type AgentBox, type Patched } from "./layer-style";

const AREA_SHAPES = ["rect", "ellipse", "polygon"] as const;

export interface AgentArea {
  shape?: (typeof AREA_SHAPES)[number];
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  points?: { x: number; y: number }[];
  feather?: number;
  invert?: boolean;
}

export interface AgentPixelFields {
  action?: string;
  area?: AgentArea;
  paint_color?: string;
  paint_opacity?: number;
}

interface PixelOperation extends AgentPixelFields, AgentBox {
  op: "add_paint_layer" | "paint_area" | "crop_to_area" | "copy_area_to_layer";
  layer_id?: string;
  name?: string;
}

export interface OutlinePixels {
  width: number;
  height: number;
  strokes: number;
  areas: number;
  painted?: { x: number; y: number; w: number; h: number };
}

type Outcome = AgentOutcome<ImageSurface>;

const AREA_HELP = "precisa de area com shape rect ou ellipse (x e y do centro, w e h em frações da prancheta) ou polygon (points com pelo menos 3 vértices {x, y} em frações da prancheta)";

function refuse(reason: string): Outcome {
  return { ok: false, reason };
}

function shapePoints(area: AgentArea, canvas: CanvasSize): Patched<number[]> {
  const shape = area.shape ?? (area.points ? "polygon" : "rect");
  if (!(AREA_SHAPES as readonly string[]).includes(shape)) return { ok: false, reason: `area.shape precisa ser um de: ${AREA_SHAPES.join(", ")}` };
  if (shape === "polygon") {
    const points = area.points ?? [];
    if (points.length < 3) return { ok: false, reason: "area.points precisa de pelo menos 3 vértices" };
    return { ok: true, value: points.flatMap((point) => [point.x * canvas.width, point.y * canvas.height]) };
  }
  if (area.x === undefined || area.y === undefined || area.w === undefined || area.h === undefined || area.w <= 0 || area.h <= 0) return { ok: false, reason: `area ${AREA_HELP}` };
  const a = { x: (area.x - area.w / 2) * canvas.width, y: (area.y - area.h / 2) * canvas.height };
  const b = { x: (area.x + area.w / 2) * canvas.width, y: (area.y + area.h / 2) * canvas.height };
  return { ok: true, value: shape === "rect" ? rectPoints(a, b) : ellipsePoints(a, b) };
}

function areaSelection(area: AgentArea | undefined, canvas: CanvasSize): Patched<PixelSelection> {
  if (!area) return { ok: false, reason: AREA_HELP };
  const feather = outOfRange("area.feather", area.feather, PIXEL_RANGES.feather);
  if (feather) return { ok: false, reason: feather };
  const points = shapePoints(area, canvas);
  if (!points.ok) return points;
  return { ok: true, value: { artboardId: "elo", parts: [{ mode: "add", points: points.value }], feather: area.feather ?? 0, invert: Boolean(area.invert) } };
}

function issueReason(issue: PixelEditIssue, layerId: string): string {
  switch (issue) {
    case "missing":
      return `a camada ${layerId} não existe; leia o projeto de novo com studio_read`;
    case "locked":
      return `a camada ${layerId} está travada; destrave com set_locked antes`;
    case "no_pixels":
      return `a camada ${layerId} não tem pixels: as áreas valem para camadas de pintura (crie com add_paint_layer) e fotos`;
    case "not_image":
      return "hide e reveal valem só para fotos; numa camada de pintura use erase";
    case "color":
      return "fill precisa de paint_color #rrggbb";
    case "empty":
      return `a área não cobre nada da camada ${layerId}; confira x, y, w e h em frações da prancheta`;
    case "invalid":
      return `a camada ${layerId} ficaria inválida`;
  }
}

function finished(result: PixelEdit, label: string, layerId: string): Outcome {
  if (!result.ok) return refuse(issueReason(result.issue, layerId));
  const focus = result.created ?? result.layerId;
  return { ok: true, document: result.document, focus: { kind: "layer", layerId: focus }, label, changed: [result.layerId], ...(result.created ? { created: [result.created] } : {}) };
}

function paintArea(doc: ImageSurface, op: PixelOperation, layerId: string, selection: PixelSelection): Outcome {
  const action = op.action as PixelAction | undefined;
  if (!action || !(PIXEL_ACTIONS as readonly string[]).includes(action)) return refuse(`paint_area precisa de action: ${PIXEL_ACTIONS.join(", ")}`);
  if (op.paint_color !== undefined && (!isValidColor(op.paint_color, true) || op.paint_color.length !== 7)) return refuse("paint_color precisa ser uma cor #rrggbb");
  const opacity = op.paint_opacity ?? 1;
  if (!(opacity > 0 && opacity <= 1)) return refuse("paint_opacity vai de 0 (sem efeito) até 1; use um valor acima de 0");
  return finished(paintSelection(doc, layerId, selection, action, { color: op.paint_color, opacity }), "paint_area", layerId);
}

export function applyPixelOperation(doc: ImageSurface, op: PixelOperation): Outcome {
  if (op.op === "add_paint_layer") {
    const added = addPaintLayer(doc, { name: op.name?.trim() || undefined, transform: hasBox(op) ? withBox(fullFrame(), op) : fullFrame() });
    return { ok: true, document: added.document, focus: { kind: "layer", layerId: added.id }, label: "add_paint_layer", created: [added.id] };
  }
  const layerId = op.layer_id;
  if (!layerId) return refuse(`${op.op} precisa de layer_id`);
  const selection = areaSelection(op.area, doc.canvas);
  if (!selection.ok) return refuse(`${op.op}: ${selection.reason}`);
  if (op.op === "paint_area") return paintArea(doc, op, layerId, selection.value);
  if (op.op === "crop_to_area") return finished(cropToSelection(doc, layerId, selection.value), "crop_to_area", layerId);
  return finished(copySelectionToLayer(doc, layerId, selection.value), "copy_area_to_layer", layerId);
}

function counted(surface: PixelSurface): Pick<OutlinePixels, "strokes" | "areas"> {
  return { strokes: surface.ops.filter((op) => op.kind === "stroke").length, areas: surface.ops.filter((op) => op.kind === "area").length };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function outlinePixels(layer: Layer): { pixels?: OutlinePixels; mask?: Pick<OutlinePixels, "strokes" | "areas"> } {
  if (layer.mask) return { mask: counted(layer.mask) };
  const surface = layer.surface;
  if (!surface) return {};
  const bounds = paintedBounds(surface);
  const t = layer.transform;
  const painted = bounds
    ? { x: round(t.x - t.w / 2 + ((bounds.x + bounds.width / 2) / surface.width) * t.w), y: round(t.y - t.h / 2 + ((bounds.y + bounds.height / 2) / surface.height) * t.h), w: round((bounds.width / surface.width) * t.w), h: round((bounds.height / surface.height) * t.h) }
    : undefined;
  return { pixels: { width: surface.width, height: surface.height, ...counted(surface), ...(painted ? { painted } : {}) } };
}
