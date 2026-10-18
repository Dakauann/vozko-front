import { produce, type Draft } from "immer";

import { artboardById, artboardOfLayer } from "./artboards";
import { newStudioId, type ImageDocument, type Layer } from "./document";
import { clampTo, LAYER_RANGES } from "./layer-ranges";
import {
  backgroundValues,
  LAYER_SLOTS,
  linkedSlots,
  SLOT_KEYS,
  SLOT_KIND,
  slotSuits,
  styleById,
  styleValues,
  TEXT_STYLE_FIELDS,
  type LayerSlot,
  type StudioStyle,
  type StyleKind,
  type StyleRole,
  type StyleSlot,
} from "./shared-styles";
import { styleIssue } from "./validate";
import { RUN_STYLE_KEYS, withoutRunKeys } from "./text-runs";

export type StyleRefusal = "missing" | "slot" | "range" | "locked" | "invalid";

export type StyleTarget = { kind: "layer"; layerId: string } | { kind: "background"; artboardId: string };

type Refused = { ok: false; reason: StyleRefusal; ids: string[] };

type StyleOutcome = { ok: true; document: ImageDocument } | Refused;

type CreatedStyle = { ok: true; document: ImageDocument; styleId: string } | Refused;

type UpdatedStyle = { ok: true; document: ImageDocument; changed: string[] } | Refused;

export type StyleValuesInput = Partial<Pick<StudioStyle, "color" | "gradient" | "fontId" | "fontWeight" | "italic" | "fontSizePx" | "lineHeight" | "letterSpacing" | "shadow">>;

export type StylePatchInput = { [K in keyof StyleValuesInput]?: StyleValuesInput[K] | null };

export interface StyleSource {
  layerId?: string;
  artboardId?: string;
  slot?: StyleSlot;
}

export interface NewStyle {
  kind: StyleKind;
  name: string;
  role?: StyleRole;
  description?: string;
  values?: StyleValuesInput;
  from?: StyleSource;
  link?: boolean;
}

interface StyleUse {
  artboardId: string;
  layerId?: string;
  slot: StyleSlot;
}

const FONT_PX_STEP = 0.5;

function refuse(reason: StyleRefusal, ids: string[] = []): Refused {
  return { ok: false, reason, ids };
}

function defaultSlot(kind: StyleKind): LayerSlot {
  return kind === "color" ? "fill" : kind;
}

function compact(style: StudioStyle): StudioStyle {
  return Object.fromEntries(Object.entries(style).filter(([key, value]) => key === "name" || (value !== undefined && value !== "" && value !== 0))) as unknown as StudioStyle;
}

function capturedText(layer: Layer, surfaceHeight: number): StyleValuesInput {
  return {
    fontId: layer.fontId,
    fontWeight: layer.fontWeight,
    italic: layer.italic ? true : undefined,
    fontSizePx: layer.fontSize !== undefined ? Math.round((layer.fontSize * surfaceHeight) / FONT_PX_STEP) * FONT_PX_STEP : undefined,
    lineHeight: layer.lineHeight,
    letterSpacing: layer.letterSpacing,
  };
}

function captured(doc: ImageDocument, kind: StyleKind, from: StyleSource): { values: StyleValuesInput; target: StyleTarget; slot: StyleSlot } | null {
  if (from.layerId === undefined) {
    const artboard = from.artboardId ? artboardById(doc, from.artboardId) : undefined;
    if (!artboard || kind !== "color") return null;
    const { background, gradient } = artboard.canvas;
    return { values: gradient ? { gradient } : { color: background || undefined }, target: { kind: "background", artboardId: artboard.id }, slot: "background" };
  }
  const home = artboardOfLayer(doc, from.layerId);
  const layer = home?.layers.find((l) => l.id === from.layerId);
  if (!home || !layer) return null;
  const slot = (from.slot ?? defaultSlot(kind)) as LayerSlot;
  if (SLOT_KIND[slot] !== kind || !LAYER_SLOTS.includes(slot)) return null;
  const target: StyleTarget = { kind: "layer", layerId: layer.id };
  if (slot === "fill") return { values: layer.gradient ? { gradient: layer.gradient } : { color: layer.fill }, target, slot };
  if (slot === "stroke") return { values: { color: layer.stroke }, target, slot };
  if (slot === "effect") return { values: { shadow: layer.shadow }, target, slot };
  return { values: capturedText(layer, home.canvas.height), target, slot };
}

function withStyle(doc: ImageDocument, style: StudioStyle): ImageDocument {
  return produce(doc, (draft) => {
    draft.styles = [...(draft.styles ?? []), style as Draft<StudioStyle>];
  });
}

export function createStyle(doc: ImageDocument, input: NewStyle): CreatedStyle {
  const source = input.from ? captured(doc, input.kind, input.from) : null;
  if (input.from && !source) return refuse("missing");
  const style = compact({ id: newStudioId("style"), kind: input.kind, name: input.name.trim(), role: input.role, description: input.description?.trim(), ...(source?.values ?? input.values ?? {}) });
  if (styleIssue(style)) return refuse(source ? "slot" : "invalid");
  const added = withStyle(doc, style);
  if (!source || input.link === false) return { ok: true, document: added, styleId: style.id };
  const linked = applyStyle(added, style.id, [source.target], source.slot === "background" ? undefined : source.slot);
  return linked.ok ? { ok: true, document: linked.document, styleId: style.id } : linked;
}

function slotFor(style: StudioStyle, target: StyleTarget, slot: LayerSlot | undefined): StyleSlot {
  return target.kind === "background" ? "background" : (slot ?? defaultSlot(style.kind));
}

function fontInRange(patch: Partial<Layer>): boolean {
  return patch.fontSize === undefined || clampTo(patch.fontSize, LAYER_RANGES.fontSize) === patch.fontSize;
}

function writeTarget(draft: Draft<ImageDocument>, style: StudioStyle, target: StyleTarget, slot: StyleSlot) {
  if (target.kind === "background") {
    const artboard = draft.artboards.find((a) => a.id === target.artboardId);
    if (!artboard) return;
    const values = backgroundValues(style);
    artboard.canvas.background = values.background;
    if (values.gradient) artboard.canvas.gradient = values.gradient as Draft<typeof values.gradient>;
    else delete artboard.canvas.gradient;
    artboard.canvas.backgroundStyleId = style.id;
    return;
  }
  for (const artboard of draft.artboards) {
    const layer = artboard.layers.find((l) => l.id === target.layerId);
    if (!layer) continue;
    const patch = styleValues(style, slot as LayerSlot, artboard.canvas.height);
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) delete (layer as Record<string, unknown>)[key];
      else (layer as Record<string, unknown>)[key] = value;
    }
    const governed = RUN_STYLE_KEYS.filter((key) => key in patch);
    if (layer.runs && governed.length > 0) {
      const runs = withoutRunKeys(layer as Layer, governed);
      if (runs) layer.runs = runs;
      else delete layer.runs;
    }
    layer[SLOT_KEYS[slot as LayerSlot]] = style.id;
  }
}

function checkTargets(doc: ImageDocument, style: StudioStyle, targets: readonly StyleTarget[], slot: LayerSlot | undefined): Refused | null {
  const missing: string[] = [];
  const unsuited: string[] = [];
  const locked: string[] = [];
  const outside: string[] = [];
  for (const target of targets) {
    const chosen = slotFor(style, target, slot);
    if (target.kind === "background") {
      if (!artboardById(doc, target.artboardId)) missing.push(target.artboardId);
      else if (style.kind !== "color") unsuited.push(target.artboardId);
      continue;
    }
    const home = artboardOfLayer(doc, target.layerId);
    const layer = home?.layers.find((l) => l.id === target.layerId);
    if (!home || !layer) missing.push(target.layerId);
    else if (layer.locked) locked.push(layer.id);
    else if (chosen === "background" || !slotSuits(layer, chosen, style)) unsuited.push(layer.id);
    else if (!fontInRange(styleValues(style, chosen, home.canvas.height))) outside.push(layer.id);
  }
  if (missing.length > 0) return refuse("missing", missing);
  if (locked.length > 0) return refuse("locked", locked);
  if (unsuited.length > 0) return refuse("slot", unsuited);
  return outside.length > 0 ? refuse("range", outside) : null;
}

export function applyStyle(doc: ImageDocument, styleId: string, targets: readonly StyleTarget[], slot?: LayerSlot): StyleOutcome {
  const style = styleById(doc, styleId);
  if (!style) return refuse("missing");
  const problem = checkTargets(doc, style, targets, slot);
  if (problem) return problem;
  return {
    ok: true,
    document: produce(doc, (draft) => {
      for (const target of targets) writeTarget(draft, style, target, slotFor(style, target, slot));
    }),
  };
}

export function styleUses(doc: ImageDocument, styleId: string): StyleUse[] {
  return doc.artboards.flatMap((artboard) => [
    ...(artboard.canvas.backgroundStyleId === styleId ? [{ artboardId: artboard.id, slot: "background" as const }] : []),
    ...artboard.layers.flatMap((layer) => linkedSlots(layer).filter(([, id]) => id === styleId).map(([slot]) => ({ artboardId: artboard.id, layerId: layer.id, slot }))),
  ]);
}

function targetOfUse(use: StyleUse): StyleTarget {
  return use.layerId ? { kind: "layer", layerId: use.layerId } : { kind: "background", artboardId: use.artboardId };
}

export function updateStyle(doc: ImageDocument, styleId: string, patch: { name?: string; description?: string; role?: StyleRole | null; values?: StylePatchInput }): UpdatedStyle {
  const current = styleById(doc, styleId);
  if (!current) return refuse("missing");
  const merged: StudioStyle = { ...current };
  if (patch.name !== undefined) merged.name = patch.name.trim();
  if (patch.description !== undefined) merged.description = patch.description.trim();
  if (patch.role !== undefined) merged.role = patch.role ?? undefined;
  for (const [key, value] of Object.entries(patch.values ?? {})) {
    if (value === undefined) continue;
    Object.assign(merged, { [key]: value === null ? undefined : value });
  }
  if (merged.kind === "color" && patch.values?.color) merged.gradient = undefined;
  if (merged.kind === "color" && patch.values?.gradient) merged.color = undefined;
  const style = compact(merged);
  if (styleIssue(style)) return refuse("invalid");
  const uses = styleUses(doc, styleId);
  const outside = uses.filter((use) => use.layerId && use.slot === "text" && !fontInRange(styleValues(style, "text", artboardById(doc, use.artboardId)!.canvas.height))).map((use) => use.layerId!);
  if (outside.length > 0) return refuse("range", outside);
  const document = produce(doc, (draft) => {
    const at = draft.styles!.findIndex((s) => s.id === styleId);
    draft.styles![at] = style as Draft<StudioStyle>;
    for (const use of uses) writeTarget(draft, style, targetOfUse(use), use.slot);
  });
  return { ok: true, document, changed: [...new Set(uses.map((use) => use.layerId ?? use.artboardId))] };
}

export function detachStyle(doc: ImageDocument, targets: readonly StyleTarget[], slot?: StyleSlot): ImageDocument {
  return produce(doc, (draft) => {
    for (const target of targets) {
      if (target.kind === "background") {
        const artboard = draft.artboards.find((a) => a.id === target.artboardId);
        if (artboard) delete artboard.canvas.backgroundStyleId;
        continue;
      }
      for (const artboard of draft.artboards) {
        const layer = artboard.layers.find((l) => l.id === target.layerId);
        if (!layer) continue;
        for (const each of LAYER_SLOTS) if (slot === undefined || slot === each) delete layer[SLOT_KEYS[each]];
      }
    }
  });
}

export function deleteStyle(doc: ImageDocument, styleId: string): ImageDocument {
  if (!styleById(doc, styleId)) return doc;
  return produce(doc, (draft) => {
    for (const artboard of draft.artboards) {
      if (artboard.canvas.backgroundStyleId === styleId) delete artboard.canvas.backgroundStyleId;
      for (const layer of artboard.layers) for (const slot of LAYER_SLOTS) if (layer[SLOT_KEYS[slot]] === styleId) delete layer[SLOT_KEYS[slot]];
    }
    draft.styles = draft.styles!.filter((s) => s.id !== styleId);
    if (draft.styles.length === 0) delete draft.styles;
  });
}

export function referencedStyles(doc: ImageDocument, layers: readonly Layer[]): StudioStyle[] {
  const ids = new Set(layers.flatMap((layer) => linkedSlots(layer).map(([, id]) => id)));
  return (doc.styles ?? []).filter((style) => ids.has(style.id));
}

export function mergedStyles(doc: ImageDocument, styles: readonly StudioStyle[]): ImageDocument {
  const known = new Set((doc.styles ?? []).map((s) => s.id));
  const missing = styles.filter((style) => !known.has(style.id));
  return missing.length === 0 ? doc : produce(doc, (draft) => {
    draft.styles = [...(draft.styles ?? []), ...(missing as Draft<StudioStyle>[])];
  });
}

export function textStyleFields(style: StudioStyle): (typeof TEXT_STYLE_FIELDS)[number][] {
  return TEXT_STYLE_FIELDS.filter((field) => style[field] !== undefined);
}
