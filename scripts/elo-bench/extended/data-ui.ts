import type { Artboard, Layer } from "@/lib/studio/document";
import type { FontId } from "@/lib/studio/fonts";

import { arc, chart, CLEAR, drop, ellipse, icon, linear, path, pressed, radial, raised, rect, sheet, soft, star, triangle, writer, type Sheet } from "../authoring";
import { source, type CorpusEntry } from "./corpus";


function sparkline(id: string, s: Sheet, left: number, top: number, w: number, h: number, values: number[], color: string): Layer {
  return { id, type: "chart", transform: s.at(left, top, w, h), chart: chart("area", values.map((_, i) => `${i + 1}`), values, [color], { axes: false, gridlines: false, valueLabels: false, smooth: true, lineWidth: 0.025, legend: "none" }) };
}

const DASH = { bg: "#f4f5f9", card: "#ffffff", ink: "#0f172a", muted: "#566175", line: "#e2e8f0", indigo: "#4f46e5", tint: "#e0e7ff", green: "#15803d", mint: "#dcfce7", red: "#b91c1c", rose: "#fee2e2", amber: "#f59e0b", pink: "#ec4899" };

function dashboard(): Artboard {
  const s = sheet(1080, 2340);
  const t = writer(s, "inter");
  const card = (id: string, left: number, top: number, w: number, h: number) => s.card(id, s.at(left, top, w, h), DASH.card, 66, { effects: soft(id, DASH.ink, 0.07, 22, 66) });
  const bars = [130, 170, 110, 240, 150, 190, 100];
  const days = ["S", "T", "Q", "Q", "S", "S", "D"];
  const base = 1689;
  return s.board(DASH.bg, [
    t("clock", "9:41", 72, 38, 200, 56, 42, 600, DASH.ink),
    ...[0, 1, 2, 3].map((i) => s.card(`signal${i + 1}`, s.at(822 + i * 18, 76 - (i + 1) * 9, 11, (i + 1) * 9), DASH.ink, 3)),
    s.card("battery", s.at(922, 50, 72, 34), CLEAR, 9, { stroke: DASH.ink, strokeWidth: 3 }),
    s.card("battery_level", s.at(928, 56, 50, 22), DASH.ink, 5),
    s.card("battery_cap", s.at(998, 60, 6, 14), DASH.ink, 3),
    t("greeting", "Bom dia, Lia", 56, 150, 600, 46, 36, 500, DASH.muted),
    t("title", "Visão geral", 56, 194, 600, 80, 66, 700, DASH.ink),
    ellipse("bell_button", s.mid(800, 222, 112, 112), DASH.card, { effects: soft("bell", DASH.ink, 0.08, 14, 40) }),
    icon("bell", "bell", s.mid(800, 222, 52, 52), DASH.ink),
    ellipse("avatar", s.mid(948, 222, 112, 112), DASH.indigo, { gradient: linear("#6366f1", DASH.pink, 135), stroke: "#ffffff", strokeWidth: 6 }),
    t("avatar_initials", "LS", 892, 196, 112, 52, 40, 700, "#ffffff", "center"),
    s.card("segments", s.at(56, 351, 968, 120), "#e9ebf2", 60),
    s.card("segment_active", s.at(380, 357, 320, 108), DASH.card, 54, { effects: soft("seg", DASH.ink, 0.08, 8, 20) }),
    t("segment_day", "Dia", 62, 388, 318, 46, 38, 600, DASH.muted, "center"),
    t("segment_week", "Semana", 380, 388, 320, 46, 38, 700, DASH.ink, "center"),
    t("segment_month", "Mês", 700, 388, 318, 46, 38, 600, DASH.muted, "center"),
    card("kpi_revenue", 56, 515, 468, 350),
    t("kpi_revenue_label", "Receita", 96, 552, 380, 42, 33, 500, DASH.muted),
    t("kpi_revenue_value", "R$ 48,2k", 96, 596, 400, 86, 72, 800, DASH.ink),
    s.card("kpi_revenue_delta", s.at(96, 694, 150, 50), DASH.mint, 25),
    t("kpi_revenue_delta_text", "+12,4%", 96, 701, 150, 36, 30, 700, DASH.green, "center"),
    sparkline("kpi_revenue_spark", s, 290, 690, 214, 150, [12, 18, 14, 22, 19, 28, 26, 34], DASH.indigo),
    card("kpi_users", 556, 515, 468, 350),
    t("kpi_users_label", "Usuários ativos", 596, 552, 380, 42, 33, 500, DASH.muted),
    t("kpi_users_value", "3.912", 596, 596, 400, 86, 72, 800, DASH.ink),
    s.card("kpi_users_delta", s.at(596, 694, 140, 50), DASH.rose, 25),
    t("kpi_users_delta_text", "-2,1%", 596, 701, 140, 36, 30, 700, DASH.red, "center"),
    sparkline("kpi_users_spark", s, 790, 690, 214, 150, [30, 27, 31, 25, 26, 22, 24, 20], "#fb7185"),
    card("goal_card", 56, 913, 968, 300),
    ellipse("goal_track", s.at(107, 985, 156, 156), CLEAR, { stroke: DASH.tint, strokeWidth: 22 }),
    path("goal_arc", arc(0.72, 0.062), s.at(96, 974, 178, 178), CLEAR, { stroke: DASH.indigo, strokeWidth: 22, lineCap: "round" }),
    t("goal_percent", "72%", 96, 1038, 178, 52, 42, 800, DASH.ink, "center"),
    t("goal_title", "Meta do mês", 330, 978, 640, 52, 42, 700, DASH.ink),
    t("goal_detail", "R$ 36.000 de R$ 50.000", 330, 1036, 640, 44, 33, 500, DASH.muted),
    s.card("goal_bar_track", s.at(330, 1104, 650, 18), DASH.tint, 9),
    s.card("goal_bar_fill", s.at(330, 1104, 468, 18), DASH.indigo, 9),
    card("bars_card", 56, 1264, 968, 515),
    t("bars_title", "Receita semanal", 96, 1300, 520, 52, 42, 700, DASH.ink),
    s.card("bars_chip", s.at(746, 1296, 238, 60), DASH.bg, 30),
    t("bars_chip_text", "Esta semana", 746, 1309, 238, 36, 30, 600, DASH.muted, "center"),
    ...[0, 1, 2].map((i) => rect(`bars_grid${i + 1}`, s.at(96, 1449 + i * 80, 888, 3), "#eef0f5")),
    ...bars.flatMap((h, i) => [s.card(`bar${i + 1}`, s.at(124 + i * 128, base - h, 64, h), i === 3 ? DASH.indigo : DASH.tint, 22), t(`day${i + 1}`, days[i], 124 + i * 128, base + 18, 64, 40, 30, 600, DASH.muted, "center")]),
    s.card("tooltip", s.at(466, 1366, 148, 64), DASH.ink, 22),
    t("tooltip_text", "R$ 8,4k", 466, 1380, 148, 36, 30, 700, "#ffffff", "center"),
    triangle("tooltip_pointer", s.mid(540, 1437, 28, 16, 180), DASH.ink),
    card("channels_card", 56, 1825, 468, 400),
    t("channels_title", "Canais", 96, 1858, 380, 52, 40, 700, DASH.ink),
    { id: "channels_donut", type: "chart", transform: s.at(84, 1930, 236, 236), chart: chart("donut", ["Site", "App", "Loja", "Outros"], [45, 25, 18, 12], [DASH.indigo, "#22c55e", DASH.amber, DASH.pink], { axes: false, gridlines: false, valueLabels: false, hole: 0.66 }) },
    t("channels_count", "4", 84, 2008, 236, 60, 50, 800, DASH.ink, "center"),
    t("channels_count_label", "canais", 84, 2062, 236, 40, 30, 500, DASH.muted, "center"),
    ...[["Site 45%", DASH.indigo], ["App 25%", "#22c55e"], ["Loja 18%", DASH.amber], ["Outros 12%", DASH.pink]].flatMap(([label, color], i) => [ellipse(`legend_dot${i + 1}`, s.mid(342, 1972 + i * 54, 18, 18), color), t(`legend${i + 1}`, label, 358, 1952 + i * 54, 164, 40, 28, 600, DASH.ink)]),
    card("score_card", 556, 1825, 468, 400),
    t("score_title", "Pontuação", 596, 1858, 380, 52, 40, 700, DASH.ink),
    path("score_track", "M0.06 0.5 A0.44 0.44 0 0 1 0.94 0.5", s.at(630, 1920, 320, 320), CLEAR, { stroke: "#e9ebf2", strokeWidth: 28, lineCap: "round" }),
    path("score_arc", "M0.06 0.5 A0.44 0.44 0 0 1 0.898 0.3127", s.at(630, 1920, 320, 320), CLEAR, { stroke: DASH.indigo, strokeWidth: 28, lineCap: "round" }),
    t("score_value", "86", 630, 2010, 320, 90, 78, 800, DASH.ink, "center"),
    t("score_label", "Excelente", 630, 2100, 320, 40, 30, 700, DASH.green, "center"),
  ]);
}

function slide(): Artboard {
  const s = sheet(1920, 1080);
  const t = writer(s, "plus-jakarta-sans");
  const lime = "#c6ff4d";
  const heights = [44, 58, 66, 84, 98, 120, 146, 178, 214, 262, 318, 392];
  return s.board("#0e0f13", [
    ellipse("glow", s.mid(1630, 1030, 1700, 1000), "#5b4bff", { gradient: radial("#5b4bff73", "#5b4bff00") }),
    s.card("chip", s.at(112, 104, 190, 50), CLEAR, 12, { stroke: "#ffffff40", strokeWidth: 2 }),
    t("chip_text", "TRAÇÃO", 112, 115, 190, 30, 22, 700, "#ffffff", "center", { letterSpacing: 0.12 }),
    s.card("highlight", s.at(96, 298, 224, 112), lime, 26),
    t("headline", "Crescemos\n9x em\n12 meses", 112, 186, 980, 350, 120, 800, "#ffffff", "left", { lineHeight: 0.95, letterSpacing: -0.03, runs: [{ start: 10, end: 12, fill: "#0e0f13" }] }),
    t("support", "A receita recorrente anual foi de R$ 230 mil para R$ 2,1 milhões sem aumentar o time de vendas.", 112, 640, 900, 100, 32, 400, "#a1a1aa", "left", { lineHeight: 1.35 }),
    s.card("panel", s.at(1152, 194, 653, 713), "#ffffff0f", 28, { stroke: "#ffffff1f", strokeWidth: 2, effects: [drop("panel_shadow", "#000000", 0.35, 0, 30, 60)] }),
    t("panel_value", "R$ 2,1 mi", 1200, 240, 400, 64, 54, 800, "#ffffff"),
    t("panel_label", "receita recorrente anual", 1200, 312, 400, 34, 24, 500, "#a1a1aa"),
    s.card("panel_delta", s.at(1600, 248, 160, 48), "#22c55e26", 24),
    t("panel_delta_text", "+812%", 1600, 258, 160, 30, 24, 700, "#4ade80", "center"),
    ...heights.map((h, i) => s.card(`month${i + 1}`, s.at(1200 + i * 47, 850 - h, 34, h), i === heights.length - 1 ? lime : "#ffffff40", 6)),
    t("month_first", "jan", 1190, 866, 60, 30, 20, 500, "#a1a1aa", "center"),
    t("month_last", "dez", 1707, 866, 60, 30, 20, 500, "#a1a1aa", "center"),
    ...[
      ["NORTE", "archivo-black"],
      ["lumen", "outfit"],
      ["ÓRBITA", "space-grotesk"],
      ["kasa", "fraunces"],
    ].map(([name, font], i) => s.label(`client${i + 1}`, name, s.at(112 + i * 210, 930, 180, 44), 32, { font: font as FontId, weight: 700, fill: "#ffffff66", align: "left" })),
    t("page", "07", 1700, 960, 105, 30, 22, 600, "#a1a1aa", "right"),
  ]);
}

const MAIL = { brand: "#ff5a36", tint: "#ffe4dc", ink: "#1a1a1a", muted: "#5f6470" };

function emailHeader(): Artboard {
  const s = sheet(1200, 1120);
  const t = writer(s, "outfit");
  const tilt = s.spin(905, 760, -6);
  const bars = [70, 110, 90, 150, 120];
  return s.board("#ffffff", [
    t("preheader", "Seu resumo da semana", 48, 18, 520, 36, 24, 500, MAIL.muted),
    t("browser", "Ver no navegador", 632, 18, 520, 36, 24, 500, MAIL.muted, "right", { runs: [{ start: 0, end: 16, underline: true }] }),
    rect("preheader_rule", s.at(0, 68, 1200, 2), "#eef0f5"),
    star("logo_mark", s.at(64, 100, 44, 44), MAIL.brand, 4, 0.38),
    t("logo", "lumen", 120, 90, 300, 64, 52, 800, MAIL.ink),
    t("nav", "Produto     Preços     Blog", 640, 106, 496, 40, 26, 600, MAIL.ink, "right"),
    s.card("hero", s.at(64, 190, 1072, 860), MAIL.tint, 48),
    ellipse("hero_circle_top", s.at(780, 110, 520, 520), "#ff5a3626", { clip: true }),
    ellipse("hero_circle_bottom", s.at(-60, 780, 420, 420), "#ff5a3626", { clip: true }),
    star("hero_sparkle", s.at(1010, 250, 60, 60), MAIL.brand, 4, 0.35),
    t("eyebrow", "EDIÇÃO 42", 120, 268, 400, 34, 24, 700, MAIL.brand, "left", { letterSpacing: 0.12 }),
    t("headline", "Novidades para\na sua semana\nmais corrida", 120, 318, 580, 250, 72, 800, MAIL.ink, "left", { lineHeight: 1.08 }),
    t("body", "Agendamento em massa, respostas salvas e um painel novo de equipe.", 120, 590, 560, 96, 32, 400, MAIL.muted, "left", { lineHeight: 1.35 }),
    s.card("cta", s.at(120, 724, 370, 96), MAIL.brand, 48, { effects: soft("cta", MAIL.brand, 0.25, 14, 28) }),
    t("cta_text", "Ler a novidade", 156, 752, 240, 40, 30, 700, "#ffffff"),
    ellipse("cta_arrow_bg", s.at(406, 736, 72, 72), "#ffffff"),
    icon("cta_arrow", "arrow-right", s.at(424, 754, 36, 36), MAIL.brand),
    s.card("mock", tilt(0, 0, 430, 390), "#ffffff", 26, { effects: soft("mock", MAIL.brand, 0.22, 32, 64) }),
    s.card("mock_title", tilt(-90, -140, 200, 22), MAIL.ink, 11),
    s.card("mock_line", tilt(-110, -102, 160, 16), "#d5d8de", 8),
    ellipse("mock_avatar", tilt(150, -126, 52, 52), "#ffd0c3"),
    s.label("mock_stat", "Respostas +38%", tilt(-40, -36, 300, 40), 30, { font: "outfit", weight: 700, fill: MAIL.ink, align: "left" }),
    ...bars.map((h, i) => s.card(`mock_bar${i + 1}`, tilt(-128 + i * 64, 150 - h / 2, 40, h), i === bars.length - 1 ? MAIL.brand : "#ffd0c3", 8)),
  ]);
}

const HERO = { bg: "#fafafb", ink: "#0b0b12", muted: "#555a66", brand: "#6d4aff", tint: "#ebe5ff", line: "#ececf2", green: "#12b76a" };

function webHero(): Artboard {
  const s = sheet(1440, 1000);
  const t = writer(s, "manrope");
  const floating = (id: string) => soft(id, "#1b1340", 0.14, 20, 40);
  const tiles: [string, string][] = [
    ["Saldo", "R$ 182.400"],
    ["Recebido hoje", "R$ 12.480"],
    ["Aprovação", "98,2%"],
  ];
  const rows: [string, string][] = [
    ["Loja Aurora", "+R$ 320"],
    ["Café Bússola", "+R$ 86"],
    ["Ateliê Sol", "+R$ 1.240"],
    ["Mercado Rio", "+R$ 412"],
  ];
  return s.board(HERO.bg, [
    ellipse("wash", s.mid(720, 40, 1700, 760), HERO.tint, { gradient: radial("#e3dcff", "#fafafb00") }),
    s.card("logo_mark", s.at(120, 26, 40, 40), HERO.brand, 10),
    star("logo_diamond", s.at(130, 36, 20, 20), "#ffffff", 4, 0.5),
    t("logo", "pagora", 170, 26, 200, 40, 30, 800, HERO.ink),
    t("nav", "Produto    Soluções    Preços    Clientes", 470, 34, 500, 30, 18, 600, HERO.muted, "center"),
    t("login", "Entrar", 1080, 34, 90, 30, 18, 600, HERO.ink, "right"),
    s.card("start", s.at(1190, 22, 130, 50), HERO.ink, 14),
    t("start_text", "Começar", 1190, 34, 130, 28, 18, 700, "#ffffff", "center"),
    s.card("chip", s.at(520, 100, 400, 46), "#ffffff", 23, { stroke: HERO.line, strokeWidth: 2 }),
    s.card("chip_new", s.at(527, 107, 72, 32), HERO.brand, 16),
    t("chip_new_text", "Novo", 527, 112, 72, 24, 17, 700, "#ffffff", "center"),
    t("chip_text", "Repasses em 40 países", 610, 111, 260, 26, 18, 600, HERO.ink),
    icon("chip_arrow", "arrow-right", s.at(880, 112, 22, 22), HERO.ink),
    t("headline", "Pagamentos que caem antes\ndo seu café esfriar", 160, 166, 1120, 170, 74, 800, HERO.ink, "center", { lineHeight: 1.04, letterSpacing: -0.03 }),
    t("sub", "Receba as vendas no mesmo dia, concilie tudo sozinho e acompanhe cada centavo em um só painel.", 330, 348, 780, 64, 22, 400, HERO.muted, "center", { lineHeight: 1.4 }),
    s.card("capture", s.at(470, 432, 500, 64), "#ffffff", 14, { stroke: HERO.line, strokeWidth: 2, effects: floating("capture") }),
    t("capture_placeholder", "seu@email.com", 494, 452, 260, 26, 19, 500, "#8a8f9a"),
    s.card("capture_button", s.at(820, 438, 144, 52), HERO.brand, 10),
    t("capture_button_text", "Teste grátis", 820, 451, 144, 26, 18, 700, "#ffffff", "center"),
    t("trust", "Mais de 4.000 equipes confiam", 520, 512, 400, 26, 17, 600, HERO.muted, "center"),
    ...["NORTE", "lumen", "ÓRBITA", "kasa", "VELA"].map((name, i) => t(`trust_logo${i + 1}`, name, 400 + i * 128, 544, 120, 32, 22, 800, "#9a9ca8", "center")),
    s.card("mockup", s.at(170, 600, 1100, 480), "#ffffff", 24, { stroke: HERO.line, strokeWidth: 2, effects: soft("mockup", "#1b1340", 0.16, 40, 80) }),
    s.card("mock_sidebar", s.at(190, 620, 180, 440), "#f6f5fb", 16),
    s.card("mock_nav_active", s.at(204, 676, 152, 40), HERO.tint, 10),
    ...[0, 1, 2, 3, 4].map((i) => s.card(`mock_nav${i + 1}`, s.at(222, 640 + i * 48 + (i > 0 ? 8 : 0), i === 1 ? 96 : 110 - i * 6, 12), i === 1 ? HERO.brand : "#d9d7e4", 6)),
    t("mock_title", "Visão geral", 392, 634, 300, 32, 24, 800, HERO.ink),
    s.card("mock_search", s.at(1030, 628, 220, 40), "#f4f4f8", 20),
    ...tiles.flatMap(([label, value], i) => [
      s.card(`mock_tile${i + 1}`, s.at(392 + i * 290, 692, 270, 112), "#fafafb", 16, { stroke: HERO.line, strokeWidth: 2 }),
      t(`mock_tile${i + 1}_label`, label, 412 + i * 290, 710, 230, 24, 17, 600, HERO.muted),
      t(`mock_tile${i + 1}_value`, value, 412 + i * 290, 740, 240, 40, 30, 800, HERO.ink),
    ]),
    { id: "mock_chart", type: "chart", transform: s.at(392, 824, 560, 176), chart: chart("area", ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"], [32, 41, 38, 52, 49, 63, 71], [HERO.brand], { axes: false, gridlines: true, gridColor: "#efedf6", valueLabels: false, smooth: true, lineWidth: 0.02 }) },
    ...rows.flatMap(([name, value], i) => [
      ellipse(`mock_row${i + 1}_dot`, s.mid(988, 846 + i * 44, 14, 14), [HERO.brand, HERO.green, "#f59e0b", "#ec4899"][i]),
      t(`mock_row${i + 1}_name`, name, 1004, 834 + i * 44, 140, 26, 17, 600, HERO.ink),
      t(`mock_row${i + 1}_value`, value, 1140, 834 + i * 44, 110, 26, 17, 700, HERO.green, "right"),
    ]),
    s.card("float_payout", s.at(64, 660, 300, 136), "#ffffff", 24, { effects: floating("float_payout") }),
    ellipse("float_payout_icon_bg", s.at(88, 684, 48, 48), HERO.green),
    icon("float_payout_icon", "check-circle", s.at(96, 692, 32, 32), "#ffffff"),
    t("float_payout_title", "Repasse enviado", 148, 694, 200, 28, 19, 700, HERO.ink),
    t("float_payout_value", "R$ 12.480,00", 88, 740, 260, 40, 32, 800, HERO.ink),
    t("float_payout_time", "há 2 s", 248, 668, 96, 24, 17, 500, HERO.muted, "right"),
    s.card("float_conversion", s.at(1116, 604, 270, 176), "#ffffff", 24, { effects: floating("float_conversion") }),
    { id: "float_donut", type: "chart", transform: s.at(1136, 630, 116, 116), chart: chart("donut", ["Convertidos", "Restante"], [68, 32], [HERO.brand, HERO.tint], { axes: false, gridlines: false, valueLabels: false, hole: 0.7 }) },
    t("float_conversion_label", "Conversão", 1266, 640, 110, 26, 18, 600, HERO.muted),
    t("float_conversion_value", "68%", 1266, 668, 110, 44, 38, 800, HERO.ink),
    t("float_conversion_note", "+6 pts", 1266, 716, 110, 26, 18, 700, HERO.green),
    s.card("float_people", s.at(1096, 806, 304, 64), "#ffffff", 32, { effects: floating("float_people") }),
    ...["#ffb38a", "#8ad1ff", "#c5a8ff"].map((color, i) => ellipse(`float_avatar${i + 1}`, s.at(1110 + i * 30, 818, 40, 40), color, { stroke: "#ffffff", strokeWidth: 3 })),
    t("float_people_text", "+2,4 mil esta semana", 1214, 824, 180, 28, 17, 700, HERO.ink),
  ]);
}

const NEU = { surface: "#e0e5ec", light: "#ffffff", dark: "#a3b1c6", ink: "#31456a", muted: "#6b7c96", accent: "#ff7a50" };

function neumorphic(): Artboard {
  const s = sheet(1125, 2436);
  const t = writer(s, "nunito");
  const up = (id: string) => raised(id, NEU.light, NEU.dark, 24, 48);
  const down = (id: string) => pressed(id, NEU.light, NEU.dark, 10, 20);
  const actions: [string, string][] = [
    ["Enviar", "arrow-up-right"],
    ["Receber", "currency-dollar"],
    ["Recarregar", "lightning"],
    ["Mais", "sparkle"],
  ];
  const payments: [string, string, string, string][] = [
    ["Mercado Central", "Hoje, 09:12", "-R$ 86,40", "storefront"],
    ["Entrega Rápida", "Ontem, 19:40", "-R$ 32,90", "package"],
  ];
  return s.board(NEU.surface, [
    ellipse("menu_button", s.mid(144, 160, 144, 144), NEU.surface, { effects: up("menu_button") }),
    s.card("menu_line1", s.mid(144, 146, 54, 8), NEU.ink, 4),
    s.card("menu_line2", s.mid(144, 174, 54, 8), NEU.ink, 4),
    t("title", "Carteira", 312, 128, 500, 64, 54, 800, NEU.ink, "center"),
    ellipse("avatar_button", s.mid(981, 160, 144, 144), NEU.surface, { effects: up("avatar_button") }),
    t("avatar_initials", "LS", 909, 132, 144, 56, 46, 800, NEU.accent, "center"),
    s.card("card_back", s.at(110, 380, 905, 585), NEU.surface, 90, { effects: up("card_back") }),
    s.card("card", s.at(72, 340, 981, 585), NEU.surface, 90, { gradient: linear("#e8edf4", "#d6dce5", 145), effects: up("card") }),
    s.card("card_chip", s.at(150, 430, 132, 96), NEU.surface, 24, { effects: down("card_chip") }),
    t("card_number", "4532  ••••  2201", 150, 610, 760, 70, 60, 700, NEU.ink, "left", { letterSpacing: 0.08 }),
    t("card_holder", "LIA SOARES", 150, 760, 420, 46, 38, 700, NEU.muted, "left", { letterSpacing: 0.08 }),
    t("card_expiry", "08/29", 600, 760, 160, 46, 38, 700, NEU.muted),
    ellipse("card_mark_a", s.mid(898, 820, 96, 96), NEU.accent),
    ellipse("card_mark_b", s.mid(958, 820, 96, 96, 0, 0.85), "#ffb08f"),
    t("balance_label", "Saldo total", 72, 1010, 600, 50, 40, 600, NEU.muted),
    t("balance", "R$ 12.840,32", 72, 1062, 981, 124, 104, 800, NEU.ink),
    ...actions.flatMap(([name, glyph], i) => [
      s.card(`action${i + 1}`, s.at(72 + i * 263, 1234, 192, 192), NEU.surface, 60, { effects: i === 1 ? down(`action${i + 1}`) : up(`action${i + 1}`) }),
      icon(`action${i + 1}_icon`, glyph, s.mid(168 + i * 263, 1330, 76, 76), i === 1 ? NEU.accent : NEU.ink),
      t(`action${i + 1}_label`, name, 52 + i * 263, 1450, 232, 46, 36, 700, NEU.muted, "center"),
    ]),
    s.card("spending", s.at(72, 1540, 981, 450), NEU.surface, 90, { effects: up("spending") }),
    ellipse("spending_well", s.at(132, 1620, 288, 288), NEU.surface, { effects: down("spending_well") }),
    path("spending_arc", arc(0.65, 0.07), s.at(132, 1620, 288, 288), CLEAR, { stroke: NEU.accent, strokeWidth: 30, lineCap: "round" }),
    t("spending_percent", "65%", 132, 1734, 288, 60, 52, 800, NEU.ink, "center"),
    t("spending_title", "Gastos do mês", 470, 1640, 560, 60, 50, 800, NEU.ink),
    t("spending_detail", "R$ 1.940 de R$ 3.000", 470, 1708, 560, 50, 40, 600, NEU.muted),
    s.card("slider_track", s.at(470, 1820, 520, 22), NEU.surface, 11, { effects: down("slider_track") }),
    s.card("slider_fill", s.at(470, 1820, 336, 22), NEU.accent, 11),
    ellipse("slider_knob", s.mid(806, 1831, 64, 64), NEU.surface, { effects: raised("slider_knob", NEU.light, NEU.dark, 8, 16) }),
    ...payments.flatMap(([name, when, amount, glyph], i) => [
      ellipse(`payment${i + 1}_well`, s.at(72, 2040 + i * 118, 100, 100), NEU.surface, { effects: down(`payment${i + 1}_well`) }),
      icon(`payment${i + 1}_icon`, glyph, s.mid(122, 2090 + i * 118, 46, 46), NEU.muted),
      t(`payment${i + 1}_name`, name, 200, 2042 + i * 118, 480, 50, 42, 700, NEU.ink),
      t(`payment${i + 1}_when`, when, 200, 2094 + i * 118, 480, 42, 34, 600, NEU.muted),
      t(`payment${i + 1}_amount`, amount, 700, 2062 + i * 118, 353, 52, 44, 800, NEU.ink, "right"),
    ]),
    s.card("tabbar", s.at(72, 2290, 981, 120), NEU.surface, 60, { effects: down("tabbar") }),
    ellipse("tab_active", s.mid(220, 2350, 96, 96), NEU.surface, { effects: raised("tab_active", NEU.light, NEU.dark, 8, 16) }),
    ...["storefront", "chat-circle", "bell", "users"].map((glyph, i) => icon(`tab${i + 1}`, glyph, s.mid(220 + i * 228, 2350, 52, 52), i === 0 ? NEU.accent : NEU.muted)),
  ]);
}

const GLASS = { base: "#1b1036", text: "#ffffff", muted: "#ffffffb3", pink: "#ff6cab", violet: "#7366ff", teal: "#00d4c8", peach: "#ffb86b" };

function glassCards(): Artboard {
  const s = sheet(1440, 1024);
  const t = writer(s, "outfit");
  const glass = (id: string, left: number, top: number, w: number, h: number, px: number, extra = {}) =>
    s.card(id, s.at(left, top, w, h), "#ffffff1f", px, { gradient: linear("#ffffff3d", "#ffffff0f", 135), stroke: "#ffffff59", strokeWidth: 2, effects: [drop(`${id}_shadow`, "#0b0620", 0.28, 0, 14, 28, -1)], ...extra });
  const blob = (id: string, cx: number, cy: number, d: number, color: string) => ellipse(id, s.mid(cx, cy, d, d), color, { gradient: radial(color, `${color}00`) });
  const nav = ["Início", "Cartões", "Pagamentos", "Investimentos", "Relatórios", "Ajustes"];
  const people: [string, string][] = [
    ["AL", GLASS.pink],
    ["BR", GLASS.violet],
    ["CM", GLASS.teal],
    ["DS", GLASS.peach],
    ["EF", "#9ad0ff"],
  ];
  const card = (n: number, dx: number, dy: number, opacity: number) =>
    s.card(`credit${n}`, s.at(372 + dx, 178 + dy, 470, 294, 0, opacity), "#ffffff26", 40, { gradient: linear("#ffffff55", "#ffffff12", 135), stroke: "#ffffff80", strokeWidth: 2, effects: [drop(`credit${n}_shadow`, "#0b0620", 0.3, 0, 18, 36, -1)] });
  return s.board(GLASS.base, [
    blob("blob_pink", 170, 210, 760, GLASS.pink),
    blob("blob_violet", 1120, 150, 860, GLASS.violet),
    blob("blob_teal", 860, 880, 640, GLASS.teal),
    blob("blob_peach", 360, 920, 480, GLASS.peach),
    glass("sidebar", 48, 48, 270, 928, 28),
    s.card("logo_mark", s.at(80, 84, 44, 44), "#ffffff", 14, { gradient: linear("#ffffff", "#ffd4ea", 135) }),
    t("logo", "Nimbo", 136, 86, 160, 40, 30, 800, GLASS.text),
    s.card("nav_active", s.at(68, 172, 230, 56), "#ffffff2e", 28),
    ...nav.map((label, i) => t(`nav${i + 1}`, label, 96, 186 + i * 72, 200, 30, 21, i === 0 ? 700 : 500, i === 0 ? GLASS.text : GLASS.muted)),
    glass("upgrade", 72, 772, 222, 180, 22),
    t("upgrade_title", "Plano Pro", 96, 796, 180, 32, 24, 800, GLASS.text),
    t("upgrade_text", "Cartões ilimitados e cashback em dobro.", 96, 834, 180, 56, 18, 500, GLASS.muted, "left", { lineHeight: 1.3 }),
    s.card("upgrade_button", s.at(96, 900, 150, 36), "#ffffff", 18),
    t("upgrade_button_text", "Assinar", 96, 907, 150, 24, 17, 800, GLASS.base, "center"),
    t("hello", "Olá, Ana", 372, 70, 400, 50, 40, 800, GLASS.text),
    glass("search", 980, 68, 260, 54, 27),
    t("search_text", "Buscar", 1010, 82, 180, 28, 19, 500, GLASS.muted),
    glass("bell_button", 1256, 68, 54, 54, 27),
    icon("bell", "bell", s.mid(1283, 95, 26, 26), GLASS.text),
    ellipse("avatar", s.at(1326, 68, 54, 54), GLASS.pink, { gradient: linear(GLASS.peach, GLASS.pink, 135), stroke: "#ffffff", strokeWidth: 3 }),
    card(3, 36, -36, 0.7),
    card(2, 18, -18, 0.85),
    card(1, 0, 0, 1),
    s.card("credit_chip", s.at(410, 232, 66, 50, 0, 0.85), "#ffe9b3", 10, { gradient: linear("#fff3cf", "#e7c26d", 135) }),
    ...[0, 1, 2].map((i) => path(`credit_wave${i + 1}`, "M0 0 C0.6 0.25 0.6 0.75 0 1", s.at(494 + i * 12, 240 - i * 4, 14, 34 + i * 8), CLEAR, { stroke: "#ffffffd9", strokeWidth: 3, lineCap: "round" })),
    t("credit_number", "5284  ••••  ••••  9012", 410, 330, 420, 40, 30, 700, GLASS.text, "left", { letterSpacing: 0.1 }),
    t("credit_name", "ANA LIMA", 410, 400, 200, 28, 19, 700, GLASS.muted, "left", { letterSpacing: 0.1 }),
    t("credit_expiry", "09/28", 620, 400, 100, 28, 19, 700, GLASS.muted),
    ellipse("credit_mark_a", s.mid(772, 414, 52, 52), "#ffffffb3"),
    ellipse("credit_mark_b", s.mid(800, 414, 52, 52), "#ffffff66"),
    glass("balance_panel", 884, 160, 492, 172, 28),
    t("balance_label", "Saldo total", 916, 186, 260, 28, 20, 500, GLASS.muted),
    t("balance", "R$ 24.580,90", 916, 222, 440, 64, 54, 800, GLASS.text),
    s.card("balance_delta", s.at(1236, 184, 112, 40), "#22c55e40", 20),
    t("balance_delta_text", "+3,2%", 1236, 192, 112, 26, 19, 800, "#86efac", "center"),
    glass("send_panel", 884, 352, 492, 172, 28),
    t("send_title", "Envio rápido", 916, 376, 260, 30, 22, 700, GLASS.text),
    ...people.flatMap(([initials, color], i) => [
      ellipse(`person${i + 1}`, s.at(916 + i * 74, 428, 60, 60), color, { gradient: linear(color, "#ffffff", 160), stroke: "#ffffff", strokeWidth: 3 }),
      t(`person${i + 1}_initials`, initials, 916 + i * 74, 444, 60, 28, 19, 800, GLASS.base, "center"),
    ]),
    ellipse("person_add", s.at(1290, 428, 60, 60), CLEAR, { stroke: "#ffffffb3", strokeWidth: 3, dash: true }),
    t("person_add_plus", "+", 1290, 436, 60, 40, 34, 500, GLASS.text, "center"),
    glass("spend_panel", 372, 548, 300, 428, 28),
    t("spend_title", "Gastos", 404, 574, 240, 30, 22, 700, GLASS.text),
    { id: "spend_donut", type: "chart", transform: s.at(402, 630, 240, 240), chart: chart("donut", ["Casa", "Mercado", "Lazer", "Outros"], [42, 28, 18, 12], [GLASS.pink, GLASS.violet, GLASS.teal, GLASS.peach], { axes: false, gridlines: false, valueLabels: false, hole: 0.72 }) },
    t("spend_total", "R$ 3.120", 402, 732, 240, 36, 28, 800, GLASS.text, "center"),
    t("spend_note", "Mercado subiu 12% no mês", 404, 898, 240, 52, 18, 500, GLASS.muted, "left", { lineHeight: 1.3 }),
    glass("activity_panel", 696, 548, 680, 428, 28),
    t("activity_title", "Atividade", 728, 574, 300, 30, 22, 700, GLASS.text),
    { id: "activity_chart", type: "chart", transform: s.at(724, 630, 624, 316), chart: chart("area", ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul"], [420, 610, 540, 880, 760, 1240, 980], ["#ffffff"], { fontId: "outfit", textColor: "#ffffffb3", gridColor: "#ffffff1a", axes: true, gridlines: true, valueLabels: false, smooth: true, lineWidth: 0.008, fontSize: 0.055 }) },
    s.card("activity_tip", s.at(1112, 616, 132, 50), "#ffffff33", 14, { stroke: "#ffffff73", strokeWidth: 2 }),
    t("activity_tip_text", "R$ 1.240", 1112, 628, 132, 28, 20, 800, GLASS.text, "center"),
  ]);
}

export function dataUiCorpus(): CorpusEntry[] {
  return [
    {
      id: "dashboard",
      title: "Painel de indicadores no celular",
      useCase: "infográfico e cards de dados com gráficos",
      sources: [source("Figma Community", "Mobile Dashboard: Charts & KPI Widgets", "https://www.figma.com/community/file/1528308765361625218/mobile-dashboard-charts-kpi-widgets")],
      intent:
        "Tela de celular 1080 x 2340 com margem lateral de 56 px e calha de 32 px; cards brancos de largura total ou meia largura empilhados sobre cinza claro. Hierarquia: título da tela, controle segmentado, dois KPIs grandes com variação e minigráfico, meta com anel de progresso, gráfico de barras com a barra de destaque e a dica escura, e a linha final com rosca e medidor. Uma família sans geométrica (Inter) em quatro pesos. Cor: tinta azul quase preta, cinza frio de apoio, índigo como única cor de dado e verde e vermelho só para variação. Profundidade: sombra dupla bem suave nos cards, nada dentro deles. Raios: 66 nos cards, 30 nas pílulas e chips, 22 nas barras e na dica.",
      brief:
        "Tela de painel para celular (1080 x 2340) de uma loja: saudação Bom dia, Lia e título Visão geral; seletor Dia, Semana, Mês com Semana ativo; KPIs receita R$ 48,2k (+12,4%) e usuários ativos 3.912 (-2,1%) com minigráficos; meta do mês 72% (R$ 36.000 de R$ 50.000); barras da receita semanal com o pico de R$ 8,4k na quinta; canais site 45%, app 25%, loja 18%, outros 12%; pontuação 86, excelente. Cards brancos arredondados, sombras suaves.",
      photos: [],
      make: dashboard,
    },
    {
      id: "slide",
      title: "Slide de apresentação com número de impacto",
      useCase: "slide de apresentação",
      sources: [source("Figma Community", "Pitch Deck Figma Slides Template", "https://www.figma.com/community/file/1486772280400965224/pitch-deck-figma-slides-template-brix-agency"), source("Figma Community", "Lumio Free Pitch Deck Template", "https://www.figma.com/community/file/1309109978092151887/lumio-free-pitch-deck-template")],
      intent:
        "Slide 16:9 escuro com margem de 112 px e duas colunas: à esquerda a frase de impacto em três linhas (120 px, entrelinha 0.95, espaçamento negativo) com a palavra-número sobre uma pílula lima, à direita um painel de vidro com o valor, a variação e 12 barras crescentes em que só a última é lima. Hierarquia: frase, número do painel, barras, texto de apoio, logos de clientes a 40%. Uma grotesca (Plus Jakarta Sans) em três pesos. Cor: preto azulado, um brilho violeta difuso no canto inferior direito, lima como único destaque. Profundidade: brilho de fundo e sombra larga sob o painel translúcido. Raios: 28 no painel, 26 na pílula, 12 no chip, 6 nas barras.",
      brief:
        "Slide 16:9 de pitch para investidores sobre tração: crescemos 9x em 12 meses; a receita recorrente anual foi de R$ 230 mil para R$ 2,1 milhões (+812%) sem aumentar o time de vendas. Mostre a evolução dos 12 meses em barras, destaque o número 9x e coloque logos de clientes (NORTE, lumen, ÓRBITA, kasa) no rodapé. Fundo escuro, um único destaque lima, página 07.",
      photos: [],
      make: slide,
    },
    {
      id: "email-header",
      title: "Cabeçalho de e-mail com bloco herói",
      useCase: "cabeçalho ou banner de e-mail",
      sources: [source("Figma Community", "Email Design System (newsletter templates)", "https://www.figma.com/community/file/1147555883650369324/email-design-system-newsletter-templates")],
      intent:
        "Topo de newsletter 1200 x 1120 (600 px de e-mail em 2x), coluna única com respiro de 64 px: faixa de pré-cabeçalho, barra com logotipo e navegação, e um painel herói pêssego com cantos de 48 px. Dentro do painel, à esquerda o sobretítulo, o título em três linhas (72 px, 800), o texto e o botão pílula com a seta num círculo branco; à direita um card de interface girado -6 graus que transborda a borda do painel. Tipografia: Outfit, geométrica, em três pesos. Cor: laranja vivo da marca, pêssego claro, tinta quase preta e cinza neutro. Profundidade: plana como pede o e-mail, com uma única sombra colorida sob o card girado; círculos grandes a 15% recortados pelo painel. Raios: 48 painel e botão, 26 card, 8 barras.",
      brief:
        "Cabeçalho de newsletter (1200 x 1120) da marca lumen, edição 42: Novidades para a sua semana mais corrida, com agendamento em massa, respostas salvas e um painel novo de equipe. Botão Ler a novidade. Inclua o pré-cabeçalho Seu resumo da semana e Ver no navegador, navegação Produto, Preços e Blog, e uma miniatura da interface mostrando respostas +38%. Laranja e pêssego, cantos bem arredondados.",
      photos: [],
      make: emailHeader,
    },
    {
      id: "web-hero",
      title: "Herói de site com painel e cards flutuantes",
      useCase: "banner herói de site",
      sources: [source("Figma Community", "SaaS Hero Section: Modern Payment Dashboard Focus", "https://www.figma.com/community/file/1507702130361975470/saas-hero-section-modern-payment-dashboard-focus")],
      intent:
        "Herói centrado 1440 x 1000 com largura de conteúdo de 1200 px: navegação, chip de anúncio, título de duas linhas (74 px, 800, espaçamento -3%), subtítulo, captura de e-mail com botão embutido, faixa de confiança com logos e, cortado pela base, um painel de produto com barra lateral, KPIs, gráfico de área e lista. Três cards flutuantes quebram as bordas do painel (repasse enviado, conversão com rosca, pílula de pessoas). Tipografia Manrope em quatro pesos. Cor: branco gelo com um véu lilás no topo, violeta como marca, verde só para dinheiro entrando. Profundidade em três planos: fundo, painel com sombra longa e cards com sombra média acima. Raios: 24 painel e cards, 14 campo e botões, 10 chips internos.",
      brief:
        "Herói de site (1440 x 1000) para a fintech pagora: Pagamentos que caem antes do seu café esfriar. Subtítulo sobre receber vendas no mesmo dia e conciliar tudo sozinho, campo de e-mail com Teste grátis, selo Novo: repasses em 40 países, prova social de 4.000 equipes e um painel do produto com saldo R$ 182.400, gráfico da semana e cards flutuantes de repasse enviado de R$ 12.480,00 e conversão de 68%.",
      photos: [],
      make: webHero,
    },
    {
      id: "neumorphic",
      title: "Carteira em neumorfismo",
      useCase: "cards de interface suaves e arredondados (neumorfismo)",
      sources: [source("Dribbble", "Skeuomorph Mobile Banking", "https://dribbble.com/shots/7994421-Skeuomorph-Mobile-Banking"), source("Built In", "Neumorphism and accessibility", "https://builtin.com/design-ux/neumorphism-accessibility")],
      intent:
        "Tela de celular 1125 x 2436 em que tudo nasce da mesma superfície cinza azulada: cada peça elevada leva duas sombras, uma clara para cima e à esquerda e uma escura para baixo e à direita (24 px, desfoque 48), e as peças afundadas usam as mesmas sombras por dentro. Hierarquia: cartão com número, saldo grande, quatro botões quadrados com o segundo pressionado, card de gastos com anel de progresso num poço, duas transações e a barra de abas afundada. Tipografia Nunito arredondada em dois pesos. Cor: superfície #e0e5ec, tinta azul acinzentada, laranja como única cor de estado. Raios: 90 nos cards, 60 nos botões e barra, círculos inteiros nos poços.",
      brief:
        "Tela de carteira digital (1125 x 2436) em neumorfismo: cartão 4532 •••• 2201 de LIA SOARES, validade 08/29; saldo total R$ 12.840,32; ações Enviar, Receber (pressionada), Recarregar e Mais; gastos do mês 65% (R$ 1.940 de R$ 3.000) com controle deslizante; transações Mercado Central -R$ 86,40 e Entrega Rápida -R$ 32,90; barra de abas. Tudo da mesma cor de fundo, elevado ou afundado por sombras claras e escuras, um laranja de destaque.",
      photos: [],
      make: neumorphic,
    },
    {
      id: "glass-cards",
      title: "Painel financeiro em vidro com pilha de cartões",
      useCase: "cards de interface suaves e arredondados (vidro, pilha arredondada)",
      sources: [source("freeCodeCamp", "Glassmorphism: how to create a glass card in Figma", "https://www.freecodecamp.org/news/glassmorphism-how-to-create-a-glass-card-in-figma/"), source("Dribbble", "Finance dashboard Glassmorphism", "https://dribbble.com/shots/23344131-Finance-dashboard-Glassmorphism")],
      intent:
        "Painel 1440 x 1024 de cards de vidro flutuando sobre quatro manchas de cor saturada (rosa, violeta, turquesa, pêssego) num fundo roxo profundo. Grade: barra lateral de 270 px e conteúdo em três colunas com calha de 24 px. Hierarquia: pilha de três cartões de crédito deslocados 18 px para cima e à direita, saldo, envio rápido, rosca de gastos e gráfico de atividade com dica. Receita de vidro: degradê branco de 24% a 6% a 135 graus, contorno branco de 35%, sombra suave com espalhamento -1. Tipografia Outfit, branco e branco a 70%. Raios: 40 nos cartões, 28 nos painéis, 22 nos internos, pílulas inteiras.",
      brief:
        "Painel financeiro (1440 x 1024) do app Nimbo em glassmorphism: Olá, Ana; pilha de cartões de vidro com o cartão 5284 •••• •••• 9012 de ANA LIMA na frente; saldo total R$ 24.580,90 (+3,2%); envio rápido com cinco contatos; rosca de gastos R$ 3.120; gráfico de atividade de jan a jul com pico de R$ 1.240; barra lateral com Início, Cartões, Pagamentos, Investimentos, Relatórios, Ajustes e um card do Plano Pro. Manchas coloridas desfocadas atrás do vidro.",
      photos: [],
      make: glassCards,
    },
  ];
}
