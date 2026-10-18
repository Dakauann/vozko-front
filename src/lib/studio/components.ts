import { fullFrame, type Artboard, type CanvasSize, type Crop, type ImageDocument, type ImageSurface, type Layer, type Transform } from "./document";
import type { FontId } from "./fonts";
import { normalizedRotation } from "./layer-ranges";
import { scaledUnits } from "./layers";
import { paintsProperty } from "./paint";
import { repeatedLayers } from "./repeat-edits";
import { retextLayerPatch } from "./text-runs";
import { generatedPartLayers, isGeneratedLayer } from "./generated-layers";

export interface InstanceOverride {
  layerId: string;
  text?: string;
  fill?: string;
  stroke?: string;
  fontId?: FontId;
  fontWeight?: number;
  italic?: boolean;
  assetId?: string;
  crop?: Crop;
  iconId?: string;
  hidden?: boolean;
}

export const OVERRIDE_FIELDS = ["text", "fill", "stroke", "fontId", "fontWeight", "italic", "assetId", "crop", "iconId", "hidden"] as const;

export type OverrideField = (typeof OVERRIDE_FIELDS)[number];

export type OverrideValues = Partial<Pick<Layer, OverrideField>>;

export const INSTANCE_FIELDS: readonly string[] = ["id", "type", "name", "transform", "hidden", "locked", "groupId", "flipX", "flipY", "componentId", "overrides", "layoutItem"];

const PART_MARK = ";";
const CANVAS_PART = "@canvas";
const REPEAT_MARK = "#r";

export function partId(instanceId: string, layerId: string): string {
  return `${instanceId}${PART_MARK}${layerId}`;
}

export function isPartId(id: string): boolean {
  return id.includes(PART_MARK);
}

export function partSource(id: string): { instanceId: string; layerId: string } | null {
  const at = id.indexOf(PART_MARK);
  return at < 0 ? null : { instanceId: id.slice(0, at), layerId: id.slice(at + PART_MARK.length) };
}

export function mainLayerOf(layerId: string): string {
  const at = layerId.indexOf(REPEAT_MARK);
  return at < 0 ? layerId : layerId.slice(0, at);
}

function allows(main: Layer, field: OverrideField): boolean {
  switch (field) {
    case "text":
    case "fontId":
    case "fontWeight":
    case "italic":
      return main.type === "text";
    case "assetId":
    case "crop":
      return main.type === "image";
    case "iconId":
      return main.type === "icon";
    case "fill":
    case "stroke":
      return paintsProperty(main, field);
    case "hidden":
      return true;
  }
}

export function overridableFields(main: Layer): OverrideField[] {
  return OVERRIDE_FIELDS.filter((field) => allows(main, field));
}

export function setFields(override: Partial<InstanceOverride>): OverrideField[] {
  return OVERRIDE_FIELDS.filter((field) => {
    const value = override[field];
    return value !== undefined && value !== "" && value !== 0;
  });
}

export function overriddenLayer(main: Layer, override: Partial<InstanceOverride>): Layer {
  const values: Partial<Layer> = {};
  for (const field of setFields(override)) Object.assign(values, { [field]: override[field] });
  return { ...main, ...retextLayerPatch(main, values) };
}

export function componentOf(doc: ImageDocument, id: string | undefined): Artboard | undefined {
  const found = id ? doc.artboards.find((a) => a.id === id) : undefined;
  return found?.component ? found : undefined;
}

export function instancesOf(doc: ImageDocument, componentId: string): { artboard: Artboard; layer: Layer }[] {
  return doc.artboards.flatMap((artboard) => artboard.layers.filter((l) => l.type === "instance" && l.componentId === componentId).map((layer) => ({ artboard, layer })));
}

export function instanceScale(transform: Transform, component: CanvasSize, host: CanvasSize): number {
  return Math.min((transform.w * host.width) / component.width, (transform.h * host.height) / component.height);
}

function canvasPart(component: Artboard): Layer | null {
  const { background, gradient } = component.canvas;
  if (!background && !gradient) return null;
  return { id: CANVAS_PART, type: "shape", shape: "rect", transform: fullFrame(), ...(gradient ? { gradient } : { fill: background }) };
}

function overriddenLayers(component: ImageSurface, overrides: readonly InstanceOverride[]): Layer[] {
  if (overrides.length === 0) return component.layers;
  const byId = new Map(overrides.map((o) => [o.layerId, o]));
  return component.layers.map((layer) => {
    const override = byId.get(layer.id);
    return override ? overriddenLayer(layer, override) : layer;
  });
}

function placed(main: Layer, instance: Layer, transform: Transform, scale: number, component: CanvasSize, host: CanvasSize): Layer {
  let dx = (main.transform.x - 0.5) * component.width * scale;
  let dy = (main.transform.y - 0.5) * component.height * scale;
  let rotation = main.transform.rotation;
  let flipX = Boolean(main.flipX);
  let flipY = Boolean(main.flipY);
  if (instance.flipX) {
    dx = -dx;
    rotation = -rotation;
    flipX = !flipX;
  }
  if (instance.flipY) {
    dy = -dy;
    rotation = -rotation;
    flipY = !flipY;
  }
  const theta = (transform.rotation * Math.PI) / 180;
  const rx = dx * Math.cos(theta) - dy * Math.sin(theta);
  const ry = dx * Math.sin(theta) + dy * Math.cos(theta);
  const part: Layer = {
    ...main,
    ...scaledUnits(main, scale),
    id: partId(instance.id, main.id),
    transform: {
      x: (transform.x * host.width + rx) / host.width,
      y: (transform.y * host.height + ry) / host.height,
      w: (main.transform.w * component.width * scale) / host.width,
      h: (main.transform.h * component.height * scale) / host.height,
      rotation: normalizedRotation(rotation + transform.rotation),
      opacity: main.transform.opacity * transform.opacity,
    },
    locked: true,
    ...(main.fontSize !== undefined ? { fontSize: (main.fontSize * component.height * scale) / host.height } : {}),
  };
  if (flipX) part.flipX = true;
  else delete part.flipX;
  if (flipY) part.flipY = true;
  else delete part.flipY;
  if (instance.hidden || main.hidden) part.hidden = true;
  else delete part.hidden;
  if (instance.groupId) part.groupId = instance.groupId;
  else delete part.groupId;
  return part;
}

export function generatedBoard(layer: Layer, host: CanvasSize, transform: Transform = layer.transform): Artboard {
  const canvas = { width: Math.max(1, transform.w * host.width), height: Math.max(1, transform.h * host.height), background: "" };
  return { id: layer.id, ...(layer.name ? { name: layer.name } : {}), x: 0, y: 0, canvas, layers: generatedPartLayers(layer, canvas) };
}

export function generatedSurfaceParts(layer: Layer, host: CanvasSize, transform: Transform = layer.transform): Layer[] {
  return isGeneratedLayer(layer) ? instanceParts(generatedBoard(layer, host, transform), layer, host, transform) : [];
}

function resolvesToParts(layer: Layer): boolean {
  return layer.type === "instance" || isGeneratedLayer(layer);
}

export function instanceParts(component: Artboard, instance: Layer, host: CanvasSize, transform: Transform = instance.transform): Layer[] {
  const layers = overriddenLayers(component, instance.overrides ?? [])
    .filter((layer) => layer.type !== "instance")
    .flatMap((layer) => (isGeneratedLayer(layer) ? generatedSurfaceParts(layer, component.canvas) : [layer]));
  const source: ImageSurface = { canvas: component.canvas, layers, ...(component.groups ? { groups: component.groups } : {}) };
  const background = canvasPart(component);
  const mains = background ? [background, ...repeatedLayers(source)] : repeatedLayers(source);
  const scale = instanceScale(transform, component.canvas, host);
  return mains.map((main, index) => {
    const part = placed(main, instance, transform, scale, component.canvas, host);
    if (index === 0) delete part.clip;
    return part;
  });
}

interface Resolution {
  components: readonly (Artboard | undefined)[];
  surface: ImageSurface;
}

const resolutions = new WeakMap<ImageSurface, Resolution>();

function surfaceLayers(doc: ImageDocument, surface: ImageSurface, generated: (layer: Layer) => Layer[]): Layer[] {
  return surface.layers.flatMap((layer) => {
    if (isGeneratedLayer(layer)) return generated(layer);
    if (layer.type !== "instance") return [layer];
    const component = componentOf(doc, layer.componentId);
    return component ? instanceParts(component, layer, surface.canvas) : [];
  });
}

export function perceivedSurface<S extends ImageSurface>(doc: ImageDocument, surface: S): S {
  return surface.layers.some((layer) => layer.type === "instance") ? { ...surface, layers: surfaceLayers(doc, surface, (layer) => [layer]) } : surface;
}

export function resolvedSurface<S extends ImageSurface>(doc: ImageDocument, surface: S): S {
  if (!surface.layers.some(resolvesToParts)) return surface;
  const instances = surface.layers.filter((l) => l.type === "instance");
  const components = instances.map((l) => componentOf(doc, l.componentId));
  const known = resolutions.get(surface);
  if (known && known.components.length === components.length && known.components.every((c, i) => c === components[i])) return known.surface as S;
  const layers = surfaceLayers(doc, surface, (layer) => generatedSurfaceParts(layer, surface.canvas));
  const resolved = { ...surface, layers };
  resolutions.set(surface, { components, surface: resolved });
  return resolved;
}

export function resolvedArtboards(doc: ImageDocument, artboards: readonly Artboard[]): Artboard[] {
  return artboards.map((artboard) => resolvedSurface(doc, artboard));
}

export function liveParts(doc: ImageDocument, surface: ImageSurface, moved: ReadonlyMap<string, Transform>): Map<string, Transform> {
  const out = new Map(moved);
  for (const layer of surface.layers) {
    const transform = moved.get(layer.id);
    if (!transform) continue;
    for (const part of resolvedParts(doc, layer, surface.canvas, transform)) out.set(part.id, part.transform);
  }
  return out;
}

function resolvedParts(doc: ImageDocument, layer: Layer, host: CanvasSize, transform: Transform = layer.transform): Layer[] {
  if (isGeneratedLayer(layer)) return generatedSurfaceParts(layer, host, transform);
  const component = layer.type === "instance" ? componentOf(doc, layer.componentId) : undefined;
  return component ? instanceParts(component, layer, host, transform) : [];
}

export function partIdsOf(doc: ImageDocument, surface: ImageSurface, ids: readonly string[]): string[] {
  const wanted = new Set(ids);
  return surface.layers.flatMap((layer) => (wanted.has(layer.id) ? resolvedParts(doc, layer, surface.canvas).map((part) => part.id) : []));
}

interface InstanceAnchors {
  after: Map<string, Layer[]>;
  loose: Layer[];
}

export function instanceAnchors(surface: ImageSurface, resolved: ImageSurface): InstanceAnchors {
  const after = new Map<string, Layer[]>();
  const loose: Layer[] = [];
  for (const instance of surface.layers) {
    if (!resolvesToParts(instance)) continue;
    const prefix = partId(instance.id, "");
    const top = resolved.layers.findLast((layer) => layer.id.startsWith(prefix));
    if (top) after.set(top.id, [...(after.get(top.id) ?? []), instance]);
    else loose.push(instance);
  }
  return { after, loose };
}
