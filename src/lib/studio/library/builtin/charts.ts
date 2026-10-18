import { CHART_KINDS, chartInk, isRoundChart, newChartSpec, type ChartData, type ChartKind, type ChartSpec } from "../../chart";
import { chartRatio, chartTransform, newChartLayer } from "../../chart-edits";
import { counterLocaleFor } from "../../locale-numbers";
import { LIBRARY_LOCALES, OWN_SOURCE, type LibraryCategory, type LibraryItem, type LibraryLocale } from "../model";
import { previewSvg } from "../preview";

const VIEW = 40;
const SOFT = `fill-opacity="0.45"`;
const LINE = `fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"`;

const PREVIEWS: Record<ChartKind, string> = {
  bar: `<rect x="7" y="20" width="6" height="13" rx="1"/><rect x="17" y="12" width="6" height="21" rx="1"/><rect x="27" y="6" width="6" height="27" rx="1"/>`,
  barHorizontal: `<rect x="6" y="7" width="14" height="6" rx="1"/><rect x="6" y="17" width="27" height="6" rx="1"/><rect x="6" y="27" width="20" height="6" rx="1"/>`,
  barGrouped: `<rect x="5" y="18" width="5" height="15" rx="1"/><rect x="10" y="12" width="5" height="21" rx="1" ${SOFT}/><rect x="20" y="10" width="5" height="23" rx="1"/><rect x="25" y="16" width="5" height="17" rx="1" ${SOFT}/>`,
  barStacked: `<rect x="7" y="22" width="7" height="11" rx="1"/><rect x="7" y="13" width="7" height="9" rx="1" ${SOFT}/><rect x="17" y="17" width="7" height="16" rx="1"/><rect x="17" y="7" width="7" height="10" rx="1" ${SOFT}/><rect x="27" y="24" width="7" height="9" rx="1"/><rect x="27" y="16" width="7" height="8" rx="1" ${SOFT}/>`,
  line: `<path d="M6 30 15 20l7 5 12-15" ${LINE}/>`,
  lineMulti: `<path d="M6 30 15 20l7 5 12-15" ${LINE}/><path d="M6 22l9 4 7-9 12 3" ${LINE} stroke-opacity="0.45"/>`,
  area: `<path d="M6 33V24l9-8 7 5 12-12v24Z" ${SOFT}/><path d="M6 24l9-8 7 5 12-12" ${LINE}/>`,
  areaStacked: `<path d="M6 33V27l9-4 7 3 12-6v13Z"/><path d="M6 27l9-4 7 3 12-6V9l-12 7-7-4-9 5Z" ${SOFT}/>`,
  pie: `<path d="M20 20V6a14 14 0 0 1 12.1 21Z"/><path d="M20 20 32.1 27A14 14 0 1 1 20 6Z" ${SOFT}/>`,
  donut: `<path d="M20 6a14 14 0 0 1 13.3 18.3l-6.6-2.2A7 7 0 0 0 20 13Z"/><path d="M33.3 24.3A14 14 0 1 1 20 6v7a7 7 0 1 0 6.7 9.1Z" ${SOFT}/>`,
  scatter: `<circle cx="9" cy="28" r="2.6"/><circle cx="15" cy="22" r="2.6"/><circle cx="20" cy="25" r="2.6" ${SOFT}/><circle cx="25" cy="15" r="2.6"/><circle cx="31" cy="10" r="2.6"/><circle cx="29" cy="20" r="2.6" ${SOFT}/>`,
};

const TAGS: Record<LibraryLocale, readonly string[]> = {
  pt: ["gráfico", "dados", "números", "estatística"],
  en: ["chart", "graph", "data", "numbers"],
  es: ["gráfico", "datos", "números"],
  de: ["diagramm", "daten", "zahlen"],
};

const KIND_TAGS: Record<ChartKind, Record<LibraryLocale, readonly string[]>> = {
  bar: { pt: ["barras", "colunas"], en: ["bar", "column"], es: ["barras", "columnas"], de: ["balken", "säulen"] },
  barHorizontal: { pt: ["barras", "horizontal", "ranking"], en: ["bar", "horizontal", "ranking"], es: ["barras", "horizontal"], de: ["balken", "horizontal"] },
  barGrouped: { pt: ["barras", "agrupadas", "categorias", "comparação"], en: ["grouped", "categorical", "comparison"], es: ["agrupadas", "categorías"], de: ["gruppiert", "kategorien"] },
  barStacked: { pt: ["barras", "empilhadas"], en: ["stacked", "bar"], es: ["apiladas"], de: ["gestapelt"] },
  line: { pt: ["linha", "tendência"], en: ["line", "trend"], es: ["línea", "tendencia"], de: ["linie", "trend"] },
  lineMulti: { pt: ["linhas", "várias", "comparação"], en: ["multi line", "lines"], es: ["líneas", "varias"], de: ["linien", "mehrere"] },
  area: { pt: ["área"], en: ["area"], es: ["área"], de: ["fläche"] },
  areaStacked: { pt: ["área", "empilhada"], en: ["stacked area"], es: ["área apilada"], de: ["gestapelte fläche"] },
  pie: { pt: ["pizza", "setores", "fatias"], en: ["pie", "slices"], es: ["circular", "sectores"], de: ["kreis", "torte"] },
  donut: { pt: ["rosca", "anel"], en: ["donut", "ring"], es: ["anillo", "dona"], de: ["ring", "donut"] },
  scatter: { pt: ["dispersão", "pontos", "correlação"], en: ["scatter", "points", "correlation"], es: ["dispersión", "puntos"], de: ["streudiagramm", "punkte"] },
};

const CATEGORY_LABELS: Record<LibraryLocale, readonly string[]> = { pt: ["Jan", "Fev", "Mar", "Abr", "Mai"], en: ["Jan", "Feb", "Mar", "Apr", "May"], es: ["Ene", "Feb", "Mar", "Abr", "May"], de: ["Jan", "Feb", "Mär", "Apr", "Mai"] };
const SERIES_NAMES: Record<LibraryLocale, readonly [string, string]> = { pt: ["Vendas", "Meta"], en: ["Sales", "Target"], es: ["Ventas", "Meta"], de: ["Umsatz", "Ziel"] };
const SLICE_LABELS: Record<LibraryLocale, readonly string[]> = { pt: ["Norte", "Sul", "Leste", "Oeste"], en: ["North", "South", "East", "West"], es: ["Norte", "Sur", "Este", "Oeste"], de: ["Nord", "Süd", "Ost", "West"] };
const SCATTER_NAMES: Record<LibraryLocale, readonly [string, string]> = { pt: ["Preço", "Vendas"], en: ["Price", "Sales"], es: ["Precio", "Ventas"], de: ["Preis", "Umsatz"] };

const SALES = [120, 180, 150, 220, 260];
const TARGETS = [140, 160, 170, 200, 240];
const SHARES = [40, 30, 20, 10];
const PRICES = [10, 20, 30, 40, 50];
const VOLUMES = [320, 280, 210, 190, 120];

function libraryLocale(locale: string): LibraryLocale {
  const short = locale.split("-")[0];
  return (LIBRARY_LOCALES as readonly string[]).includes(short) ? (short as LibraryLocale) : "pt";
}

function sampleChartData(kind: ChartKind, locale: string): ChartData {
  const lang = libraryLocale(locale);
  if (isRoundChart(kind)) return { labels: [...SLICE_LABELS[lang]], series: [{ name: SERIES_NAMES[lang][0], values: [...SHARES] }] };
  if (kind === "scatter") return { labels: ["A", "B", "C", "D", "E"], series: [{ name: SCATTER_NAMES[lang][0], values: [...PRICES] }, { name: SCATTER_NAMES[lang][1], values: [...VOLUMES] }] };
  const [sales, target] = SERIES_NAMES[lang];
  return { labels: [...CATEGORY_LABELS[lang]], series: [{ name: sales, values: [...SALES] }, { name: target, values: [...TARGETS] }] };
}

export function sampleChartSpec(kind: ChartKind, locale: string, ink: string): ChartSpec {
  return newChartSpec(kind, sampleChartData(kind, locale), counterLocaleFor(locale), chartInk(ink));
}

function tagsOf(kind: ChartKind): Record<LibraryLocale, readonly string[]> {
  const of = (locale: LibraryLocale) => [...TAGS[locale], ...KIND_TAGS[kind][locale]];
  return { pt: of("pt"), en: of("en"), es: of("es"), de: of("de") };
}

function kebab(id: string): string {
  return id.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

const CHART_ITEM_PREFIX = "chart-";

function chartItem(kind: ChartKind): LibraryItem {
  return {
    id: `${CHART_ITEM_PREFIX}${kebab(kind)}`,
    category: "charts",
    editors: ["image", "video"],
    ratio: chartRatio(kind),
    label: { key: `studio.chart.kinds.${kind}` },
    tags: tagsOf(kind),
    preview: { kind: "svg", markup: previewSvg(PREVIEWS[kind], VIEW) },
    source: OWN_SOURCE,
    template: {
      kind: "layers",
      build: (ctx) => ({ layers: [newChartLayer(sampleChartSpec(kind, ctx.locale, ctx.ink), chartTransform(ctx.canvas, kind))] }),
    },
  };
}

const CHART_ITEMS: readonly LibraryItem[] = CHART_KINDS.map(chartItem);

export const CHARTS_CATEGORY: LibraryCategory = {
  id: "charts",
  panel: "elements",
  label: { key: "studio.library.categories.charts" },
  tile: "square",
  items: () => CHART_ITEMS,
};
