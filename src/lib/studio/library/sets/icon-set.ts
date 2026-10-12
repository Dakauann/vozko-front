import { artLayers } from "../../svg-import";
import { LIBRARY_INK, type LibraryItem, type LibraryLocale, type LibrarySource, type LocalizedText } from "../model";
import { chunkedData, parsedModule, type Chunked } from "./chunks";
import { ICON_CHUNK_SIZE, ICON_CHUNKS, ICON_INDEX } from "./data/loaders";
import { centeredTarget, iconArt, iconMarkup, ICON_WEIGHTS, localizedNames, type IconIndexEntry, type IconPaths, type IconWeight } from "./format";

export const ICON_SET_SOURCE: LibrarySource = { set: "phosphor", license: "MIT" };

export const ICON_SET_SHARE = 0.2;

export const ICON_WEIGHT_LABELS: Readonly<Record<IconWeight, LocalizedText>> = {
  regular: { pt: "Regular", en: "Regular", es: "Regular", de: "Normal" },
  thin: { pt: "Fino", en: "Thin", es: "Fino", de: "Dünn" },
  light: { pt: "Leve", en: "Light", es: "Ligero", de: "Leicht" },
  bold: { pt: "Negrito", en: "Bold", es: "Negrita", de: "Fett" },
  fill: { pt: "Preenchido", en: "Filled", es: "Relleno", de: "Gefüllt" },
  duotone: { pt: "Duotom", en: "Duotone", es: "Bitono", de: "Zweifarbig" },
};

export { centeredTarget };

function weightedLabel(names: Record<LibraryLocale, string>, weight: IconWeight): LocalizedText {
  if (weight === "regular") return names;
  const suffix = ICON_WEIGHT_LABELS[weight];
  return { pt: `${names.pt} (${suffix.pt.toLowerCase()})`, en: `${names.en} (${suffix.en.toLowerCase()})`, es: `${names.es} (${suffix.es.toLowerCase()})`, de: `${names.de} (${suffix.de.toLowerCase()})` };
}

function iconSetItem(entry: IconIndexEntry, position: number, weight: IconWeight, chunks: Chunked<IconPaths[]>): LibraryItem {
  const size = ICON_CHUNK_SIZE[weight];
  const chunk = Math.floor(position / size);
  const at = position % size;
  const paths = () => chunks.get(chunk)?.[at];
  return {
    id: `icon-${entry.n}-${weight}`,
    category: "icons",
    subcategory: weight,
    editors: ["image", "video"],
    ratio: 1,
    label: { text: weightedLabel(localizedNames(entry.l), weight) },
    tags: { en: entry.t, pt: entry.p },
    preview: {
      kind: "deferred",
      load: async () => {
        const loaded = (await chunks.load(chunk))[at];
        return { kind: "svg", markup: iconMarkup(loaded) };
      },
    },
    source: ICON_SET_SOURCE,
    palette: (editor) => [LIBRARY_INK[editor]],
    assets: { loaded: () => paths() !== undefined, load: async () => void (await chunks.load(chunk)) },
    template: {
      kind: "layers",
      build: (ctx) => {
        const loaded = paths();
        if (!loaded) throw new Error(`the icon ${entry.n} is not loaded`);
        return artLayers(iconArt(loaded, ctx.ink), ctx.canvas, { target: centeredTarget(ctx.canvas, ICON_SET_SHARE) });
      },
    },
  };
}

let items: Promise<LibraryItem[]> | null = null;

export function iconSetItems(): Promise<LibraryItem[]> {
  items ??= parsedModule<IconIndexEntry[]>(ICON_INDEX).then((index) =>
    ICON_WEIGHTS.flatMap((weight) => {
      const chunks = chunkedData<IconPaths[]>(ICON_CHUNKS[weight]);
      return index.map((entry, position) => iconSetItem(entry, position, weight, chunks));
    }),
  );
  items.catch(() => {
    items = null;
  });
  return items;
}
