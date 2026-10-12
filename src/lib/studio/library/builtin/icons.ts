import { newIconLayer } from "../../document";
import { squareTransform } from "../../geometry";
import { OWN_SOURCE, type LibraryCategory, type LibraryItem } from "../model";
import { ICON_WEIGHTS } from "../sets/format";
import { ICON_WEIGHT_LABELS, iconSetItems } from "../sets/icon-set";

const ICON_SHARE = 0.2;

function iconItem(iconId: string): LibraryItem {
  return {
    id: `icon-${iconId}`,
    category: "icons",
    subcategory: "essentials",
    editors: ["image", "video"],
    ratio: 1,
    label: { key: `studio.image.icons.${iconId}` },
    preview: { kind: "icon", iconId },
    source: OWN_SOURCE,
    template: { kind: "layers", build: (ctx) => ({ layers: [newIconLayer(iconId, ctx.ink, squareTransform(ctx.canvas, ICON_SHARE))] }) },
  };
}

export function iconsCategory(iconIds: readonly string[]): LibraryCategory {
  const own = iconIds.map(iconItem);
  return {
    id: "icons",
    panel: "elements",
    label: { key: "studio.library.categories.icons" },
    tile: "square",
    fixture: "sample",
    subcategories: [{ id: "essentials", label: { key: "studio.library.subcategories.icons.essentials" } }, ...ICON_WEIGHTS.map((id) => ({ id, label: { text: ICON_WEIGHT_LABELS[id] } }))],
    items: async () => [...own, ...(await iconSetItems())],
  };
}
