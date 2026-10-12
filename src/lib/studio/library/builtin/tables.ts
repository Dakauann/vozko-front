import { newTableLayer, tableTransform } from "../../generated-edits";
import { newTableSpec, tableInk, type TableGrid, type TableSpec, type TableStyle } from "../../table";
import { itemLabelKey } from "../catalog";
import { LIBRARY_LOCALES, OWN_SOURCE, type LibraryCategory, type LibraryItem, type LibraryLocale } from "../model";
import { previewSvg } from "../preview";

type TableSample = "plans" | "schedule" | "menu" | "steps";

interface TableLook {
  id: string;
  sample: TableSample;
  style: (ink: string) => Partial<TableStyle>;
  header: boolean;
  align?: TableSpec["columns"][number]["align"][];
  widths?: number[];
  markup: string;
}

const VIEW = 40;

const SAMPLES: Record<TableSample, Record<LibraryLocale, TableGrid>> = {
  plans: {
    pt: [["Plano", "Preço", "Usuários"], ["Básico", "R$ 49", "3"], ["Pro", "R$ 99", "10"], ["Empresa", "R$ 199", "Ilimitado"]],
    en: [["Plan", "Price", "Users"], ["Basic", "$9", "3"], ["Pro", "$19", "10"], ["Business", "$39", "Unlimited"]],
    es: [["Plan", "Precio", "Usuarios"], ["Básico", "9 €", "3"], ["Pro", "19 €", "10"], ["Empresa", "39 €", "Ilimitado"]],
    de: [["Tarif", "Preis", "Nutzer"], ["Basis", "9 €", "3"], ["Pro", "19 €", "10"], ["Business", "39 €", "Unbegrenzt"]],
  },
  schedule: {
    pt: [["Dia", "Horário"], ["Segunda a sexta", "8h às 18h"], ["Sábado", "9h às 13h"], ["Domingo", "Fechado"]],
    en: [["Day", "Hours"], ["Monday to Friday", "8 am to 6 pm"], ["Saturday", "9 am to 1 pm"], ["Sunday", "Closed"]],
    es: [["Día", "Horario"], ["Lunes a viernes", "8 a 18 h"], ["Sábado", "9 a 13 h"], ["Domingo", "Cerrado"]],
    de: [["Tag", "Öffnungszeit"], ["Montag bis Freitag", "8 bis 18 Uhr"], ["Samstag", "9 bis 13 Uhr"], ["Sonntag", "Geschlossen"]],
  },
  menu: {
    pt: [["Item", "Valor"], ["Café", "R$ 6"], ["Pão de queijo", "R$ 5"], ["Suco natural", "R$ 9"]],
    en: [["Item", "Price"], ["Coffee", "$3"], ["Croissant", "$4"], ["Fresh juice", "$5"]],
    es: [["Producto", "Precio"], ["Café", "2 €"], ["Croissant", "3 €"], ["Zumo natural", "4 €"]],
    de: [["Artikel", "Preis"], ["Kaffee", "3 €"], ["Croissant", "3 €"], ["Frischer Saft", "4 €"]],
  },
  steps: {
    pt: [["1", "Escolha o produto"], ["2", "Fale com a gente no WhatsApp"], ["3", "Receba em casa"]],
    en: [["1", "Pick a product"], ["2", "Message us on WhatsApp"], ["3", "Get it at home"]],
    es: [["1", "Elige el producto"], ["2", "Escríbenos por WhatsApp"], ["3", "Recíbelo en casa"]],
    de: [["1", "Produkt wählen"], ["2", "Schreib uns auf WhatsApp"], ["3", "Nach Hause geliefert"]],
  },
};

const LOOKS: readonly TableLook[] = [
  {
    id: "table-striped",
    sample: "plans",
    header: true,
    align: ["left", "right", "center"],
    widths: [2, 1, 1],
    style: () => ({}),
    markup: `<rect x="5" y="8" width="30" height="6" rx="1"/><rect x="5" y="20" width="30" height="6" fill-opacity="0.18"/><path d="M5 14h30M5 20h30M5 26h30M5 32h30" stroke="currentColor" stroke-opacity="0.45" stroke-width="1"/>`,
  },
  {
    id: "table-grid",
    sample: "schedule",
    header: true,
    widths: [3, 2],
    style: (ink) => ({ borders: "all", banding: false, headerFill: `${ink}1f`, headerText: ink }),
    markup: `<rect x="5" y="8" width="30" height="6" fill-opacity="0.25"/><path d="M5 8h30v24H5ZM5 14h30M5 20h30M5 26h30M20 8v24" fill="none" stroke="currentColor" stroke-width="1.2"/>`,
  },
  {
    id: "table-minimal",
    sample: "menu",
    header: true,
    align: ["left", "right"],
    widths: [3, 1],
    style: (ink) => ({ borders: "rows", banding: false, headerFill: "#00000000", headerText: ink, borderColor: `${ink}66` }),
    markup: `<path d="M5 14h30M5 20h30M5 26h30" stroke="currentColor" stroke-opacity="0.5" stroke-width="1"/><path d="M6 10.5h10M28 10.5h6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M6 17h12M30 17h4M6 23h9M30 23h4M6 29h11M30 29h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`,
  },
  {
    id: "table-steps",
    sample: "steps",
    header: false,
    align: ["center", "left"],
    widths: [1, 5],
    style: (ink) => ({ borders: "none", banding: true, bandFill: `${ink}14`, weight: 500 }),
    markup: `<rect x="5" y="8" width="30" height="7" rx="1.5" fill-opacity="0.18"/><rect x="5" y="22" width="30" height="7" rx="1.5" fill-opacity="0.18"/><circle cx="9" cy="11.5" r="2"/><circle cx="9" cy="18.5" r="2"/><circle cx="9" cy="25.5" r="2"/><path d="M14 11.5h16M14 18.5h12M14 25.5h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`,
  },
];

const TAGS: Record<LibraryLocale, readonly string[]> = {
  pt: ["tabela", "planilha", "linhas", "colunas", "preços", "dados"],
  en: ["table", "spreadsheet", "rows", "columns", "prices", "data"],
  es: ["tabla", "hoja de cálculo", "filas", "columnas", "precios", "datos"],
  de: ["tabelle", "zeilen", "spalten", "preise", "daten"],
};

function libraryLocale(locale: string): LibraryLocale {
  const short = locale.split("-")[0];
  return (LIBRARY_LOCALES as readonly string[]).includes(short) ? (short as LibraryLocale) : "pt";
}

export function sampleTable(look: Pick<TableLook, "sample" | "header" | "style" | "align" | "widths">, locale: string, ink: string): TableSpec {
  const base = newTableSpec(SAMPLES[look.sample][libraryLocale(locale)], tableInk(ink), look.header);
  const solid = ink.slice(0, 7);
  return {
    ...base,
    columns: base.columns.map((column, i) => ({ width: look.widths?.[i] ?? column.width, align: look.align?.[i] ?? column.align })),
    style: { ...base.style, ...look.style(solid) },
  };
}

function tableItem(look: TableLook): LibraryItem {
  return {
    id: look.id,
    category: "tables",
    editors: ["image", "video"],
    ratio: 1.6,
    label: { key: itemLabelKey(look.id) },
    tags: TAGS,
    preview: { kind: "svg", markup: previewSvg(look.markup, VIEW) },
    source: OWN_SOURCE,
    template: {
      kind: "layers",
      build: (ctx) => {
        const spec = sampleTable(look, ctx.locale, ctx.ink);
        return { layers: [newTableLayer(spec, tableTransform(ctx.canvas, spec))] };
      },
    },
  };
}

const TABLE_ITEMS: readonly LibraryItem[] = LOOKS.map(tableItem);

export const TABLES_CATEGORY: LibraryCategory = {
  id: "tables",
  panel: "elements",
  label: { key: "studio.library.categories.tables" },
  tile: "square",
  items: () => TABLE_ITEMS,
};
