import type { Artboard, Layer } from "@/lib/studio/document";

import { CLEAR, ellipse, linear, photo, rect, sheet, writer, type Sheet } from "../authoring";
import type { CorpusEntry } from "../extended/corpus";
import { photoAsset } from "../photos";
import { arcLine, dribbble, line, vector, type Frame } from "./kit";

function cloud(s: Sheet, id: string, base: number, xs: number[], tops: number[], outer: string, inner: string, rim = 14): Layer[] {
  const outline = (shrink: number) => {
    const last = xs.length - 1;
    const pts = xs.map((x, i): [number, number] => [i === 0 ? x + shrink : i === last ? x - shrink : x, i === 0 || i === last ? base : tops[i - 1] + shrink]);
    const arcs = pts.slice(1).map(([x, y], i) => {
      const [px, py] = pts[i];
      const r = Math.hypot(x - px, y - py) * 0.56;
      return `A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${x} ${y}`;
    });
    return `M${pts[0][0]} ${pts[0][1]} ${arcs.join(" ")} Z`;
  };
  const left = xs[0];
  const right = xs[xs.length - 1];
  const reach = Math.max(...xs.slice(1).map((x, i) => x - xs[i])) * 0.45;
  const top = Math.min(...tops) - reach;
  const frame: Frame = [left, top, right - left, base - top];
  const layers = [vector(s, `${id}_rim`, outline(0), outer, {}, frame)];
  return rim > 0 ? [...layers, vector(s, `${id}_fill`, outline(rim), inner, {}, frame)] : layers;
}

function frond(s: Sheet, id: string, from: [number, number], via: [number, number], to: [number, number], count: number, reach: number, spread: number, color: string, width: number, sides: number[] = [1, -1]): Layer {
  const at = (u: number) => [(1 - u) ** 2 * from[0] + 2 * (1 - u) * u * via[0] + u * u * to[0], (1 - u) ** 2 * from[1] + 2 * (1 - u) * u * via[1] + u * u * to[1]];
  const tangent = (u: number) => [2 * (1 - u) * (via[0] - from[0]) + 2 * u * (to[0] - via[0]), 2 * (1 - u) * (via[1] - from[1]) + 2 * u * (to[1] - via[1])];
  const parts = [`M${from[0]} ${from[1]} Q${via[0]} ${via[1]} ${to[0]} ${to[1]}`];
  for (let k = 1; k <= count; k += 1) {
    const u = 0.08 + (0.9 * k) / count;
    const [x, y] = at(u);
    const [tx, ty] = tangent(u);
    const base = Math.atan2(ty, tx);
    const length = reach * (1.15 - 0.6 * u);
    for (const side of sides) {
      const a = base + side * ((spread * Math.PI) / 180);
      const mx = x + Math.cos(a) * length * 0.5 + Math.cos(base) * length * 0.15;
      const my = y + Math.sin(a) * length * 0.5 + Math.sin(base) * length * 0.15 + length * 0.12;
      parts.push(`M${x.toFixed(1)} ${y.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${(x + Math.cos(a) * length).toFixed(1)} ${(y + Math.sin(a) * length + length * 0.3).toFixed(1)}`);
    }
  }
  return line(s, id, parts.join(" "), color, width);
}

export function aviationCard(): Artboard {
  const s = sheet(600, 1160);
  const lilac = "#9e8abd";
  const cream = "#f0dfcd";
  const pink = "#e792bb";
  const plum = "#2a112e";
  const orange = "#f17031";
  const yellow = "#efac35";
  const red = "#c42a24";
  const green = "#2a774e";
  const f = s.spin(262, 375, 55.4);
  const e1 = s.spin(405, 318, 55.4);
  const e2 = s.spin(148, 492, 55.4);
  const t = writer(s, "anton");
  return s.board("#f4efe8", [
    rect("card", s.at(0, 0, 600, 1160), lilac, { radius: s.round(32, s.at(0, 0, 600, 1160)), gradient: linear("#a693c4", "#9784b6", 170) }),
    ellipse("sun", s.mid(506, 140, 236, 236), "#da5d24"),
    ...cloud(s, "cloud_top", 30, [0, 30, 60, 88], [10, 6], cream, cream, 0),
    ...cloud(s, "cloud_small", 108, [196, 218, 250, 292, 330], [86, 72, 82], cream, pink, 10),
    ...cloud(s, "cloud_sun", 245, [290, 360, 410, 470, 530, 600], [170, 150, 175, 120], cream, pink, 18),
    ...cloud(s, "cloud_left", 388, [-30, 20, 80, 150, 200], [300, 320, 340], cream, pink, 16),
    ...cloud(s, "cloud_mid", 615, [40, 70, 120, 175, 225], [575, 568, 588], cream, cream, 0),
    ...cloud(s, "cloud_low", 808, [300, 345, 410, 470, 540, 610], [740, 755, 720, 690], cream, pink, 18),
    vector(s, "trail_right", "M430 352 L586 612", CLEAR, { stroke: cream, strokeWidth: 3, lineCap: "round" }, undefined, 0, 0.8),
    vector(s, "trail_left", "M188 552 L560 1150", CLEAR, { stroke: cream, strokeWidth: 3, lineCap: "round" }, undefined, 0, 0.8),
    ...[
      [440, 372, 26],
      [458, 404, 30],
      [478, 440, 34],
      [500, 478, 30],
      [196, 566, 26],
      [214, 596, 30],
      [234, 630, 34],
      [256, 664, 30],
    ].map(([x, y, r], i) => ellipse(`puff${i}`, s.mid(x, y, r * 2, r * 2, 0, 0.45), cream)),
    vector(s, "wing_right", "M282 330 L595 276 L596 300 L422 448 Z", red),
    vector(s, "wing_right_top", "M282 330 L595 276 L590 290 L400 395 Z", orange),
    vector(s, "wing_right_edge", "M282 330 L595 276 L592 284 L292 342 Z", yellow),
    vector(s, "wing_left", "M215 378 L36 702 L52 704 L312 482 Z", red),
    vector(s, "wing_left_top", "M215 378 L36 702 L44 700 L262 438 Z", orange),
    vector(s, "wing_left_edge", "M215 378 L36 702 L42 704 L226 392 Z", yellow),
    vector(s, "stab_right", "M410 556 L566 556 L560 572 L452 612 Z", red),
    vector(s, "stab_right_top", "M410 556 L566 556 L470 588 Z", orange),
    vector(s, "stab_left", "M372 588 L432 612 L318 712 L306 712 Z", red),
    vector(s, "stab_left_top", "M372 588 L398 600 L306 712 Z", orange),
    rect("fuselage", f(0, 0, 650, 96), cream, { radius: 1 }),
    rect("belly", f(142, 0, 366, 96), plum, { radius: 1 }),
    rect("canopy", f(-118, 12, 272, 72), "#21608b", { radius: 1 }),
    rect("rear_strip", f(180, -36, 150, 22), cream, { radius: 1 }),
    ...[-205, -180, -155, -130, -105, -80].map((x, i) => ellipse(`window${i}`, f(x, -36, 9, 7), plum)),
    ...[130, 155, 180, 205, 230].map((x, i) => ellipse(`rear_window${i}`, f(x, -36, 9, 7), plum)),
    rect("windshield", f(-296, -18, 26, 7), plum, { radius: 1 }),
    rect("engine_right", e1(0, 0, 112, 46), cream, { radius: 1 }),
    rect("engine_right_tail", e1(48, 0, 22, 30), plum, { radius: 1 }),
    ellipse("engine_right_intake", e1(-44, 0, 26, 42), plum),
    rect("engine_left", e2(0, 0, 112, 46), cream, { radius: 1 }),
    rect("engine_left_tail", e2(48, 0, 22, 30), plum, { radius: 1 }),
    ellipse("engine_left_intake", e2(-44, 0, 26, 42), plum),
    line(s, "gear_right", "M378 404 L402 430 L426 414 M402 430 L412 452", plum, 10),
    ellipse("gear_right_wheel", s.mid(414, 458, 22, 18), plum),
    line(s, "gear_left", "M222 486 L246 512 L270 496 M246 512 L254 536", plum, 10),
    ellipse("gear_left_wheel", s.mid(256, 542, 22, 18), plum),
    frond(s, "palm_left", [-10, 760], [100, 670], [236, 700], 11, 80, 70, green, 5, [1]),
    frond(s, "palm_left_top", [-10, 680], [30, 640], [70, 610], 5, 50, 70, green, 4),
    t("title_small", "AS", 74, 826, 120, 50, 40, 400, plum, "left", { letterSpacing: 0.02 }),
    s.label("title_mid", "AVIADORAS", s.at(64, 870, 340, 90, -3), 72, { font: "anton", weight: 400, fill: plum, align: "left", leading: 1 }),
    s.label("title_big", "DO CÉU", s.at(60, 945, 340, 120, -3), 104, { font: "anton", weight: 400, fill: plum, align: "left", leading: 1 }),
    vector(s, "title_swash", "M250 1058 C290 1052 330 1044 362 1034 L364 1046 C330 1058 290 1066 250 1070 Z", plum),
    frond(s, "palm_right_up", [560, 1060], [520, 900], [540, 770], 12, 70, 55, green, 5),
    frond(s, "palm_right_left", [580, 1040], [480, 930], [390, 880], 11, 75, 60, green, 5),
    frond(s, "leaf_mass", [620, 1170], [450, 1060], [240, 1066], 9, 95, 62, "#236c4e", 16),
    frond(s, "leaf_back", [620, 1100], [540, 1010], [430, 985], 7, 70, 60, "#236c4e", 13),
    vector(s, "leaf_low", "M120 1112 C160 1080 220 1062 268 1070 C230 1100 170 1114 120 1112 Z", green),
  ]);
}

export function adWarsPoster(): Artboard {
  const s = sheet(1200, 1600);
  const char = "#49473f";
  const ivory = "#f5f2e7";
  const sand = "#ebe3ce";
  const gold = "#a28448";
  const t = writer(s, "montserrat");
  const diamonds: Layer[] = [];
  for (let row = 0; row < 3; row += 1) for (let col = -1; col < 6; col += 1) diamonds.push(vector(s, `diamond_${row}_${col}`, `M${240 + col * 180} ${95 + row * 240} L${330 + col * 180} ${215 + row * 240} L${240 + col * 180} ${335 + row * 240} L${150 + col * 180} ${215 + row * 240} Z`, sand));
  return s.board(char, [
    rect("panel", s.at(152, 100, 896, 712), ivory),
    ...diamonds,
    rect("panel_left_trim", s.at(0, 0, 152, 820), char),
    rect("panel_right_trim", s.at(1048, 0, 152, 820), char),
    rect("panel_top_trim", s.at(0, 0, 1200, 100), char),
    rect("clip_tab", s.at(568, 0, 67, 20), "#151513"),
    s.label("side_left", "QUINTA  9  DE  ABRIL  18H", s.mid(242, 460, 640, 40, -90), 25, { font: "montserrat", weight: 700, fill: gold, align: "center", spacing: 0.42 }),
    s.label("side_right", "BAR  DO  PORÃO  CENTRO", s.mid(958, 460, 640, 40, 90), 25, { font: "montserrat", weight: 700, fill: char, align: "center", spacing: 0.42 }),
    vector(s, "tail", "M405 545 C342 588 312 636 298 678 L372 678 C378 622 390 582 405 545 Z", char),
    rect("wheat_stem", s.at(381, 320, 4, 182), gold),
    ellipse("wheat_tip", s.mid(383, 332, 18, 46), gold),
    ...[372, 408, 444].flatMap((y, i) => [ellipse(`wheat_l${i}`, s.mid(370, y, 16, 44, -40), gold), ellipse(`wheat_r${i}`, s.mid(396, y, 16, 44, 40), i === 1 ? gold : char)]),
    ...[390, 426, 462].map((y, i) => ellipse(`wheat_d${i}`, s.mid(370, y, 14, 40, -40), char)),
    vector(s, "leg_hind_back", "M410 600 L470 600 L455 760 L438 760 L430 660 Z", gold),
    vector(s, "leg_hind", "M500 610 L560 610 L548 680 L560 745 L538 745 L520 690 Z", gold),
    vector(s, "leg_front", "M676 610 L716 610 L726 760 L706 760 Z", gold),
    vector(s, "leg_raised", "M700 572 L850 576 L850 690 L824 690 L824 616 L784 616 L780 642 L700 636 Z", gold),
    vector(s, "body", "M490 490 L700 490 L700 640 L490 640 C440 640 410 600 410 565 C410 525 445 490 490 490 Z", gold),
    vector(s, "neck", "M680 610 L680 470 C680 428 720 405 772 405 L868 405 L850 430 L850 540 L796 540 L796 502 C776 500 758 490 752 470 L752 610 Z", gold),
    line(s, "mane", "M694 500 L694 470 C694 436 724 418 772 418", char, 26, { lineCap: "butt" }),
    rect("bridle", s.at(795, 512, 46, 24), char),
    ellipse("eye", s.mid(818, 463, 16, 16), char),
    ...[
      [444, 760],
      [540, 742],
      [714, 760],
      [822, 688],
    ].map(([x, y], i) => vector(s, `hoof${i}`, `M${x} ${y} L${x + 22} ${y} L${x + 22} ${y + 20} C${x + 10} ${y + 20} ${x} ${y + 12} ${x} ${y} Z`, char)),
    vector(s, "crown", "M770 368 L770 304 L800 344 L815 304 L830 344 L858 304 L858 368 Z", gold),
    ...[770, 815, 858].map((x, i) => ellipse(`crown_dot${i}`, s.mid(x, 309, 14, 14), gold)),
    rect("crown_band", s.at(770, 368, 88, 24), char),
    rect("crown_gap", s.at(830, 368, 8, 24), ivory),
    vector(s, "rider_leg", "M520 490 L560 490 L560 580 C540 580 520 560 520 540 Z", char),
    rect("saddle", s.at(552, 588, 142, 24), char, { radius: 1 }),
    vector(s, "torso", "M488 486 L520 360 L560 360 L560 486 Z", gold),
    rect("belt", s.at(540, 398, 118, 32), char),
    vector(s, "pauldron", "M622 366 C642 366 656 380 656 400 L656 440 C656 450 648 458 638 458 L622 458 Z", gold),
    line(s, "arm", "M500 400 L478 268", char, 36, { lineCap: "butt" }),
    line(s, "forearm", "M488 330 L474 262", gold, 30, { lineCap: "butt" }),
    vector(s, "plume", "M520 278 C540 254 568 246 590 248 L590 282 C568 270 542 270 520 278 Z", char),
    vector(s, "helmet", "M556 356 L556 312 C556 296 570 284 588 284 C606 284 620 296 620 312 L620 356 Z", gold),
    rect("visor", s.at(568, 318, 40, 38), ivory),
    ...[572, 582, 592, 602].map((x, i) => rect(`visor_bar${i}`, s.at(x, 330, 4, 26), char)),
    rect("visor_brow", s.at(566, 318, 44, 10), char),
    line(s, "sword", "M462 248 L668 142", gold, 26, { lineCap: "butt" }),
    vector(s, "sword_tip", "M664 132 L696 128 L676 158 Z", char),
    line(s, "sword_guard", "M486 206 L512 252", char, 14, { lineCap: "butt" }),
    ellipse("sword_pommel", s.mid(442, 258, 24, 24), char),
    vector(s, "shield", "M546 456 L680 456 L680 610 L566 610 C556 610 546 600 546 590 Z", ivory),
    line(s, "shield_slash", "M562 552 L652 462", gold, 4, { lineCap: "butt" }),
    s.label("shield_a", "D", s.at(556, 462, 60, 60), 50, { font: "bungee", weight: 400, fill: char, align: "center" }),
    s.label("shield_b", "P", s.at(606, 512, 60, 60), 50, { font: "bungee", weight: 400, fill: char, align: "center" }),
    vector(s, "banner", "M152 812 L1048 812 L1048 980 C1048 1062 1000 1112 940 1142 L600 1308 L260 1142 C200 1112 152 1062 152 980 Z", gold),
    t("motto", "SÓ OS MAIS AFIADOS VÃO VENCER", 150, 842, 900, 32, 23, 700, char, "center", { letterSpacing: 0.42 }),
    s.label("title", "DUELO PUBLI", s.at(80, 892, 1040, 150), 108, { font: "bungee", weight: 400, fill: sand, align: "center", leading: 1, spacing: -0.03 }),
    t("subtitle", "O GRANDE QUIZ DE PUBLICIDADE DO ANO", 150, 1062, 900, 24, 16, 700, char, "center", { letterSpacing: 0.42 }),
    s.label("year_left", "20", s.at(400, 1118, 110, 60), 50, { font: "bungee", weight: 400, fill: ivory, align: "center" }),
    s.label("year_right", "26", s.at(684, 1118, 110, 60), 50, { font: "bungee", weight: 400, fill: ivory, align: "center" }),
    s.label("seal_text", "SABER INÚTIL É PODER", s.mid(600, 1180, 180, 150), 11, { font: "montserrat", weight: 700, fill: char, align: "center", spacing: 0.22 }, { curve: 0.9 }),
    vector(s, "seal_shield", "M576 1152 L586 1152 L586 1160 L596 1160 L596 1152 L606 1152 L606 1160 L616 1160 L616 1152 L624 1152 L624 1188 C624 1200 612 1208 600 1214 C588 1208 576 1200 576 1188 Z", sand),
    vector(s, "seal_bolt", "M604 1166 L588 1188 L599 1188 L594 1204 L612 1180 L601 1180 Z", gold),
    ellipse("seal_dot", s.mid(600, 1244, 7, 7), sand),
    vector(s, "base_triangle", "M600 1310 L967 1498 L233 1498 Z", gold),
    t("mark_club", "CLUBE SUL", 520, 1354, 160, 40, 26, 900, ivory, "center", { letterSpacing: -0.02 }),
    ellipse("mark_ring", s.mid(532, 1418, 32, 32), CLEAR, { stroke: ivory, strokeWidth: 4 }),
    t("mark_ring_text", "R", 518, 1404, 28, 28, 17, 800, ivory, "center"),
    t("mark_word", "RITMOUM", 554, 1403, 160, 32, 22, 800, ivory, "left"),
    t("info", "MAIS INFORMAÇÕES EM CLUBESUL.ORG", 300, 1456, 600, 22, 14, 700, char, "center", { letterSpacing: 0.3 }),
    t("printer", "IMPRESSO PELA GRÁFICA NORTE", 400, 1528, 400, 16, 9, 700, gold, "center", { letterSpacing: 0.35 }),
  ]);
}

function roughFrame(left: number, top: number, right: number, bottom: number, step: number, wobble: number): string {
  const jitter = (i: number) => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
  const pts: [number, number][] = [];
  let i = 0;
  for (let x = left; x < right; x += step) pts.push([x, top + jitter(i++) * wobble]);
  for (let y = top; y < bottom; y += step) pts.push([right - jitter(i++) * wobble, y]);
  for (let x = right; x > left; x -= step) pts.push([x, bottom - jitter(i++) * wobble]);
  for (let y = bottom; y > top; y -= step) pts.push([left + jitter(i++) * wobble, y]);
  return `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")} Z`;
}

function paw(s: Sheet, id: string, cx: number, cy: number, ink: string): Layer[] {
  return [
    ellipse(`${id}_pad`, s.mid(cx + 3, cy + 8, 20, 17), ink),
    ellipse(`${id}_toe0`, s.mid(cx - 12, cy - 3, 10, 13, -20), ink),
    ellipse(`${id}_toe1`, s.mid(cx - 4, cy - 13, 10, 13, -5), ink),
    ellipse(`${id}_toe2`, s.mid(cx + 8, cy - 13, 10, 13, 10), ink),
    ellipse(`${id}_toe3`, s.mid(cx + 17, cy - 3, 10, 13, 25), ink),
  ];
}

export function dogFlyer(): Artboard {
  const s = sheet(1600, 1200);
  const ink = "#1d1d1b";
  const t = writer(s, "montserrat");
  const caps = (id: string, value: string, cx: number, top: number, w: number, px: number, spacing = 0.14) => t(id, value, cx - w / 2, top, w, px * 1.3, px, 600, ink, "center", { letterSpacing: spacing });
  const gem = (id: string, cx: number, cy: number) => rect(id, s.mid(cx, cy, 14, 14, 45), ink);
  return s.board("#dbddd8", [
    caps("line1_a", "ADOÇÃO AO VIVO", 472, 42, 420, 30),
    gem("line1_gem", 688, 62),
    caps("line1_b", "COMIDA PARA GENTE + PETS", 1010, 42, 640, 30),
    caps("line2_a", "FEIRA DO BAIRRO", 376, 92, 380, 30),
    gem("line2_gem_a", 582, 110),
    caps("line2_b", "CABINE FOTO", 756, 92, 320, 30),
    gem("line2_gem_b", 940, 110),
    caps("line2_c", "MICROCHIP GRÁTIS", 1185, 92, 440, 30),
    photo("dog", photoAsset("sleepingDog"), s.at(190, 540, 1220, 540), { crop: { x: 240 / 1600, y: 270 / 1067, w: 1180 / 1600, h: 522 / 1067 }, blendMode: "multiply", filters: { brightness: 0.35, contrast: 60, saturation: -2, blur: 0 } }),
    vector(s, "frame", roughFrame(96, 158, 1504, 1096, 26, 3), CLEAR, { stroke: ink, strokeWidth: 7, lineJoin: "round" }),
    vector(s, "frame_grit", roughFrame(97, 157, 1503, 1097, 17, 4), CLEAR, { stroke: ink, strokeWidth: 3, lineJoin: "round" }),
    caps("friday", "SEXTA", 800, 228, 400, 38, 0.14),
    s.label("date", "10 JUNHO", s.at(540, 296, 520, 84), 72, { font: "alfa-slab-one", weight: 400, fill: ink, align: "center", leading: 1 }),
    caps("place", "PÁTIO DO BECO DA PRAÇA", 805, 392, 520, 25, 0.06),
    caps("hours", "18H ÀS 21H", 797, 450, 400, 38, 0.2),
    t("left_note", "CÃES\nAMIGÁVEIS\nBEM-VINDOS", 225, 302, 260, 130, 25, 600, ink, "center", { letterSpacing: 0.08, lineHeight: 1.68 }),
    t("right_note", "UMA FEIRA\nPOP-UP EM PROL\nDOS PETS SEM\nLAR DE VILA\nSERENA", 1090, 263, 340, 210, 24, 600, ink, "center", { letterSpacing: 0.06, lineHeight: 1.69 }),
    ...paw(s, "paw_left", 266, 1150, ink),
    caps("hosts", "REALIZAÇÃO: LOJA TROPEL, RALI + VET CENTRO", 798, 1132, 1000, 28, 0.13),
    ...paw(s, "paw_right", 1330, 1150, ink),
  ]);
}

export function artsPoster(): Artboard {
  const s = sheet(1200, 1600);
  const cream = "#f0e4d5";
  const rust = "#d35a29";
  const amber = "#f79424";
  const brown = "#865420";
  const ink = "#070706";
  const t = writer(s, "fraunces");
  const body = "Junte-se ao Clube Sul numa noite de cerveja\nartesanal e colagem de arte. Faça o seu\npróprio copo de lembrança para as farras.\nPetiscos e boas risadas inclusos.";
  return s.board(cream, [
    rect("clip_tab", s.at(568, 0, 67, 20), "#1c1c1e"),
    t("title_top", "Artes &", 60, 176, 640, 160, 150, 400, ink, "left", { lineHeight: 1, letterSpacing: -0.05 }),
    t("title_bottom", "Ofícios", 60, 318, 640, 160, 150, 400, ink, "left", { lineHeight: 1, letterSpacing: -0.05 }),
    rect("rule_top", s.at(66, 474, 527, 2), ink),
    t("body", body, 66, 494, 560, 140, 26, 300, ink, "left", { lineHeight: 1.29, letterSpacing: -0.01 }),
    rect("rule_mid", s.at(66, 646, 527, 2), ink),
    t("date", "26 de setembro\n18h", 66, 664, 240, 72, 28, 700, ink, "left", { lineHeight: 1.18 }),
    t("venue", "Cervejaria Ponte Alta", 309, 664, 320, 36, 28, 700, ink, "left"),
    t("address", "Rua das Pedras, 1041, sala 2,\nVila Serena, MG", 309, 696, 320, 60, 22, 400, ink, "left", { lineHeight: 1.2 }),
    rect("rule_low", s.at(66, 769, 527, 2), ink),
    t("more", "Mais informações em clubesul.org", 66, 791, 500, 30, 21, 400, ink, "left"),
    vector(s, "goblet_foam", "M668 67 L935 67 L953 122 L652 122 Z", "#ffffff"),
    vector(s, "goblet_bowl", "M652 122 L955 122 A153.2 153.2 0 1 1 652 122 Z", rust, {}, [650.3, -8.4, 306.4, 306.4]),
    ...[675, 721, 768].map((x, i) => rect(`goblet_stripe${i}`, s.at(x, 122, 22, 190), cream)),
    rect("goblet_cut", s.at(790, 122, 6, 190), cream),
    ...[35, 60, 85, 110, 135].map((r, i) => arcLine(s, `goblet_ring${i}`, 800, 122, r, 0, 90, amber, 4)),
    vector(s, "goblet_stem", "M803 315 C818 368 856 404 898 410 L707 410 C750 404 788 368 803 315 Z", rust),
    vector(s, "pint_foam", "M828 410 L1130 410 L1121 490 L835 490 Z", "#ffffff"),
    vector(s, "pint_beer", "M835 490 L1121 490 L1077 820 L878 820 Z", amber),
    vector(s, "pint_dregs", "M858 672 L1050 820 L878 820 Z", brown),
    ...[
      [880, 660],
      [915, 633],
      [950, 610],
      [985, 585],
      [1018, 562],
      [1052, 537],
      [1086, 513],
    ].map(([x, top], i) => rect(`pint_line${i}`, s.at(x - 2, top, 4, 820 - top), rust)),
    vector(s, "pint_trim", "M1121 490 L1135 490 L1091 820 L1077 820 Z", cream),
    vector(s, "tulip_foam", "M782 822 L968 822 L985 886 L768 886 Z", "#ffffff"),
    vector(s, "tulip_body", "M768 886 L985 886 C1000 920 1017 960 1017 1000 C1017 1060 940 1120 875 1190 C810 1120 733 1060 733 1000 C733 960 752 920 768 886 Z", "#000000"),
    ...[908, 955, 1003].map((y, i) => rect(`tulip_band${i}`, s.at(908, y, 112, 23), cream)),
    vector(s, "tulip_edge", "M985 886 C1000 920 1017 960 1017 1000 L1040 1000 L1040 886 Z", cream),
    ...[762, 794, 826, 858, 890, 922, 954, 986].map((x, i) => rect(`tulip_line${i}`, s.at(x - 1.5, 1027, 3, 1184 - Math.abs(x - 875) - 1027), brown)),
    vector(s, "tulip_stem", "M875 1205 C890 1260 930 1296 972 1302 L778 1302 C820 1296 860 1260 875 1205 Z", "#000000"),
    ellipse("head", s.mid(258, 1147, 386, 386), brown),
    vector(s, "face", "M258 1147 L394.5 1010.5 A193 193 0 0 1 394.5 1283.5 Z", amber, {}, [65, 954, 386, 386]),
    vector(s, "eye_lid", "M308 1176 C300 1120 350 1072 415 1068 C422 1120 380 1172 308 1176 Z", "#000000"),
    vector(s, "eye_white", "M308 1176 L415 1068 C422 1120 380 1172 308 1176 Z", cream),
    ellipse("eye_pupil", s.mid(364, 1123, 44, 44), "#000000"),
    vector(s, "shoulder", "M65 1533 A193 193 0 0 1 258 1340 L258 1533 Z", rust, {}, [65, 1340, 193, 193]),
    ...[33, 63, 93, 123, 153].map((r, i) => arcLine(s, `shoulder_ring${i}`, 258, 1533, r, 180, 270, amber, 4)),
    vector(s, "sleeve", "M258 1340 L680 1340 L628 1533 L258 1533 Z", "#000000"),
    ...[1373, 1405, 1438, 1470, 1503].map((y, i) => rect(`sleeve_stripe${i}`, s.at(258, y - 2, 422 - ((y - 1340) * 52) / 193, 4), amber)),
    vector(s, "palm", "M680 1340 L805 1340 L805 1460 L648 1460 Z", brown),
    rect("finger_top", s.at(760, 1340, 72, 17), brown, { radius: 1 }),
    rect("thumb", s.at(869, 1302, 15, 79), brown, { radius: 1 }),
    rect("thumb_base", s.at(770, 1365, 114, 16), brown, { radius: 1 }),
    rect("finger_gap", s.at(774, 1356, 90, 10), cream, { radius: 1 }),
    rect("finger_a", s.at(770, 1392, 171, 16), brown, { radius: 1 }),
    rect("finger_b", s.at(770, 1420, 156, 15), brown, { radius: 1 }),
    rect("finger_c", s.at(770, 1445, 145, 15), brown, { radius: 1 }),
    ...[1381, 1408, 1435].map((y, i) => rect(`finger_split${i}`, s.at(800, y, 40, y === 1435 ? 10 : 12), cream, { radius: 1 })),
    t("mark_club", "CLUBE\nSUL", 800, 1494, 70, 44, 17, 900, ink, "center", { lineHeight: 1 }),
    ellipse("mark_ring", s.mid(911, 1514, 38, 38), "#00000000", { stroke: ink, strokeWidth: 4 }),
    t("mark_ring_text", "R", 896, 1500, 30, 30, 20, 800, ink, "center"),
    t("mark_word", "RITMOUM", 936, 1499, 160, 32, 23, 800, ink, "left", { letterSpacing: 0.02, fontId: "montserrat" }),
    s.label("printer", "Impresso pela Gráfica Norte", s.mid(1120, 1472, 130, 14, -90), 10, { font: "fraunces", weight: 700, fill: ink, align: "center" }),
  ]);
}

export function postersCorpus(): CorpusEntry[] {
  return [
    {
      id: "sota-arts-poster",
      title: "Pôster de evento Artes & Ofícios com copos geométricos",
      useCase: "pôster de evento de associação criativa",
      sources: [dribbble("9524116-AAF-Omaha-Arts-Crafts-event-poster-design", "AAF Omaha Arts & Crafts event poster design", "867 likes, 155k views")],
      intent: "Mid-century event poster on cream: the left half carries a two line soft serif title set huge and tight, three thin black rules dividing a four line body paragraph, a two column date and venue block in bold plus regular, and a small info line. The right edge stacks three flat geometric beer glasses (goblet in rust, pint in amber with a brown sediment triangle, black tulip glass) each with a white foam band, balanced on the hand of a pac-man style figure at the bottom left: a brown circle head with an amber quarter face and an almond eye, a rust quarter shoulder with concentric arcs and a striped black sleeve. Flat rust, amber, brown and black, no shadows, small sponsor marks bottom right.",
      brief: "Pôster do evento Artes & Ofícios do Clube Sul: fundo creme, título serifado enorme à esquerda com filetes, texto curto, data 26 de setembro às 18h e endereço da Cervejaria Ponte Alta, e uma ilustração geométrica de três copos de cerveja equilibrados na mão de um personagem, em laranja, marrom e preto.",
      photos: [],
      make: artsPoster,
    },
    {
      id: "sota-aviation-card",
      title: "Marcador retrô de aviação com céu lilás",
      useCase: "marcador de página e pôster ilustrado vintage",
      sources: [dribbble("23663755-Bookmark-illustration-Retro-poster-design-Vintage-poster", "Bookmark illustration, retro poster design, vintage poster", "450 likes")],
      intent: "Tall retro travel bookmark with a rounded top corner: a flat lilac sky with a half hidden orange sun top right, scalloped clouds with cream rims and pink fill stacked at several depths, a big airliner seen from below crossing diagonally from top left to center right (cream fuselage with a blue canopy and plum rear belly, orange, yellow and red swept wings, two cream engines with plum intakes, landing gear) leaving two thin cream contrails with puffs. Green palm fronds frame the bottom corners and overlap a heavy condensed plum title in three steps (small, medium, big) slightly rotated with a swash under it. Flat vintage palette, no outlines.",
      brief: "Marcador de página retrô 'As Aviadoras do Céu': céu lilás, sol laranja, nuvens com borda creme e miolo rosa, um avião visto de baixo em diagonal com asas laranja e vermelhas, rastros brancos, folhas de palmeira verdes e o título em letras condensadas roxo escuro embaixo.",
      photos: [],
      make: aviationCard,
    },
    {
      id: "sota-adwars-poster",
      title: "Pôster de quiz de publicidade com cavaleiro geométrico",
      useCase: "pôster de evento de associação de publicidade",
      sources: [dribbble("6172370-AAF-Omaha-Ad-Wars-event-poster-design", "AAF Omaha Ad Wars event poster design", "446 likes")],
      intent: "Charcoal poster with a cream panel in the upper half carrying a soft harlequin diamond pattern; a flat geometric knight on a horse in gold and charcoal (pencil as sword, crowned horse, shield with two initials, wheat sprig at the left) fills the panel between two vertical widely tracked lines of copy (gold on the left, charcoal on the right). Below, a gold pentagon shield shape continues the panel to a point: tracked dark motto, a huge chunky light title, a tracked subtitle, the year split around a small circular seal with curved text. A gold triangle mirrors the point at the bottom holding sponsor placeholders and a tracked info line, with a tiny printer credit under it.",
      brief: "Pôster do Duelo Publi, o grande quiz de publicidade do ano: fundo grafite, painel creme com losangos e um cavaleiro geométrico dourado com lápis no lugar da espada, escudo dourado embaixo com o título grande, data quinta 9 de abril às 18h no Bar do Porão e o ano 2026.",
      photos: [],
      make: adWarsPoster,
    },
    {
      id: "sota-dog-flyer",
      title: "Flyer de feira de adoção com cão gravado",
      useCase: "flyer de evento beneficente de adoção de animais",
      sources: [dribbble("2726286-Dog-Days-of-Summer-event-flyer", "Dog Days of Summer event flyer", "254 likes")],
      intent: "Landscape flyer on warm light gray in black ink only: two centered lines of widely tracked caps with diamond separators above a rough hand inked rectangular frame. Inside, a symmetric three column header (a three line note left, the stacked date block center with a tracked day, a heavy slab date, a place line and the hours, a five line note right) sits over an engraving style sleeping dog that fills the lower half of the frame edge to edge. A tracked credit line with two paw prints closes the bottom outside the frame.",
      brief: "Flyer da feira de adoção de sexta, 10 de junho, das 18h às 21h no Pátio do Beco da Praça: fundo cinza claro, tudo em preto, moldura com traço irregular, textos em caixa alta espaçada e a foto de um cão dormindo em alto contraste como gravura.",
      photos: ["sleepingDog"],
      make: dogFlyer,
    },
  ];
}
