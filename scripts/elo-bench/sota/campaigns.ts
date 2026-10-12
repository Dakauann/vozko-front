import type { Artboard, Layer } from "@/lib/studio/document";

import { CLEAR, drop, ellipse, glow, inset, linear, photo, radial, rect, sheet, soft, star, writer, type Sheet } from "../authoring";
import { photoAsset, placedPhoto } from "../photos";
import { source, type CorpusEntry } from "../extended/corpus";
import { line, vector } from "./kit";

const MUTED = { brightness: 0, contrast: 0, saturation: 0, blur: 0 };

export function chickenLegs(): Artboard {
  const s = sheet(1400, 846);
  const cream = "#f8f1e1";
  const t = writer(s, "bebas-neue");
  return s.board("#ec0f2c", [
    rect("grain", s.at(0, 0, 1400, 846), CLEAR, { gradient: radial("#ff2a4400", "#c3001d55", 0.5, 0.45, 0.9) }),
    s.label("logo", "GALO", s.at(560, 78, 280, 76), 66, { font: "archivo-black", weight: 400, fill: cream, align: "center", italic: true, spacing: -0.02 }),
    s.label("kicker", "APRESENTA", s.at(500, 180, 400, 30), 22, { font: "oswald", weight: 300, fill: cream, align: "center", spacing: 0.38 }),
    s.label("lead", "AS MELHORES", s.at(330, 238, 740, 140), 150, { font: "bebas-neue", weight: 400, fill: cream, align: "center", spacing: 0 }, { runs: [{ start: 3, end: 5, fontId: "archivo-black", fontSize: 112 / 846 }] }),
    s.label("title", "PERNAS", s.at(100, 360, 1200, 170), 186, { font: "archivo-black", weight: 400, fill: cream, align: "center", spacing: 0.1 }),
    rect("seal_box", s.at(138, 543, 52, 21), CLEAR, { stroke: cream, strokeWidth: 2 }),
    ...[0, 1, 2, 3].map((i) => star(`seal_star${i}`, s.mid(150 + i * 9.5, 554, 7, 7), cream, 5, 0.45)),
    vector(s, "crest", "M228 538 L256 538 L256 556 C256 566 248 572 242 576 C236 572 228 566 228 556 Z", CLEAR, { stroke: cream, strokeWidth: 2.5 }),
    t("crest_text", "G", 228, 541, 28, 22, 18, 400, cream, "center"),
    t("marks", "®©", 296, 536, 64, 38, 40, 400, cream, "left"),
    ...[1080, 1245].map((x, i) => vector(s, `drumstick${i}`, `M${x - 14} ${566} C${x - 22} ${552} ${x - 6} ${538} ${x + 6} ${542} C${x + 16} ${546} ${x + 14} ${560} ${x + 2} ${564} L${x - 6} ${572} C${x - 4} ${578} ${x - 12} ${580} ${x - 14} ${574} C${x - 20} ${576} ${x - 22} ${568} ${x - 14} ${566} Z`, cream)),
    ellipse("ball", s.mid(1163, 555, 26, 26), cream),
    star("ball_patch", s.mid(1163, 555, 11, 11), "#ec0f2c", 5, 0.6),
    line(s, "signature", "M598 694 C560 690 520 650 506 612 C488 560 540 500 620 455 C700 410 800 392 848 398 C870 402 852 418 820 432 M548 602 C600 590 650 560 668 520 M620 548 C660 530 700 512 742 516 C780 520 800 504 830 486 L892 466 M612 626 C640 612 660 600 690 602 C720 604 740 590 760 606 M760 606 C800 566 840 600 808 640 C780 680 700 690 660 700 M700 660 C640 680 600 690 580 752 C620 748 700 726 780 690 C820 672 830 610 822 562", "#1b1416", 3.2),
  ]);
}

export function chocolateBag(): Artboard {
  const s = sheet(1400, 875);
  const cream = "#f2e4c8";
  const t = writer(s, "montserrat");
  return s.board("#050505", [
    rect("vignette", s.at(0, 0, 1400, 875), CLEAR, { gradient: radial("#14110e", "#030303", 0.5, 0.45, 0.8) }),
    line(s, "strap_back", "M590 372 L652 172 Q705 140 758 176 L806 372", "#5a3520", 18, { lineCap: "butt" }),
    line(s, "strap_front", "M566 372 L640 160 Q705 118 772 166 L836 372", "#8b5a38", 20, { lineCap: "butt", effects: [drop("strap_shadow", "#000000", 0.5, 0, 4, 8)] }),
    vector(s, "bag", "M284 372 L1113 372 L1122 740 L276 740 Z", "#a98062", { gradient: linear("#b98f6f", "#8c6f52", 15, "#a7805f"), effects: soft("bag", "#000000", 0.6, 20, 40) }),
    rect("bag_fold", s.at(284, 372, 829, 8, 0, 0.6), "#c39a78"),
    vector(s, "bag_side_shade", "M1060 372 L1113 372 L1122 740 L1070 740 Z", "#6e553e", {}, undefined, 0, 0.35),
    vector(s, "bag_left_shade", "M284 372 L310 372 L300 740 L276 740 Z", "#6e553e", {}, undefined, 0, 0.25),
    t("kicker", "CHOCOLATES DO CACAU À BARRA", 450, 424, 500, 22, 15, 500, cream, "center", { letterSpacing: 0.06 }),
    t("wordmark", "CASA AURORA", 250, 604, 900, 110, 90, 400, cream, "center", { letterSpacing: 0.02 }),
    ellipse("registered", s.mid(1071, 628, 18, 18), CLEAR, { stroke: cream, strokeWidth: 1.6 }),
    t("registered_r", "R", 1062, 620, 18, 16, 11, 600, cream, "center"),
  ]);
}

export function probabilitiesBanner(): Artboard {
  const s = sheet(1400, 621);
  const t = writer(s, "work-sans");
  const body = "Na teoria, a chance de situações assim acontecerem: alguém riscar o seu carro, arrancar\no seu retrovisor ou até você esquecer a chave dentro do veículo, é bem baixa. O problema\né que até aquilo que achamos impossível acaba acontecendo em algum momento da vida,\ne na maioria das vezes o protagonista dessas histórias tristes é o nosso próprio carro.\nPara isso e muito mais, é sempre melhor ter um seguro de carro.";
  return s.board("#0b0b0a", [
    placedPhoto("photo", "carDoor", s.at(0, 0, 1400, 621), s, { filters: { ...MUTED, saturation: -0.7, brightness: -0.15 } }, 0.55, 0.5),
    rect("shade", s.at(0, 0, 1400, 621), CLEAR, { gradient: radial("#0b0b0a99", "#0b0b0ae6", 0.5, 0.4, 0.9) }),
    line(s, "chalk", "M1086 80 C1140 86 1200 94 1272 96 M1090 92 C1150 98 1210 100 1266 100 L1276 94", "#e8e4dc", 3),
    t("logo", "V[E]", 470, 70, 460, 160, 176, 800, "#ffffff", "center", { letterSpacing: -0.02 }),
    t("title", "PROBABILIDADES", 250, 276, 900, 70, 62, 300, "#f2df7c", "center", { letterSpacing: 0.3 }),
    t("body", body, 222, 402, 956, 136, 17, 400, "#f4f4f2", "center", { letterSpacing: 0.06, lineHeight: 1.5 }),
  ]);
}

function stepped(left: number, top: number, right: number, bottom: number, step: number): string {
  return `M${left + step} ${top} L${right - step} ${top} L${right - step} ${top + step} L${right} ${top + step} L${right} ${bottom - step} L${right - step} ${bottom - step} L${right - step} ${bottom} L${left + step} ${bottom} L${left + step} ${bottom - step} L${left} ${bottom - step} L${left} ${top + step} L${left + step} ${top + step} Z`;
}

function leafSwash(s: Sheet, id: string, cx: number, cy: number, dir: 1 | -1, green: string, yellow: string): Layer[] {
  const w = 300 * dir;
  const d = `M${cx} ${cy} C${cx + w * 0.3} ${cy - 30} ${cx + w * 0.7} ${cy - 34} ${cx + w} ${cy + 6} C${cx + w * 0.7} ${cy - 6} ${cx + w * 0.35} ${cy + 2} ${cx} ${cy + 18} Z`;
  return [vector(s, id, d, green), line(s, `${id}_vein`, `M${cx + w * 0.08} ${cy + 6} C${cx + w * 0.35} ${cy - 12} ${cx + w * 0.7} ${cy - 16} ${cx + w * 0.95} ${cy + 2}`, yellow, 3)];
}

export function letteringSign(): Artboard {
  const s = sheet(1080, 1140);
  const green = "#3d6b22";
  const yellow = "#f0a00a";
  const red = "#cc3a32";
  const blue = "#3a90bf";
  const orange = "#ee6b27";
  const cream = "#f4ead2";
  const asterisk = (id: string, cx: number, cy: number, r: number) => star(id, s.mid(cx, cy, r * 2, r * 2), yellow, 8, 0.12);
  const letters: [number, number, string][] = [
    [155, 275, green],
    [275, 395, yellow],
    [395, 525, green],
    [525, 645, yellow],
    [645, 740, green],
    [740, 860, yellow],
  ];
  return s.board("#ddd0b2", [
    rect("paper", s.at(0, 0, 1080, 1140), CLEAR, { gradient: radial("#e6dcc0", "#cfc09c", 0.5, 0.45, 0.95) }),
    line(s, "arc_top", "M322 106 A300 300 0 0 1 758 106", blue, 4, {}, [240, 40, 600, 600]),
    line(s, "arc_bottom", "M322 1036 A300 300 0 0 0 758 1036", blue, 4, {}, [240, 500, 600, 600]),
    vector(s, "frame_green", stepped(34, 130, 1046, 985, 95), CLEAR, { stroke: green, strokeWidth: 4 }),
    vector(s, "frame_blue", stepped(62, 190, 1018, 1010, 110), CLEAR, { stroke: blue, strokeWidth: 4 }),
    vector(s, "frame_orange", stepped(92, 265, 988, 975, 80), CLEAR, { stroke: orange, strokeWidth: 4 }),
    vector(s, "frame_blue_inner", stepped(118, 385, 962, 760, 60), CLEAR, { stroke: blue, strokeWidth: 4 }),
    vector(s, "frame_red_inner", stepped(135, 440, 945, 700, 40), CLEAR, { stroke: red, strokeWidth: 4 }),
    vector(s, "crest_red", "M540 166 C580 166 600 190 640 190 L870 190 L870 236 L790 236 C770 236 760 262 760 262 C760 262 770 288 790 288 L870 288 L870 336 L640 336 C600 336 580 362 540 362 C500 362 480 336 440 336 L210 336 L210 288 L290 288 C310 288 320 262 320 262 C320 262 310 236 290 236 L210 236 L210 190 L440 190 C480 190 500 166 540 166 Z", CLEAR, { stroke: red, strokeWidth: 4 }),
    vector(s, "diamond", "M540 173 L668 265 L540 357 L412 265 Z", yellow),
    rect("rule_left", s.at(235, 260, 145, 4), orange),
    rect("rule_right", s.at(700, 260, 145, 4), orange),
    ellipse("dot_left", s.mid(390, 262, 26, 26), red),
    ellipse("dot_right", s.mid(690, 262, 26, 26), red),
    line(s, "curl_left_blue", "M378 250 C340 220 300 214 240 226 M378 274 C340 304 300 310 240 298", blue, 7),
    line(s, "curl_left_green", "M374 262 C330 244 290 244 250 254 M374 262 C330 280 290 280 250 270", green, 6),
    line(s, "curl_right_blue", "M702 250 C740 220 780 214 840 226 M702 274 C740 304 780 310 840 298", blue, 7),
    line(s, "curl_right_green", "M706 262 C750 244 790 244 830 254 M706 262 C750 280 790 280 830 270", green, 6),
    s.label("initial", "A", s.at(440, 190, 200, 150), 150, { font: "alfa-slab-one", weight: 400, fill: blue, align: "center", leading: 1 }, { effects: [drop("initial_shadow", green, 1, 0, 10, 0)] }),
    star("star_top", s.mid(540, 95, 70, 70), yellow, 8, 0.4),
    star("star_bottom", s.mid(540, 1030, 70, 70), yellow, 8, 0.4),
    asterisk("spark_a", 170, 352, 26),
    asterisk("spark_b", 905, 352, 26),
    asterisk("spark_c", 125, 725, 26),
    asterisk("spark_d", 952, 725, 26),
    ...leafSwash(s, "swash_a", 190, 425, 1, green, yellow),
    ...leafSwash(s, "swash_b", 890, 425, -1, green, yellow),
    ...leafSwash(s, "swash_c", 190, 718, 1, green, yellow),
    ...leafSwash(s, "swash_d", 890, 718, -1, green, yellow),
    ...leafSwash(s, "swash_e", 200, 935, 1, green, yellow),
    ...leafSwash(s, "swash_f", 880, 935, -1, green, yellow),
    s.label("title", "FESTA", s.at(40, 450, 1000, 230), 215, { font: "alfa-slab-one", weight: 400, fill: blue, align: "center", leading: 1, spacing: 0.02 }, { stroke: cream, strokeWidth: 4, runs: letters.slice(0, "FESTA".length).map(([, , color], i) => ({ start: i, end: i + 1, fill: color })), effects: [drop("title_red", red, 1, -6, 14, 0), drop("title_orange", orange, 1, -12, 26, 0)] }),
    s.label("tagline", "É NO BAIRRO", s.at(40, 780, 1000, 130), 96, { font: "alfa-slab-one", weight: 400, fill: red, align: "center", italic: true, leading: 1, spacing: 0.02 }, { stroke: cream, strokeWidth: 3, effects: [drop("tagline_yellow", yellow, 1, -5, 10, 0), drop("tagline_orange", orange, 1, -9, 18, 0)] }),
  ]);
}

export function skincareLid(): Artboard {
  const s = sheet(1400, 1020);
  return s.board("#d9d3ca", [
    rect("table", s.at(0, 0, 1400, 1020), CLEAR, { gradient: linear("#e4ded5", "#cbc4b9", 30) }),
    vector(s, "side_light", "M0 700 L400 1020 L0 1020 Z", "#e9ebed", { gradient: linear("#f5f6f7", "#c9cdd1", 0) }),
    vector(s, "side_dark", "M1400 680 L990 1020 L1400 1020 Z", "#1c201f"),
    rect("lid", s.mid(708, 478, 1255, 1255, 40), "#9aa0a6", { radius: 0.02, gradient: linear("#25292d", "#e6eaee", 12, "#8d949a"), effects: [inset("lid_rim", "#ffffff", 0.35, 0, 0, 6)] }),
    rect("lid_sheen", s.mid(760, 470, 1255, 1255, 40), CLEAR, { gradient: radial("#ffffff40", "#ffffff00", 0.75, 0.35, 0.6) }),
    s.label("wordmark", "aína", s.mid(712, 470, 760, 420, -42), 400, { font: "cormorant-garamond", weight: 500, fill: "#121314", align: "center", leading: 1, spacing: -0.04 }),
    s.label("side_copy", "suave todo dia", s.mid(1240, 905, 420, 70, -40), 64, { font: "cormorant-garamond", weight: 400, fill: "#3a3e3d", align: "center", leading: 1 }),
    s.label("side_small", "cuidado sem pressa", s.mid(1330, 960, 260, 30, -40), 24, { font: "cormorant-garamond", weight: 400, fill: "#55595a", align: "center", leading: 1, italic: true }),
  ]);
}

export function jewelryBanner(): Artboard {
  const s = sheet(700, 1960);
  const gold = "#c9a46a";
  const t = writer(s, "lato");
  return s.board("#1b1815", [
    placedPhoto("orchid", "orchid", s.at(-40, 300, 780, 1110), s, {}, 0.5, 0.48),
    rect("orchid_fade", s.at(0, 1280, 700, 140), CLEAR, { gradient: linear("#1b181500", "#1b1815", 90) }),
    line(s, "chain_inner", "M690 0 C640 420 520 900 330 914 C220 920 140 760 92 560", gold, 3, { effects: [drop("chain_inner_shadow", "#000000", 0.35, 2, 4, 4)] }),
    line(s, "chain_outer", "M700 330 C620 760 470 1056 350 1062 C260 1066 170 860 118 600", gold, 3, { effects: [drop("chain_outer_shadow", "#000000", 0.35, 2, 4, 4)] }),
    s.card("bail", s.at(341, 1060, 20, 64), gold, 8),
    s.card("gem_setting", s.at(316, 1124, 70, 108), gold, 10, { effects: [drop("gem_shadow", "#000000", 0.4, 3, 8, 12)] }),
    s.card("gem", s.at(324, 1132, 54, 92), "#eef2f4", 6, { gradient: linear("#ffffff", "#c9d3d8", 70, "#f1f5f7") }),
    line(s, "gem_facet_a", "M336 1144 L336 1212 M366 1144 L366 1212 M336 1144 L366 1144 M336 1212 L366 1212", "#b9c4ca", 2),
    t("url", "WWW.ELORA.COM", 160, 168, 380, 40, 30, 400, "#d9d2c6", "center", { letterSpacing: 0.02 }),
    s.label("wordmark", "ELORA", s.at(0, 1530, 700, 190), 186, { font: "cormorant-garamond", weight: 500, fill: "#efe9df", align: "center", leading: 1, spacing: 0.02 }),
    t("tagline", "DA TELA PARA A MÃO,\nDA VISÃO À EXPERIÊNCIA", 80, 1752, 540, 90, 33, 400, "#e9e2d6", "center", { lineHeight: 1.25 }),
  ]);
}

function puzzleEdge(s: Sheet, id: string, cx: number, cy: number, r: number, fill: string): Layer {
  return ellipse(id, s.mid(cx, cy, r * 2, r * 2), fill);
}

export function pizzaPoster(): Artboard {
  const s = sheet(1400, 1311);
  const red = "#f30f12";
  const blue = "#1ba0e6";
  const ink = "#111111";
  const white = "#ffffff";
  const cream = "#fde9d6";
  const t = writer(s, "archivo-black");
  const outline = { stroke: ink, strokeWidth: 5, lineJoin: "round" as const };
  return s.board(red, [
    vector(s, "puzzle", "M308 228 L1185 240 L1200 958 L272 962 L262 808 L198 800 L206 520 L296 500 Z", white),
    ...[
      [612, 228, white],
      [1120, 238, white],
      [1198, 600, red],
      [1198, 770, red],
      [270, 590, red],
      [270, 720, white],
      [418, 962, red],
      [800, 962, white],
      [972, 962, red],
    ].map(([x, y, fill], i) => puzzleEdge(s, `knob${i}`, x as number, y as number, 30, fill as string)),
    vector(s, "piece_loose", "M904 800 L1052 812 L1040 930 L908 934 Z", red),
    puzzleEdge(s, "piece_knob", 976, 800, 26, red),
    vector(s, "figure_left_body", "M0 220 C80 200 180 230 230 300 L250 420 C190 480 140 520 120 560 L0 600 Z", blue, outline),
    vector(s, "figure_left_legs", "M0 470 C80 470 170 470 210 520 C240 600 200 700 160 760 L60 780 C40 700 20 640 0 620 Z", ink, outline),
    vector(s, "figure_left_shoe", "M20 780 C60 760 140 770 170 820 C180 860 150 900 100 900 L20 880 Z", blue, outline),
    ellipse("figure_left_head", s.mid(240, 160, 130, 150), cream, outline),
    vector(s, "figure_left_hair", "M180 120 C200 60 280 50 330 80 L360 40 C370 100 340 150 300 140 C270 120 220 120 180 120 Z", red, outline),
    vector(s, "pizza_box", "M220 350 L400 380 L392 420 L212 390 Z", red, { ...outline, effects: [drop("box_shadow", ink, 0.2, 4, 6, 0)] }),
    vector(s, "pizza_box_base", "M190 410 L388 470 L376 500 L178 440 Z", white, outline),
    vector(s, "pizza_in_box", "M200 418 L310 440 L290 462 L196 436 Z", "#ffcc33", outline),
    vector(s, "figure_right_hoodie", "M1180 220 C1260 200 1360 220 1400 260 L1400 560 L1250 560 C1220 480 1180 420 1110 400 C1080 360 1100 300 1180 220 Z", blue, outline),
    vector(s, "figure_right_shorts", "M1240 500 L1400 500 L1400 640 L1300 640 L1260 600 Z", ink, outline),
    vector(s, "figure_right_leg", "M1300 640 L1380 640 L1360 800 L1290 790 Z", white, outline),
    vector(s, "figure_right_shoe", "M1240 820 C1300 780 1400 800 1400 820 L1400 960 C1330 960 1250 920 1240 880 Z", red, outline),
    ellipse("figure_right_head", s.mid(1230, 130, 130, 150), cream, outline),
    vector(s, "figure_right_hair", "M1170 70 C1180 30 1260 20 1310 50 C1300 90 1260 100 1180 100 Z", "#ffe14d", outline),
    ellipse("headphones", s.mid(1265, 222, 60, 60), white, outline),
    vector(s, "arm_right", "M1110 400 C1040 360 960 340 900 330 C870 320 860 280 890 270 L960 290 L1100 330 Z", white, outline),
    vector(s, "slice", "M880 236 L1030 210 L1018 262 Z", "#ffe14d", outline),
    ellipse("slice_pep_a", s.mid(925, 238, 18, 14), red),
    ellipse("slice_pep_b", s.mid(965, 232, 16, 12), red),
    vector(s, "figure_mid_body", "M620 270 C660 250 720 260 740 300 L730 400 L640 400 C620 360 610 310 620 270 Z", ink, outline),
    ellipse("figure_mid_head", s.mid(690, 190, 70, 90), cream, outline),
    vector(s, "figure_mid_hair", "M650 160 C670 120 740 130 760 180 C790 240 790 300 760 330 C740 260 720 200 650 160 Z", blue, outline),
    ...[
      [450, 150, "heart"],
      [1040, 140, "sparkle"],
      [315, 900, "fire"],
      [1130, 880, "heart"],
    ].map(([x, y, icon], i) => [
      s.card(`sticker${i}`, s.mid(x as number, y as number, 92, 80, -8), white, 22, { ...outline, strokeWidth: 3 }),
      { id: `sticker${i}_icon`, type: "icon" as const, iconId: icon as string, transform: s.mid(x as number, y as number, 48, 48, -8), fill: red },
    ]).flat(),
    s.card("badge", s.mid(770, 590, 680, 330, -4), white, 40, { stroke: red, strokeWidth: 8, effects: [drop("badge_shadow", ink, 0.15, 0, 8, 0)] }),
    s.card("tag_blue", s.mid(523, 512, 150, 112, -10), blue, 6),
    t("tag_blue_text", "PARTE", 452, 488, 142, 50, 34, 400, white, "center", { transform: s.mid(523, 512, 220, 50, -10) }),
    s.card("tag_red", s.mid(708, 490, 218, 86, -3), red, 6),
    t("tag_red_text", "A PIZZA", 604, 468, 208, 46, 40, 400, white, "center", { transform: s.mid(708, 490, 300, 50, -3) }),
    s.label("headline", "DIVIDE", s.mid(770, 625, 760, 190, -5), 132, { font: "archivo-black", weight: 400, fill: red, align: "center", leading: 1 }),
    t("headline_small", "AMOR", 960, 682, 140, 50, 40, 400, red, "center", { transform: s.mid(1030, 708, 220, 50, -5) }),
    vector(s, "logo_mark", "M598 38 L618 30 L628 54 L608 62 Z", blue, { stroke: white, strokeWidth: 3 }),
    ellipse("logo_dot", s.mid(611, 46, 7, 7), white),
    t("logo", "Forno Rubi", 632, 30, 180, 40, 30, 400, white, "left"),
    s.label("footer_title", "COM QUEM ESTÁ DO SEU LADO\nDIVIDA UM POUCO DE CARINHO!", s.at(390, 1132, 620, 112), 46, { font: "anton", weight: 400, fill: white, align: "center", leading: 1.15, spacing: 0.02 }),
    s.label("footer_left", "Forno Rubi Pizza\nEntrega grátis", s.at(68, 1192, 240, 50), 19, { font: "dm-sans", weight: 500, fill: white, align: "left", leading: 1.25 }, { runs: [{ start: 0, end: 16, fontWeight: 800 }] }),
    s.label("footer_right", "0800 6099\nfornorubi.com.br", s.at(1110, 1192, 226, 50), 19, { font: "dm-sans", weight: 800, fill: white, align: "right", leading: 1.25 }),
  ]);
}

export function sneakerPoster(): Artboard {
  const s = sheet(1080, 1620);
  const red = "#e3141c";
  const t = writer(s, "cormorant-garamond");
  const body = "TUDO NASCE, CRESCE, SE TRANSFORMA E UM DIA SE APAGA. PESSOAS, IDEIAS,\nATÉ CLÁSSICOS. MAS ALGUMAS COISAS EXISTEM PARA IR ALÉM DO PRÓPRIO CICLO, E PARA ISSO\nÉ PRECISO ALGO EXTRAORDINÁRIO: UMA NOVA VIDA. UMA TRANSFORMAÇÃO, TALVEZ ATÉ UM\nMILAGRE. ENCONTRAMOS UM SACRO. UM CRIADOR LIGADO AO NASCIMENTO ANTES MESMO DE NASCER: SUA\nMÃE É PARTEIRA E DEDICOU A VIDA A TRAZER NOVAS VIDAS AO\nMUNDO; ELE ACHOU SEU JEITO DE FAZER O MESMO, DANDO VIDA A NOVAS IDEIAS. COLOCAMOS O\nACERVO DA NORTE NAS MÃOS DELE PARA DESMONTAR, TRANSFORMAR E FAZER\nRENASCER, LEVANDO NOSSOS CLÁSSICOS NUMA JORNADA DO CELESTIAL AO TERRENO. E\nASSIM NASCEU O RENASCER, PORQUE ALGUNS CLÁSSICOS\nNÃO FORAM FEITOS PARA MORRER, MAS PARA RENASCER.";
  const highlight = body.indexOf("DO CELESTIAL AO TERRENO");
  return s.board("#07080b", [
    placedPhoto("photo", "sneakersDark", s.at(0, 700, 1080, 920), s, { filters: { ...MUTED, brightness: -0.12, saturation: -0.4 } }, 0.5, 0.55),
    rect("photo_fade", s.at(0, 700, 1080, 420), CLEAR, { gradient: linear("#07080b", "#07080b00", 90) }),
    rect("teal_cast", s.at(0, 700, 1080, 920, 0, 0.35), "#0f3a4a", { blendMode: "color" }),
    rect("stand_left", s.at(152, 150, 9, 1470, -1.5), "#1d232b"),
    rect("stand_left_b", s.at(250, 230, 6, 1390, 1), "#151a20"),
    s.card("lamp_left_body", s.mid(225, 110, 120, 70, 35), "#1a1f26", 12),
    ellipse("lamp_left_glow", s.mid(296, 150, 66, 76), "#eaf6ff", { effects: [glow("lamp_left_halo", "#bfe8ff", 0.8, 60)] }),
    s.card("panel_left", s.at(52, 720, 110, 360), "#171b21", 10),
    s.card("panel_right", s.at(912, 222, 54, 210), "#151920", 8),
    rect("stand_right", s.at(966, 420, 9, 1200), "#1d232b"),
    t("brand_left", "NORTE", 280, 216, 200, 30, 26, 700, "#ffffff", "center", { fontId: "archivo-black" }),
    line(s, "brand_left_mark", "M342 262 L372 248 L402 262 M352 268 L380 256 L410 268", "#ffffff", 3),
    line(s, "times", "M534 226 L566 258 M566 226 L534 258", "#d7dbe0", 1.5),
    s.label("brand_right", "Sacro", s.at(580, 196, 300, 86), 84, { font: "playfair-display", weight: 900, fill: red, align: "center", italic: true, leading: 1 }),
    s.label("vertical", "COLEÇÃO RENASCER", s.mid(540, 882, 640, 40, -90), 30, { font: "cormorant-garamond", weight: 400, fill: "#b4121b", align: "center", spacing: 0.28, leading: 1 }),
    t("body", body, 20, 1134, 1040, 204, 15, 500, "#e6e8ea", "center", { lineHeight: 1.2, letterSpacing: -0.01, runs: [{ start: highlight, end: highlight + 23, fill: red }] }),
  ]);
}

export function chickenFlyer(): Artboard {
  const s = sheet(1080, 1440);
  const t = writer(s, "montserrat");
  const leaf = (id: string, cx: number, cy: number, w: number, h: number, angle: number) => ellipse(id, s.mid(cx, cy, w, h, angle), "#4fa52a", { gradient: linear("#7fd04a", "#3d8a1e", 90) });
  return s.board("#0c0c0c", [
    placedPhoto("chili_backdrop", "chili", s.at(0, 0, 1080, 1440, 0, 0.55), s, { filters: { ...MUTED, blur: 18, brightness: -0.2 } }, 0.5, 0.5),
    ellipse("leaves_corner", s.mid(70, 1400, 160, 90, -30, 0.45), "#3d8a1e", { effects: [glow("leaves_glow", "#3d8a1e", 0.5, 30)] }),
    s.card("card", s.at(133, 170, 795, 1122), "#5a3a2c", 64, { gradient: linear("#4a3a35", "#c4462a", 90, "#9a4a2e"), stroke: "#ffffff40", strokeWidth: 3, effects: soft("card", "#000000", 0.5, 24, 60) }),
    t("title", "FRANGO", 160, 236, 740, 140, 132, 800, "#ffffff", "center", { letterSpacing: 0.01 }),
    s.label("title_script", "Assado", s.at(150, 370, 760, 160), 150, { font: "playfair-display", weight: 400, fill: "#d8d10a", align: "center", leading: 1 }),
    leaf("leaf_a", 240, 580, 90, 34, -20),
    leaf("leaf_b", 330, 560, 80, 30, 50),
    leaf("leaf_c", 395, 530, 70, 40, 70),
    leaf("leaf_d", 290, 470, 30, 60, 20),
    ellipse("pot_shadow", s.mid(530, 1090, 700, 80, 0, 0.45), "#000000", { effects: [glow("pot_shadow_blur", "#000000", 0.6, 30)] }),
    ellipse("pot", s.mid(525, 820, 760, 600), "#1d1a19", { effects: soft("pot", "#000000", 0.45, 20, 40) }),
    photo("pot_photo", photoAsset("roastChicken"), s.mid(525, 820, 760, 600), { crop: { x: 0.15, y: 0.12, w: 0.6, h: 0.63 }, clip: true }),
    star("date_badge", s.mid(830, 1043, 140, 140), "#ea000e", 22, 0.88, { effects: [drop("date_shadow", "#000000", 0.35, 0, 6, 12)] }),
    t("date", "30\nDEZ", 770, 1002, 120, 82, 34, 800, "#ffffff", "center", { lineHeight: 1.15 }),
    t("body", "Da pele crocante ao interior suculento, nosso\nFrango Assado de Festa foi feito para matar\nqualquer vontade. Traga o apetite, o sabor é nosso!", 160, 1158, 740, 100, 25, 500, "#f3e9e4", "center", { lineHeight: 1.3, letterSpacing: 0.04 }),
  ]);
}

export const behance = (title: string, gallery: string) => source(`Behance curated ${gallery} gallery (real brand work)`, title, "https://www.behance.net/galleries");
export const figma = (title: string) => source("Figma Community (one of the most used flyer templates)", title, "https://www.figma.com/community");

export function campaignsCorpus(): CorpusEntry[] {
  return [
    {
      id: "sota-lettering-sign",
      title: "Letreiro em filete com letras em camadas",
      useCase: "lettering e sinalização de filete",
      sources: [behance("Brazilian lettering and filete signage (Rafael Castro)", "graphic design")],
      intent: "Symmetric filete sign on aged paper: nested stepped frames in green, blue, orange and red line work, a yellow diamond crest with a slab initial, red dots and curls either side, leaf swashes above and below each line. The hero word is a fat slab with two-tone letters (green and yellow tops, blue bottoms), a cream inline and a stacked red then orange extrusion down and to the left; the italic second line repeats the trick in red with a yellow extrusion. Eight-point stars top and bottom, asterisk sparks at the corners. Everything is centered on one vertical axis.",
      brief: "Placa de filete para a festa do bairro: 'A FESTA É NO BAIRRO'. Papel envelhecido, molduras de linhas finas em verde, azul, laranja e vermelho, losango amarelo com a inicial, folhas e estrelas, letras gordas com sombra em camadas.",
      photos: [],
      make: letteringSign,
    },
    {
      id: "sota-skincare-lid",
      title: "Tampa de embalagem metálica de skincare",
      useCase: "embalagem de cosmético (identidade de marca)",
      sources: [behance("Skincare brand identity (box lid in brushed silver)", "graphic design")],
      intent: "Photographic mockup flattened into vector: the corner of a silver box seen from above at a 40 degree turn, the lid a metallic gradient from graphite on the left to near white on the right with a soft sheen, a light side face bottom left and a black side face bottom right carrying a line of serif copy. The wordmark is a single tall high-contrast serif in black, set large and turned with the box, the only typographic element on the lid.",
      brief: "Tampa de caixa de skincare da marca aína em prata escovada, com o nome em serifa fina de alto contraste bem grande e girado com a caixa, e a frase 'suave todo dia' na lateral escura.",
      photos: [],
      make: skincareLid,
    },
    {
      id: "sota-choc-bag",
      title: "Sacola kraft de chocolateria",
      useCase: "embalagem e sacola de marca",
      sources: [behance("Chocolate packaging and brand (kraft shopping bag)", "graphic design")],
      intent: "Product shot reduced to its design: a wide kraft bag on pure black with two brown ribbon handles meeting above, warm kraft gradient with darker sides, a tiny tracked kicker centered near the top and a very wide light geometric wordmark across the bottom third with a small registered mark. Huge negative space around the bag; the type is cream, quiet and wide.",
      brief: "Sacola kraft para a chocolateria Casa Aurora sobre fundo preto: alças de fita marrom, 'CHOCOLATES DO CACAU À BARRA' pequeno no topo e o nome bem largo e fino na base.",
      photos: [],
      make: chocolateBag,
    },
    {
      id: "sota-jewelry-banner",
      title: "Banner vertical de joalheria com orquídea",
      useCase: "banner de rua e mídia exterior de joalheria",
      sources: [behance("Jewelry visual identity (street banner with orchid)", "graphic design")],
      intent: "Tall black street banner: a single white orchid fills the middle third edge to edge, two fine gold chains hang from the top right through the flower and end in an emerald cut pendant at the center line. A small tracked URL at the top, a large classical serif wordmark low in the banner and a two line caps tagline under it. Black, white and gold only.",
      brief: "Banner vertical para a joalheria Elora: fundo preto, uma orquídea branca grande no meio com um colar de ouro e pingente, o nome em serifa clássica embaixo e 'DA TELA PARA A MÃO, DA VISÃO À EXPERIÊNCIA'.",
      photos: ["orchid"],
      make: jewelryBanner,
    },
    {
      id: "sota-pizza-poster",
      title: "Pôster de campanha de pizzaria com quebra-cabeça",
      useCase: "anúncio de campanha integrada (pizzaria)",
      sources: [behance("Pizza chain IMC campaign poster", "advertising")],
      intent: "Loud red poster: a white jigsaw sheet with knobs and missing pieces fills the middle, cartoon figures in blue, black and white with thick black outlines burst in from both sides carrying pizza, stickers float around. The title lockup is a tilted white badge with a red outline holding a blue tag, a red tag, one huge red heavy word and a small word tucked bottom right. Brand on top, a two line slogan and two small corner blocks in the footer.",
      brief: "Pôster da campanha 'Parte a pizza, divide o amor' da pizzaria Forno Rubi: vermelho vivo, quebra-cabeça branco, personagens em traço grosso preto, selo inclinado com o título e rodapé com entrega grátis, telefone e site.",
      photos: [],
      make: pizzaPoster,
    },
    {
      id: "sota-chicken-legs",
      title: "Anúncio tipográfico de frango frito",
      useCase: "anúncio de campanha de rede de fast food",
      sources: [behance("Fried chicken chain campaign (typographic key visual)", "advertising")],
      intent: "Pure typography on grainy red: a small italic heavy logo, a tracked thin 'presents', a condensed two word line where two letters switch to a wide black weight, then one huge extended heavy word across the whole width. A black ink signature scribbles over the big word; tiny cream icons sit at both ends of a baseline row. Cream on red, one black accent.",
      brief: "Anúncio tipográfico da rede GALO: 'AS MELHORES PERNAS', com uma palavra gigante larga, um autógrafo preto rabiscado por cima e ícones pequenos de coxinha e bola. Vermelho e creme.",
      photos: [],
      make: chickenLegs,
    },
    {
      id: "sota-sneaker-poster",
      title: "Pôster editorial de coleção de tênis",
      useCase: "anúncio de coleção de moda e calçados",
      sources: [behance("Sneaker collection campaign poster (collab lockup, dark studio)", "advertising")],
      intent: "Dark studio editorial poster: photo in near black with teal light, studio lamps and stands at both sides, a collab lockup high up (white sans mark, thin cross, red blackletter-like word), a thin red vertical title running up the center and a centered block of small caps serif copy near the bottom with one phrase in red, the product at the bottom center.",
      brief: "Pôster da coleção Renascer, parceria Norte e Sacro: estúdio escuro com refletores, tênis brancos no chão, título vertical vermelho fino e um bloco de texto em caixa alta serifada com uma frase em vermelho.",
      photos: ["sneakersDark"],
      make: sneakerPoster,
    },
    {
      id: "sota-probabilities-banner",
      title: "Banner de campanha de seguro de carro",
      useCase: "banner de campanha de seguros",
      sources: [behance("Car insurance campaign 'Probabilities' (web banner)", "advertising")],
      intent: "Wide cinematic banner: dark desaturated photo under a heavy vignette, a bold white bracket logo at the top center, a thin widely tracked yellow title, then a five line centered paragraph in small tracked white sans. Chalk scratches as the only texture.",
      brief: "Banner largo da campanha 'Probabilidades' de um seguro de carro: foto escura de um carro à noite, logotipo branco no topo, título amarelo fino e espaçado e um parágrafo curto centralizado.",
      photos: ["carDoor"],
      make: probabilitiesBanner,
    },
    {
      id: "sota-chicken-flyer",
      title: "Flyer de frango assado com cartão de vidro",
      useCase: "flyer de promoção de restaurante",
      sources: [figma("Chicken Feast food promo flyer (dark variant)")],
      intent: "Food flyer: blurred chilies on black, a large rounded glass card with a brown to red-orange gradient and a faint white edge, a heavy white sans word over a yellow condensed serif word, the roast chicken in a black pot as the hero with leaves flying, a red scalloped date badge on the pot and a three line centered blurb at the bottom.",
      brief: "Flyer do Frango Assado para 30 de dezembro: fundo preto com pimentas desfocadas, cartão arredondado com degradê marrom e laranja, título 'FRANGO' branco e 'Assado' amarelo, o frango na panela, selo vermelho com a data e um texto curto.",
      photos: ["roastChicken", "chili"],
      make: chickenFlyer,
    },
  ];
}
