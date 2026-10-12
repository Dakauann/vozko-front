import type { TextAlign } from "../../document";
import type { FontId } from "../../fonts";
import { itemLabelKey } from "../catalog";
import { componentLayers, componentRatio, componentSlots, type ComponentKit, type ComponentPanel, type ComponentPart, type ComponentText } from "../component-kit";
import { localizedText as words, OWN_SOURCE, type LibraryCategory, type LibraryItem, type LibraryLocale, type LocalizedText } from "../model";
import { previewSvg } from "../preview";
import type { Box, ComboColor, ComboEffect, ComboSurface, ComboText } from "../text-combo";
import { sampleChartSpec } from "./charts";

export const COMPONENT_SUBCATEGORIES = ["kpis", "charts", "navigation", "glass", "pricing"] as const;

type Subcategory = (typeof COMPONENT_SUBCATEGORIES)[number];

interface ComponentLook {
  id: string;
  subcategory: Subcategory;
  tags: Partial<Record<LibraryLocale, readonly string[]>>;
  kit: ComponentKit;
  markup: string;
}

interface TextPlace {
  left: number;
  top: number;
  width: number;
  align?: TextAlign;
}

const VIEW = 40;
const SOFT = `fill-opacity="0.35"`;
const FAINT = `fill-opacity="0.18"`;
const OUTLINE = `fill="none" stroke="currentColor" stroke-width="1.4"`;
const PILL_CHIP = { padX: 0.55, padY: 0.28, radius: 0.5 };

function lift(color: `#${string}`, opacity: number, y: number, blur: number): ComboEffect {
  return { type: "drop-shadow", color, opacity, x: 0, y, blur };
}

function panel(box: Box, surface: Omit<ComboSurface, "shape">): ComponentPanel {
  return { kind: "panel", box, surface: { shape: "rect", ...surface } };
}

function text(place: TextPlace, slot: string, sample: LocalizedText, font: FontId, weight: number, size: number, color: ComboColor, extra: Partial<ComboText> = {}): ComponentText {
  return { kind: "text", left: place.left, top: place.top, width: place.width, align: place.align ?? "left", part: { kind: "text", slot, sample, font, weight, size, color, ...extra } };
}

function kit(width: number, height: number, parts: readonly ComponentPart[]): ComponentKit {
  return { width, height, parts };
}

const KPI_DARK = kit(1, 0.62, [
  panel({ x: 0.5, y: 0.31, w: 1, h: 0.62 }, { fill: "#0f172a", radius: 0.12, effects: [lift("#020617", 0.25, 0.02, 0.06)] }),
  text({ left: 0.08, top: 0.09, width: 0.55 }, "label", words("Receita do mês", "Monthly revenue", "Ingresos del mes", "Monatsumsatz"), "inter", 500, 0.065, "#94a3b8"),
  text({ left: 0.08, top: 0.075, width: 0.84, align: "right" }, "delta", words("+12,4%", "+12.4%", "+12,4%", "+12,4 %"), "inter", 700, 0.055, "#052e16", { pill: { color: "#4ade80", ...PILL_CHIP } }),
  text({ left: 0.08, top: 0.24, width: 0.84 }, "value", words("R$ 48,2 mil", "$48.2k", "48,2 mil €", "48,2 Tsd. €"), "space-grotesk", 700, 0.17, "#f8fafc"),
  text({ left: 0.08, top: 0.47, width: 0.84 }, "caption", words("em relação ao mês anterior", "compared with last month", "frente al mes anterior", "im Vergleich zum Vormonat"), "inter", 400, 0.055, "#94a3b8"),
]);

const KPI_LIGHT = kit(1, 0.62, [
  panel({ x: 0.5, y: 0.31, w: 1, h: 0.62 }, { fill: "#ffffff", radius: 0.12, stroke: { color: "#e2e8f0", width: 0.006 }, effects: [lift("#0f172a", 0.08, 0.02, 0.06)] }),
  text({ left: 0.08, top: 0.09, width: 0.55 }, "label", words("Novos clientes", "New customers", "Clientes nuevos", "Neukunden"), "inter", 500, 0.065, "#64748b"),
  text({ left: 0.08, top: 0.075, width: 0.84, align: "right" }, "delta", words("+8,1%", "+8.1%", "+8,1%", "+8,1 %"), "inter", 700, 0.055, "#166534", { pill: { color: "#dcfce7", ...PILL_CHIP } }),
  text({ left: 0.08, top: 0.24, width: 0.84 }, "value", words("1.284", "1,284", "1.284", "1.284"), "space-grotesk", 700, 0.17, "#0f172a"),
  text({ left: 0.08, top: 0.47, width: 0.84 }, "caption", words("nos últimos 30 dias", "in the last 30 days", "en los últimos 30 días", "in den letzten 30 Tagen"), "inter", 400, 0.055, "#64748b"),
]);

const KPI_COLUMNS = [0.05, 0.37, 0.69] as const;

const KPI_ROW_SAMPLES: readonly { label: LocalizedText; value: LocalizedText; delta: LocalizedText }[] = [
  { label: words("Visitas", "Visits", "Visitas", "Besuche"), value: words("12,4 mil", "12.4k", "12,4 mil", "12,4 Tsd."), delta: words("+12% na semana", "+12% this week", "+12% esta semana", "+12 % diese Woche") },
  { label: words("Conversão", "Conversion", "Conversión", "Konversion"), value: words("3,8%", "3.8%", "3,8%", "3,8 %"), delta: words("+0,6 ponto", "+0.6 points", "+0,6 puntos", "+0,6 Punkte") },
  { label: words("Ticket médio", "Average order", "Ticket medio", "Warenkorb"), value: words("R$ 182", "$36", "36 €", "36 €"), delta: words("+4% no mês", "+4% this month", "+4% este mes", "+4 % diesen Monat") },
];

const KPI_ROW = kit(1, 0.27, [
  panel({ x: 0.5, y: 0.135, w: 1, h: 0.27 }, { fill: "#ffffff", radius: 0.12, stroke: { color: "#e5e7eb", width: 0.003 }, effects: [lift("#0f172a", 0.08, 0.01, 0.03)] }),
  panel({ x: 0.34, y: 0.135, w: 0.003, h: 0.15 }, { fill: "#e5e7eb" }),
  panel({ x: 0.66, y: 0.135, w: 0.003, h: 0.15 }, { fill: "#e5e7eb" }),
  ...KPI_COLUMNS.flatMap((left, i) => {
    const sample = KPI_ROW_SAMPLES[i];
    const n = i + 1;
    return [
      text({ left, top: 0.055, width: 0.26 }, `label${n}`, sample.label, "inter", 500, 0.03, "#64748b"),
      text({ left, top: 0.1, width: 0.26 }, `value${n}`, sample.value, "space-grotesk", 700, 0.065, "#0f172a"),
      text({ left, top: 0.185, width: 0.26 }, `delta${n}`, sample.delta, "inter", 600, 0.026, "#16a34a"),
    ];
  }),
]);

const CHART_DARK = kit(1, 0.78, [
  panel({ x: 0.5, y: 0.39, w: 1, h: 0.78 }, { fill: "#111827", radius: 0.08, effects: [lift("#030712", 0.25, 0.02, 0.06)] }),
  text({ left: 0.07, top: 0.07, width: 0.6 }, "title", words("Vendas por mês", "Sales by month", "Ventas por mes", "Umsatz pro Monat"), "inter", 600, 0.065, "#f9fafb"),
  text({ left: 0.07, top: 0.155, width: 0.6 }, "subtitle", words("Últimos 5 meses", "Last 5 months", "Últimos 5 meses", "Letzte 5 Monate"), "inter", 400, 0.045, "#9ca3af"),
  text({ left: 0.07, top: 0.075, width: 0.86, align: "right" }, "badge", words("+18%", "+18%", "+18%", "+18 %"), "inter", 700, 0.05, "#064e3b", { pill: { color: "#34d399", ...PILL_CHIP } }),
  { kind: "chart", box: { x: 0.5, y: 0.5, w: 0.86, h: 0.44 }, chart: "bar", ink: "#f9fafb" },
]);

const CHART_LIGHT = kit(1, 0.78, [
  panel({ x: 0.5, y: 0.39, w: 1, h: 0.78 }, { fill: "#ffffff", radius: 0.08, stroke: { color: "#e5e7eb", width: 0.004 }, effects: [lift("#0f172a", 0.08, 0.02, 0.06)] }),
  text({ left: 0.07, top: 0.07, width: 0.5 }, "title", words("Receita acumulada", "Revenue to date", "Ingresos acumulados", "Umsatz bisher"), "inter", 600, 0.06, "#111827"),
  text({ left: 0.07, top: 0.15, width: 0.5 }, "subtitle", words("Comparado com a meta", "Compared with target", "Comparado con la meta", "Im Vergleich zum Ziel"), "inter", 400, 0.042, "#6b7280"),
  text({ left: 0.55, top: 0.075, width: 0.38, align: "right" }, "value", words("R$ 260 mil", "$260k", "260 mil €", "260 Tsd. €"), "space-grotesk", 700, 0.075, "#111827"),
  { kind: "chart", box: { x: 0.5, y: 0.5, w: 0.86, h: 0.44 }, chart: "lineMulti", ink: "#111827" },
]);

const NAV_LINKS = [0.3, 0.42, 0.54, 0.66] as const;

const NAV_SAMPLES: readonly LocalizedText[] = [words("Início", "Home", "Inicio", "Start"), words("Produtos", "Products", "Productos", "Produkte"), words("Preços", "Pricing", "Precios", "Preise"), words("Contato", "Contact", "Contacto", "Kontakt")];

const NAV_BAR = kit(1, 0.085, [
  panel({ x: 0.5, y: 0.0425, w: 1, h: 0.085 }, { fill: "#ffffff", radius: 0.3, stroke: { color: "#e5e7eb", width: 0.0015 }, effects: [lift("#0f172a", 0.08, 0.004, 0.012)] }),
  text({ left: 0.03, top: 0.025, width: 0.22 }, "brand", words("Aurora", "Aurora", "Aurora", "Aurora"), "space-grotesk", 700, 0.03, "#111827"),
  ...NAV_LINKS.map((left, i) => text({ left, top: 0.031, width: 0.11, align: "center" }, `link${i + 1}`, NAV_SAMPLES[i], "inter", 500, 0.02, "#4b5563")),
  text({ left: 0.03, top: 0.0235, width: 0.94, align: "right" }, "cta", words("Começar", "Get started", "Empezar", "Loslegen"), "inter", 600, 0.02, "#ffffff", { pill: { color: "#111827", padX: 0.9, padY: 0.45, radius: 0.5 } }),
]);

const SIDEBAR_ITEMS: readonly LocalizedText[] = [
  words("Visão geral", "Overview", "Resumen", "Übersicht"),
  words("Vendas", "Sales", "Ventas", "Umsatz"),
  words("Clientes", "Customers", "Clientes", "Kunden"),
  words("Relatórios", "Reports", "Informes", "Berichte"),
  words("Configurações", "Settings", "Ajustes", "Einstellungen"),
];

const SIDEBAR_ROW = 0.2;
const SIDEBAR_FIRST = 0.58;
const SIDEBAR_SIZE = 0.075;

const SIDEBAR = kit(1, 2.4, [
  panel({ x: 0.5, y: 1.2, w: 1, h: 2.4 }, { fill: "#0f172a", radius: 0.08 }),
  panel({ x: 0.5, y: SIDEBAR_FIRST + (SIDEBAR_SIZE * 1.15) / 2, w: 0.84, h: 0.16 }, { fill: "#2563eb", radius: 0.25 }),
  text({ left: 0.12, top: 0.12, width: 0.76 }, "brand", words("Aurora", "Aurora", "Aurora", "Aurora"), "space-grotesk", 700, 0.12, "#f8fafc"),
  text({ left: 0.14, top: 0.42, width: 0.72 }, "section", words("Menu", "Menu", "Menú", "Menü"), "inter", 600, 0.05, "#64748b", { caps: true, spacing: 0.12 }),
  ...SIDEBAR_ITEMS.map((sample, i) => text({ left: 0.14, top: SIDEBAR_FIRST + i * SIDEBAR_ROW, width: 0.72 }, `item${i + 1}`, sample, "inter", 500, SIDEBAR_SIZE, i === 0 ? "#ffffff" : "#cbd5e1")),
  text({ left: 0.14, top: 2.12, width: 0.72 }, "account", words("Minha conta", "My account", "Mi cuenta", "Mein Konto"), "inter", 500, 0.06, "#94a3b8"),
]);

const GLASS_CARD = kit(1, 0.74, [
  panel({ x: 0.5, y: 0.37, w: 1, h: 0.74 }, { fill: "#ffffff26", radius: 0.1, stroke: { color: "#ffffff66", width: 0.004 }, effects: [lift("#0f172a", 0.25, 0.03, 0.08)] }),
  text({ left: 0.08, top: 0.09, width: 0.84 }, "eyebrow", words("Novidade", "New", "Novedad", "Neu"), "inter", 600, 0.045, "#ffffff", { caps: true, spacing: 0.14, opacity: 0.8 }),
  text({ left: 0.08, top: 0.17, width: 0.84 }, "title", words("Coleção de verão", "Summer collection", "Colección de verano", "Sommerkollektion"), "outfit", 700, 0.1, "#ffffff", { lines: 2, lineHeight: 1.05 }),
  text({ left: 0.08, top: 0.42, width: 0.84 }, "body", words("Peças leves para os dias mais quentes do ano", "Light pieces for the warmest days of the year", "Prendas ligeras para los días más cálidos del año", "Leichte Teile für die wärmsten Tage des Jahres"), "inter", 400, 0.045, "#ffffff", { lines: 2, lineHeight: 1.4, opacity: 0.85 }),
  text({ left: 0.08, top: 0.58, width: 0.84 }, "cta", words("Ver coleção", "Shop now", "Ver colección", "Jetzt ansehen"), "inter", 600, 0.045, "#0f172a", { pill: { color: "#ffffff", padX: 0.9, padY: 0.5, radius: 0.5 } }),
]);

const GLASS_STAT = kit(1, 0.52, [
  panel({ x: 0.5, y: 0.26, w: 1, h: 0.52 }, { fill: "#0f172a59", radius: 0.12, stroke: { color: "#ffffff33", width: 0.004 }, effects: [lift("#020617", 0.3, 0.03, 0.08)] }),
  text({ left: 0.08, top: 0.09, width: 0.84 }, "label", words("Seguidores", "Followers", "Seguidores", "Follower"), "inter", 500, 0.06, "#e2e8f0"),
  text({ left: 0.08, top: 0.19, width: 0.84 }, "value", words("24,8 mil", "24.8k", "24,8 mil", "24,8 Tsd."), "space-grotesk", 700, 0.16, "#ffffff"),
  text({ left: 0.08, top: 0.39, width: 0.84 }, "caption", words("+1.204 nesta semana", "+1,204 this week", "+1.204 esta semana", "+1.204 diese Woche"), "inter", 500, 0.05, "#86efac"),
]);

const PRICE_FEATURES: readonly LocalizedText[] = [
  words("10 usuários incluídos", "10 users included", "10 usuarios incluidos", "10 Nutzer inklusive"),
  words("Relatórios ilimitados", "Unlimited reports", "Informes ilimitados", "Unbegrenzte Berichte"),
  words("Suporte prioritário", "Priority support", "Soporte prioritario", "Bevorzugter Support"),
];

const PRICE_CTA_SIZE = 0.06;

const PRICE_CARD = kit(1, 1.3, [
  panel({ x: 0.5, y: 0.65, w: 1, h: 1.3 }, { fill: "#ffffff", radius: 0.08, stroke: { color: "#e5e7eb", width: 0.004 }, effects: [lift("#0f172a", 0.1, 0.03, 0.08)] }),
  text({ left: 0.08, top: 0.09, width: 0.5 }, "plan", words("Profissional", "Professional", "Profesional", "Professional"), "inter", 600, 0.055, "#4f46e5", { caps: true, spacing: 0.1 }),
  text({ left: 0.08, top: 0.08, width: 0.84, align: "right" }, "badge", words("Mais popular", "Most popular", "Más popular", "Beliebt"), "inter", 600, 0.042, "#4338ca", { pill: { color: "#e0e7ff", ...PILL_CHIP } }),
  text({ left: 0.08, top: 0.2, width: 0.84 }, "price", words("R$ 99", "$19", "19 €", "19 €"), "space-grotesk", 700, 0.2, "#111827"),
  text({ left: 0.08, top: 0.44, width: 0.84 }, "period", words("por mês, cobrado anualmente", "per month, billed yearly", "al mes, facturado al año", "pro Monat, jährlich abgerechnet"), "inter", 400, 0.05, "#6b7280"),
  panel({ x: 0.5, y: 0.55, w: 0.84, h: 0.004 }, { fill: "#e5e7eb" }),
  ...PRICE_FEATURES.map((sample, i) => text({ left: 0.08, top: 0.61 + i * 0.1, width: 0.84 }, `feature${i + 1}`, sample, "inter", 400, 0.055, "#374151")),
  panel({ x: 0.5, y: 1.1, w: 0.84, h: 0.14 }, { fill: "#4f46e5", radius: 0.3 }),
  text({ left: 0.08, top: 1.1 - (PRICE_CTA_SIZE * 1.15) / 2, width: 0.84, align: "center" }, "cta", words("Assinar agora", "Subscribe now", "Suscribirse ahora", "Jetzt abonnieren"), "inter", 600, PRICE_CTA_SIZE, "#ffffff"),
]);

const LISTING_CARD = kit(1, 1.04, [
  panel({ x: 0.5, y: 0.52, w: 1, h: 1.04 }, { fill: "#ffffff", radius: 0.07, effects: [lift("#0f172a", 0.12, 0.03, 0.08)] }),
  panel({ x: 0.5, y: 0.3, w: 0.92, h: 0.52 }, { fill: "#cbd5e1", radius: 0.05 }),
  text({ left: 0.08, top: 0.08, width: 0.84 }, "tag", words("À venda", "For sale", "En venta", "Zu verkaufen"), "inter", 600, 0.045, "#ffffff", { pill: { color: "#0f766e", ...PILL_CHIP } }),
  text({ left: 0.06, top: 0.61, width: 0.88 }, "title", words("Apartamento no Centro", "Downtown apartment", "Piso en el centro", "Wohnung im Zentrum"), "outfit", 600, 0.075, "#0f172a"),
  text({ left: 0.06, top: 0.72, width: 0.88 }, "detail", words("2 quartos, 68 m², 1 vaga", "2 bedrooms, 68 m², 1 parking", "2 habitaciones, 68 m², 1 plaza", "2 Zimmer, 68 m², 1 Stellplatz"), "inter", 400, 0.05, "#64748b"),
  text({ left: 0.06, top: 0.84, width: 0.5 }, "price", words("R$ 450.000", "$450,000", "450.000 €", "450.000 €"), "space-grotesk", 700, 0.09, "#0f766e"),
  text({ left: 0.56, top: 0.865, width: 0.38, align: "right" }, "action", words("Ver detalhes", "See details", "Ver detalles", "Details ansehen"), "inter", 600, 0.05, "#0f766e"),
]);

const LOOKS: readonly ComponentLook[] = [
  {
    id: "component-kpi-card",
    subcategory: "kpis",
    tags: { pt: ["kpi", "indicador", "métrica", "painel", "dashboard"], en: ["kpi", "metric", "stat", "dashboard"] },
    kit: KPI_DARK,
    markup: `<rect x="4" y="9" width="32" height="22" rx="4" ${FAINT}/><rect x="8" y="13" width="12" height="2.5" rx="1.25" ${SOFT}/><rect x="8" y="18" width="18" height="6" rx="1.5"/><rect x="27" y="12.5" width="6" height="3.5" rx="1.75"/>`,
  },
  {
    id: "component-kpi-card-light",
    subcategory: "kpis",
    tags: { pt: ["kpi", "indicador", "métrica", "claro"], en: ["kpi", "metric", "stat", "light"] },
    kit: KPI_LIGHT,
    markup: `<rect x="4.5" y="9.5" width="31" height="21" rx="4" ${OUTLINE}/><rect x="8" y="13" width="12" height="2.5" rx="1.25" ${SOFT}/><rect x="8" y="18" width="14" height="6" rx="1.5"/><rect x="27" y="12.5" width="6" height="3.5" rx="1.75" ${SOFT}/>`,
  },
  {
    id: "component-kpi-row",
    subcategory: "kpis",
    tags: { pt: ["kpi", "indicadores", "faixa", "dashboard"], en: ["kpi", "metrics", "strip", "dashboard"] },
    kit: KPI_ROW,
    markup: `<rect x="3.5" y="13.5" width="33" height="13" rx="3" ${OUTLINE}/><rect x="6" y="16" width="6" height="2" rx="1" ${SOFT}/><rect x="6" y="20" width="8" height="4" rx="1"/><rect x="17" y="16" width="6" height="2" rx="1" ${SOFT}/><rect x="17" y="20" width="8" height="4" rx="1"/><rect x="28" y="16" width="6" height="2" rx="1" ${SOFT}/><rect x="28" y="20" width="6" height="4" rx="1"/>`,
  },
  {
    id: "component-chart-card",
    subcategory: "charts",
    tags: { pt: ["gráfico", "cartão", "barras", "dashboard"], en: ["chart", "card", "bar", "dashboard"] },
    kit: CHART_DARK,
    markup: `<rect x="4" y="6" width="32" height="28" rx="4" ${FAINT}/><rect x="8" y="10" width="13" height="2.5" rx="1.25" ${SOFT}/><rect x="9" y="22" width="4" height="8" rx="1"/><rect x="15" y="18" width="4" height="12" rx="1"/><rect x="21" y="20" width="4" height="10" rx="1"/><rect x="27" y="15" width="4" height="15" rx="1"/>`,
  },
  {
    id: "component-chart-card-line",
    subcategory: "charts",
    tags: { pt: ["gráfico", "cartão", "linha", "meta"], en: ["chart", "card", "line", "target"] },
    kit: CHART_LIGHT,
    markup: `<rect x="4.5" y="6.5" width="31" height="27" rx="4" ${OUTLINE}/><rect x="8" y="10" width="12" height="2.5" rx="1.25" ${SOFT}/><path d="M9 28l6-6 5 3 10-10" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    id: "component-nav-bar",
    subcategory: "navigation",
    tags: { pt: ["menu", "navegação", "cabeçalho", "site"], en: ["navbar", "navigation", "header", "website"] },
    kit: NAV_BAR,
    markup: `<rect x="2.5" y="15.5" width="35" height="9" rx="4.5" ${OUTLINE}/><rect x="5.5" y="18.5" width="6" height="3" rx="1.5"/><rect x="14" y="19.25" width="3.5" height="1.5" rx="0.75" ${SOFT}/><rect x="19" y="19.25" width="3.5" height="1.5" rx="0.75" ${SOFT}/><rect x="24" y="19.25" width="3.5" height="1.5" rx="0.75" ${SOFT}/><rect x="29" y="18" width="6" height="4" rx="2"/>`,
  },
  {
    id: "component-sidebar",
    subcategory: "navigation",
    tags: { pt: ["menu lateral", "barra lateral", "navegação", "app"], en: ["sidebar", "navigation", "menu", "app"] },
    kit: SIDEBAR,
    markup: `<rect x="12" y="3" width="16" height="34" rx="3" ${FAINT}/><rect x="15" y="6.5" width="8" height="3" rx="1.5"/><rect x="14" y="14" width="12" height="4" rx="2"/><rect x="15.5" y="21" width="8" height="1.6" rx="0.8" ${SOFT}/><rect x="15.5" y="25" width="7" height="1.6" rx="0.8" ${SOFT}/><rect x="15.5" y="29" width="9" height="1.6" rx="0.8" ${SOFT}/>`,
  },
  {
    id: "component-glass-card",
    subcategory: "glass",
    tags: { pt: ["vidro", "fosco", "transparente", "cartão"], en: ["glass", "frosted", "glassmorphism", "card"] },
    kit: GLASS_CARD,
    markup: `<rect x="4.5" y="7.5" width="31" height="25" rx="4" ${FAINT} stroke="currentColor" stroke-opacity="0.7" stroke-width="1.2"/><rect x="8" y="11" width="7" height="1.8" rx="0.9" ${SOFT}/><rect x="8" y="15" width="20" height="4" rx="1.2"/><rect x="8" y="21.5" width="18" height="1.8" rx="0.9" ${SOFT}/><rect x="8" y="26" width="9" height="3.5" rx="1.75"/>`,
  },
  {
    id: "component-glass-stat",
    subcategory: "glass",
    tags: { pt: ["vidro", "fosco", "número", "seguidores"], en: ["glass", "frosted", "stat", "followers"] },
    kit: GLASS_STAT,
    markup: `<rect x="4.5" y="11.5" width="31" height="17" rx="4" ${SOFT} stroke="currentColor" stroke-opacity="0.7" stroke-width="1.2"/><rect x="8" y="14.5" width="9" height="2" rx="1" ${SOFT}/><rect x="8" y="18.5" width="15" height="5" rx="1.2"/>`,
  },
  {
    id: "component-price-card",
    subcategory: "pricing",
    tags: { pt: ["preço", "plano", "assinatura", "tabela de preços"], en: ["pricing", "plan", "subscription", "price card"] },
    kit: PRICE_CARD,
    markup: `<rect x="9.5" y="3.5" width="21" height="33" rx="3.5" ${OUTLINE}/><rect x="13" y="7" width="7" height="2" rx="1" ${SOFT}/><rect x="13" y="11" width="10" height="6" rx="1.2"/><rect x="13" y="20.5" width="13" height="1.6" rx="0.8" ${SOFT}/><rect x="13" y="24" width="11" height="1.6" rx="0.8" ${SOFT}/><rect x="13" y="29" width="14" height="4" rx="2"/>`,
  },
  {
    id: "component-listing-card",
    subcategory: "pricing",
    tags: { pt: ["anúncio", "imóvel", "produto", "vitrine"], en: ["listing", "real estate", "product", "card"] },
    kit: LISTING_CARD,
    markup: `<rect x="7.5" y="4.5" width="25" height="31" rx="3.5" ${OUTLINE}/><rect x="10" y="7" width="20" height="14" rx="2" ${SOFT}/><rect x="10" y="24" width="15" height="2.4" rx="1.2"/><rect x="10" y="28" width="11" height="1.6" rx="0.8" ${SOFT}/><rect x="10" y="31" width="9" height="2.4" rx="1.2"/>`,
  },
];

function componentItem(look: ComponentLook): LibraryItem {
  return {
    id: look.id,
    category: "components",
    subcategory: look.subcategory,
    editors: ["image", "video"],
    ratio: componentRatio(look.kit),
    label: { key: itemLabelKey(look.id) },
    tags: look.tags,
    preview: { kind: "svg", markup: previewSvg(look.markup, VIEW) },
    source: OWN_SOURCE,
    template: { kind: "layers", slots: componentSlots(look.kit), build: (ctx) => ({ layers: componentLayers(look.kit, ctx, sampleChartSpec) }) },
  };
}

const COMPONENT_ITEMS: readonly LibraryItem[] = LOOKS.map(componentItem);

export const COMPONENTS_CATEGORY: LibraryCategory = {
  id: "components",
  panel: "elements",
  label: { key: "studio.library.categories.components" },
  tile: "square",
  subcategories: COMPONENT_SUBCATEGORIES.map((id) => ({ id, label: { key: `studio.library.subcategories.components.${id}` } })),
  items: () => COMPONENT_ITEMS,
};
