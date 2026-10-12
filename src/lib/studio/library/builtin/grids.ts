import { cellNode, gridMarkup, splitNode, type GridNode } from "../grid-layout";
import { OWN_SOURCE, type LibraryCategory, type LibraryItem, type LocalizedText } from "../model";

type Subcategory = "split" | "collage";

interface GridPreset {
  id: string;
  subcategory: Subcategory;
  name: LocalizedText;
  root: GridNode;
}

function text(pt: string, en: string, es: string, de: string): LocalizedText {
  return { pt, en, es, de };
}

function cells(count: number): GridNode[] {
  return Array.from({ length: count }, () => cellNode());
}

function rows(count: number, columns: number): GridNode {
  return splitNode("column", Array.from({ length: count }, () => splitNode("row", cells(columns))));
}

const ROUNDED = { kind: "rect", radius: 0.12 } as const;

const GRID_PRESETS: GridPreset[] = [
  { id: "grid-two-columns", subcategory: "split", name: text("2 colunas", "2 columns", "2 columnas", "2 Spalten"), root: splitNode("row", cells(2)) },
  { id: "grid-two-rows", subcategory: "split", name: text("2 linhas", "2 rows", "2 filas", "2 Zeilen"), root: splitNode("column", cells(2)) },
  { id: "grid-three-columns", subcategory: "split", name: text("3 colunas", "3 columns", "3 columnas", "3 Spalten"), root: splitNode("row", cells(3)) },
  { id: "grid-three-rows", subcategory: "split", name: text("3 linhas", "3 rows", "3 filas", "3 Zeilen"), root: splitNode("column", cells(3)) },
  { id: "grid-two-by-two", subcategory: "collage", name: text("2 por 2", "2 by 2", "2 por 2", "2 mal 2"), root: rows(2, 2) },
  { id: "grid-three-by-three", subcategory: "collage", name: text("3 por 3", "3 by 3", "3 por 3", "3 mal 3"), root: rows(3, 3) },
  { id: "grid-two-by-three", subcategory: "collage", name: text("2 por 3", "2 by 3", "2 por 3", "2 mal 3"), root: rows(3, 2) },
  { id: "grid-big-left", subcategory: "collage", name: text("Destaque à esquerda", "Feature left", "Destacado a la izquierda", "Groß links"), root: splitNode("row", [cellNode(undefined, 2), splitNode("column", cells(2))]) },
  { id: "grid-big-right", subcategory: "collage", name: text("Destaque à direita", "Feature right", "Destacado a la derecha", "Groß rechts"), root: splitNode("row", [splitNode("column", cells(2)), cellNode(undefined, 2)]) },
  { id: "grid-big-top", subcategory: "collage", name: text("Destaque em cima", "Feature top", "Destacado arriba", "Groß oben"), root: splitNode("column", [cellNode(undefined, 2), splitNode("row", cells(2))]) },
  { id: "grid-big-bottom", subcategory: "collage", name: text("Destaque embaixo", "Feature bottom", "Destacado abajo", "Groß unten"), root: splitNode("column", [splitNode("row", cells(3)), cellNode(undefined, 2)]) },
  { id: "grid-big-left-three", subcategory: "collage", name: text("Destaque e 3 fotos", "Feature and 3 photos", "Destacado y 3 fotos", "Groß und 3 Fotos"), root: splitNode("row", [cellNode(undefined, 2), splitNode("column", cells(3))]) },
  { id: "grid-mosaic", subcategory: "collage", name: text("Mosaico", "Mosaic", "Mosaico", "Mosaik"), root: splitNode("row", [splitNode("column", [cellNode(undefined, 2), cellNode()]), splitNode("column", [cellNode(), cellNode(undefined, 2)])]) },
  { id: "grid-rounded-two-by-two", subcategory: "collage", name: text("2 por 2 arredondado", "Rounded 2 by 2", "2 por 2 redondeado", "2 mal 2 abgerundet"), root: splitNode("column", [splitNode("row", [cellNode(ROUNDED), cellNode(ROUNDED)]), splitNode("row", [cellNode(ROUNDED), cellNode(ROUNDED)])]) },
  { id: "grid-rounded-columns", subcategory: "split", name: text("Colunas arredondadas", "Rounded columns", "Columnas redondeadas", "Abgerundete Spalten"), root: splitNode("row", [cellNode(ROUNDED), cellNode(ROUNDED)]) },
];

const TAGS = {
  pt: ["colagem", "grade", "tela dividida", "fotos"],
  en: ["collage", "grid", "split screen", "photos"],
  es: ["collage", "cuadrícula", "pantalla dividida"],
  de: ["collage", "raster", "geteilter bildschirm"],
};

function gridItem(preset: GridPreset): LibraryItem {
  return {
    id: preset.id,
    category: "grids",
    subcategory: preset.subcategory,
    editors: ["image", "video"],
    ratio: 1,
    label: { text: preset.name },
    tags: TAGS,
    preview: { kind: "svg", markup: gridMarkup(preset.root, 1) },
    source: OWN_SOURCE,
    template: { kind: "grid", root: preset.root },
  };
}

const GRID_ITEMS: readonly LibraryItem[] = GRID_PRESETS.map(gridItem);

const SUBCATEGORIES: readonly Subcategory[] = ["split", "collage"];

export const GRIDS_CATEGORY: LibraryCategory = {
  id: "grids",
  panel: "elements",
  label: { key: "studio.library.categories.grids" },
  tile: "square",
  notes: { image: { key: "studio.library.notes.gridsImage" }, video: { key: "studio.library.notes.gridsVideo" } },
  subcategories: SUBCATEGORIES.map((id) => ({ id, label: { key: `studio.library.subcategories.grids.${id}` } })),
  items: () => GRID_ITEMS,
};
