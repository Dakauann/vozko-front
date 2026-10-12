import { artboardOfItem, editArtboard } from "../artboards";
import { ITEM_SIZINGS, LAYOUT_ALIGNS, LAYOUT_DIRECTIONS, LAYOUT_SIZINGS, LAYOUT_SPACING_RANGE, type ItemSizing, type Layout, type LayoutItem, type LayoutPadding } from "../auto-layout";
import { removeLayout, setLayout, setLayoutItem, type LayoutRefusal, type LayoutTarget } from "../auto-layout-edits";
import type { Artboard, ImageDocument, StudioGroup } from "../document";
import type { AgentOutcome } from "./batch";
import type { ImageOpContext, ImageOperation } from "./image-ops";

export const LAYOUT_OPERATIONS = ["set_layout", "remove_layout", "set_layout_item"] as const;

export type LayoutOpName = (typeof LAYOUT_OPERATIONS)[number];

export interface AgentLayoutFields {
  layout_direction?: string;
  layout_gap?: number;
  layout_auto_gap?: boolean;
  layout_padding?: number[];
  layout_align_main?: string;
  layout_align_cross?: string;
  layout_width?: string;
  layout_height?: string;
  item_width?: string;
  item_height?: string;
  item_absolute?: boolean;
}

type DocumentOutcome = AgentOutcome<ImageDocument>;
type Refusal = { ok: false; reason: string };

const REFUSALS: Record<LayoutRefusal, string> = {
  missing: "a camada ou o grupo não existe; leia o projeto de novo com studio_read",
  locked: "há camada travada na seleção; destrave com set_locked antes",
  base: "a camada de baixo do layout está girada; o layout automático precisa da base reta (rotation 0)",
  repeat: "o grupo tem repetição; tire a repetição com clear_repeat antes do layout automático",
  range: "o layout deixaria camadas longe demais da prancheta; diminua layout_gap, layout_padding ou o conteúdo",
  invalid: "essa combinação não vale: hug só em textos sem curva, fill e hug pedem a camada reta, absolute não combina com fill ou hug e um item não pode preencher um contêiner que abraça o conteúdo",
};

function refuse(reason: string): Refusal {
  return { ok: false, reason };
}

export function isLayoutOperation(name: string): name is LayoutOpName {
  return (LAYOUT_OPERATIONS as readonly string[]).includes(name);
}

function choice<T extends string>(name: string, value: string | undefined, allowed: readonly T[]): { ok: true; value: T | undefined } | Refusal {
  if (value === undefined) return { ok: true, value: undefined };
  return (allowed as readonly string[]).includes(value) ? { ok: true, value: value as T } : refuse(`${name} precisa ser um de: ${allowed.join(", ")}`);
}

function spacing(name: string, value: number | undefined): string | null {
  return value === undefined || (value >= LAYOUT_SPACING_RANGE[0] && value <= LAYOUT_SPACING_RANGE[1]) ? null : `${name} vai de ${LAYOUT_SPACING_RANGE[0]} a ${LAYOUT_SPACING_RANGE[1]} pixels`;
}

export function paddingOf(values: readonly number[]): LayoutPadding | null {
  if (values.length === 1) return { top: values[0], right: values[0], bottom: values[0], left: values[0] };
  if (values.length === 2) return { top: values[0], right: values[1], bottom: values[0], left: values[1] };
  if (values.length === 4) return { top: values[0], right: values[1], bottom: values[2], left: values[3] };
  return null;
}

function layoutPatch(op: ImageOperation): { ok: true; value: Partial<Layout> } | Refusal {
  const direction = choice("layout_direction", op.layout_direction, LAYOUT_DIRECTIONS);
  const main = choice("layout_align_main", op.layout_align_main, LAYOUT_ALIGNS);
  const cross = choice("layout_align_cross", op.layout_align_cross, LAYOUT_ALIGNS);
  const width = choice("layout_width", op.layout_width, LAYOUT_SIZINGS);
  const height = choice("layout_height", op.layout_height, LAYOUT_SIZINGS);
  for (const checked of [direction, main, cross, width, height]) if (!checked.ok) return checked;
  const padding = op.layout_padding ? paddingOf(op.layout_padding) : undefined;
  if (padding === null) return refuse("layout_padding leva 1 número (todos os lados), 2 (vertical e horizontal) ou 4 (topo, direita, baixo, esquerda)");
  const problem = spacing("layout_gap", op.layout_gap) ?? (padding ? [padding.top, padding.right, padding.bottom, padding.left].map((value) => spacing("layout_padding", value)).find(Boolean) : null);
  if (problem) return refuse(problem);
  if (op.layout_auto_gap && (op.layout_gap !== undefined || op.layout_align_main !== undefined)) return refuse("layout_auto_gap espalha os itens sozinho; não mande layout_gap nem layout_align_main junto");
  const patch: Partial<Layout> = {};
  if (direction.ok && direction.value) patch.direction = direction.value;
  if (op.layout_gap !== undefined) patch.gap = op.layout_gap;
  if (op.layout_auto_gap !== undefined) patch.autoGap = op.layout_auto_gap;
  if (padding) patch.padding = padding;
  if (main.ok && main.value) patch.alignMain = main.value;
  if (cross.ok && cross.value) patch.alignCross = cross.value;
  if (width.ok && width.value) patch.width = width.value;
  if (height.ok && height.value) patch.height = height.value;
  return { ok: true, value: patch };
}

function homeOf(doc: ImageDocument, op: ImageOperation): Artboard | undefined {
  const id = op.group_id ?? op.layer_ids?.[0] ?? op.layer_id;
  return id ? artboardOfItem(doc, id) : undefined;
}

function setLayoutOp(doc: ImageDocument, op: ImageOperation, ctx: ImageOpContext): DocumentOutcome {
  const patch = layoutPatch(op);
  if (!patch.ok) return patch;
  const ids = op.layer_ids && op.layer_ids.length > 0 ? op.layer_ids : op.layer_id ? [op.layer_id] : [];
  const target: LayoutTarget | null = op.group_id ? { groupId: op.group_id } : ids.length > 0 ? { ids } : null;
  if (!target) return refuse("set_layout precisa de group_id, ou de layer_ids para montar o grupo com layout");
  const artboard = homeOf(doc, op);
  if (!artboard) return refuse(REFUSALS.missing);
  const result = setLayout(artboard, target, patch.value, ctx.measure);
  if (!result.ok) return refuse(REFUSALS[result.reason]);
  const document = editArtboard(doc, artboard.id, () => result.document);
  return { ok: true, document, focus: { kind: "artboard", artboardId: artboard.id }, label: "set_layout", created: [result.groupId], changed: [result.groupId] };
}

function removeLayoutOp(doc: ImageDocument, op: ImageOperation): DocumentOutcome {
  const artboard = op.group_id ? artboardOfItem(doc, op.group_id) : undefined;
  const group = artboard?.groups?.find((g) => g.id === op.group_id);
  if (!artboard || !group) return refuse(REFUSALS.missing);
  if (!group.layout) return refuse(`o grupo ${group.id} não tem layout automático`);
  return { ok: true, document: editArtboard(doc, artboard.id, (surface) => removeLayout(surface, group.id)), focus: { kind: "artboard", artboardId: artboard.id }, label: "remove_layout", changed: [group.id] };
}

function layoutContainer(artboard: Artboard, id: string): StudioGroup | undefined {
  const layer = artboard.layers.find((l) => l.id === id);
  const containerId = layer ? layer.groupId : artboard.groups?.find((g) => g.id === id)?.parentId;
  const container = containerId ? artboard.groups?.find((g) => g.id === containerId) : undefined;
  return container?.layout && container.baseId !== id ? container : undefined;
}

function setItemOp(doc: ImageDocument, op: ImageOperation, ctx: ImageOpContext): DocumentOutcome {
  const id = op.group_id ?? op.layer_id;
  const artboard = id ? artboardOfItem(doc, id) : undefined;
  if (!id || !artboard) return refuse(REFUSALS.missing);
  if (!layoutContainer(artboard, id)) return refuse(`${id} não está dentro de um grupo com layout automático, ou é a base dele`);
  const width = choice<ItemSizing>("item_width", op.item_width, ITEM_SIZINGS);
  const height = choice<ItemSizing>("item_height", op.item_height, ITEM_SIZINGS);
  if (!width.ok) return width;
  if (!height.ok) return height;
  if (op.item_width === undefined && op.item_height === undefined && op.item_absolute === undefined) return refuse("set_layout_item precisa de item_width, item_height ou item_absolute");
  const patch: Partial<LayoutItem> = { ...(width.value ? { width: width.value } : {}), ...(height.value ? { height: height.value } : {}), ...(op.item_absolute !== undefined ? { absolute: op.item_absolute } : {}) };
  const result = setLayoutItem(artboard, id, patch, ctx.measure);
  if (!result.ok) return refuse(REFUSALS[result.reason]);
  const document = editArtboard(doc, artboard.id, () => result.document);
  const notes = result.fixed.length > 0 ? [`o grupo passou a ter tamanho fixo em ${result.fixed.join(" e ")} para o item poder preencher`] : [];
  return { ok: true, document, focus: { kind: "artboard", artboardId: artboard.id }, label: "set_layout_item", changed: [id], notes };
}

export function layoutOperation(doc: ImageDocument, op: ImageOperation, ctx: ImageOpContext): DocumentOutcome {
  switch (op.op as LayoutOpName) {
    case "set_layout":
      return setLayoutOp(doc, op, ctx);
    case "remove_layout":
      return removeLayoutOp(doc, op);
    case "set_layout_item":
      return setItemOp(doc, op, ctx);
  }
  return refuse(`a operação ${op.op} não existe`);
}

export interface OutlineLayout {
  direction: string;
  gap: number | "auto";
  padding: [number, number, number, number];
  align_main?: string;
  align_cross?: string;
  width: string;
  height: string;
}

export function outlineLayout(group: StudioGroup): { layout?: OutlineLayout; item?: LayoutItem } {
  const layout = group.layout;
  const padding = layout?.padding ?? { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    ...(layout
      ? {
          layout: {
            direction: layout.direction,
            gap: layout.autoGap ? "auto" : (layout.gap ?? 0),
            padding: [padding.top, padding.right, padding.bottom, padding.left],
            ...(layout.alignMain ? { align_main: layout.alignMain } : {}),
            ...(layout.alignCross ? { align_cross: layout.alignCross } : {}),
            width: layout.width,
            height: layout.height,
          },
        }
      : {}),
    ...(group.layoutItem ? { item: group.layoutItem } : {}),
  };
}
