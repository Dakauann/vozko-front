import type { Artboard, Layer } from "@/lib/studio/document";

import { CLEAR, drop, ellipse, icon, inset, linear, radial, rect, sheet, soft, triangle, writer, type Sheet } from "../authoring";
import type { CorpusEntry } from "../extended/corpus";
import { photoIn } from "../photos";
import { dribbble, line, vector } from "./kit";

const LILAC = "#d4b9ff";
const VIOLET = "#b98dff";
const PLUM = "#1d1031";

function sunriseMark(s: Sheet, id: string, left: number, top: number, size: number, fill: string): Layer[] {
  const u = size / 120;
  const x = (v: number) => left + v * u;
  const y = (v: number) => top + v * u;
  return [
    vector(s, `${id}_sun`, `M${x(0)} ${y(66)} A${60 * u} ${60 * u} 0 0 1 ${x(120)} ${y(66)} Z`, fill, {}, [x(0), y(6), 120 * u, 60 * u]),
    s.card(`${id}_bar`, s.at(x(0), y(78), 120 * u, 18 * u), fill, 9 * u),
    s.card(`${id}_bar_short`, s.at(x(24), y(102), 72 * u, 18 * u), fill, 9 * u),
  ];
}

function ring(s: Sheet, id: string, cx: number, cy: number, inner: number, outer: number, stroke: string, opacity = 1): Layer {
  const r = (inner + outer) / 2;
  return ellipse(id, s.mid(cx, cy, 2 * r, 2 * r, 0, opacity), CLEAR, { stroke, strokeWidth: outer - inner });
}

function bannerFrame(s: Sheet, fill: string): Layer {
  return s.card("frame", s.at(0, 0, s.width, s.height), fill, 22);
}

export function bannerRings(): Artboard {
  const s = sheet(600, 1720);
  const sans = writer(s, "inter");
  const bands: [number, number, number][] = [
    [106, 131, 1],
    [143, 166, 1],
    [181, 205, 1],
    [218, 236, 1],
    [256, 271, 1],
    [293, 307, 1],
    [331, 341, 1],
    [368, 376, 1],
    [405, 412, 0.95],
    [443, 446, 0.85],
    [480, 482, 0.7],
    [516, 518, 0.45],
  ];
  return s.board("#ffffff", [
    bannerFrame(s, LILAC),
    ...bands.map(([inner, outer, opacity], i) => ring(s, `ring${i}`, 300, 1080, inner, outer, VIOLET, opacity)),
    ...sunriseMark(s, "mark", 242, 1022, 116, "#ffffff"),
    sans("headline", "Um lar\nmelhor\npara o\ncapital da\nempresa.", 58, 74, 520, 460, 88, 300, "#231538", "left", { lineHeight: 0.92, letterSpacing: -0.03 }),
    sans("wordmark", "alvorada", 40, 1548, 520, 120, 118, 500, "#020202", "center", { letterSpacing: -0.04, lineHeight: 1 }),
  ]);
}

export function bannerCircles(): Artboard {
  const s = sheet(600, 1720);
  const sans = writer(s, "inter");
  const centers: [number, number][] = [175, 425].flatMap((cx) => [1177, 1441, 1705].map((cy) => [cx, cy] as [number, number]));
  return s.board("#ffffff", [
    bannerFrame(s, PLUM),
    ...centers.map(([cx, cy], i) => ellipse(`circle${i}`, s.mid(cx, cy, 500, 500), CLEAR, { stroke: "#ad8dde", strokeWidth: 3 })),
    ...sunriseMark(s, "mark", 78, 80, 78, "#ffffff"),
    sans("wordmark", "alvorada", 170, 66, 420, 100, 90, 500, "#ffffff", "left", { letterSpacing: -0.04, lineHeight: 1 }),
    sans("headline", "Invista\ne comece\na render.", 58, 504, 540, 380, 106, 300, "#d9c2ff", "left", { lineHeight: 1.0, letterSpacing: -0.03 }),
  ]);
}

export function bannerArcs(): Artboard {
  const s = sheet(600, 1720);
  const sans = writer(s, "inter");
  const bands: [number, number, number][] = [
    [283, 356, 1],
    [379, 434, 1],
    [453, 500, 1],
    [525, 561, 1],
    [596, 619, 1],
    [641, 656, 1],
    [686, 694, 1],
    [728, 734, 0.95],
    [771, 774, 0.9],
    [812, 815, 0.8],
    [853, 855, 0.6],
  ];
  return s.board("#ffffff", [
    bannerFrame(s, "#ffffff"),
    ellipse("sun_disc", s.mid(300, 1726, 548, 548), LILAC),
    ...bands.map(([inner, outer, opacity], i) => ring(s, `arc${i}`, 300, 1726, inner, outer, LILAC, opacity)),
    ...sunriseMark(s, "mark", 244, 1548, 100, "#000000"),
    sans("wordmark", "alvorada", 60, 56, 480, 100, 88, 500, "#000000", "center", { letterSpacing: -0.04, lineHeight: 1 }),
    sans("headline", "Faça seu\ndinheiro\nparado\nrender.", 40, 430, 520, 420, 90, 400, "#000000", "center", { lineHeight: 0.98, letterSpacing: -0.03 }),
  ]);
}

export function realEstateHero(): Artboard {
  const s = sheet(1440, 1130);
  const t = writer(s, "manrope");
  const ink = "#111111";
  const gray = "#8d8f91";
  const hair = "#e3e3e3";
  const outline = (id: string, left: number, top: number, w: number, h: number, fill = CLEAR, stroke = "#d6d6d6") => s.card(id, s.at(left, top, w, h), fill, h / 2, { stroke, strokeWidth: 1.2 });
  const nav: [string, number, number][] = [
    ["Apartamentos", 374, 130],
    ["Casas", 532, 60],
    ["Comercial", 604, 96],
    ["Aluguel", 716, 76],
    ["Sobre", 842, 60],
    ["Contato", 918, 80],
  ];
  const fields: [string, string, number, number][] = [
    ["Localização", "São Paulo, SP", 56, 250],
    ["Tipo de imóvel", "Apartamentos", 317, 250],
    ["Preço", "R$ 2 mi a R$ 13 mi", 577, 250],
    ["Quartos", "3 a 5", 837, 250],
  ];
  const stats: [string, string, number][] = [
    ["4", "quartos", 1057],
    ["3", "banheiros", 1166],
    ["173", "m²", 1276],
  ];
  const fx = (i: number) => fields[i][2] + 22;
  return s.board("#ffffff", [
    rect("sky", s.at(0, 0, 1440, 842), CLEAR, { gradient: linear("#fff2e2", "#dcecf7", 12, "#eeeeea") }),
    t("logo", "Habitar", 40, 24, 200, 40, 30, 500, ink, "left", { letterSpacing: -0.02 }),
    ...nav.map(([label, left, w], i) => t(`nav${i}`, label, left, 30, w + 20, 26, 18, 500, "#1d1d1d", "left")),
    ellipse("nav_dot", s.mid(818, 44, 4, 4), ink),
    outline("currency", 1222, 20, 84, 42, CLEAR, "#1d1d1d"),
    t("currency_label", "BRL", 1238, 30, 50, 24, 16, 500, ink, "left"),
    line(s, "currency_chev", "M1280 39 L1285 44 L1290 39", ink, 1.6),
    s.card("login", s.at(1319, 20, 80, 42), ink, 21),
    t("login_label", "Entrar", 1319, 30, 80, 24, 16, 500, "#ffffff", "center"),
    t("headline", "Imóveis para viver e para investir", 38, 94, 1100, 70, 54, 500, ink, "left", { letterSpacing: -0.015, lineHeight: 1 }),
    ...photoIn(s.card("villa", s.at(40, 186, 980, 501), "#cfd8dc", 22), "villa", s, 0.5, 0.55),
    s.card("details", s.at(1033, 186, 366, 501), "#ffffff", 22),
    t("address", "R. das Acácias, 201,\nSão Paulo, SP 01452", 1057, 210, 270, 50, 17, 400, "#222222", "left", { lineHeight: 1.35, letterSpacing: -0.01 }),
    vector(s, "bookmark", "M1347 223 L1365 223 L1365 243 L1356 237 L1347 243 Z", CLEAR, { stroke: ink, strokeWidth: 1.6, lineJoin: "round" }),
    rect("bookmark_line", s.at(1351, 229, 10, 1.6), ink),
    ...stats.flatMap(([value, unit, left], i) => [t(`stat${i}`, value, left - 2, 282, 110, 38, 30, 500, ink, "left", { letterSpacing: -0.02 }), t(`stat${i}_unit`, unit, left, 320, 110, 24, 17, 400, "#3a3a3a", "left")]),
    t("price", "R$ 8.250.000", 1056, 366, 170, 36, 25, 600, ink, "left", { letterSpacing: -0.02 }),
    outline("split", 1232, 368, 143, 34),
    t("split_label", "Parcelamento", 1246, 376, 110, 20, 14, 500, ink, "left"),
    line(s, "split_chev", "M1356 381 L1360 385 L1356 389", ink, 1.4),
    s.card("agent", s.at(1057, 428, 318, 150), "#f6f6f6", 16),
    ellipse("agent_avatar", s.mid(1105, 476, 50, 50), "#ded3c8"),
    t("agent_initial", "M", 1080, 461, 50, 30, 20, 600, "#5b4636", "center"),
    t("agent_role", "Corretora", 1276, 453, 80, 20, 14, 400, "#b8b9ba", "right"),
    t("agent_name", "Marina\nAlves Costa", 1081, 512, 140, 46, 16, 500, "#1d1d1d", "left", { lineHeight: 1.3 }),
    outline("contact", 1222, 520, 129, 34, "#ffffff"),
    t("contact_label", "Contato", 1222, 528, 129, 20, 15, 500, ink, "center"),
    s.card("tour", s.at(1057, 603, 318, 60), "#181818", 30),
    t("tour_label", "Agendar visita", 1057, 612, 318, 26, 19, 500, "#ffffff", "center"),
    t("tour_hint", "A partir de amanhã, 11:00", 1057, 637, 318, 18, 12, 400, "#d8d8d8", "center"),
    s.card("search", s.at(40, 708, 1359, 92), "#ffffff", 20),
    ...fields.flatMap(([label, value, left, w], i) => [outline(`field${i}`, left, 726, w, 60, CLEAR, hair), t(`field${i}_label`, label, left + 62, 734, 170, 18, 14, 400, i === 0 ? gray : "#3a3a3a", "left"), t(`field${i}_value`, value, left + 62, 752, 186, 26, i === 0 ? 17 : 19, 500, i === 0 ? "#2a2a2a" : ink, "left", { letterSpacing: -0.01 })]),
    icon("pin", "map-pin", s.at(fx(0), 742, 24, 26), "#2a2a2a"),
    vector(s, "building", `M${fx(1) - 2} 766 L${fx(1) - 2} 744 L${fx(1) + 12} 744 L${fx(1) + 12} 766 M${fx(1) + 12} 752 L${fx(1) + 24} 752 L${fx(1) + 24} 766 M${fx(1) - 6} 766 L${fx(1) + 28} 766`, CLEAR, { stroke: "#2a2a2a", strokeWidth: 1.6, lineJoin: "round" }),
    ...[0, 1].flatMap((r) => [0, 1].map((c) => rect(`building_win${r}${c}`, s.at(fx(1) + 2 + c * 5, 749 + r * 6, 2.5, 2.5), "#2a2a2a"))),
    t("currency_icon", "$", fx(2) - 2, 740, 24, 30, 24, 400, "#2a2a2a", "center"),
    line(s, "expand", `M${fx(3)} 752 L${fx(3)} 744 L${fx(3) + 8} 744 M${fx(3) + 16} 744 L${fx(3) + 24} 744 L${fx(3) + 24} 752 M${fx(3) + 24} 760 L${fx(3) + 24} 768 L${fx(3) + 16} 768 M${fx(3) + 8} 768 L${fx(3)} 768 L${fx(3)} 760`, "#2a2a2a", 1.6),
    outline("more", 1097, 726, 116, 60, CLEAR, hair),
    ...[0, 1, 2].flatMap((i) => [rect(`slider${i}`, s.at(1119 + i * 8, 744, 1.6, 24), "#2a2a2a"), rect(`slider${i}_knob`, s.at(1116 + i * 8, [758, 748, 754][i], 7.6, 2.4), "#2a2a2a")]),
    t("more_label", "Mais", 1155, 746, 50, 20, 14, 500, "#3a3a3a", "left"),
    s.card("search_button", s.at(1222, 725, 162, 60), "#111111", 30),
    t("search_label", "Buscar", 1222, 742, 162, 26, 18, 500, "#ffffff", "center"),
    t("latest", "Novidades na sua região", 38, 892, 900, 66, 50, 500, ink, "left", { letterSpacing: -0.015, lineHeight: 1 }),
    outline("view_all", 1268, 902, 131, 34),
    t("view_all_label", "Ver todos", 1284, 910, 90, 20, 15, 500, ink, "left"),
    line(s, "view_all_chev", "M1373 915 L1377 919 L1373 923", ink, 1.4),
    ...photoIn(s.card("room_a", s.at(40, 987, 310, 183), "#eeeeee", 20), "roomBright", s, 0.5, 0.35),
    ...photoIn(s.card("room_b", s.at(365, 987, 309, 183), "#eeeeee", 20), "roomChairs", s, 0.5, 0.3),
    ...photoIn(s.card("room_c", s.at(690, 987, 710, 183), "#eeeeee", 20), "living", s, 0.5, 0.35),
  ]);
}

export function darkDashboard(): Artboard {
  const s = sheet(1440, 1014);
  const t = writer(s, "plus-jakarta-sans");
  const display = writer(s, "anton");
  const lime = "#b8ff66";
  const orange = "#ff9b22";
  const panel = "#1f1f1f";
  const white = "#ffffff";
  const pill = (id: string, left: number, top: number, w: number, h: number, fill = panel) => s.card(id, s.at(left, top, w, h), fill, h / 2);
  const disc = (id: string, cx: number, cy: number, r: number, fill: string) => ellipse(id, s.mid(cx, cy, 2 * r, 2 * r), fill);
  const ringDot = (id: string, cx: number, cy: number, color: string) => ellipse(id, s.mid(cx, cy, 13, 13), panel, { stroke: color, strokeWidth: 3.5 });
  const dots = (id: string, cx: number, cy: number) => [0, 1, 2].map((i) => disc(`${id}${i}`, cx - 7 + i * 7, cy, 1.6, white));
  const navs: [string, string, number, number][] = [
    ["Painel", "package", 143, 179],
    ["Monitoramento", "target", 337, 196],
    ["Suporte", "chat-circle", 548, 152],
  ];
  const filters: [string, string, number, number][] = [
    ["Data:", "Hoje", 803, 148],
    ["Produto:", "Todos", 966, 180],
    ["Perfil:", "Rafael", 1158, 168],
  ];
  const side: [string, number][] = [
    ["heart", 290],
    ["calendar", 372],
    ["star", 453],
    ["bell", 534],
  ];
  const palette = [lime, orange, white];
  const matrix: Layer[] = [];
  for (let c = 0; c < 13; c += 1) {
    for (let r = 0; r < 3; r += 1) {
      const k = (c * 7 + r * 3) % 5;
      if (k === 4) continue;
      matrix.push(disc(`dot${c}_${r}`, 488 + c * 21.2, 495 + r * 21, 5, palette[k % 3]));
    }
  }
  const lifts: [number, number][] = [
    [530, 474],
    [658, 474],
    [721, 474],
    [743, 452],
    [743, 474],
  ];
  const candles: [number, number, number, string, string, number, number, string, string, string][] = [
    [202, 700, 763, white, "52", 790, 852, orange, "81", lime],
    [265, 714, 798, lime, "96", 825, 860, orange, "25", white],
    [328, 709, 764, lime, "48", 790, 843, white, "51", orange],
    [390, 697, 765, lime, "80", 791, 835, orange, "49", white],
    [453, 701, 740, orange, "34", 766, 825, lime, "67", white],
    [516, 669, 757, lime, "92", 783, 836, white, "28", orange],
    [579, 722, 775, lime, "58", 801, 855, orange, "20", white],
    [642, 680, 767, orange, "84", 794, 852, lime, "39", white],
    [704, 713, 751, white, "36", 778, 838, orange, "72", lime],
  ];
  const ticks = [0, 5, 10, 15, 20, 25, 30];
  const tickX = (v: number) => 924 + (v * (1350 - 924)) / 30;
  const dates = ["30.09", "29.09", "28.09", "27.09", "26.09", "25.09", "24.09"];
  const bars: [number, number, number, string, string, string[] | string][] = [
    [925, 1097, 367, lime, "16", "globe"],
    [1160, 1350, 426, orange, "29", "star"],
    [960, 1160, 486, white, "15", ["A", "L", "J"]],
    [997, 1207, 544, lime, "21", "heart"],
    [922, 1047, 603, white, "10", "chat-circle"],
    [998, 1122, 662, orange, "15", "camera"],
    [1067, 1326, 720, lime, "19", ["C", "M", "P", "T"]],
    [1033, 1158, 779, white, "8", "bell"],
  ];
  const tints = ["#d9c7b8", "#b9c9d8", "#cfd8b0", "#e0b9b0"];
  return s.board("#c1dda2", [
    s.card("frame", s.at(0, 0, 1440, 1014), "#000000", 40),
    disc("logo", 70, 71, 30, white),
    icon("logo_mark", "sparkle", s.mid(70, 71, 32, 32), "#000000"),
    ...navs.flatMap(([label, glyph, left, w], i) => [pill(`nav${i}`, left, 42, w, 59), icon(`nav${i}_icon`, glyph, s.at(left + 31, 59, 25, 25), white), t(`nav${i}_label`, label, left + 67, 59, w - 70, 26, 16, 600, white, "left")]),
    disc("search", 735, 71, 30, panel),
    ellipse("search_lens", s.mid(733, 69, 17, 17), CLEAR, { stroke: white, strokeWidth: 2 }),
    line(s, "search_handle", "M740 76 L746 82", white, 2.2),
    t("user_name", "Rafael Moura", 1110, 58, 213, 24, 16, 700, white, "right"),
    t("user_handle", "@rmoura", 1150, 83, 173, 22, 15, 500, "#7b7b7b", "right"),
    disc("avatar", 1371, 84, 27, "#d9c7b8"),
    t("avatar_initials", "RM", 1344, 72, 54, 26, 17, 700, "#3d2f25", "center"),
    disc("badge", 1394, 57, 10, "#e5332a"),
    t("badge_count", "2", 1384, 49, 20, 16, 11, 700, white, "center"),
    ...side.flatMap(([glyph, cy], i) => [disc(`side${i}`, 70, cy, 30, panel), icon(`side${i}_icon`, glyph, s.mid(70, cy, 24, 24), white)]),
    disc("add", 70, 943, 30, panel),
    rect("add_h", s.at(59, 942, 22, 2.2), white),
    rect("add_v", s.at(69, 932, 2.2, 22), white),
    display("title", "VISÃO GERAL", 143, 168, 400, 60, 46, 400, white, "left", { lineHeight: 1 }),
    ...filters.flatMap(([label, value, left, w], i) => [
      pill(`filter${i}`, left, 163, w, 59),
      t(`filter${i}_text`, `${label} ${value}`, left + 20, 182, w - 46, 24, 15, 600, white, "left", { runs: [{ start: 0, end: label.length, fill: "#8d8d8d" }] }),
      line(s, `filter${i}_chev`, `M${left + w - 34} 189 L${left + w - 28} 195 L${left + w - 22} 189`, white, 1.8),
    ]),
    disc("toggle", 1369, 192, 30, panel),
    s.card("toggle_top", s.at(1357, 183, 24, 9), CLEAR, 4.5, { stroke: white, strokeWidth: 1.8 }),
    s.card("toggle_bottom", s.at(1357, 194, 24, 9), CLEAR, 4.5, { stroke: white, strokeWidth: 1.8 }),
    disc("toggle_knob_a", 1376, 187.5, 2.4, white),
    disc("toggle_knob_b", 1362, 198.5, 2.4, white),
    s.card("customer", s.at(145, 262, 292, 295), panel, 30),
    display("customer_title", "CLIENTES", 175, 296, 200, 26, 20, 400, white, "left", { lineHeight: 1, letterSpacing: 0.03 }),
    ...dots("customer_more", 392, 305),
    triangle("customer_up", s.mid(184, 355, 13, 11), lime),
    triangle("customer_down", s.mid(333, 355, 13, 11, 180), orange),
    display("customer_kpi_a", "2,4%", 174, 366, 130, 52, 44, 400, white, "left", { lineHeight: 1 }),
    t("customer_label_a", "Navegação", 175, 419, 120, 18, 12, 700, white, "left"),
    display("customer_kpi_b", "1,1%", 321, 366, 110, 52, 44, 400, white, "left", { lineHeight: 1 }),
    t("customer_label_b", "Rádio", 323, 419, 110, 18, 12, 700, white, "left"),
    line(s, "customer_lime", "M145 508 L180 505 L215 510 L250 500 L285 492 L320 497 L350 487 L400 495 L420 510 L437 498", lime, 2),
    line(s, "customer_orange", "M145 485 L170 482 L180 512 L235 540 L278 470 L325 517 L370 483 L400 490 L415 505 L437 515", orange, 2),
    s.card("product", s.at(468, 262, 295, 295), panel, 30),
    display("product_title", "PRODUTO", 500, 296, 200, 26, 20, 400, white, "left", { lineHeight: 1, letterSpacing: 0.03 }),
    ...dots("product_more", 719, 305),
    triangle("product_up", s.mid(510, 355, 13, 11), lime),
    triangle("product_down", s.mid(649, 355, 13, 11, 180), orange),
    display("product_kpi_a", "2,8%", 499, 366, 130, 52, 44, 400, white, "left", { lineHeight: 1 }),
    t("product_label_a", "Parceiros", 500, 419, 120, 18, 12, 700, white, "left"),
    display("product_kpi_b", "3,2%", 639, 366, 120, 52, 44, 400, white, "left", { lineHeight: 1 }),
    t("product_label_b", "Donos", 640, 419, 110, 18, 12, 700, white, "left"),
    ...matrix,
    ...lifts.map(([cx, cy], i) => disc(`lift${i}`, cx, cy, 5, i % 2 === 0 ? white : lime)),
    s.card("candles", s.at(145, 590, 618, 382), panel, 30),
    display("candles_title", "PRODUTOS", 183, 624, 200, 26, 20, 400, white, "left", { lineHeight: 1, letterSpacing: 0.03 }),
    ...dots("candles_more", 711, 635),
    ...candles.flatMap(([cx, topA, botA, fillA, labelA, topB, botB, fillB, labelB, dotFill], i) => [
      rect(`candle${i}_stem`, s.at(cx - 0.75, 670 + (i % 3) * 12, 1.5, 210 - (i % 2) * 20), "#3e3e3e"),
      pill(`candle${i}_top`, cx - 19, topA, 38, botA - topA, fillA),
      t(`candle${i}_top_label`, labelA, cx - 19, (topA + botA) / 2 - 8, 38, 16, 10, 700, "#3a3a3a", "center"),
      disc(`candle${i}_dot`, cx, (botA + topB) / 2, 6, dotFill),
      pill(`candle${i}_bottom`, cx - 19, topB, 38, botB - topB, fillB),
      t(`candle${i}_bottom_label`, labelB, cx - 19, (topB + botB) / 2 - 8, 38, 16, 10, 700, "#3a3a3a", "center"),
    ]),
    ringDot("legend_resources", 189, 924, white),
    t("legend_resources_label", "Recursos", 210, 914, 100, 22, 14, 600, white, "left"),
    ringDot("legend_valid", 318, 924, lime),
    t("legend_valid_label", "Válidos", 339, 914, 80, 22, 14, 600, white, "left"),
    ringDot("legend_invalid", 412, 924, orange),
    t("legend_invalid_label", "Inválidos", 433, 914, 100, 22, 14, 600, white, "left"),
    t("candles_total", "Total: 1.012", 583, 914, 140, 22, 14, 600, white, "right", { runs: [{ start: 0, end: 6, fill: "#7b7b7b" }] }),
    s.card("timeline", s.at(803, 262, 595, 710), panel, 30),
    display("timeline_title", "LINHA DO TEMPO", 845, 296, 300, 26, 20, 400, white, "left", { lineHeight: 1, letterSpacing: 0.03 }),
    ...dots("timeline_more", 1346, 307),
    ...ticks.map((v, i) => rect(`grid${i}`, s.at(tickX(v) - 0.75, 352, 1.5, 490), "#343434")),
    ...ticks.map((v, i) => t(`tick${i}`, String(v), tickX(v) - 20, 856, 40, 20, 13, 700, white, "center")),
    ...dates.map((d, i) => t(`date${i}`, d, 845, 383 + i * 66, 60, 20, 13, 700, white, "left")),
    ...bars.flatMap(([from, to, top, fill, value, mark], i) => [
      pill(`bar${i}`, from, top, to - from, 38, fill),
      t(`bar${i}_value`, value, to - 46, top + 11, 26, 16, 10, 700, "#3a3a3a", "center"),
      ...(typeof mark === "string"
        ? [disc(`bar${i}_badge`, from + 19, top + 19, 14, panel), icon(`bar${i}_icon`, mark, s.mid(from + 19, top + 19, 16, 16), white)]
        : mark.flatMap((letter, k) => [disc(`bar${i}_person${k}`, from + 19 + k * 29, top + 19, 13, tints[k % tints.length]), t(`bar${i}_person${k}_initial`, letter, from + 6 + k * 29, top + 11, 26, 16, 11, 700, "#2b2b2b", "center")])),
    ]),
    ringDot("legend_customer", 852, 924, lime),
    t("legend_customer_label", "Clientes", 872, 914, 90, 22, 14, 600, white, "left"),
    ringDot("legend_product", 976, 924, orange),
    t("legend_product_label", "Produto", 997, 914, 90, 22, 14, 600, white, "left"),
    ringDot("legend_web", 1089, 924, white),
    t("legend_web_label", "Web", 1110, 914, 60, 22, 14, 600, white, "left"),
    t("timeline_total", "Total: 284", 1218, 914, 140, 22, 14, 600, white, "right", { runs: [{ start: 0, end: 6, fill: "#7b7b7b" }] }),
  ]);
}

function leaf(s: Sheet, id: string, bx: number, by: number, tx: number, ty: number, width: number, fill: string, extra: Partial<Layer> = {}): Layer {
  const dx = tx - bx;
  const dy = ty - by;
  const len = Math.hypot(dx, dy);
  const nx = (-dy / len) * width;
  const ny = (dx / len) * width;
  const p = (along: number, side: number) => `${(bx + dx * along + nx * side).toFixed(1)} ${(by + dy * along + ny * side).toFixed(1)}`;
  return vector(s, id, `M${bx} ${by} C${p(0.2, 1)} ${p(0.7, 0.9)} ${tx} ${ty} C${p(0.7, -0.9)} ${p(0.2, -1)} ${bx} ${by} Z`, fill, extra);
}

export function blueprintHero(): Artboard {
  const s = sheet(1600, 1200);
  const indigo = "#554cf6";
  const teal = "#3fe0dc";
  const paper = "#f0f0ff";
  const brand = writer(s, "fredoka");
  const tilt = s.spin(828, 607, 11.7);
  const slab = (id: string, left: number, top: number, w: number, h: number, fill: string, r = 26, extra: Partial<Layer> = {}) => s.card(id, s.at(left, top, w, h), fill, r, extra);
  const disc = (id: string, cx: number, cy: number, r: number, fill: string, extra: Partial<Layer> = {}) => ellipse(id, s.mid(cx, cy, 2 * r, 2 * r), fill, extra);
  const leaflets: [number, number, number, number][] = [
    [1380, 1000, 1350, 975],
    [1395, 985, 1372, 940],
    [1410, 965, 1405, 925],
    [1425, 950, 1450, 915],
    [1440, 935, 1470, 905],
    [1405, 1010, 1440, 995],
    [1425, 990, 1465, 975],
    [1445, 970, 1490, 945],
  ];
  return s.board("#6e7bfd", [
    rect("wall", s.at(0, 0, 1600, 1200), CLEAR, { gradient: linear("#6b78fd", "#7f92f8", 90) }),
    rect("floor", s.at(0, 1020, 1600, 180), CLEAR, { gradient: linear("#7a8cfb", "#8a9dfa", 90, "#8496fa") }),
    s.card("window_shadow", s.at(210, 200, 1215, 830), "#3d3fb8", 32, { effects: [drop("window_shadow_blur", "#2f2fa0", 0.45, 0, 30, 60)] }),
    s.card("window", s.at(190, 160, 1235, 855), paper, 30, { gradient: linear("#f6f6ff", "#e5e3fa", 0, "#efeffd"), effects: soft("window", "#3a36c9", 0.35, 24, 50) }),
    vector(s, "titlebar", "M220 160 L1395 160 C1412 160 1425 173 1425 190 L1425 222 L190 222 L190 190 C190 173 203 160 220 160 Z", "#383947"),
    disc("light_red", 243, 189, 10, "#ef4b5c"),
    disc("light_yellow", 280, 189, 10, "#f5d33b"),
    disc("light_green", 317, 189, 10, "#5fe0b0"),
    brand("wordmark", "procura", 226, 250, 150, 52, 40, 600, "#5b5df5", "left", { letterSpacing: -0.02, lineHeight: 1 }),
    s.card("searchbar", s.at(380, 253, 868, 50), "#f4f4ff", 25, { stroke: "#cfd0f4", strokeWidth: 2, effects: [inset("searchbar_inset", "#b9b8ee", 0.5, 0, 3, 6)] }),
    brand("query", "planta baixa", 408, 258, 400, 40, 29, 600, "#4c50e0", "left", { lineHeight: 1 }),
    ellipse("lens", s.mid(1216, 277, 22, 22), CLEAR, { stroke: "#4c50e0", strokeWidth: 2.6 }),
    line(s, "lens_handle", "M1224 285 L1231 292", "#4c50e0", 3),
    disc("profile", 1335, 277, 30, "#e6ecff", { stroke: "#8fa2f8", strokeWidth: 3 }),
    disc("profile_head", 1335, 268, 10, "#8fa2f8"),
    vector(s, "profile_body", "M1314 297 C1318 284 1326 280 1335 280 C1344 280 1352 284 1356 297 C1350 303 1342 306 1335 306 C1328 306 1320 303 1314 297 Z", "#8fa2f8"),
    slab("plan", 380, 370, 868, 125, "#dcdafb", 22, { effects: [inset("plan_inset", "#9d99ea", 0.6, 0, 10, 18), inset("plan_rim", "#ffffff", 0.7, 0, -3, 4)] }),
    line(s, "plan_walls", "M420 495 L420 430 L520 430 M560 380 L560 470 L700 470 L700 420 M720 380 L720 440 L800 440 L800 495 M870 380 L870 495 M940 420 L1040 420 L1040 495 M1110 380 L1110 450 L1240 450", "#bdb9f3", 8, { lineCap: "butt" }),
    ellipse("plan_round", s.mid(757, 413, 34, 34), CLEAR, { stroke: "#bdb9f3", strokeWidth: 6 }),
    slab("row_card", 382, 525, 866, 123, "#efeffd", 22, { stroke: "#dedcf8", strokeWidth: 2, effects: soft("row_card", "#8a86e0", 0.18, 8, 20) }),
    slab("card_add", 383, 668, 255, 232, "#e8ebfd", 24, { gradient: linear("#d8e4fb", "#eeeefd", 90), effects: soft("card_add", "#7f7bdc", 0.22, 12, 26) }),
    disc("card_add_ring", 508, 775, 36, CLEAR, { stroke: "#ffffff", strokeWidth: 4 }),
    rect("card_add_h", s.at(490, 773, 36, 4), "#ffffff"),
    rect("card_add_v", s.at(506, 757, 4, 36), "#ffffff"),
    ...[690, 995].flatMap((left, i) => [
      slab(`card_media${i}`, left, 668, 256, 232, "#f4f4ff", 24, { effects: soft(`card_media${i}`, "#7f7bdc", 0.22, 12, 26) }),
      vector(s, `card_media${i}_top`, `M${left + 24} 668 L${left + 232} 668 C${left + 245} 668 ${left + 256} 679 ${left + 256} 692 L${left + 256} 800 L${left} 800 L${left} 692 C${left} 679 ${left + 11} 668 ${left + 24} 668 Z`, "#a8ccff", { gradient: linear("#c9dcff", "#9fc4ff", 90) }),
      disc(`card_media${i}_sun`, left + 125, 735, 38, "#eef0ff"),
      s.card(`card_media${i}_line_a`, s.at(left + 38, 836, 170, 7), "#d4d6f6", 3.5),
      s.card(`card_media${i}_line_b`, s.at(left + 38, 858, 170, 7), "#d4d6f6", 3.5),
    ]),
    s.card("slab_side", tilt(0, 10, 888, 118), "#3e33d8", 18, { effects: soft("slab", "#2a20b0", 0.45, 22, 40) }),
    s.card("slab", tilt(0, 0, 888, 112), indigo, 18, { gradient: linear("#5f57fa", "#4c42ef", 90) }),
    s.card("slab_pill", tilt(-340, -32, 120, 34), "#5ee2fd", 17, { effects: [drop("slab_pill_shadow", "#2b22b8", 0.4, 0, 4, 6)] }),
    s.card("slab_peach", tilt(-300, 6, 220, 16), "#f0b088", 8),
    s.card("slab_line_a", tilt(-40, 26, 820, 7), "#8777f7", 3.5),
    s.card("slab_line_b", tilt(10, 42, 740, 7), "#a998ff", 3.5),
    vector(s, "arrow", "M933 287 L962 318 L946 318 L946 360 L920 360 L920 318 L904 318 Z", "#3fd6b8", { gradient: linear("#5ff0cc", "#2fb8a0", 90), effects: soft("arrow", "#2a6a9a", 0.3, 8, 12) }),
    leaf(s, "leaf_back_left", 190, 1020, 70, 900, 50, "#7a3fe0"),
    leaf(s, "leaf_left_a", 200, 1025, 105, 880, 40, "#c14bd6", { gradient: linear("#d65ce0", "#8c33c8", 60) }),
    leaf(s, "leaf_left_b", 190, 1020, 160, 760, 38, "#9b3fd1", { gradient: linear("#b44ae0", "#7a2ec4", 80) }),
    leaf(s, "leaf_left_c", 205, 1020, 165, 830, 22, "#e070d8"),
    vector(s, "pot", "M195 966 L285 966 L275 1040 L205 1040 Z", "#e8a38a", { gradient: linear("#f2b59c", "#d98a76", 0), effects: soft("pot", "#4a3aa0", 0.3, 8, 14) }),
    s.card("pot_rim", s.at(190, 958, 100, 18), "#f0ae94", 6),
    s.card("cactus_trunk", s.at(212, 870, 62, 100), "#1aa39a", 31, { gradient: linear("#2cc0a8", "#0f7f86", 0) }),
    ellipse("cactus_arm_left", s.mid(196, 830, 40, 54, -15), "#1aa39a", { gradient: linear("#2cc0a8", "#118a8c", 0) }),
    ellipse("cactus_arm_right", s.mid(293, 890, 44, 50, 20), "#1aa39a", { gradient: linear("#26b8a4", "#0f7f86", 0) }),
    ellipse("cactus_top", s.mid(244, 860, 54, 64), "#1aa39a", { gradient: linear("#2cc0a8", "#118a8c", 0) }),
    disc("cactus_bud", 268, 828, 13, "#1aa39a"),
    slab("video_card", 325, 793, 258, 235, "#f0efff", 24, { effects: soft("video_card", "#3e3ab8", 0.35, 18, 34) }),
    vector(s, "video_top", "M349 793 L559 793 C572 793 583 804 583 817 L583 935 L325 935 L325 817 C325 804 336 793 349 793 Z", teal, { gradient: linear("#4ff0e6", "#2fcfd0", 90) }),
    disc("video_play", 455, 863, 43, "#f4f6ff", { effects: [drop("video_play_shadow", "#1f9aa0", 0.35, 0, 6, 10)] }),
    triangle("video_play_icon", s.mid(458, 863, 26, 28, 90), teal),
    s.card("video_line_a", s.at(370, 955, 170, 7), "#d4d6f6", 3.5),
    s.card("video_line_b", s.at(370, 980, 170, 7), "#d4d6f6", 3.5),
    s.card("pencil", s.at(455, 1026, 92, 15, 0), "#f2b34a", 7.5, { gradient: linear("#f8c45c", "#e09a2c", 90) }),
    rect("pencil_eraser", s.at(452, 1026, 16, 15), "#f28aa8"),
    triangle("pencil_tip", s.mid(553, 1033, 15, 14, 90), "#f6d6b8"),
    disc("torus", 672, 980, 52, CLEAR, { stroke: "#8157f7", strokeWidth: 32, effects: soft("torus", "#3a2ab0", 0.35, 10, 18) }),
    disc("ball", 722, 1018, 26, "#f7c0dc", { gradient: radial("#ffe0ef", "#e89ac4", 0.35, 0.3, 0.9) }),
    s.card("tin", s.at(785, 988, 62, 58), "#8157f7", 12, { gradient: linear("#9b78fb", "#6d45ef", 0) }),
    rect("tin_band", s.at(785, 1005, 62, 22), "#e37192"),
    ellipse("tin_lid", s.mid(816, 990, 62, 18), "#a88cff"),
    vector(s, "stairs", "M1010 1048 L1010 965 L1200 965 L1200 990 L1213 990 L1213 1015 L1225 1015 L1225 1048 Z", "#529fe7", { gradient: linear("#63b4f2", "#3f86dc", 90), effects: soft("stairs", "#2f3aa8", 0.35, 10, 16) }),
    rect("stairs_step_a", s.at(1030, 988, 172, 3), "#8ccaf8"),
    rect("stairs_step_b", s.at(1040, 1013, 174, 3), "#8ccaf8"),
    leaf(s, "leaf_small_blue", 1295, 1030, 1265, 960, 22, "#7d9cf8"),
    leaf(s, "leaf_small_blue_b", 1300, 1030, 1325, 975, 18, "#6f8ef4"),
    leaf(s, "leaf_right_back", 1430, 1030, 1560, 780, 70, "#6b35f1", { gradient: linear("#8a5cf8", "#4b1ac1", 60) }),
    leaf(s, "leaf_right_mid", 1400, 1030, 1430, 780, 48, "#932dcb", { gradient: linear("#b24be0", "#6e1fb8", 70) }),
    leaf(s, "leaf_right_front", 1420, 1032, 1530, 900, 40, "#c040d0", { gradient: linear("#d860e0", "#9a2ac8", 60) }),
    line(s, "branch", "M1370 1030 C1400 990 1430 950 1480 900", "#c040d0", 5),
    ...leaflets.map(([bx, by, tx, ty], i) => leaf(s, `leaflet${i}`, bx, by, tx, ty, 11, "#3fd6c8", { gradient: linear("#5ff0d8", "#2ab8b8", 90) })),
    ellipse("cat_body", s.mid(1365, 135, 90, 52), "#fdfbff", { effects: soft("cat", "#3a36b0", 0.25, 6, 10) }),
    ellipse("cat_patch", s.mid(1385, 128, 46, 36), "#e8a088"),
    disc("cat_head", 1298, 140, 24, "#fdfbff"),
    triangle("cat_ear_left", s.mid(1283, 120, 14, 16, -15), "#fdfbff"),
    triangle("cat_ear_right", s.mid(1310, 118, 14, 16, 15), "#fdfbff"),
    line(s, "cat_eyes", "M1288 142 Q1292 145 1296 142 M1302 142 Q1306 145 1310 142", "#5a4a6a", 1.6),
    line(s, "cat_tail", "M1405 150 C1418 170 1410 190 1414 202", "#fdfbff", 9),
  ]);
}

const CRESCENT = dribbble("24302233-Crescent-Ad-Banners", "Crescent Ad Banners", "274 likes");

export function screensCorpus(): CorpusEntry[] {
  return [
    {
      id: "sota-banner-rings",
      title: "Banner vertical de fintech com anéis concêntricos",
      useCase: "banner de mídia display de fintech",
      sources: [CRESCENT],
      intent: "Tall 600 x 1720 display banner on flat lilac with rounded corners: a big light grotesk headline in deep plum set tight and flush left in the top quarter, a target of violet concentric rings of shrinking thickness filling the lower two thirds with a small white logo mark at the exact center, and a heavy lowercase wordmark centered at the bottom. Two purples and white, no photos, all hierarchy from size.",
      brief: "Banner vertical lilás da fintech alvorada: 'Um lar melhor para o capital da empresa.' em grotesca grande no topo à esquerda, anéis concêntricos violeta com o símbolo branco no centro e o nome embaixo.",
      photos: [],
      make: bannerRings,
    },
    {
      id: "sota-banner-circles",
      title: "Banner vertical escuro de fintech com rosácea de círculos",
      useCase: "banner de mídia display de fintech",
      sources: [CRESCENT],
      intent: "Same family as the lilac banner, inverted: deep plum ground with rounded corners, the white mark and lowercase wordmark as a lockup at the top, a light weight lilac three line headline flush left in the middle, and a rosette of six thin lilac outline circles in two overlapping columns bleeding off the bottom and sides.",
      brief: "Banner vertical roxo escuro da fintech alvorada: símbolo e nome brancos no topo, 'Invista e comece a render.' em lilás fino e uma rosácea de círculos lilás vazados saindo pela base.",
      photos: [],
      make: bannerCircles,
    },
    {
      id: "sota-banner-arcs",
      title: "Banner vertical branco de fintech com arcos lilás",
      useCase: "banner de mídia display de fintech",
      sources: [CRESCENT],
      intent: "White member of the banner family: lowercase wordmark centered at the top, a centered regular grotesk headline in black in the upper middle, and a sunrise of lilac concentric arcs rising from the bottom edge, bands thick near the center and thinning to hairlines outward, with the black mark centered low inside the innermost disc.",
      brief: "Banner vertical branco da fintech alvorada: nome no topo, 'Faça seu dinheiro parado render.' centralizado em preto e arcos lilás nascendo da base com o símbolo preto no centro.",
      photos: [],
      make: bannerArcs,
    },
    {
      id: "sota-realestate-hero",
      title: "Topo de site imobiliário com ficha do imóvel",
      useCase: "site de imobiliária (página inicial)",
      sources: [dribbble("24633224-Real-Estate-Website", "Real Estate Website", "961 likes")],
      intent: "Desktop real estate home page top, 1440 wide on a soft peach to sky blue wash: a wordmark, centered text nav and two pills (outlined currency, black log in) in one row, a wide medium weight grotesk headline, then a two column row of a large rounded house photo and a white details card (address, three big stat numbers with units, price with an outlined pill, a grey agent card with an initial avatar and outlined contact pill, a black pill button with two lines). A white search bar of outlined pill fields with line icons and a black search pill closes the hero; below on white, a section title with an outlined 'view all' pill and three rounded interior photos.",
      brief: "Topo do site da imobiliária Habitar: menu, título 'Imóveis para viver e para investir', foto grande da casa com ficha branca (endereço, 4 quartos, 3 banheiros, 173 m², R$ 8.250.000, corretora e botão 'Agendar visita'), barra de busca em pílulas e 'Novidades na sua região' com três fotos de interiores.",
      photos: ["villa", "roomBright", "roomChairs", "living"],
      make: realEstateHero,
    },
    {
      id: "sota-dark-dashboard",
      title: "Painel escuro de produto com linha do tempo",
      useCase: "painel de análise de produto (SaaS)",
      sources: [dribbble("25683483-Dashboard-UI", "Dashboard UI", "1600 likes, 1.2M views")],
      intent: "Black rounded app frame on a pale lime ground: a round logo and three dark nav pills with icons at the top, user name and initial avatar with a red badge at the top right, a left rail of round icon buttons, a condensed heavy caps title, and three dark filter pills with grey labels and white values. Dark grey rounded cards hold big condensed % KPIs with lime up and orange down triangles, a thin two color line chart, a lime, orange and white dot matrix, a pill candle chart of stacked capsules on thin stems with tiny value labels, and a projects timeline of lime, orange and white capsule bars against gridlines with icon or initial badges. Lime #b8ff66 and orange #ff9b22 are the only accents.",
      brief: "Painel escuro de produto: moldura preta arredondada, menu em pílulas, título 'VISÃO GERAL', filtros, cartões com KPIs em %, gráfico de linha, matriz de pontos, gráfico de cápsulas e uma linha do tempo de projetos com barras lima, laranja e brancas.",
      photos: [],
      make: darkDashboard,
    },
    {
      id: "sota-blueprint-hero",
      title: "Ilustração 3D de busca com janela de navegador",
      useCase: "ilustração de destaque para landing page",
      sources: [dribbble("8172256-Blueprint-landing-page", "Blueprint landing page", "7200 likes, 1.1M views")],
      intent: "Soft 3D concept illustration on a periwinkle wall and floor: a big lavender browser window with a dark title bar and traffic lights, a wordmark and a rounded search bar with a query, a recessed blueprint panel, placeholder content cards with sky blue image areas, and a long tilted indigo card with a cyan pill, a peach bar and light lines leaning across the page. Clay-like props frame the base: a teal video card with a play button, a cactus in a terracotta pot, purple and magenta leaves with teal leaflets, a purple torus, a pink ball, a tin, a pencil, blue stairs, a green up arrow and a sleeping cat on the window corner. Everything rounded with soft blue shadows.",
      brief: "Ilustração 3D em tons de lilás e azul para a página de um serviço de busca: janela de navegador grande com a busca 'planta baixa', um cartão índigo inclinado, cartões de conteúdo, plantas, um cacto, um cartão de vídeo turquesa e pequenos objetos, sem pessoas.",
      photos: [],
      make: blueprintHero,
    },
  ];
}
