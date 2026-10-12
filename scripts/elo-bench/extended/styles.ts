import type { Artboard, Layer } from "@/lib/studio/document";

import { CLEAR, drop, ellipse, glow, icon, linear, path, polygon, radial, rect, sheet, soft, star, triangle, writer } from "../authoring";
import { photoIn } from "../photos";
import { source, type CorpusEntry } from "./corpus";

const TEARDROP = "M0.5 0 C0.75 0.35 1 0.55 1 0.75 C1 0.9 0.78 1 0.5 1 C0.22 1 0 0.9 0 0.75 C0 0.55 0.25 0.35 0.5 0 Z";
const ZIGZAG = "M0 0.8 L0.2 0.2 L0.4 0.8 L0.6 0.2 L0.8 0.8 L1 0.2";

function brutalist(): Artboard {
  const s = sheet(1400, 2000);
  const t = writer(s, "oswald");
  const ink = "#111111";
  const red = "#e1251b";
  const paper = "#f2efe8";
  const cells: [string, string, number, number][] = [
    ["DATA", "14 NOV", 56, 1212],
    ["HORÁRIO", "20H", 716, 1212],
    ["LOCAL", "ESTAÇÃO SUL", 56, 1396],
    ["INGRESSOS", "R$ 30", 716, 1396],
  ];
  return s.board(paper, [
    rect("rule_top", s.at(56, 76, 1288, 12), ink),
    t("header_left", "TEATRO DA CIDADE", 56, 104, 700, 48, 38, 600, ink),
    t("header_right", "2026", 900, 104, 444, 48, 38, 600, ink, "right"),
    s.label("title", "GRITO!", s.at(40, 150, 1320, 520), 540, { font: "bebas-neue", weight: 400, fill: ink, align: "left", leading: 0.85 }, { runs: [{ start: 5, end: 6, fill: red }] }),
    path("flag", "M0 0 L1 0 L0.9 0.2 L1 0.4 L1 1 L0 1 Z", s.at(56, 700, 784, 440), red),
    t("flag_text", "3 PEÇAS\n3 PALCOS\n1 NOITE", 100, 744, 640, 350, 104, 700, paper, "left", { lineHeight: 1.02 }),
    star("asterisk", s.at(890, 700, 420, 420), red, 6, 0.16),
    rect("rule_cells_top", s.at(56, 1190, 1288, 10), ink),
    rect("rule_cells_mid", s.at(56, 1376, 1288, 5), ink),
    rect("rule_cells_bottom", s.at(56, 1562, 1288, 10), ink),
    rect("rule_cells_vertical", s.at(696, 1190, 6, 382), ink),
    ...cells.flatMap(([label, value, left, top], i) => [t(`cell${i + 1}_label`, label, left, top, 600, 40, 30, 500, ink), t(`cell${i + 1}_value`, value, left, top + 50, 620, 96, 84, 700, ink)]),
    t("manifesto", "A REVOLUÇÃO\nCOMEÇA NO PALCO", 56, 1608, 1288, 240, 108, 700, ink, "left", { lineHeight: 0.98 }),
    rect("rule_bottom", s.at(56, 1880, 1288, 10), ink),
    t("credits", "REALIZAÇÃO COLETIVO GRITO  ·  APOIO SECRETARIA DE CULTURA", 56, 1910, 1288, 44, 30, 500, ink),
  ]);
}

function luxuryHero(): Artboard {
  const s = sheet(1440, 900);
  const t = writer(s, "montserrat");
  const ivory = "#f5f1e8";
  const muted = "#8c877d";
  const gold = "#c6a15b";
  return s.board("#0c0c0c", [
    ellipse("backlight", s.mid(1000, 470, 820, 760), gold, { gradient: radial("#c6a15b4d", "#c6a15b00") }),
    s.card("menu_line1", s.at(160, 42, 34, 3), ivory, 1),
    s.card("menu_line2", s.at(160, 52, 22, 3), ivory, 1),
    t("menu", "MENU", 206, 36, 120, 26, 18, 500, ivory, "left", { letterSpacing: 0.2 }),
    s.label("wordmark", "MAISON ALBA", s.at(470, 30, 500, 40), 30, { font: "playfair-display", weight: 500, fill: ivory, align: "center", spacing: 0.3 }),
    t("bag", "BUSCAR     SACOLA (0)", 980, 36, 300, 26, 18, 500, ivory, "right", { letterSpacing: 0.2 }),
    rect("nav_rule", s.at(160, 90, 1120, 2), "#c6a15b66"),
    t("eyebrow", "EAU DE PARFUM  ·  100 ML", 160, 262, 460, 28, 19, 600, gold, "left", { letterSpacing: 0.22 }),
    s.label("headline", "A arte do\nperfume\nsilencioso", s.at(152, 306, 640, 330), 104, { font: "playfair-display", weight: 400, fill: ivory, align: "left", leading: 1.02 }, { runs: [{ start: 18, end: 28, fill: gold, italic: true }] }),
    t("body", "Âmbar, figo e cedro em uma fragrância que só se revela de perto.", 160, 652, 420, 60, 20, 400, muted, "left", { lineHeight: 1.45 }),
    rect("cta", s.at(160, 742, 220, 60), CLEAR, { stroke: gold, strokeWidth: 2 }),
    t("cta_text", "COMPRAR", 160, 760, 220, 26, 19, 600, ivory, "center", { letterSpacing: 0.22 }),
    rect("cta_arrow", s.at(392, 771, 52, 2), gold),
    ellipse("plinth_body_base", s.mid(1000, 824, 360, 70), "#121212"),
    rect("plinth_body", s.at(820, 742, 360, 82), "#151515", { gradient: linear("#1d1d1d", "#0d0d0d", 0) }),
    ellipse("plinth_top", s.mid(1000, 742, 360, 70), "#1a1a1a", { stroke: "#c6a15b59", strokeWidth: 2 }),
    s.card("bottle", s.at(880, 330, 240, 400), "#b5793a", 18, { gradient: linear("#d29a55", "#6b3e14", 160), stroke: "#e3c98f80", strokeWidth: 2, effects: [glow("bottle_glow", gold, 0.25, 60)] }),
    s.card("bottle_facet_left", s.at(896, 346, 26, 368), "#ffffff26", 10),
    s.card("bottle_facet_right", s.at(1084, 346, 18, 368), "#00000033", 8),
    s.card("bottle_label", s.at(938, 520, 124, 74), "#f5f1e8", 4),
    s.label("bottle_label_text", "ALBA\nNº 07", s.at(938, 528, 124, 58), 20, { font: "playfair-display", weight: 600, fill: "#3a2a1a", align: "center", leading: 1.1, spacing: 0.1 }),
    rect("bottle_neck", s.at(966, 300, 68, 32), "#8a6a2f", { gradient: linear("#e3c98f", "#8a6a2f", 0) }),
    s.card("bottle_cap", s.at(930, 200, 140, 104), gold, 8, { gradient: linear("#f0dca8", "#9a7638", 0, "#d8b468") }),
    s.label("vertical", "COLEÇÃO Nº 07", s.mid(1340, 470, 300, 30, -90), 18, { font: "montserrat", weight: 600, fill: gold, align: "center", spacing: 0.3 }),
    t("pagination", "01 / 04", 160, 838, 100, 26, 18, 600, ivory),
    rect("pagination_track", s.at(270, 850, 160, 2), "#ffffff26"),
    rect("pagination_fill", s.at(270, 850, 40, 2), gold),
    t("scroll", "ROLAR", 1180, 838, 100, 26, 18, 600, ivory, "right", { letterSpacing: 0.2 }),
  ]);
}

const KIDS = { cream: "#fff6e5", tomato: "#ff5a4e", sun: "#ffc531", sky: "#3ea6ff", grass: "#2bc48a", grape: "#8b5cf6", ink: "#2b1b4a" };

function kidsParty(): Artboard {
  const s = sheet(1500, 2100);
  const t = writer(s, "fredoka");
  const hard = (id: string, color: string, x = 10, y = 12) => [drop(id, color, 1, x, y, 0)];
  const confetti: [string, number, number, number, number, number, string][] = [
    ["pill", 120, 620, 90, 26, 30, KIDS.sky],
    ["dot", 210, 860, 34, 34, 0, KIDS.grape],
    ["zig", 90, 1080, 120, 44, -20, KIDS.tomato],
    ["pill", 200, 1300, 90, 26, -40, KIDS.sun],
    ["dot", 1330, 640, 34, 34, 0, KIDS.grass],
    ["pill", 1300, 860, 90, 26, 50, KIDS.tomato],
    ["zig", 1290, 1100, 120, 44, 25, KIDS.sky],
    ["dot", 1380, 1300, 30, 30, 0, KIDS.sun],
    ["pill", 640, 220, 80, 24, -15, KIDS.grass],
    ["dot", 900, 210, 28, 28, 0, KIDS.tomato],
    ["zig", 1390, 1500, 120, 44, 10, KIDS.grape],
    ["pill", 1390, 1740, 90, 26, 20, KIDS.sky],
  ];
  const details: [string, string, string][] = [
    ["calendar", "Sábado, 14 de junho", KIDS.tomato],
    ["clock", "Das 14h às 17h", KIDS.sky],
    ["map-pin", "Parque Brincar, Rua Azul, 12", KIDS.grass],
  ];
  return s.board(KIDS.cream, [
    ellipse("corner_tomato", s.mid(0, 0, 900, 900), KIDS.tomato),
    s.card("corner_sun", s.mid(1310, 190, 270, 270, 15), KIDS.sun, 48, { effects: hard("corner_sun_shadow", "#d99a0b") }),
    ellipse("corner_sky", s.mid(940, 2120, 560, 560), KIDS.sky),
    triangle("corner_grass", s.mid(210, 1910, 320, 280, -10), KIDS.grass, { effects: hard("corner_grass_shadow", "#1b8f63") }),
    ...confetti.map(([kind, cx, cy, w, h, angle, color], i) =>
      kind === "pill" ? s.card(`confetti${i + 1}`, s.mid(cx, cy, w, h, angle), color, h / 2) : kind === "dot" ? ellipse(`confetti${i + 1}`, s.mid(cx, cy, w, h), color) : path(`confetti${i + 1}`, ZIGZAG, s.mid(cx, cy, w, h, angle), CLEAR, { stroke: color, strokeWidth: 10, lineCap: "round", lineJoin: "round" }),
    ),
    s.card("invite_pill", s.at(330, 300, 840, 112), KIDS.ink, 56),
    t("invite_text", "VEM PRA FESTA!", 330, 326, 840, 64, 54, 700, KIDS.cream, "center", { letterSpacing: 0.06 }),
    t("turning", "O Léo vai fazer", 250, 450, 1000, 100, 88, 600, KIDS.ink, "center"),
    s.label("age", "5", s.at(450, 520, 600, 800), 760, { font: "fredoka", weight: 700, fill: KIDS.sun, align: "center", leading: 1 }, { stroke: KIDS.ink, strokeWidth: 16, effects: [drop("age_shadow", KIDS.tomato, 1, 18, 18, 0)] }),
    star("age_star_left", s.mid(420, 700, 110, 110, -12), KIDS.grape, 5, 0.45),
    star("age_star_right", s.mid(1100, 1180, 80, 80, 16), KIDS.sky, 5, 0.45),
    s.card("details", s.at(210, 1380, 1080, 440), "#ffffff", 30, { stroke: KIDS.ink, strokeWidth: 5, effects: [drop("details_shadow", KIDS.ink, 1, 10, 10, 0)] }),
    ...details.flatMap(([glyph, label, color], i) => [ellipse(`detail${i + 1}_bg`, s.at(262, 1424 + i * 128, 92, 92), color), icon(`detail${i + 1}_icon`, glyph, s.at(284, 1446 + i * 128, 48, 48), "#ffffff"), t(`detail${i + 1}`, label, 384, 1442 + i * 128, 880, 60, 50, 600, KIDS.ink)]),
    t("rsvp", "Confirme com a Ana: (11) 95555-0123", 200, 1872, 1100, 56, 44, 600, KIDS.ink, "center"),
  ]);
}

function festaJunina(): Artboard {
  const s = sheet(1920, 1080);
  const t = writer(s, "fredoka");
  const night = "#13235b";
  const colors = ["#e63946", "#ffc93c", "#2a9d8f", "#f4a261", "#ff7fb0"];
  const sag = (x: number, top: number, low: number) => top + (low - top) * (1 - ((x - 960) / 960) ** 2);
  const slope = (x: number, top: number, low: number) => (Math.atan((-2 * (low - top) * (x - 960)) / 960 ** 2) * 180) / Math.PI;
  const lower = Array.from({ length: 15 }, (_, i) => 70 + i * 127);
  const upper = Array.from({ length: 12 }, (_, i) => 120 + i * 152);
  const flag = (id: string, x: number, top: number, low: number, color: string, w: number, h: number): Layer[] => {
    const y = sag(x, top, low);
    const angle = slope(x, top, low);
    return [triangle(id, s.mid(x, y + h / 2, w, h, 180 + angle), color), triangle(`${id}_doodle`, s.mid(x + 6, y + h / 2 + 6, w, h, 180 + angle), CLEAR, { stroke: "#ffffff", strokeWidth: 3 })];
  };
  const kernels = Array.from({ length: 12 }, (_, i) => s.card(`corn_kernel${i + 1}`, s.mid(1662 + (i % 3) * 30, 818 + Math.floor(i / 3) * 44, 22, 32), "#ffe08a", 8));
  return s.board(night, [
    ellipse("night_glow", s.mid(960, 560, 1800, 1100), "#1f3a8a", { gradient: radial("#2a4aa8", "#13235b00") }),
    path("string_upper", "M0 0.1 Q0.5 1.6 1 0.1", s.at(0, 0, 1920, 110), CLEAR, { stroke: "#ffffffcc", strokeWidth: 3 }),
    ...upper.flatMap((x, i) => [triangle(`flag_up${i + 1}`, s.mid(x, sag(x, 6, 104) + 32, 52, 64, 180 + slope(x, 6, 104)), colors[(i + 2) % colors.length])]),
    path("string_lower", "M0 0.06 Q0.5 1.94 1 0.06", s.at(0, 60, 1920, 115), CLEAR, { stroke: "#ffffffcc", strokeWidth: 3 }),
    ...lower.flatMap((x, i) => flag(`flag${i + 1}`, x, 66, 172, colors[i % colors.length], 70, 90)),
    ellipse("moon", s.mid(1690, 250, 140, 140), "#ffe9a8", { stroke: "#ffffff", strokeWidth: 3 }),
    ellipse("moon_shadow", s.mid(1730, 226, 120, 120), night),
    ...[
      [150, 300, 46],
      [1500, 400, 34],
      [380, 520, 28],
      [1780, 640, 40],
      [700, 960, 30],
    ].map(([x, y, d], i) => star(`doodle_star${i + 1}`, s.mid(x, y, d, d, i * 12), CLEAR, 5, 0.45, { stroke: "#ffffff", strokeWidth: 3 })),
    s.card("lantern_left", s.mid(190, 420, 90, 120), "#f4a261", 36, { effects: [glow("lantern_left_glow", "#ffc93c", 0.5, 30)] }),
    rect("lantern_left_band", s.mid(190, 420, 90, 14), "#e63946"),
    rect("lantern_left_string", s.mid(190, 330, 3, 60), "#ffffffb3"),
    s.card("lantern_right", s.mid(1640, 520, 80, 110), "#e63946", 32, { effects: [glow("lantern_right_glow", "#ffc93c", 0.45, 28)] }),
    rect("lantern_right_band", s.mid(1640, 520, 80, 12), "#ffc93c"),
    rect("lantern_right_string", s.mid(1640, 438, 3, 54), "#ffffffb3"),
    path("swash", "M0.02 0.1 L0.98 0 L1 0.22 L0.97 0.46 L1 0.72 L0.98 1 L0.03 0.94 L0 0.7 L0.03 0.46 L0 0.2 Z", s.at(384, 380, 1152, 230, -3, 0.92), "#ffc93c"),
    s.label("title", "Festa Junina", s.at(330, 350, 1260, 260, -3), 190, { font: "kaushan-script", weight: 400, fill: "#ffffff", align: "center", leading: 1 }, { stroke: night, strokeWidth: 8 }),
    t("subtitle", "ARRAIÁ DA VILA  ·  24 DE JUNHO", 360, 650, 1200, 56, 46, 700, "#ffc93c", "center", { letterSpacing: 0.1 }),
    t("details", "Quadrilha, quentão e pipoca a partir das 18h", 360, 724, 1200, 44, 34, 500, "#ffffff", "center"),
    s.card("log_left", s.mid(250, 1010, 260, 44, 18), "#8b5a2b", 22),
    s.card("log_right", s.mid(250, 1010, 260, 44, -18), "#a06a35", 22),
    path("flame_red", TEARDROP, s.mid(250, 870, 200, 250), "#e63946", { stroke: "#ffffff", strokeWidth: 3 }),
    path("flame_orange", TEARDROP, s.mid(250, 900, 140, 180), "#f4a261"),
    path("flame_yellow", TEARDROP, s.mid(250, 930, 80, 110), "#ffc93c"),
    ...[
      [150, 760],
      [360, 730],
      [120, 860],
      [390, 840],
    ].map(([x, y], i) => ellipse(`spark${i + 1}`, s.mid(x, y, 14, 14), "#ffc93c")),
    path("corn_husk_left", TEARDROP, s.mid(1640, 940, 90, 260, 156), "#2a9d8f"),
    path("corn_husk_right", TEARDROP, s.mid(1740, 940, 90, 260, -156), "#2a9d8f"),
    s.card("corn_body", s.mid(1692, 880, 130, 280), "#ffc93c", 65, { stroke: "#ffffff", strokeWidth: 3 }),
    ...kernels,
  ]);
}

function blackFriday(): Artboard {
  const s = sheet(1440, 560);
  const t = writer(s, "anton");
  const neon = "#d7ff1e";
  const gloss = linear("#2e2e2e", "#050505", 135);
  return s.board("#0a0a0a", [
    ellipse("lift", s.mid(1060, 300, 1100, 700), "#1e1e1e", { gradient: radial("#262626", "#0a0a0a00") }),
    rect("ticker", s.mid(1180, 300, 760, 52, -6), neon),
    s.label("ticker_text", "BLACK FRIDAY  ✱  BLACK FRIDAY  ✱  BLACK FRIDAY", s.mid(1180, 300, 740, 34, -6), 24, { font: "archivo-black", weight: 400, fill: "#0a0a0a", align: "center" }),
    t("label", "TEMPO LIMITADO  ·  27/11 A 01/12", 80, 70, 600, 30, 20, 400, "#8a8a8a", "left", { letterSpacing: 0.12 }),
    t("black_echo", "BLACK", 88, 114, 620, 170, 168, 400, CLEAR, "left", { lineHeight: 0.85, stroke: "#ffffff40", strokeWidth: 2 }),
    t("black", "BLACK", 80, 106, 620, 170, 168, 400, "#ffffff", "left", { lineHeight: 0.85 }),
    t("friday", "FRIDAY", 80, 252, 640, 170, 168, 400, CLEAR, "left", { lineHeight: 0.85, stroke: "#ffffff", strokeWidth: 3 }),
    t("discount_upto", "ATÉ", 560, 96, 520, 44, 36, 400, neon, "center", { letterSpacing: 0.2 }),
    t("discount", "70%", 520, 136, 600, 260, 250, 400, neon, "center", { lineHeight: 0.9, effects: [glow("discount_glow", neon, 0.25, 30)] }),
    ...["02 D", "14 H", "36 M", "09 S"].flatMap((value, i) => [s.card(`count${i + 1}`, s.at(80 + i * 112, 444, 100, 56), "#1c1c1c", 28, { stroke: "#ffffff1a", strokeWidth: 2 }), s.label(`count${i + 1}_text`, value, s.at(80 + i * 112, 458, 100, 30), 22, { font: "space-grotesk", weight: 700, fill: "#ffffff", align: "center" })]),
    s.card("cta", s.at(540, 444, 290, 56), neon, 16, { effects: [glow("cta_glow", neon, 0.35, 24)] }),
    s.label("cta_text", "COMPRAR AGORA", s.at(560, 458, 210, 30), 22, { font: "space-grotesk", weight: 700, fill: "#0a0a0a", align: "left" }),
    icon("cta_arrow", "arrow-right", s.at(786, 458, 28, 28), "#0a0a0a"),
    ellipse("tag_contact", s.mid(1100, 470, 240, 30), "#00000099"),
    path("tag", "M0.18 0 L1 0 L1 1 L0.18 1 L0 0.5 Z", s.mid(1100, 330, 300, 170, 20), "#1a1a1a", { gradient: gloss, stroke: "#ffffffb3", strokeWidth: 2, effects: [glow("tag_rim", neon, 0.3, 18), drop("tag_shadow", "#000000", 0.6, 0, 24, 40)] }),
    ellipse("tag_hole", s.mid(1038, 287, 26, 26), "#0a0a0a", { stroke: "#ffffff80", strokeWidth: 2 }),
    s.label("tag_percent", "%", s.mid(1120, 340, 140, 120, 20), 110, { font: "anton", weight: 400, fill: neon, align: "center", leading: 1 }),
    ellipse("gift_contact", s.mid(1330, 500, 200, 26), "#00000099"),
    s.card("gift_box", s.mid(1330, 420, 170, 150, -8), "#1a1a1a", 12, { gradient: gloss, stroke: "#ffffff80", strokeWidth: 2, effects: [drop("gift_shadow", "#000000", 0.6, 0, 18, 30)] }),
    s.card("gift_lid", s.mid(1322, 338, 196, 44, -8), "#222222", 10, { gradient: gloss, stroke: "#ffffff80", strokeWidth: 2 }),
    rect("gift_ribbon_v", s.mid(1326, 410, 26, 190, -8), neon),
    ellipse("gift_bow_left", s.mid(1290, 306, 60, 36, -28), CLEAR, { stroke: neon, strokeWidth: 8 }),
    ellipse("gift_bow_right", s.mid(1348, 300, 60, 36, 12), CLEAR, { stroke: neon, strokeWidth: 8 }),
    ellipse("sphere_chrome", s.mid(1010, 140, 64, 64), "#cfcfcf", { gradient: radial("#ffffff", "#5a5a5a", 0.35, 0.3, 0.9) }),
    ellipse("sphere_neon", s.mid(1400, 170, 40, 40), neon, { gradient: radial("#f6ffb3", "#9fbf00", 0.35, 0.3, 0.9), effects: [glow("sphere_neon_glow", neon, 0.5, 20)] }),
  ]);
}

function christmas(): Artboard {
  const s = sheet(1080, 1350);
  const t = writer(s, "dm-sans");
  const green = "#0f3b2e";
  const gold = "#d9b46a";
  const red = "#c8102e";
  const flakes: [number, number, number][] = [
    [90, 860, 26],
    [990, 900, 20],
    [160, 1210, 18],
    [940, 1240, 28],
    [520, 1290, 16],
  ];
  return s.board(green, [
    ellipse("glow", s.mid(540, 1000, 1300, 900), "#1d5a45", { gradient: radial("#1f5f49", "#0f3b2e00") }),
    ...photoIn(s.card("photo_frame", s.at(64, 64, 952, 700), "#0b2e24", 44, { effects: soft("photo_frame", "#03140f", 0.45, 30, 60) }), "ornaments", s, 0.5, 0.5),
    s.card("photo_line", s.at(88, 88, 904, 652), CLEAR, 32, { stroke: "#f3dfae99", strokeWidth: 2 }),
    ellipse("badge", s.mid(860, 760, 250, 250), red, { stroke: gold, strokeWidth: 6, effects: [drop("badge_shadow", "#03140f", 0.5, 0, 16, 30)] }),
    t("badge_top", "até", 760, 676, 200, 40, 34, 600, "#ffe9c4", "center"),
    t("badge_value", "40%", 760, 712, 200, 90, 80, 800, "#ffffff", "center"),
    t("badge_bottom", "OFF", 760, 800, 200, 40, 34, 800, "#ffe9c4", "center", { letterSpacing: 0.1 }),
    s.label("script", "Natal", s.at(64, 790, 600, 150), 140, { font: "great-vibes", weight: 400, fill: gold, align: "left", leading: 1 }),
    s.label("title", "ENCANTADO", s.at(70, 930, 700, 90), 82, { font: "dm-serif-display", weight: 400, fill: "#fff7e6", align: "left", leading: 1, spacing: 0.06 }),
    t("body", "Presentes com embrulho grátis e entrega até 23 de dezembro.", 72, 1036, 620, 96, 32, 500, "#d6e6dc", "left", { lineHeight: 1.35 }),
    s.card("cta", s.at(72, 1150, 380, 88), gold, 44, { gradient: linear("#f1d595", "#b98c3e", 90), effects: soft("cta", "#03140f", 0.4, 12, 24) }),
    t("cta_text", "Escolher presentes", 72, 1176, 380, 40, 32, 800, green, "center"),
    ...flakes.map(([x, y, d], i) => star(`flake${i + 1}`, s.mid(x, y, d, d, 0, 0.7), "#ffffff", 6, 0.3)),
    t("footer", "lojabrilho.com.br", 600, 1180, 410, 36, 28, 600, "#d6e6dc", "right"),
  ]);
}

const ARENA = { page: "#07080d", ink: "#f5f7ff", muted: "#8b90a7", blue: "#3b82f6", red: "#f43f5e", win: "#22c55e" };

function esports(): Artboard {
  const s = sheet(1920, 1080);
  const display = (id: string, value: string, left: number, top: number, w: number, h: number, px: number, fill: string, align: Layer["align"] = "center") => s.label(id, value, s.at(left, top, w, h), px, { font: "bebas-neue", weight: 400, fill, align, leading: 1 });
  const maps: [string, string, string][] = [
    ["Porto", "13 : 9", ARENA.blue],
    ["Deserto", "11 : 13", ARENA.red],
    ["Usina", "13 : 7", ARENA.blue],
  ];
  const team = (side: "a" | "b", cx: number, color: string, glyph: string, name: string, record: string): Layer[] => [
    polygon(`team_${side}_plate`, s.mid(cx, 450, 230, 230, 30), "#151826", 6, { stroke: color, strokeWidth: 6, effects: [glow(`team_${side}_rim`, color, 0.45, 30)] }),
    polygon(`team_${side}_inner`, s.mid(cx, 450, 170, 170, 30), "#0d0f18", 6),
    icon(`team_${side}_crest`, glyph, s.mid(cx, 450, 100, 100), color),
    display(`team_${side}_name`, name, cx - 300, 590, 600, 70, 64, ARENA.ink),
    s.label(`team_${side}_record`, record, s.at(cx - 200, 662, 400, 36), 28, { font: "jetbrains-mono", weight: 500, fill: ARENA.muted, align: "center" }),
  ];
  return s.board(ARENA.page, [
    s.card("card", s.at(77, 77, 1766, 926), "#12131c", 45, { gradient: linear("#12131c", "#1a1c2a", 90), effects: [drop("card_shadow", "#000000", 0.5, 0, 30, 60)] }),
    ellipse("glow_blue", s.mid(160, 450, 900, 900), ARENA.blue, { gradient: radial("#3b82f659", "#3b82f600"), clip: true }),
    ellipse("glow_red", s.mid(1760, 450, 900, 900), ARENA.red, { gradient: radial("#f43f5e59", "#f43f5e00"), clip: true }),
    rect("card_highlight", s.at(122, 79, 1676, 2), "#ffffff1a"),
    s.card("league", s.at(154, 128, 560, 56), "#ffffff0f", 13, { stroke: "#ffffff1f", strokeWidth: 2 }),
    s.label("league_text", "LIGA DE PRIMAVERA  ·  SEMANA 6", s.at(154, 140, 560, 32), 24, { font: "space-grotesk", weight: 700, fill: ARENA.ink, align: "center", spacing: 0.06 }),
    s.label("best_of", "MELHOR DE 3", s.at(760, 140, 400, 32), 24, { font: "space-grotesk", weight: 600, fill: ARENA.muted, align: "center", spacing: 0.12 }),
    s.card("live", s.at(1450, 128, 316, 56), "#f43f5e26", 13, { stroke: "#f43f5e80", strokeWidth: 2 }),
    ellipse("live_dot", s.mid(1484, 156, 16, 16), ARENA.red, { effects: [glow("live_glow", ARENA.red, 0.8, 12)] }),
    s.label("live_text", "AO VIVO  ·  MAPA 3", s.at(1504, 140, 250, 32), 24, { font: "space-grotesk", weight: 700, fill: "#ffd1da", align: "left", spacing: 0.06 }),
    ...team("a", 420, ARENA.blue, "lightning", "RAIOS DO NORTE", "8 V  ·  2 D"),
    ...team("b", 1500, ARENA.red, "fire", "FÊNIX DE FERRO", "7 V  ·  3 D"),
    s.label("vs", "VS", s.at(860, 300, 200, 40), 30, { font: "space-grotesk", weight: 700, fill: ARENA.muted, align: "center", spacing: 0.3 }),
    display("score_a", "2", 690, 350, 220, 210, 210, ARENA.ink, "right"),
    rect("score_slash", s.mid(960, 452, 8, 170, 18), ARENA.muted),
    display("score_b", "1", 1010, 350, 220, 210, 210, ARENA.muted, "left"),
    ...maps.flatMap(([name, score, color], i) => [
      s.card(`map${i + 1}`, s.at(154 + i * 546, 760, 520, 150), "#ffffff0a", 26, { stroke: "#ffffff14", strokeWidth: 2 }),
      s.card(`map${i + 1}_thumb`, s.at(176 + i * 546, 780, 110, 110), color, 19, { gradient: linear(i === 1 ? "#f59e0b" : "#14b8a6", i === 1 ? "#7c2d12" : "#1e3a8a", 135) }),
      display(`map${i + 1}_name`, name.toUpperCase(), 310 + i * 546, 784, 340, 50, 46, ARENA.ink, "left"),
      s.label(`map${i + 1}_score`, score, s.at(310 + i * 546, 838, 200, 36), 28, { font: "jetbrains-mono", weight: 500, fill: ARENA.muted, align: "left" }),
      s.card(`map${i + 1}_winner`, s.at(510 + i * 546, 854, 130, 8), color, 4),
    ]),
    s.card("odds_blue", s.at(154, 950, 935, 12), ARENA.blue, 6),
    s.card("odds_red", s.at(1089, 950, 677, 12), ARENA.red, 6),
    s.label("odds_blue_text", "58%", s.at(154, 970, 200, 30), 22, { font: "jetbrains-mono", weight: 500, fill: "#93c5fd", align: "left" }),
    s.label("odds_red_text", "42%", s.at(1566, 970, 200, 30), 22, { font: "jetbrains-mono", weight: 500, fill: "#fda4af", align: "right" }),
  ]);
}

export function stylesCorpus(): CorpusEntry[] {
  return [
    {
      id: "brutalist",
      title: "Cartaz brutalista tipográfico",
      useCase: "brutalista ou tipográfico ousado",
      sources: [source("Fonts In Use", "Òh!pera 2024 (identity and posters)", "https://fontsinuse.com/uses/63894/oh-pera-2024"), source("Figma Community", "Brutalist Poster Design", "https://www.figma.com/community/file/1256330962819721640/brutalist-poster-design")],
      intent:
        "Cartaz 50 x 70 (1400 x 2000) de manifesto em duas tintas, preto e vermelho, sobre papel cru. Grade de seis colunas com margem de 56 px e cantos sempre retos. Hierarquia: título monumental em caixa alta condensada ocupando toda a medida, com a exclamação em vermelho; bandeira vermelha com corte de flâmula e o texto em papel vazado; asterisco gigante como único ornamento; filetes pesados que formam quatro células de informação; frase de manifesto e créditos no pé. Uma família condensada (Oswald) e uma display condensada (Bebas Neue) para o título. Profundidade zero, tinta chapada. Raio 0 em tudo.",
      brief:
        "Cartaz brutalista (1400 x 2000) para a noite de micro-teatro GRITO!: 3 peças, 3 palcos, 1 noite; 14 de novembro, 20h, Estação Sul, ingressos R$ 30; frase A revolução começa no palco; realização Coletivo Grito, apoio Secretaria de Cultura, Teatro da Cidade 2026. Só preto e vermelho sobre papel cru, tipografia condensada enorme, filetes pesados, nada arredondado.",
      photos: [],
      make: brutalist,
    },
    {
      id: "luxury-hero",
      title: "Herói de perfume em luxo minimalista",
      useCase: "luxo minimalista",
      sources: [source("Figma Community", "Luxurious Perfume Website Landing Page UI Design", "https://www.figma.com/community/file/1486405752336724297/luxurious-perfume-website-landing-page-ui-design"), source("Figma Community", "Luxury Dark E-commerce UI Kit Hero", "https://www.figma.com/community/file/1561745020867016714/luxury-dark-e-commerce-ui-kit-hero")],
      intent:
        "Herói 1440 x 900 de perfumaria com margens largas de 160 px: navegação fina com logotipo serifado espaçado e filete dourado; à esquerda sobretítulo, título serifado de alto contraste em três linhas com a palavra final em itálico dourado, texto curto e botão retangular só com contorno e uma seta em linha; à direita o frasco sobre um pedestal de pedra escura, com contraluz quente difusa. Tipografia Playfair Display com Montserrat espaçada em caixa alta para a interface. Cor: preto, marfim, cinza quente e dourado. Profundidade só no frasco (brilho dourado atrás, facetas claras e escuras). Raio 0 no quadro e no botão; frasco com 18.",
      brief:
        "Herói de site (1440 x 900) para a perfumaria MAISON ALBA lançando a Coleção Nº 07, eau de parfum de 100 ml: A arte do perfume silencioso, com âmbar, figo e cedro. Botão Comprar, navegação Menu, Buscar e Sacola (0), paginação 01 / 04. Preto, marfim e dourado, serifa de alto contraste, muito respiro e o frasco iluminado por trás.",
      photos: [],
      make: luxuryHero,
    },
    {
      id: "kids-party",
      title: "Convite infantil com formas geométricas",
      useCase: "infantil e divertido",
      sources: [source("Figma Community", "Playful shapes birthday invitation", "https://www.figma.com/community/file/1498746382971241326/playful-shapes-birthday-invitation"), source("Figma Community", "Kids birthday invitation", "https://www.figma.com/community/file/1192441642142104840/kids-birthday-invitation")],
      intent:
        "Convite 5 x 7 (1500 x 2100) feito de formas geométricas grandes nas cores primárias suaves que saem pelos cantos (quarto de círculo tomate, quadrado arredondado amarelo girado, semicírculo azul, triângulo verde) e confete pequeno nas margens. Hierarquia: pílula escura com o chamado, linha do aniversariante, numeral gigante amarelo com contorno escuro grosso e sombra tomate deslocada sem desfoque, card branco com três linhas de ícone em círculo colorido e a confirmação no pé. Tipografia Fredoka arredondada. Profundidade de adesivo: sombras chapadas deslocadas. Raios: pílulas inteiras, 48 no quadrado, 30 no card.",
      brief:
        "Convite de aniversário infantil (1500 x 2100): O Léo vai fazer 5 anos! Sábado, 14 de junho, das 14h às 17h, no Parque Brincar, Rua Azul, 12. Confirme com a Ana: (11) 95555-0123. Formas geométricas coloridas e alegres, confete, um número 5 enorme e um card com os detalhes.",
      photos: [],
      make: kidsParty,
    },
    {
      id: "festa-junina",
      title: "Festa junina com bandeirinhas e fogueira",
      useCase: "datas comemorativas e sazonais",
      sources: [source("Slidesgo", "Let's Celebrate Festa Junina!", "https://slidesgo.com/theme/lets-celebrate-festa-junina"), source("Slidesgo", "Brazil's Winter Festival: Festa Junina", "https://slidesgo.com/theme/brazils-winter-festival-festa-junina")],
      intent:
        "Peça 16:9 noturna em azul profundo com ilustração chapada: dois varais de bandeirinhas que acompanham a curva do fio (as de baixo com contorno branco deslocado, efeito de traço feito à mão), lua crescente, estrelas em traço, dois balões com brilho, uma pincelada amarela de bordas irregulares girada -3 graus sob o título manuscrito branco com contorno azul, fogueira com três chamas em gota e um milho no canto oposto. Tipografia: Kaushan Script no título, Fredoka no apoio. Cor: noite #13235b, vermelho, amarelo, verde-água, laranja e rosa das bandeirinhas. Profundidade: plana, só brilhos suaves nos balões. Raios: orgânicos.",
      brief:
        "Peça 16:9 para o Arraiá da Vila, festa junina em 24 de junho: quadrilha, quentão e pipoca a partir das 18h. Noite azul com bandeirinhas coloridas, lua, balões, fogueira e milho, título Festa Junina manuscrito sobre uma pincelada amarela.",
      photos: [],
      make: festaJunina,
    },
    {
      id: "black-friday",
      title: "Banner de Black Friday com objetos brilhantes",
      useCase: "datas comemorativas e sazonais",
      sources: [source("Figma Community", "Promo Banner: Bold & Modern Sale Section", "https://www.figma.com/community/file/1512167881262314986/promo-banner-bold-modern-sale-section"), source("Figma Community", "3D object: Black Friday", "https://www.figma.com/community/file/1428577614850090114/3d-object-black-friday")],
      intent:
        "Banner largo 1440 x 560, preto sobre preto com um leve realce à direita. Esquerda: rótulo pequeno, BLACK em branco com um eco só de contorno deslocado, FRIDAY só em contorno, contagem regressiva em quatro pílulas e botão neon. Centro: o desconto gigante em neon lima com brilho, encostando em FRIDAY. Direita: faixa neon diagonal com o letreiro repetido atrás de objetos pretos brilhantes (etiqueta com %, caixa de presente com laço neon, esferas cromada e neon) com sombras de contato. Tipografia Anton condensada, Space Grotesk para os números. Raios: 16 no botão, pílulas inteiras.",
      brief:
        "Banner de site (1440 x 560) de Black Friday: até 70% de desconto, de 27/11 a 01/12, com contagem regressiva 02 D, 14 H, 36 M, 09 S e botão Comprar agora. Preto com um único neon lima, tipografia condensada enorme, objetos pretos brilhantes de etiqueta e presente.",
      photos: [],
      make: blackFriday,
    },
    {
      id: "christmas",
      title: "Promoção de Natal com foto",
      useCase: "datas comemorativas e sazonais",
      sources: [source("Figma Community", "Christmas Creative Pack: posters, banners, ads", "https://www.figma.com/community/file/1572279503476429906/christmas-creative-pack-posters-banners-ads")],
      intent:
        "Post 4:5 em verde-pinheiro: foto de enfeites num quadro arredondado de 44 px no topo com um filete dourado interno e sombra profunda; selo vermelho com aro dourado sobreposto à borda inferior da foto (terceiro plano); abaixo, Natal em caligrafia dourada sobre ENCANTADO em serifa display, texto curto, botão pílula dourado em degradê e flocos discretos. Tipografia: Great Vibes, DM Serif Display e DM Sans. Cor: verde #0f3b2e, dourado, vermelho natalino e creme. Raios: 44 na foto, 32 no filete, pílula no botão.",
      brief:
        "Post de feed 4:5 de Natal da loja Brilho: Natal encantado, até 40% off, presentes com embrulho grátis e entrega até 23 de dezembro, botão Escolher presentes, site lojabrilho.com.br. Verde-pinheiro, dourado e vermelho, com uma foto de enfeites de Natal.",
      photos: ["ornaments"],
      make: christmas,
    },
    {
      id: "esports",
      title: "Card de partida de e-sports",
      useCase: "ficha de RPG ou jogos",
      sources: [source("Dribbble", "PlayVS Team Cards and match views", "https://dribbble.com/playvs"), source("Dribbble", "Live esports tag", "https://dribbble.com/tags/live_esports")],
      intent:
        "Card 16:9 escuro de partida ao vivo com padding de 77 px: barra superior com liga, formato e chip vermelho ao vivo; dois times espelhados em placas hexagonais com aro e brilho da cor do time, nome em display condensado e campanha em mono; placar central gigante com o lado vencedor em branco e o perdedor apagado, barra diagonal; três mapas com miniatura em degradê, placar e barra do vencedor; barra de probabilidade dividida no pé. Tipografia Bebas Neue, Space Grotesk e JetBrains Mono. Cor: azul e vermelho dos times, verde de vitória, quase preto. Profundidade: brilhos laterais das cores dos times recortados pelo card, sombra larga. Raios: 45 card, 26 mapas, 13 chips.",
      brief:
        "Card de partida de e-sports (1920 x 1080) ao vivo: Liga de Primavera, semana 6, melhor de 3, mapa 3. Raios do Norte (8 V, 2 D) 2 x 1 Fênix de Ferro (7 V, 3 D). Mapas Porto 13 : 9, Deserto 11 : 13, Usina 13 : 7. Probabilidade de vitória 58% x 42%. Escuro, azul contra vermelho, tipografia condensada de jogo.",
      photos: [],
      make: esports,
    },
  ];
}
