import type { Layer } from "../document";
import { closestIds, supports } from "../library/catalog";
import { LIBRARY_INK, type LibraryEditor, type LibraryItem, type LibraryLabel, type LibrarySlot } from "../library/model";
import { layerColors, type ColorChange, type LibraryBox } from "../library/placement";
import { isValidColor } from "../validate";
import { hasStyle, type AgentBox, type AgentStyle } from "./layer-style";

export interface AgentElementText {
  slot: string;
  text: string;
}

export interface AgentElementFields {
  item_id?: string;
  texts?: AgentElementText[];
  colors?: ColorChange[];
}

export interface LibraryLookup {
  items: ReadonlyMap<string, LibraryItem>;
  text: (label: LibraryLabel) => string;
  locale: string;
}

type ElementPlan = { ok: true; item: LibraryItem; name: string; locale: string; text: (slot: LibrarySlot) => string; colors: ColorChange[]; box: LibraryBox; notes: string[] } | { ok: false; reason: string };

const SUGGESTIONS = 5;
const SEARCH_HINT = "busque com studio_library_search";

function refuse(reason: string): ElementPlan {
  return { ok: false, reason };
}

function nearby(library: LibraryLookup, editor: LibraryEditor, id: string): string {
  const ids = [...library.items.values()].filter((item) => supports(item, editor)).map((item) => item.id);
  return closestIds(id, ids, SUGGESTIONS).join(", ");
}

function textsIssue(item: LibraryItem, texts: readonly AgentElementText[]): string | null {
  const slots = item.template.slots ?? [];
  for (const text of texts) {
    if (!slots.some((slot) => slot.id === text.slot)) {
      return slots.length === 0 ? `o item ${item.id} não tem texto para trocar` : `o item ${item.id} não tem o slot ${text.slot}; use um de: ${slots.map((slot) => slot.id).join(", ")}`;
    }
    if (typeof text.text !== "string" || text.text.trim() === "") return `texts do slot ${text.slot} precisa de text`;
  }
  return null;
}

function colorsIssue(colors: readonly ColorChange[]): string | null {
  const bad = colors.find((change) => !isValidColor(change.from ?? "", true) || !isValidColor(change.to ?? "", true));
  return bad ? "colors usa from e to, cada um uma cor #rrggbb ou #rrggbbaa" : null;
}

export function elementPlan(op: AgentElementFields & AgentBox & AgentStyle, editor: LibraryEditor, library: LibraryLookup | undefined): ElementPlan {
  if (!library) return refuse("a biblioteca de elementos ainda não carregou neste editor; tente de novo");
  const id = op.item_id?.trim() ?? "";
  if (id === "") return refuse(`add_element precisa de item_id; ${SEARCH_HINT}`);
  const item = library.items.get(id);
  if (!item) return refuse(`o item ${id} não existe na biblioteca; parecidos: ${nearby(library, editor, id)}; ${SEARCH_HINT}`);
  if (!supports(item, editor)) return refuse(`o item ${id} não entra neste editor; parecidos que entram: ${nearby(library, editor, id)}`);
  const texts = op.texts ?? [];
  const colors = op.colors ?? [];
  const problem = textsIssue(item, texts) ?? colorsIssue(colors);
  if (problem) return refuse(problem);
  const notes = [
    ...(hasStyle(op) ? ["add_element ignora campos de estilo; troque as cores com colors ou ajuste depois com update_layer ou update_clip"] : []),
    ...(op.rotation !== undefined || op.opacity !== undefined ? ["add_element ignora rotation e opacity; ajuste depois"] : []),
  ];
  return {
    ok: true,
    item,
    name: library.text(item.label),
    locale: library.locale,
    colors,
    notes,
    box: { x: op.x, y: op.y, w: op.w, h: op.h },
    text: (slot) => texts.find((text) => text.slot === slot.id)?.text ?? library.text(slot.sample),
  };
}

type IconPlan = { ok: true; kind: "catalog"; iconId: string } | { ok: true; kind: "library"; element: Required<Pick<AgentElementFields, "item_id">> & Pick<AgentElementFields, "colors"> } | { ok: false; reason: string };

const ICON_CATEGORY = "icons";

export function isCatalogIcon(iconId: string | undefined, icons: readonly string[]): boolean {
  return iconId !== undefined && icons.includes(iconId.trim());
}

export function iconPlan(iconId: string | undefined, icons: readonly string[], editor: LibraryEditor, library: LibraryLookup | undefined, fill?: string): IconPlan {
  const id = iconId?.trim() ?? "";
  if (id === "") return { ok: false, reason: `add_icon precisa de icon_id: um id do catálogo ou o item_id de um ícone; ${SEARCH_HINT}` };
  if (isCatalogIcon(id, icons)) return { ok: true, kind: "catalog", iconId: id };
  const catalogHint = `do catálogo, parecidos: ${closestIds(id, icons, SUGGESTIONS).join(", ")}`;
  if (!library) return { ok: false, reason: `o ícone ${id} não está no catálogo (${catalogHint}) e a biblioteca de elementos ainda não carregou neste editor; tente de novo` };
  const item = library.items.get(id);
  if (!item) {
    const libraryIcons = [...library.items.values()].filter((candidate) => candidate.category === ICON_CATEGORY && supports(candidate, editor)).map((candidate) => candidate.id);
    return { ok: false, reason: `o ícone ${id} não existe; ${catalogHint}; da biblioteca, parecidos: ${closestIds(id, libraryIcons, SUGGESTIONS).join(", ")}; ${SEARCH_HINT}` };
  }
  if (item.category !== ICON_CATEGORY) return { ok: false, reason: `o item ${id} da biblioteca não é um ícone; insira com add_element com item_id "${id}"` };
  if (item.preview.kind === "icon" && isCatalogIcon(item.preview.iconId, icons)) return { ok: true, kind: "catalog", iconId: item.preview.iconId };
  if (fill !== undefined && !isValidColor(fill, true)) return { ok: false, reason: "fill de um ícone da biblioteca precisa ser uma cor #rrggbb ou #rrggbbaa" };
  return { ok: true, kind: "library", element: { item_id: id, ...(fill !== undefined ? { colors: [{ from: LIBRARY_INK[editor], to: fill }] } : {}) } };
}

export function unusedColorNotes(colors: readonly ColorChange[], original: readonly Layer[]): string[] {
  const present = layerColors(original);
  const missing = colors.filter((change) => !present.includes(change.from.toLowerCase()));
  return missing.length === 0 ? [] : [`as cores ${missing.map((change) => change.from).join(", ")} não estão no item; as dele são ${present.join(", ")}`];
}
