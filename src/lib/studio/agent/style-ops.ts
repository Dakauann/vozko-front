import { artboardOfLayer } from "../artboards";
import type { Gradient, ImageDocument, Layer, Shadow } from "../document";
import type { FontId } from "../fonts";
import { applyStyle, createStyle, deleteStyle, detachStyle, styleUses, updateStyle, type StylePatchInput, type StyleRefusal, type StyleTarget, type StyleValuesInput } from "../shared-style-edits";
import { LAYER_SLOTS, linkedSlots, STYLE_KINDS, STYLE_ROLES, styleById, styleSummary, type LayerSlot, type StyleKind, type StyleRole, type StyleSlot } from "../shared-styles";
import type { AgentOutcome } from "./batch";
import type { ImageOperation } from "./image-ops";
import { gradientOf, type AgentGradient, type AgentShadow } from "./layer-style";

const STYLE_OPERATIONS = ["create_style", "update_style", "apply_style", "detach_style", "delete_style"] as const;

type StyleOpName = (typeof STYLE_OPERATIONS)[number];

export interface AgentStyleValues {
  color?: string;
  gradient?: AgentGradient;
  font_id?: string;
  font_weight?: number;
  italic?: boolean;
  font_size_px?: number;
  line_height?: number;
  letter_spacing?: number;
  shadow?: AgentShadow;
}

export interface AgentStyleFields {
  style_id?: string;
  style_kind?: string;
  role?: string;
  description?: string;
  slot?: string;
  link?: boolean;
  style_values?: AgentStyleValues;
  style_clear?: string[];
}

type DocumentOutcome = AgentOutcome<ImageDocument>;
type Refusal = { ok: false; reason: string };

const VALUE_NAMES: Record<keyof AgentStyleValues, keyof StyleValuesInput> = {
  color: "color",
  gradient: "gradient",
  font_id: "fontId",
  font_weight: "fontWeight",
  italic: "italic",
  font_size_px: "fontSizePx",
  line_height: "lineHeight",
  letter_spacing: "letterSpacing",
  shadow: "shadow",
};

const SLOTS: readonly StyleSlot[] = [...LAYER_SLOTS, "background"];

function refuse(reason: string): Refusal {
  return { ok: false, reason };
}

export function isStyleOperation(name: string): name is StyleOpName {
  return (STYLE_OPERATIONS as readonly string[]).includes(name);
}

function targets(op: ImageOperation): string[] {
  if (op.layer_ids && op.layer_ids.length > 0) return op.layer_ids;
  return op.layer_id ? [op.layer_id] : [];
}

function shadowOf(input: AgentShadow): Shadow {
  return { color: input.color ?? "#00000059", blur: input.blur ?? 0, x: input.x ?? 0, y: input.y ?? 0 };
}

function valuesOf(input: AgentStyleValues): { ok: true; value: StyleValuesInput } | Refusal {
  const values: StyleValuesInput = {};
  for (const [agent, field] of Object.entries(VALUE_NAMES) as [keyof AgentStyleValues, keyof StyleValuesInput][]) {
    const raw = input[agent];
    if (raw === undefined) continue;
    if (agent === "gradient") {
      const gradient = gradientOf(raw as AgentGradient);
      if (!gradient.ok) return refuse(gradient.reason);
      values.gradient = gradient.value as Gradient;
    } else if (agent === "shadow") values.shadow = shadowOf(raw as AgentShadow);
    else if (agent === "font_id") values.fontId = raw as FontId;
    else Object.assign(values, { [field]: raw });
  }
  return { ok: true, value: values };
}

function slotOf(op: ImageOperation): { ok: true; value: StyleSlot | undefined } | Refusal {
  if (op.slot === undefined) return { ok: true, value: undefined };
  return (SLOTS as readonly string[]).includes(op.slot) ? { ok: true, value: op.slot as StyleSlot } : refuse(`slot precisa ser um de: ${SLOTS.join(", ")}`);
}

function roleOf(op: ImageOperation): { ok: true; value: StyleRole | undefined } | Refusal {
  if (op.role === undefined) return { ok: true, value: undefined };
  return (STYLE_ROLES as readonly string[]).includes(op.role) ? { ok: true, value: op.role as StyleRole } : refuse(`role precisa ser um de: ${STYLE_ROLES.join(", ")}`);
}

const SLOT_NAMES: Record<StyleSlot, string> = { fill: "preenchimento", stroke: "contorno", text: "texto", effect: "sombra", background: "fundo" };

function refusalText(reason: StyleRefusal, ids: readonly string[], kind?: StyleKind): string {
  const list = ids.join(", ");
  switch (reason) {
    case "missing":
      return list ? `${list} não existe; leia o projeto de novo com studio_read` : "o estilo não existe; studio_read lista os estilos em styles";
    case "locked":
      return `${list} está travada; destrave com set_locked antes`;
    case "slot":
      return list ? `${list} não tem ${kind ? SLOT_NAMES[kind === "color" ? "fill" : kind] : "esse campo"} para ligar ao estilo: cor vai em textos, formas e ícones (contorno só onde já há contorno), texto só em textos e sombra em camadas sem a lista effects` : `a camada não tem ${kind === "effect" ? "sombra" : "esse valor"} para virar estilo`;
    case "range":
      return `o tamanho ficaria fora do limite (de 0,5% a 50% da altura da prancheta) em ${list}`;
    case "invalid":
      return "os valores do estilo não servem: color tem color ou gradient, text tem font_id, font_weight, italic, font_size_px (1 a 2000), line_height ou letter_spacing, effect tem shadow; name não pode ser vazio";
  }
}

function created(doc: ImageDocument, op: ImageOperation): DocumentOutcome {
  if (!op.style_kind || !(STYLE_KINDS as readonly string[]).includes(op.style_kind)) return refuse(`create_style precisa de style_kind: ${STYLE_KINDS.join(", ")}`);
  const kind = op.style_kind as StyleKind;
  const role = roleOf(op);
  if (!role.ok) return role;
  const slot = slotOf(op);
  if (!slot.ok) return slot;
  const values = op.style_values ? valuesOf(op.style_values) : ({ ok: true, value: undefined } as const);
  if (!values.ok) return values;
  const layerId = targets(op)[0];
  const from = layerId ? { layerId, slot: slot.value } : op.artboard_id && slot.value === "background" ? { artboardId: op.artboard_id, slot: slot.value } : undefined;
  if (!from && !values.value) return refuse("create_style precisa de style_values com os valores ou de layer_id para copiar de uma camada");
  const result = createStyle(doc, { kind, name: op.name ?? "", role: role.value, description: op.description, values: values.value, from, link: op.link });
  if (!result.ok) return refuse(refusalText(result.reason, result.ids, kind));
  return { ok: true, document: result.document, focus: layerId ? { kind: "layer", layerId } : { kind: "canvas" }, label: "create_style", created: [result.styleId] };
}

function updated(doc: ImageDocument, op: ImageOperation): DocumentOutcome {
  const current = styleById(doc, op.style_id);
  if (!current) return refuse(refusalText("missing", []));
  const role = roleOf(op);
  if (!role.ok) return role;
  const values = op.style_values ? valuesOf(op.style_values) : ({ ok: true, value: {} } as const);
  if (!values.ok) return values;
  const patch: StylePatchInput = { ...values.value };
  for (const name of op.style_clear ?? []) {
    const field = VALUE_NAMES[name as keyof AgentStyleValues];
    if (!field || field === "color" || field === "gradient" || field === "shadow") return refuse(`style_clear tira campos de um estilo de texto: ${Object.keys(VALUE_NAMES).filter((key) => !["color", "gradient", "shadow"].includes(key)).join(", ")}`);
    patch[field] = null;
  }
  const result = updateStyle(doc, current.id, { name: op.name, description: op.description, role: role.value, values: patch });
  if (!result.ok) return refuse(refusalText(result.reason, result.ids, current.kind));
  return { ok: true, document: result.document, focus: { kind: "canvas" }, label: "update_style", changed: result.changed };
}

function styleTargets(doc: ImageDocument, op: ImageOperation): StyleTarget[] {
  const layers = targets(op).map((layerId): StyleTarget => ({ kind: "layer", layerId }));
  return layers.length > 0 || !op.artboard_id ? layers : [{ kind: "background", artboardId: op.artboard_id }];
}

function applied(doc: ImageDocument, op: ImageOperation): DocumentOutcome {
  const style = styleById(doc, op.style_id);
  if (!style) return refuse(refusalText("missing", []));
  const slot = slotOf(op);
  if (!slot.ok) return slot;
  const chosen = styleTargets(doc, op);
  if (chosen.length === 0) return refuse("apply_style precisa de layer_ids, ou de artboard_id para o fundo da prancheta");
  const result = applyStyle(doc, style.id, chosen, slot.value === "background" ? undefined : (slot.value as LayerSlot | undefined));
  if (!result.ok) return refuse(refusalText(result.reason, result.ids, style.kind));
  const first = targets(op)[0];
  return { ok: true, document: result.document, focus: first ? { kind: "layer", layerId: first } : { kind: "artboard", artboardId: op.artboard_id! }, label: "apply_style", changed: chosen.map((target) => (target.kind === "layer" ? target.layerId : target.artboardId)) };
}

function detached(doc: ImageDocument, op: ImageOperation): DocumentOutcome {
  const slot = slotOf(op);
  if (!slot.ok) return slot;
  const chosen = styleTargets(doc, op);
  if (chosen.length === 0) return refuse("detach_style precisa de layer_ids ou de artboard_id");
  const absent = chosen.find((target) => target.kind === "layer" && !artboardOfLayer(doc, target.layerId));
  if (absent && absent.kind === "layer") return refuse(refusalText("missing", [absent.layerId]));
  return { ok: true, document: detachStyle(doc, chosen, slot.value), focus: { kind: "canvas" }, label: "detach_style", changed: chosen.map((target) => (target.kind === "layer" ? target.layerId : target.artboardId)) };
}

function deleted(doc: ImageDocument, op: ImageOperation): DocumentOutcome {
  const style = styleById(doc, op.style_id);
  if (!style) return refuse(refusalText("missing", []));
  const changed = styleUses(doc, style.id).map((use) => use.layerId ?? use.artboardId);
  return { ok: true, document: deleteStyle(doc, style.id), focus: { kind: "canvas" }, label: "delete_style", changed };
}

export function styleOperation(doc: ImageDocument, op: ImageOperation): DocumentOutcome {
  switch (op.op as StyleOpName) {
    case "create_style":
      return created(doc, op);
    case "update_style":
      return updated(doc, op);
    case "apply_style":
      return applied(doc, op);
    case "detach_style":
      return detached(doc, op);
    case "delete_style":
      return deleted(doc, op);
  }
  return refuse(`a operação ${op.op} não existe`);
}

export interface OutlineStyleEntry {
  id: string;
  kind: StyleKind;
  name: string;
  role?: StyleRole;
  value: string;
  uses: number;
}

export function outlineStyles(doc: ImageDocument): OutlineStyleEntry[] {
  return (doc.styles ?? []).map((style) => ({ id: style.id, kind: style.kind, name: style.name, ...(style.role ? { role: style.role } : {}), value: styleSummary(style), uses: styleUses(doc, style.id).length }));
}

export function layerStyleLinks(layer: Layer): Partial<Record<LayerSlot, string>> | undefined {
  const links = linkedSlots(layer);
  return links.length > 0 ? Object.fromEntries(links) : undefined;
}
