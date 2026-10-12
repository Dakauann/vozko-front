import { activeArtboard, artboardById, artboardOfLayer } from "../artboards";
import { addInstance, createComponent, detachInstance, mainOf, resetOverrides, setComponent, setOverrides, swapComponent, type ComponentRefusal } from "../component-edits";
import { componentOf, instanceParts, instancesOf, isPartId, OVERRIDE_FIELDS, overridableFields, partSource, type InstanceOverride, type OverrideField, type OverrideValues } from "../components";
import type { Artboard, Crop, ImageDocument, Layer } from "../document";
import type { FontId } from "../fonts";
import type { AgentOutcome } from "./batch";
import type { ImageOpContext, ImageOperation } from "./image-ops";

export const COMPONENT_OPERATIONS = ["create_component", "add_instance", "set_overrides", "reset_overrides", "detach_instance", "swap_component"] as const;

export type ComponentOpName = (typeof COMPONENT_OPERATIONS)[number];

export interface AgentComponentFields {
  component_id?: string;
  part_id?: string;
  reset?: string[];
  component?: boolean;
}

type DocumentOutcome = AgentOutcome<ImageDocument>;
type Refusal = { ok: false; reason: string };

export const AGENT_OVERRIDE_NAMES: Record<OverrideField, string> = {
  text: "text",
  fill: "fill",
  stroke: "stroke",
  fontId: "font_id",
  fontWeight: "font_weight",
  italic: "italic",
  assetId: "media_id",
  crop: "crop",
  iconId: "icon_id",
  hidden: "hidden",
};

const NESTING = "componentes não vão dentro de componentes";

const CREATE_REFUSALS: Record<ComponentRefusal, string> = {
  missing: "create_component precisa de layer_ids de uma prancheta só",
  locked: "há camada travada; destrave com set_locked antes",
  instance: `a seleção tem uma instância e ${NESTING}; use detach_instance antes`,
  component: `essas camadas já estão num componente e ${NESTING}; escolha camadas de uma prancheta comum`,
  too_large: "a seleção passa de 4096 pixels de lado; diminua antes",
  field: "create_component precisa de layer_ids",
  invalid: "o componente ficaria inválido",
};

function refuse(reason: string): Refusal {
  return { ok: false, reason };
}

export function isComponentOperation(name: string): name is ComponentOpName {
  return (COMPONENT_OPERATIONS as readonly string[]).includes(name);
}

function targets(op: ImageOperation): string[] {
  if (op.layer_ids && op.layer_ids.length > 0) return op.layer_ids;
  return op.layer_id ? [op.layer_id] : [];
}

function componentIdOf(doc: ImageDocument, id: string | undefined): string | undefined {
  const instance = id ? artboardOfLayer(doc, id)?.layers.find((l) => l.id === id && l.type === "instance") : undefined;
  return instance?.componentId ?? id;
}

function absentComponent(id: string | undefined): Refusal {
  return refuse(`o componente ${id ?? "(sem component_id)"} não existe; use o id de uma prancheta com component true de studio_read`);
}

function instanceOf(doc: ImageDocument, id: string | undefined): { layer: Layer; component: Artboard } | Refusal {
  const layer = id ? artboardOfLayer(doc, id)?.layers.find((l) => l.id === id) : undefined;
  if (!layer || layer.type !== "instance") return refuse(`a camada ${id ?? "(sem layer_id)"} não é uma instância de componente; studio_read mostra type instance`);
  const component = componentOf(doc, layer.componentId);
  return component ? { layer, component } : absentComponent(layer.componentId);
}

function agentFields(fields: readonly OverrideField[]): string {
  return fields.map((field) => AGENT_OVERRIDE_NAMES[field]).join(", ");
}

function overrideValues(op: ImageOperation): OverrideValues {
  const values: OverrideValues = {};
  if (op.text !== undefined) values.text = op.text;
  if (op.fill !== undefined) values.fill = op.fill;
  if (op.stroke !== undefined) values.stroke = op.stroke;
  if (op.font_id !== undefined) values.fontId = op.font_id as FontId;
  if (op.font_weight !== undefined) values.fontWeight = op.font_weight;
  if (op.italic !== undefined) values.italic = op.italic;
  if (op.media_id !== undefined) values.assetId = op.media_id;
  if (op.crop !== undefined) values.crop = op.crop as Crop;
  if (op.icon_id !== undefined) values.iconId = op.icon_id;
  if (op.hidden !== undefined) values.hidden = op.hidden;
  return values;
}

function lockedInstance(id: string): Refusal {
  return refuse(`a instância ${id} está travada; destrave com set_locked antes`);
}

function partOf(doc: ImageDocument, op: ImageOperation): { layer: Layer; component: Artboard; main: Layer } | Refusal {
  const found = instanceOf(doc, op.layer_id);
  if ("reason" in found) return found;
  const { layer, component } = found;
  if (!op.part_id) return refuse("informe part_id, o id da camada dentro do componente (parts em studio_read)");
  const main = mainOf(component, layer.id, op.part_id);
  if (!main) return refuse(`${op.part_id} não é parte do componente ${component.id}; as partes são: ${component.layers.map((l) => l.id).join(", ")}`);
  return { layer, component, main };
}

function setOverridesOp(doc: ImageDocument, op: ImageOperation, ctx: ImageOpContext): DocumentOutcome {
  const part = partOf(doc, op);
  if ("reason" in part) return part;
  const values = overrideValues(op);
  const fields = Object.keys(values) as OverrideField[];
  if (fields.length === 0) return refuse(`set_overrides precisa de algum campo: ${agentFields(overridableFields(part.main))}`);
  if (op.media_id !== undefined && !ctx.naturalSize(op.media_id)) return refuse(`a imagem ${op.media_id} não está na biblioteca`);
  if (op.icon_id !== undefined && !ctx.icons.includes(op.icon_id)) return refuse(`o ícone ${op.icon_id} não existe; use um de: ${ctx.icons.join(", ")}`);
  const result = setOverrides(doc, part.layer.id, part.main.id, values);
  if (result.ok) return { ok: true, document: result.document, focus: { kind: "layer", layerId: part.layer.id }, label: "set_overrides", changed: [part.layer.id] };
  if (result.reason === "locked") return lockedInstance(part.layer.id);
  if (result.reason === "field") return refuse(`a parte ${part.main.id} (${part.main.type}) aceita: ${agentFields(overridableFields(part.main))}`);
  return refuse(`o valor deixaria a parte ${part.main.id} inválida; confira cores #rrggbb, font_id, font_weight de 100 a 900 e texto não vazio`);
}

function resetOverridesOp(doc: ImageDocument, op: ImageOperation): DocumentOutcome {
  const found = instanceOf(doc, op.layer_id);
  if ("reason" in found) return found;
  if (found.layer.locked) return lockedInstance(found.layer.id);
  const names = Object.entries(AGENT_OVERRIDE_NAMES) as [OverrideField, string][];
  const unknown = (op.reset ?? []).find((name) => !names.some(([, agent]) => agent === name));
  if (unknown) return refuse(`reset aceita: ${names.map(([, agent]) => agent).join(", ")}`);
  const fields = op.reset && op.reset.length > 0 ? names.filter(([, agent]) => op.reset!.includes(agent)).map(([field]) => field) : undefined;
  if (op.part_id !== undefined && !mainOf(found.component, found.layer.id, op.part_id)) return refuse(`${op.part_id} não é parte do componente ${found.component.id}`);
  const document = resetOverrides(doc, found.layer.id, op.part_id, fields);
  return { ok: true, document, focus: { kind: "layer", layerId: found.layer.id }, label: "reset_overrides", changed: [found.layer.id] };
}

function createOp(doc: ImageDocument, op: ImageOperation): DocumentOutcome {
  const ids = targets(op);
  if (ids.length === 0) return refuse(CREATE_REFUSALS.field);
  const result = createComponent(doc, ids, op.name);
  if (!result.ok) return refuse(CREATE_REFUSALS[result.reason]);
  return { ok: true, document: result.document, focus: { kind: "layer", layerId: result.instanceId }, label: "create_component", created: [result.instanceId, result.componentId], select: [result.instanceId] };
}

function addInstanceOp(doc: ImageDocument, op: ImageOperation, ctx: ImageOpContext): DocumentOutcome {
  const componentId = componentIdOf(doc, op.component_id);
  if (!componentOf(doc, componentId)) return absentComponent(op.component_id);
  const host = op.artboard_id !== undefined ? artboardById(doc, op.artboard_id) : activeArtboard(doc, ctx.activeArtboard);
  if (!host) return refuse(`a prancheta ${op.artboard_id} não existe; leia o projeto de novo com studio_read`);
  const result = addInstance(doc, host.id, componentId!, { x: op.x, y: op.y, w: op.w, h: op.h });
  if (!result.ok) return refuse(result.reason === "component" ? `uma instância não pode ficar dentro de um componente: ${NESTING}; escolha outra prancheta em artboard_id` : "a instância ficaria longe demais ou grande demais; diminua w ou h");
  return { ok: true, document: result.document, focus: { kind: "layer", layerId: result.instanceId }, label: "add_instance", created: [result.instanceId] };
}

function detachOp(doc: ImageDocument, op: ImageOperation): DocumentOutcome {
  const found = instanceOf(doc, op.layer_id);
  if ("reason" in found) return found;
  const result = detachInstance(doc, found.layer.id);
  if (!result.ok) return lockedInstance(found.layer.id);
  return { ok: true, document: result.document, focus: result.ids[0] ? { kind: "layer", layerId: result.ids[0] } : { kind: "canvas" }, label: "detach_instance", created: result.ids, changed: [found.layer.id] };
}

function swapOp(doc: ImageDocument, op: ImageOperation): DocumentOutcome {
  const found = instanceOf(doc, op.layer_id);
  if ("reason" in found) return found;
  const componentId = componentIdOf(doc, op.component_id);
  if (!componentOf(doc, componentId)) return absentComponent(op.component_id);
  const result = swapComponent(doc, found.layer.id, componentId!);
  if (!result.ok) return lockedInstance(found.layer.id);
  const notes = result.dropped.length > 0 ? [`substituições sem parte equivalente no novo componente foram descartadas: ${result.dropped.join(", ")}`] : [];
  return { ok: true, document: result.document, focus: { kind: "layer", layerId: found.layer.id }, label: "swap_component", changed: [found.layer.id], notes };
}

export function componentOperation(doc: ImageDocument, op: ImageOperation, ctx: ImageOpContext): DocumentOutcome {
  switch (op.op as ComponentOpName) {
    case "create_component":
      return createOp(doc, op);
    case "add_instance":
      return addInstanceOp(doc, op, ctx);
    case "set_overrides":
      return setOverridesOp(doc, op, ctx);
    case "reset_overrides":
      return resetOverridesOp(doc, op);
    case "detach_instance":
      return detachOp(doc, op);
    case "swap_component":
      return swapOp(doc, op);
  }
  return refuse(`a operação ${op.op} não existe`);
}

export function partRefusal(op: ImageOperation): Refusal | null {
  const ids = [...targets(op), ...(op.above_id ? [op.above_id] : []), ...(op.below_id ? [op.below_id] : [])];
  const part = ids.find(isPartId);
  const source = part ? partSource(part) : null;
  if (!part || !source) return null;
  return refuse(`${part} é parte da instância ${source.instanceId}; mude texto, cor, fonte, imagem, ícone ou visibilidade com set_overrides(layer_id: ${source.instanceId}, part_id: ${source.layerId}), mude a forma no componente ou separe com detach_instance`);
}

export function flaggedComponent(doc: ImageDocument, artboardId: string, on: boolean): { ok: true; document: ImageDocument } | Refusal {
  const result = setComponent(doc, artboardId, on);
  return result.ok ? result : refuse(`a prancheta ${artboardId} tem instâncias e ${NESTING}; use detach_instance nelas antes`);
}

export function moveRefusal(destination: Artboard, layers: readonly Layer[]): Refusal | null {
  return destination.component && layers.some((l) => l.type === "instance") ? refuse(`instâncias não entram num componente: ${NESTING}; use detach_instance antes`) : null;
}

export interface AgentOverride {
  part_id: string;
  text?: string;
  fill?: string;
  stroke?: string;
  font_id?: string;
  font_weight?: number;
  italic?: boolean;
  media_id?: string;
  crop?: Crop;
  icon_id?: string;
  hidden?: boolean;
}

export interface OutlinePart {
  id: string;
  part_id: string;
  type: Layer["type"];
  text?: string;
  fill?: string;
  stroke?: string;
  media_id?: string;
  icon_id?: string;
  hidden?: boolean;
}

export function agentOverrides(overrides: readonly InstanceOverride[]): AgentOverride[] {
  return overrides.map((override) => {
    const out: AgentOverride = { part_id: override.layerId };
    for (const field of OVERRIDE_FIELDS) if (override[field] !== undefined) Object.assign(out, { [AGENT_OVERRIDE_NAMES[field]]: override[field] });
    return out;
  });
}

export function outlineParts(doc: ImageDocument, artboard: Artboard, layer: Layer): OutlinePart[] {
  const component = layer.type === "instance" ? componentOf(doc, layer.componentId) : undefined;
  if (!component) return [];
  return instanceParts(component, layer, artboard.canvas).map((part) => ({
    id: part.id,
    part_id: partSource(part.id)?.layerId ?? part.id,
    type: part.type,
    ...(part.text ? { text: part.text } : {}),
    ...(part.fill ? { fill: part.fill } : {}),
    ...(part.stroke && (part.strokeWidth ?? 0) > 0 ? { stroke: part.stroke } : {}),
    ...(part.assetId ? { media_id: part.assetId } : {}),
    ...(part.iconId ? { icon_id: part.iconId } : {}),
    ...(part.hidden ? { hidden: true } : {}),
  }));
}

export function componentUses(doc: ImageDocument, artboard: Artboard): { component: true; instances: number } | Record<string, never> {
  return artboard.component ? { component: true, instances: instancesOf(doc, artboard.id).length } : {};
}
