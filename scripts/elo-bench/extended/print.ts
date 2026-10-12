import type { Artboard, Layer } from "@/lib/studio/document";

import { archPath, CLEAR, drop, ellipse, icon, inset, linear, path, polygon, rect, sheet, soft, star, writer } from "../authoring";
import { photoIn } from "../photos";
import { source, type CorpusEntry } from "./corpus";

const BLOB = "M0.18 0.12 C0.36 -0.04 0.72 0 0.9 0.16 C1.04 0.3 0.98 0.62 0.86 0.8 C0.7 1.02 0.34 1.02 0.16 0.86 C-0.02 0.7 0 0.28 0.18 0.12 Z";
const PORTAL = "M0.5 0 C0.82 0 1 0.22 1 0.5 L1 0.86 C1 0.95 0.94 1 0.86 1 L0.14 1 C0.06 1 0 0.95 0 0.86 L0 0.5 C0 0.22 0.18 0 0.5 0 Z";
const CLOUD = "M0 1 C0 0.6 0.2 0.45 0.35 0.55 C0.4 0.2 0.7 0.15 0.75 0.45 C0.9 0.35 1 0.6 1 1 Z";
const LEAF = "M0 0.5 C0.3 0 0.7 0 1 0.5 C0.7 1 0.3 1 0 0.5 Z";
const SWALLOWTAIL = "M0 0 L1 0 L1 1 L0.5 0.8 L0 1 Z";

const MENU = { paper: "#f3ede2", green: "#1e3a2f", terracotta: "#c8643b", sage: "#a8b89a", muted: "#6b6158", gold: "#e9b44c" };

function menuFull(): Artboard {
  const s = sheet(1240, 1754);
  const t = writer(s, "dm-sans");
  const item = (id: string, name: string, description: string, price: string, left: number, top: number): Layer[] => [
    t(`${id}_name`, name, left, top, 380, 34, 26, 700, MENU.green),
    s.label(`${id}_price`, price, s.at(left + 389, top, 120, 34), 26, { font: "fraunces", weight: 600, fill: MENU.terracotta, align: "right" }),
    t(`${id}_desc`, description, left, top + 38, 509, 30, 20, 400, MENU.muted),
  ];
  const section = (id: string, label: string, left: number, top: number, w: number): Layer[] => [s.card(id, s.at(left, top, w, 46), MENU.green, 23), t(`${id}_text`, label, left, top + 11, w, 26, 20, 700, MENU.paper, "center", { letterSpacing: 0.2 })];
  const starters: [string, string, string][] = [
    ["Bruschetta de tomate", "Pão de fermentação natural, tomate e manjericão", "R$ 28"],
    ["Burrata da casa", "Burrata, pesto de pistache e azeite de oliva", "R$ 46"],
    ["Carpaccio", "Lâminas de filé, alcaparras e parmesão", "R$ 42"],
    ["Polenta frita", "Com aioli de limão siciliano", "R$ 26"],
  ];
  const mains: [string, string, string][] = [
    ["Risoto de cogumelos", "Arbóreo, mix de cogumelos e trufa negra", "R$ 72"],
    ["Pizza margherita", "Fermentação de 48 horas, forno a lenha", "R$ 64"],
    ["Nhoque ao sugo", "Batata, molho de tomate pelado e grana padano", "R$ 58"],
    ["Polvo grelhado", "Batatas ao murro e páprica defumada", "R$ 98"],
    ["Tagliatelle ao ragu", "Massa fresca e ragu de costela por 8 horas", "R$ 69"],
  ];
  const desserts: [string, string, string][] = [
    ["Tiramisù", "Mascarpone, café e cacau", "R$ 32"],
    ["Panna cotta", "Calda de frutas vermelhas", "R$ 28"],
    ["Torta de limão", "Merengue maçaricado", "R$ 30"],
  ];
  const wines: [string, string, string][] = [
    ["Tinto da casa", "R$ 24", "R$ 96"],
    ["Branco da casa", "R$ 26", "R$ 104"],
    ["Espumante", "R$ 28", "R$ 118"],
  ];
  return s.board(MENU.paper, [
    path("hero_blob", BLOB, s.at(690, 70, 600, 360), MENU.terracotta),
    path("hero_blob_small", BLOB, s.at(640, 360, 124, 92, 20), MENU.sage),
    ...photoIn(ellipse("hero_plate", s.at(744, -30, 640, 640), "#e9dccb", { effects: [drop("hero_plate_shadow", "#28190a", 0.28, 12, 20, 40)] }), "pizza", s, 0.62, 0.5),
    s.label("wordmark", "CASA OLIVA", s.at(74, 54, 520, 50), 34, { font: "playfair-display", weight: 600, fill: MENU.green, align: "left", spacing: 0.15 }),
    rect("wordmark_rule", s.at(74, 124, 560, 2), "#1e3a2f66"),
    s.label("title", "MENU", s.at(66, 160, 600, 230), 250, { font: "bebas-neue", weight: 400, fill: MENU.green, align: "left", leading: 0.9 }),
    s.label("script", "da estação", s.at(300, 112, 400, 110, -6), 84, { font: "kaushan-script", weight: 400, fill: MENU.terracotta, align: "left", leading: 1 }),
    t("tagline", "Cozinha italiana de forno a lenha desde 2009", 74, 392, 560, 30, 22, 400, "#5e554b"),
    ...section("starters", "ENTRADAS", 74, 470, 190),
    ...starters.flatMap(([name, description, price], i) => item(`starter${i + 1}`, name, description, price, 74, 540 + i * 86)),
    ...section("mains", "PRINCIPAIS", 74, 900, 210),
    ...mains.flatMap(([name, description, price], i) => item(`main${i + 1}`, name, description, price, 74, 970 + i * 86)),
    s.card("featured", s.at(657, 480, 509, 440), "#ffffff", 31, { effects: soft("featured", "#1e140a", 0.15, 10, 30) }),
    ...photoIn(rect("featured_photo_frame", s.at(657, 480, 509, 273), "#d9cbb8", { clip: true }), "burger", s, 0.5, 0.45),
    s.label("featured_name", "Burger Oliva", s.at(689, 770, 445, 40), 32, { font: "fraunces", weight: 700, fill: MENU.green, align: "left" }),
    t("featured_desc", "Blend de 180 g, queijo da serra e cebola caramelizada no pão de fermentação natural.", 689, 814, 445, 56, 19, 400, MENU.muted, "left", { lineHeight: 1.35 }),
    s.label("featured_price", "R$ 58", s.at(689, 876, 200, 36), 28, { font: "fraunces", weight: 700, fill: MENU.terracotta, align: "left" }),
    star("chef_burst", s.mid(1146, 492, 150, 150, 12), MENU.gold, 14, 0.82, { effects: [drop("chef_burst_shadow", "#28190a", 0.25, 4, 8, 14)] }),
    t("chef_text", "ESCOLHA\nDO CHEF", 1086, 462, 120, 60, 19, 800, MENU.green, "center", { lineHeight: 1.05 }),
    ...section("desserts", "SOBREMESAS", 657, 970, 220),
    ...desserts.flatMap(([name, description, price], i) => item(`dessert${i + 1}`, name, description, price, 657, 1040 + i * 86)),
    ...section("drinks", "VINHOS", 657, 1310, 160),
    t("drinks_glass", "TAÇA", 925, 1322, 110, 24, 17, 700, MENU.muted, "right", { letterSpacing: 0.12 }),
    t("drinks_bottle", "GARRAFA", 1046, 1322, 120, 24, 17, 700, MENU.muted, "right", { letterSpacing: 0.12 }),
    ...wines.flatMap(([name, glass, bottle], i) => [
      t(`wine${i + 1}_name`, name, 657, 1380 + i * 56, 260, 34, 26, 700, MENU.green),
      s.label(`wine${i + 1}_glass`, glass, s.at(925, 1380 + i * 56, 110, 34), 24, { font: "fraunces", weight: 600, fill: MENU.terracotta, align: "right" }),
      s.label(`wine${i + 1}_bottle`, bottle, s.at(1046, 1380 + i * 56, 120, 34), 24, { font: "fraunces", weight: 600, fill: MENU.terracotta, align: "right" }),
    ]),
    path("doodle_leaf", LEAF, s.mid(620, 1250, 70, 32, -50), CLEAR, { stroke: "#1e3a2f59", strokeWidth: 3 }),
    path("doodle_leaf_vein", "M0 0.5 L1 0.5", s.mid(620, 1250, 70, 32, -50), CLEAR, { stroke: "#1e3a2f59", strokeWidth: 2 }),
    rect("footer_rule", s.at(74, 1630, 1092, 2), "#1e3a2f66"),
    t("footer_address", "RUA DAS OLIVEIRAS, 120", 74, 1656, 360, 28, 19, 700, MENU.green, "left", { letterSpacing: 0.08 }),
    t("footer_phone", "(11) 3333-0120", 440, 1656, 360, 28, 19, 700, MENU.green, "center", { letterSpacing: 0.08 }),
    t("footer_hours", "TER A DOM · 12H ÀS 23H", 806, 1656, 360, 28, 19, 700, MENU.green, "right", { letterSpacing: 0.08 }),
  ]);
}

const SALON = { blush: "#f4e6df", glow: "#ebd3c8", ink: "#3b2a26", rose: "#a8644b", muted: "#8a6e63", gold: "#c4a06a" };

function priceList(): Artboard {
  const s = sheet(1240, 1754);
  const t = writer(s, "poppins");
  const categories: [string, [string, string, string][], number, number][] = [
    ["CABELO", [["Corte feminino", "60 min", "R$ 140"], ["Escova modelada", "45 min", "R$ 90"], ["Coloração", "120 min", "R$ 280"]], 87, 1086],
    ["UNHAS", [["Manicure", "40 min", "R$ 45"], ["Pedicure", "50 min", "R$ 55"], ["Esmaltação em gel", "60 min", "R$ 120"]], 87, 1352],
    ["ROSTO", [["Limpeza de pele", "75 min", "R$ 180"], ["Design de sobrancelhas", "30 min", "R$ 60"], ["Máscara de argila", "40 min", "R$ 95"]], 657, 1086],
    ["CORPO", [["Massagem relaxante", "60 min", "R$ 190"], ["Drenagem linfática", "60 min", "R$ 170"], ["Esfoliação corporal", "45 min", "R$ 130"]], 657, 1352],
  ];
  return s.board(SALON.blush, [
    ellipse("glow", s.at(560, -180, 930, 960), SALON.glow),
    path("arch_outline", archPath(620, 912), s.at(118, 149, 620, 912), CLEAR, { stroke: SALON.gold, strokeWidth: 2 }),
    ...photoIn(path("arch", archPath(620, 912), s.at(87, 123, 620, 912), "#e7cfc3", { effects: [drop("arch_shadow", "#50281e", 0.18, 8, 16, 36)] }), "skincare", s, 0.5, 0.55),
    s.label("script", "Beleza", s.at(380, 900, 620, 180), 160, { font: "great-vibes", weight: 400, fill: SALON.rose, align: "left", leading: 1 }),
    ellipse("monogram_ring", s.at(1012, 56, 104, 104), CLEAR, { stroke: SALON.gold, strokeWidth: 2 }),
    s.label("monogram", "MS", s.at(1012, 84, 104, 50), 38, { font: "dm-serif-display", weight: 400, fill: SALON.ink, align: "center" }),
    t("title", "TABELA\nDE PREÇOS", 770, 196, 460, 170, 70, 600, SALON.ink, "left", { lineHeight: 1.05, letterSpacing: 0.04 }),
    t("subtitle", "spa e salão", 772, 398, 400, 34, 24, 300, SALON.ink, "left", { letterSpacing: 0.3 }),
    t("intro", "Atendimento com hora marcada, produtos veganos e um café enquanto você espera.", 772, 470, 380, 120, 22, 400, SALON.muted, "left", { lineHeight: 1.5 }),
    ...categories.flatMap(([name, rows, left, top], c) => [
      t(`cat${c + 1}`, name, left, top, 300, 32, 24, 600, SALON.ink, "left", { letterSpacing: 0.12 }),
      rect(`cat${c + 1}_rule`, s.at(left, top + 40, 54, 3), SALON.gold),
      ...rows.flatMap(([service, duration, price], r) => [
        t(`cat${c + 1}_row${r + 1}`, service, left, top + 60 + r * 64, 360, 32, 23, 400, SALON.ink),
        t(`cat${c + 1}_row${r + 1}_time`, duration, left, top + 90 + r * 64, 200, 24, 17, 400, SALON.muted),
        t(`cat${c + 1}_row${r + 1}_price`, price, left + 336, top + 66 + r * 64, 160, 32, 23, 600, SALON.rose, "right"),
        ...(r < rows.length - 1 ? [rect(`cat${c + 1}_row${r + 1}_rule`, s.at(left, top + 120 + r * 64, 496, 2), "#3b2a2626")] : []),
      ]),
    ]),
    s.card("footer", s.at(87, 1640, 1066, 72), SALON.ink, 36),
    t("footer_text", "(11) 4002-0110   ·   Rua Augusta, 900   ·   @maisonsoleil", 87, 1661, 1066, 32, 22, 500, "#f6ebe4", "center"),
  ]);
}

function posterPapercut(): Artboard {
  const s = sheet(1240, 1754);
  const t = writer(s, "dm-sans");
  const fills = ["#e9c9a8", "#dfa987", "#c9826a", "#a85e55", "#7c4148", "#4e2c3c", "#2a1b2e"];
  const portals = fills.map((fill, k) => {
    const scale = 0.88 ** k;
    return path(`portal${k + 1}`, PORTAL, s.mid(620, 824 + k * 14, 1091 * scale, 1087 * scale), fill, { effects: [drop(`portal${k + 1}_shadow`, "#1e0f14", 0.3, 0, 6, 14)] });
  });
  return s.board("#f2e8d8", [
    ...portals,
    ellipse("moon", s.mid(620, 830, 120, 120), "#f2c46d", { effects: [drop("moon_glow", "#f2c46d", 0.35, 0, 0, 40)] }),
    rect("stage", s.mid(620, 1010, 220, 5), "#f2e8d8"),
    ellipse("performer_head", s.mid(620, 950, 18, 18), "#f2e8d8"),
    s.card("performer_body", s.mid(620, 984, 22, 46), "#f2e8d8", 10),
    path("cloud_left", CLOUD, s.at(30, 1250, 440, 240), "#f2e8d8", { effects: [drop("cloud_left_shadow", "#1e0f14", 0.3, 0, -6, 14)] }),
    path("cloud_right", CLOUD, s.at(780, 1270, 440, 220), "#f2e8d8", { flipX: true, effects: [drop("cloud_right_shadow", "#1e0f14", 0.3, 0, -6, 14)] }),
    s.label("title", "LUA NOVA", s.at(74, 64, 1092, 170), 170, { font: "anton", weight: 400, fill: "#2a1b2e", align: "center", leading: 1, spacing: 0.04 }),
    t("kicker", "CONCERTO ACÚSTICO AO AR LIVRE", 74, 238, 1092, 34, 26, 600, "#7c4148", "center", { letterSpacing: 0.25 }),
    t("date", "SÁBADO, 22 DE NOVEMBRO  ·  21H", 74, 1508, 1092, 50, 40, 700, "#2a1b2e", "center"),
    t("venue", "TEATRO DO PARQUE", 74, 1562, 1092, 50, 40, 700, "#2a1b2e", "center"),
    rect("lineup_rule", s.mid(620, 1636, 200, 3), "#2a1b2e"),
    t("lineup", "MARINA SOL  ·  TRIO AURORA  ·  BANDA VENTO", 74, 1660, 1092, 34, 26, 500, "#4e2c3c", "center", { letterSpacing: 0.1 }),
  ]);
}

const CERT = { ivory: "#fbf8f1", navy: "#13233f", gold: "#c6a15b", muted: "#5c6578" };

function certificate(): Artboard {
  const s = sheet(1650, 1275);
  const t = writer(s, "montserrat");
  const corner = (id: string, left: number, top: number, rotation: number): Layer[] => [
    path(id, "M0 0 L1 0 L0 1 Z", s.at(left, top, 420, 420, rotation), CERT.navy),
    path(`${id}_gold`, "M0.875 0 L0.91 0 L0 0.91 L0 0.875 Z", s.at(left, top, 480, 480, rotation), CERT.gold),
  ];
  return s.board(CERT.ivory, [
    ...corner("corner_top", 0, 0, 0),
    ...corner("corner_bottom", 1230, 855, 180),
    rect("frame_outer", s.at(58, 58, 1534, 1159), CLEAR, { stroke: CERT.gold, strokeWidth: 3 }),
    rect("frame_guilloche", s.at(74, 74, 1502, 1127), CLEAR, { stroke: "#c6a15bb3", strokeWidth: 10, dashArray: [2, 5] }),
    rect("frame_inner", s.at(92, 92, 1466, 1091), CLEAR, { stroke: CERT.gold, strokeWidth: 2 }),
    rect("frame_hairline", s.at(104, 104, 1442, 1067), CLEAR, { stroke: CERT.navy, strokeWidth: 1.5 }),
    star("rosette_a", s.mid(825, 660, 660, 660), CLEAR, 24, 0.82, { stroke: "#c6a15b26", strokeWidth: 2 }),
    star("rosette_b", s.mid(825, 660, 560, 560, 7.5), CLEAR, 24, 0.82, { stroke: "#c6a15b26", strokeWidth: 2 }),
    icon("logo", "seal-check", s.mid(825, 160, 64, 64), CERT.navy),
    t("school", "ESCOLA HORIZONTE", 525, 204, 600, 32, 24, 500, CERT.navy, "center", { letterSpacing: 0.3 }),
    s.label("title", "CERTIFICADO", s.at(325, 246, 1000, 110), 100, { font: "cormorant-garamond", weight: 600, fill: CERT.navy, align: "center", spacing: 0.12, leading: 1 }),
    t("subtitle", "DE CONCLUSÃO", 425, 364, 800, 36, 28, 600, CERT.gold, "center", { letterSpacing: 0.4 }),
    s.label("presented", "Conferido com orgulho a", s.at(425, 432, 800, 40), 30, { font: "cormorant-garamond", weight: 500, fill: CERT.muted, align: "center", italic: true }),
    s.label("recipient", "Mariana Albuquerque", s.at(275, 470, 1100, 150), 124, { font: "great-vibes", weight: 400, fill: CERT.navy, align: "center", leading: 1 }),
    rect("recipient_rule", s.at(412, 630, 826, 2), CERT.gold),
    star("recipient_rule_left", s.mid(408, 631, 18, 18), CERT.gold, 4, 0.4),
    star("recipient_rule_right", s.mid(1242, 631, 18, 18), CERT.gold, 4, 0.4),
    s.label("course", "pela conclusão do curso Design de Interfaces Avançado,\ncom carga horária de 120 horas", s.at(325, 664, 1000, 90), 28, { font: "cormorant-garamond", weight: 500, fill: CERT.navy, align: "center", leading: 1.4 }, { runs: [{ start: 24, end: 54, fontWeight: 700 }] }),
    path("seal_tail_left", SWALLOWTAIL, s.mid(785, 1110, 64, 170, 15), CERT.navy),
    path("seal_tail_right", SWALLOWTAIL, s.mid(865, 1110, 64, 170, -15), CERT.navy),
    star("seal", s.mid(825, 990, 236, 236), CERT.gold, 40, 0.9, { gradient: linear("#f3e2a8", "#b8913f", 135, "#e8d08a"), effects: [drop("seal_shadow", CERT.navy, 0.3, 0, 6, 14)] }),
    ellipse("seal_ring", s.mid(825, 990, 178, 178), CLEAR, { stroke: "#8a6a2a", strokeWidth: 2 }),
    t("seal_text", "EXCELÊNCIA\n2026", 745, 950, 160, 60, 20, 700, "#5a4214", "center", { lineHeight: 1.2, letterSpacing: 0.1 }),
    star("seal_star", s.mid(825, 1034, 28, 28), "#5a4214", 5, 0.45),
    s.label("signature", "Paulo Reis", s.at(230, 872, 380, 80), 60, { font: "dancing-script", weight: 600, fill: CERT.navy, align: "center", leading: 1 }),
    rect("signature_line", s.at(230, 956, 380, 2), CERT.navy),
    t("signature_role", "Paulo Reis, diretor do programa", 200, 970, 440, 30, 20, 500, CERT.muted, "center"),
    s.label("date", "15 de outubro de 2026", s.at(1040, 900, 380, 50), 32, { font: "cormorant-garamond", weight: 600, fill: CERT.navy, align: "center" }),
    rect("date_line", s.at(1040, 956, 380, 2), CERT.navy),
    t("date_role", "Data de conclusão", 1010, 970, 440, 30, 20, 500, CERT.muted, "center"),
    s.label("id", "ID: EH-2026-00418", s.at(130, 1130, 360, 28), 18, { font: "ibm-plex-mono", weight: 500, fill: CERT.muted, align: "left" }),
  ]);
}

function invitation(): Artboard {
  const s = sheet(1000, 1400);
  const t = writer(s, "cormorant-garamond");
  const gold = "#b8923f";
  const ink = "#2b2a26";
  return s.board("#dfe3d8", [
    path("card", archPath(920, 1320), s.at(40, 40, 920, 1320), "#faf6ef", { effects: soft("card", "#3c4632", 0.22, 24, 60) }),
    path("foil_arch", archPath(828, 1228), s.at(86, 86, 828, 1228), CLEAR, { stroke: gold, strokeWidth: 3 }),
    path("foil_arch_inner", archPath(798, 1198), s.at(101, 101, 798, 1198), CLEAR, { stroke: "#b8923f99", strokeWidth: 1.5 }),
    ...photoIn(path("photo_arch", archPath(600, 640), s.at(200, 190, 600, 640), "#d8c7a8"), "beach", s, 0.55, 0.5),
    path("photo_keyline", archPath(600, 640), s.at(200, 190, 600, 640), CLEAR, { stroke: "#faf6ef", strokeWidth: 10 }),
    ellipse("monogram_ring", s.mid(500, 136, 70, 70), "#faf6ef", { stroke: gold, strokeWidth: 2 }),
    t("monogram", "L&R", 465, 122, 70, 30, 24, 700, gold, "center"),
    s.label("forever", "para sempre", s.at(90, 720, 820, 180), 150, { font: "great-vibes", weight: 400, fill: gold, align: "center", leading: 1 }, { effects: [drop("forever_shadow", "#2b2a26", 0.25, 0, 3, 8)] }),
    t("families", "JUNTO COM SUAS FAMÍLIAS", 150, 912, 700, 32, 22, 600, "#3e3a34", "center", { letterSpacing: 0.25 }),
    t("names", "Lara & Rafael", 120, 950, 760, 86, 70, 500, ink, "center", { runs: [{ start: 5, end: 6, fontId: "great-vibes", fill: gold }] }),
    t("date", "SÁBADO  |  14 DE JUNHO DE 2027  |  16H", 100, 1052, 800, 32, 24, 600, ink, "center", { letterSpacing: 0.08 }),
    t("venue", "Quinta das Palmeiras\nPraia do Forte, Bahia", 150, 1100, 700, 76, 28, 500, "#3e3a34", "center", { italic: true, lineHeight: 1.3 }),
    s.label("reception", "Recepção logo após a cerimônia", s.at(150, 1186, 700, 56), 40, { font: "great-vibes", weight: 400, fill: gold, align: "center" }),
    path("sprig_left", LEAF, s.mid(482, 1270, 44, 20, -30), gold),
    path("sprig_right", LEAF, s.mid(518, 1270, 44, 20, 30), gold),
  ]);
}

function businessCard(): Artboard {
  const s = sheet(1600, 1300);
  const t = writer(s, "montserrat");
  const front = s.spin(640, 420, -3);
  const back = s.spin(960, 860, 4);
  const goldFoil = linear("#cfae62", "#b48c3c", 90, "#f2e2a9");
  const blush = "#f2d9d3";
  return s.board("#e9e4dc", [
    s.card("back_card", back(0, 0, 1050, 600), blush, 30, { effects: soft("back_card", "#3a2f28", 0.2, 18, 44) }),
    s.card("back_square_left", back(-120, -40, 200, 200), CLEAR, 40, { stroke: "#c9a254", strokeWidth: 4 }),
    s.card("back_square_mid", back(0, 0, 200, 200), "#c9a254", 40, { gradient: goldFoil }),
    s.card("back_square_right", back(120, 40, 200, 200), CLEAR, 40, { stroke: "#c9a254", strokeWidth: 4 }),
    s.label("back_initials", "AM", back(0, 4, 190, 130), 116, { font: "dm-serif-display", weight: 400, fill: blush, align: "center", leading: 1 }),
    s.card("front_card", front(0, 0, 1050, 600), "#ffffff", 30, { effects: soft("front_card", "#3a2f28", 0.2, 18, 44) }),
    s.label("front_mark", "AM", front(-410, -222, 80, 44), 34, { font: "dm-serif-display", weight: 400, fill: "#b48c3c", align: "left" }),
    rect("front_line_top", front(0, -120, 903, 3), "#c9a254", { gradient: goldFoil }),
    s.label("front_name", "Ana Moreira", front(0, -44, 903, 90), 78, { font: "montserrat", weight: 600, fill: "#2e2a2a", align: "center", leading: 1 }),
    s.label("front_role", "ARQUITETA DE INTERIORES", front(0, 50, 903, 40), 28, { font: "montserrat", weight: 500, fill: "#8a8079", align: "center", spacing: 0.2 }),
    rect("front_line_bottom", front(0, 144, 903, 3), "#c9a254", { gradient: goldFoil }),
    s.label("front_contacts", "(11) 98888-0101   ·   ana@moreira.arq   ·   moreira.arq", front(0, 206, 903, 40), 28, { font: "montserrat", weight: 500, fill: "#2e2a2a", align: "center" }),
    t("caption", "Frente e verso  ·  85 x 55 mm  ·  hot stamping dourado", 100, 1196, 1400, 36, 26, 500, "#7c7268", "center"),
  ]);
}

function voucher(): Artboard {
  const s = sheet(1800, 900);
  const t = writer(s, "archivo-black");
  const yellow = "#f7c82b";
  const ink = "#111111";
  const bars = [6, 3, 9, 4, 3, 8, 5, 3, 10, 4, 6, 3, 7, 4, 9, 3, 5, 8, 3, 6, 4, 10, 3, 5, 7];
  let cursor = 160;
  const barcode = bars.map((h, i) => {
    const layer = rect(`barcode${i + 1}`, s.at(1560, cursor, 130, h), ink);
    cursor += h + 9;
    return layer;
  });
  return s.board("#ece7df", [
    s.card("body", s.at(50, 50, 1326, 800), ink, 24, { effects: [drop("body_shadow", "#2a2520", 0.3, 0, 24, 48)] }),
    ...photoIn(rect("photo_frame", s.at(730, 50, 646, 800), "#3a2e24"), "latte", s, 0.5, 0.55),
    path("band", "M0.45 0 L1 0 L0.55 1 L0 1 Z", s.at(640, 50, 180, 800), yellow),
    path("band_outline", "M0.45 0 L1 0 L0.55 1 L0 1 Z", s.at(690, 50, 180, 800), CLEAR, { stroke: "#ffffff", strokeWidth: 3 }),
    s.card("stub", s.at(1376, 50, 374, 800), yellow, 24, { effects: [drop("stub_shadow", "#2a2520", 0.3, 0, 24, 48)] }),
    path("perforation", "M0.5 0 L0.5 1", s.at(1366, 70, 20, 760), CLEAR, { stroke: "#11111199", strokeWidth: 4, dashArray: [12, 12] }),
    ellipse("notch_top", s.mid(1376, 50, 64, 64), "#ece7df"),
    ellipse("notch_bottom", s.mid(1376, 850, 64, 64), "#ece7df"),
    ellipse("discount_halo", s.mid(770, 450, 396, 396), CLEAR, { stroke: "#ffffff", strokeWidth: 2 }),
    ellipse("discount", s.mid(770, 450, 368, 368), yellow, { stroke: ink, strokeWidth: 6, effects: [drop("discount_shadow", "#000000", 0.45, 0, 10, 24)] }),
    s.label("discount_value", "30%", s.at(610, 330, 320, 170), 150, { font: "anton", weight: 400, fill: ink, align: "center", leading: 1 }),
    s.label("discount_off", "OFF", s.at(610, 498, 320, 70), 60, { font: "anton", weight: 400, fill: ink, align: "center", leading: 1, spacing: 0.12 }),
    t("title", "VALE", 110, 120, 500, 130, 116, 400, "#ffffff", "left", { lineHeight: 1 }),
    t("title_accent", "PRESENTE", 110, 246, 520, 96, 78, 400, yellow, "left", { lineHeight: 1 }),
    s.label("body_text", "Dois cafés especiais e uma fatia de bolo da casa, quando quiser.", s.at(110, 368, 420, 130), 30, { font: "dm-sans", weight: 500, fill: "#bdbdbd", align: "left", leading: 1.35 }),
    s.card("value_box", s.at(110, 520, 250, 96), CLEAR, 16, { stroke: yellow, strokeWidth: 3 }),
    s.label("value", "R$ 50", s.at(110, 538, 250, 60), 52, { font: "anton", weight: 400, fill: "#ffffff", align: "center", leading: 1 }),
    s.label("terms", "Uso único. Não cumulativo com outras promoções. Café Bússola.", s.at(110, 640, 440, 70), 24, { font: "dm-sans", weight: 400, fill: "#8a8a8a", align: "left", leading: 1.35 }),
    ...[0, 1, 2, 3].flatMap((row) => [0, 1, 2, 3, 4, 5].map((col) => ellipse(`dot${row * 6 + col + 1}`, s.mid(1010 + col * 26, 100 + row * 26, 8, 8), "#ffffff33"))),
    s.label("stub_number", "VALE Nº 000245", s.mid(1460, 450, 600, 44, -90), 34, { font: "ibm-plex-mono", weight: 600, fill: ink, align: "center" }),
    ...barcode,
    s.label("stub_valid", "VÁLIDO ATÉ 31/12/2026", s.mid(1712, 450, 600, 34, -90), 26, { font: "ibm-plex-mono", weight: 500, fill: ink, align: "center" }),
  ]);
}

function honeyLabel(): Artboard {
  const s = sheet(1200, 1200);
  const t = writer(s, "montserrat");
  const green = "#1f3b2d";
  const foil = linear("#f1dc9a", "#9c7a31", 120, "#c9a24f");
  const leaves: [number, number, number][] = [
    [470, 440, -40],
    [540, 380, -20],
    [640, 380, 20],
    [720, 430, 40],
    [420, 520, -70],
    [770, 520, 70],
  ];
  return s.board("#efe6d6", [
    polygon("label", s.mid(600, 600, 1000, 1000, 30), green, 6, { effects: soft("label", "#2b2416", 0.3, 20, 50) }),
    polygon("deboss_outer", s.mid(600, 600, 880, 880, 30), green, 6, { effects: [inset("deboss_outer_dark", "#000000", 0.45, 0, 3, 5), inset("deboss_outer_light", "#ffffff", 0.12, 0, -2, 2)] }),
    polygon("deboss_inner", s.mid(600, 600, 720, 720, 30), green, 6, { stroke: "#2a4c3a", strokeWidth: 2, effects: [inset("deboss_inner_dark", "#000000", 0.25, 0, 2, 4)] }),
    path("branch", "M0.5 1 C0.5 0.7 0.45 0.45 0.2 0.2 M0.5 0.62 C0.6 0.45 0.7 0.35 0.82 0.22", s.at(420, 300, 360, 300), CLEAR, { stroke: "#d9bd72", strokeWidth: 4, lineCap: "round" }),
    ...leaves.map(([x, y, angle], i) => path(`leaf${i + 1}`, LEAF, s.mid(x, y, 110, 60, angle), "#c9a24f", { gradient: foil })),
    ...[
      [500, 340],
      [690, 330],
      [600, 300],
    ].flatMap(([x, y], i) => [0, 1, 2].map((k) => ellipse(`blossom${i + 1}_${k + 1}`, s.mid(x + (k - 1) * 18, y + (k === 1 ? -14 : 0), 18, 18), "#f1dc9a"))),
    s.label("brand", "BOTÂNICA", s.at(250, 610, 700, 90), 82, { font: "cormorant-garamond", weight: 600, fill: "#e3c77f", align: "center", spacing: 0.2, leading: 1 }),
    rect("brand_rule", s.mid(600, 724, 120, 2), "#c9a24f"),
    t("descriptor", "MEL CRU DE FLOR DE TÍLIA", 300, 748, 600, 40, 30, 600, "#e9e2cf", "center", { letterSpacing: 0.15 }),
    t("weight", "250 g", 450, 800, 300, 36, 28, 500, "#e9e2cf", "center"),
    ellipse("bee_wing_left", s.mid(588, 866, 26, 18, -30), "#e9e2cf99"),
    ellipse("bee_wing_right", s.mid(614, 866, 26, 18, 30), "#e9e2cf99"),
    ellipse("bee_body", s.mid(601, 884, 22, 34), "#c9a24f", { gradient: foil }),
  ]);
}

export function printCorpus(): CorpusEntry[] {
  return [
    {
      id: "menu-full",
      title: "Cardápio completo de restaurante",
      useCase: "cardápio de restaurante",
      sources: [source("Creative Market", "Modern Food Menu Template (Mighty Design)", "https://creativemarket.com/Mighty-Design/291650265-Modern-Food-Menu-Template"), source("Envato Elements", "Food Menu Template (BarcelonaDesignShop)", "https://elements.envato.com/food-menu-template-W899RL")],
      intent:
        "Página A4 (1240 x 1754) em creme com margem de 74 px e duas colunas de 509 px com calha de 74. Topo: logotipo serifado espaçado, MENU em display condensada enorme com da estação em caligrafia terracota girada por cima, e um prato visto de cima num círculo que sangra pela direita sobre uma mancha orgânica terracota (dois planos atrás da foto). Seções em pílulas verde-escuras, itens com nome, preço serifado em terracota e descrição; à direita um card de destaque com foto recortada pelos cantos de 31 px e um selo estourado amarelo girado no canto; vinhos em tabela de três colunas; rabiscos de linha discretos; rodapé em três colunas. Tipografia: Bebas Neue, Kaushan Script, Playfair, Fraunces e DM Sans. Profundidade: sombra suave sob o prato e o card.",
      brief:
        "Cardápio A4 (1240 x 1754) do bistrô Casa Oliva, cozinha italiana de forno a lenha desde 2009: entradas (bruschetta R$ 28, burrata R$ 46, carpaccio R$ 42, polenta frita R$ 26), principais (risoto de cogumelos R$ 72, margherita R$ 64, nhoque ao sugo R$ 58, polvo grelhado R$ 98, tagliatelle ao ragu R$ 69), sobremesas (tiramisù R$ 32, panna cotta R$ 28, torta de limão R$ 30), vinhos em taça e garrafa e o destaque do chef Burger Oliva R$ 58. Rua das Oliveiras, 120, (11) 3333-0120, ter a dom das 12h às 23h. Use fotos de pizza e de hambúrguer.",
      photos: ["pizza", "burger"],
      make: menuFull,
    },
    {
      id: "price-list",
      title: "Tabela de preços de salão e spa",
      useCase: "tabela de preços",
      sources: [source("Envato Elements", "Salon Spa Two Sided Price List Flyer Template (nanoagency)", "https://elements.envato.com/salon-spa-two-sided-price-list-flyer-template-D2AKBWQ"), source("Fonts In Use", "Pome, Maison de coiffure", "https://fontsinuse.com/uses/74185/pome-maison-de-coiffure")],
      intent:
        "A4 (1240 x 1754) em rosa pó: foto num arco de topo semicircular com um arco só de contorno dourado deslocado atrás (dois planos), a palavra Beleza em caligrafia transbordando o canto do arco, título em caixa alta geométrica à direita com subtítulo espaçado, monograma num círculo dourado e a tabela em duas colunas com quatro categorias, cada serviço com duração em cinza e preço rosado alinhado à direita, filetes finos, e uma pílula escura de contato no pé. Tipografia: Poppins com Great Vibes. Cor: rosa pó, marrom profundo, rosa queimado e dourado. Raios: arco de raio igual à metade da largura, pílula inteira no rodapé.",
      brief:
        "Tabela de preços A4 (1240 x 1754) da Maison Soleil, spa e salão: cabelo (corte feminino R$ 140, escova R$ 90, coloração R$ 280), unhas (manicure R$ 45, pedicure R$ 55, gel R$ 120), rosto (limpeza de pele R$ 180, sobrancelhas R$ 60, máscara de argila R$ 95), corpo (massagem relaxante R$ 190, drenagem R$ 170, esfoliação R$ 130), com a duração de cada serviço. Contato (11) 4002-0110, Rua Augusta, 900, @maisonsoleil. Elegante, rosa pó e dourado, com uma foto de produto de skincare.",
      photos: ["skincare"],
      make: priceList,
    },
    {
      id: "poster-papercut",
      title: "Pôster em papel recortado com camadas",
      useCase: "flyer e pôster de evento com profundidade em camadas",
      sources: [source("moge.ai", "Layered Paper-Cut Editorial Poster", "https://moge.ai/prompt/image/2098415324424970307"), source("Envato Elements", "Techno Party Flyer, Event Poster Template vol.3 (Sao108)", "https://elements.envato.com/techno-party-flyer-event-poster-template-vol-3-EHLXVKK")],
      intent:
        "Pôster A3 (1240 x 1754) de papel recortado: sete portais em arco concêntricos, cada um 88% do anterior e 14 px mais baixo, escurecendo de areia a ameixa, cada camada com sombra curta e suave sobre a de baixo; no fundo do portal mais escuro uma lua amarela e uma silhueta minúscula num palco para dar escala; nuvens de papel em primeiro plano invadem a base do portal. O título condensado e as informações ficam no espaço negativo de cima e de baixo. Tipografia: Anton e DM Sans. Profundidade: a peça inteira é sobre planos empilhados e luz vinda de cima. Raios: arcos orgânicos.",
      brief:
        "Pôster A3 (1240 x 1754) do concerto acústico ao ar livre LUA NOVA: sábado, 22 de novembro, 21h, Teatro do Parque, com Marina Sol, Trio Aurora e Banda Vento. Estilo papel recortado com muitas camadas que formam um portal profundo, tons de areia a ameixa, uma lua no centro.",
      photos: [],
      make: posterPapercut,
    },
    {
      id: "certificate",
      title: "Certificado de conclusão",
      useCase: "certificado",
      sources: [source("Envato Elements", "Certificate Template (graphicook)", "https://elements.envato.com/certificate-template-WWLQLM5"), source("htmlcsstoimage", "Course Completion Certificate", "https://htmlcsstoimage.com/templates/details/course-completion-certificate.md")],
      intent:
        "Certificado carta deitado (1650 x 1275) em marfim: cantos com triângulos azul-marinho e uma faixa dourada paralela por cima, moldura em quatro níveis (filete dourado, faixa tracejada que sugere guilhochê, filete dourado e filete marinho), roseta em marca d'água. Eixo central: selo da escola, título serifado clássico espaçado, subtítulo dourado bem espaçado, nome em caligrafia formal sobre um filete com losangos nas pontas, texto do curso com o nome em negrito; base com assinatura e data nas laterais e um selo dourado serrilhado com fitas de rabo de andorinha no centro. Tipografia: Cormorant Garamond, Great Vibes, Dancing Script, Montserrat e IBM Plex Mono.",
      brief:
        "Certificado de conclusão (1650 x 1275) da Escola Horizonte para Mariana Albuquerque, curso Design de Interfaces Avançado com 120 horas, assinado por Paulo Reis, diretor do programa, em 15 de outubro de 2026, ID EH-2026-00418. Elegante, marinho e dourado, com selo e moldura clássica.",
      photos: [],
      make: certificate,
    },
    {
      id: "invitation",
      title: "Convite de casamento em arco",
      useCase: "convite",
      sources: [source("The Knot", "Forever Arch Foil Wedding Invitations", "https://www.theknot.com/paper/product/forever-arch-foil-wedding-invitations"), source("The Knot", "Monogram Arch Foil Wedding Invitations", "https://www.theknot.com/paper/product/monogram-arch-foil-wedding-invitations")],
      intent:
        "Convite 5 x 7 (1000 x 1400) com o próprio cartão recortado em arco sobre um fundo sálvia, sombra suave de objeto. Dois arcos de foil dourado por dentro da borda, foto num arco central com filete marfim, monograma num círculo no ápice e para sempre em caligrafia dourada atravessando a base da foto. Bloco de texto centrado: famílias em caixa alta espaçada, nomes em serifa com o & em caligrafia dourada, data com barras verticais, local em itálico, recepção em caligrafia e um raminho. Tipografia: Cormorant Garamond com Great Vibes. Cor: papel quente, dourado, tinta grafite.",
      brief:
        "Convite de casamento (1000 x 1400) de Lara & Rafael: sábado, 14 de junho de 2027, 16h, Quinta das Palmeiras, Praia do Forte, Bahia, recepção logo após a cerimônia. Formato em arco, detalhes em dourado, uma foto de praia tropical no centro e a frase para sempre em caligrafia.",
      photos: ["beach"],
      make: invitation,
    },
    {
      id: "business-card",
      title: "Cartão de visita frente e verso",
      useCase: "cartão de visita",
      sources: [source("MOO blog", "4 Gold Foil Business Card templates to shine through", "https://www.moo.com/blog/inspiration/gold-foil-templates-to-shine-through")],
      intent:
        "Mockup 1600 x 1300 com os dois lados do cartão (85 x 55) sobrepostos e girados (-3 e 4 graus) sobre papel bege, cada um com sombra suave. Frente branca: nome e cargo entre dois filetes de foil dourado, contatos abaixo e as iniciais pequenas no canto. Verso rosa pó: três quadrados arredondados em cascata diagonal, os de fora só em contorno dourado e o do meio cheio de foil com as iniciais vazadas na cor do cartão. Tipografia: Montserrat com DM Serif Display nas iniciais. Raios: 30 no cartão, 40 nos quadrados.",
      brief:
        "Cartão de visita frente e verso de Ana Moreira, arquiteta de interiores: (11) 98888-0101, ana@moreira.arq, moreira.arq. Mostre os dois lados num mockup (1600 x 1300), com hot stamping dourado; o verso rosa pó com as iniciais AM em destaque.",
      photos: [],
      make: businessCard,
    },
    {
      id: "voucher",
      title: "Vale-presente com canhoto destacável",
      useCase: "cupom e vale-presente",
      sources: [source("Envato Elements", "Voucher Gift Card Template (uicreativenet)", "https://elements.envato.com/gift-voucher-ZYYH72Q"), source("4OVER4", "Perforation service guide", "https://www.4over4.com/service/perforation")],
      intent:
        "Vale 8,5 x 4 (cartão de 1700 x 800 num fundo bege de 1800 x 900): corpo preto assimétrico com texto à esquerda, foto de café no terço direito cortada por uma faixa amarela inclinada e um contorno branco deslocado (dois planos), um círculo amarelo de desconto com aro preto e halo branco sobre a emenda, e um canhoto amarelo separado por uma linha picotada com recortes semicirculares em cima e embaixo, com número, código de barras e validade girados. Tipografia: Archivo Black e Anton nos títulos, DM Sans e IBM Plex Mono no apoio. Cor: preto e amarelo. Profundidade: sombra do círculo e do cartão.",
      brief:
        "Vale-presente (1800 x 900) do Café Bússola: R$ 50 para dois cafés especiais e uma fatia de bolo, 30% off, uso único e não cumulativo, vale nº 000245, válido até 31/12/2026, com canhoto destacável e uma foto de café gelado. Preto e amarelo, assimétrico.",
      photos: ["latte"],
      make: voucher,
    },
    {
      id: "honey-label",
      title: "Rótulo hexagonal de mel",
      useCase: "embalagem ou rótulo",
      sources: [source("World Brand Design Society", "The Botanic, luxury packaging design for natural raw honey", "https://worldbranddesign.com/luxury-packaging-design-for-natural-raw-honey/"), source("Packaging of the World", "The Botanic", "https://packagingoftheworld.com/2019/10/the-botanic.html")],
      intent:
        "Rótulo hexagonal de favo (1200 x 1200, rótulo de 1000 px sobre fundo creme) em papel verde-floresta: dois níveis de baixo-relevo feitos com sombras internas, um ramo de tília em foil dourado com folhas em degradê e flores, marca serifada espaçada em dourado, filete, descritor em caixa alta creme como serigrafia fosca, peso e uma abelha dourada no vértice de baixo. Tipografia: Cormorant Garamond e Montserrat. Cor: verde #1f3b2d, ouro em três paradas, creme. Profundidade: relevo para dentro e sombra suave do rótulo.",
      brief:
        "Rótulo hexagonal (1200 x 1200) para o mel cru de flor de tília BOTÂNICA, 250 g. Luxo natural: papel verde-escuro, ilustração botânica em dourado, baixo-relevo e uma pequena abelha.",
      photos: [],
      make: honeyLabel,
    },
  ];
}
