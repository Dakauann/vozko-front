import type { Artboard, Layer } from "@/lib/studio/document";

import { CLEAR, drop, ellipse, linear, radial, rect, sheet, soft, star, writer, type Sheet } from "../authoring";
import { photoIn, placedPhoto } from "../photos";
import type { CorpusEntry } from "../extended/corpus";
import { dribbble, line, sector, vector } from "./kit";

const NAVY = "#222237";
const MINT = "#00ec85";

function fintechLogo(s: Sheet, word: string): Layer[] {
  const t = writer(s, "raleway");
  return [
    sector(s, "logo_ring", 130, 154, 26, 12, 300, 240, MINT),
    ellipse("logo_dot", s.mid(130, 154, 10, 10), MINT),
    t("logo_word", "Fundora", 186, 122, 300, 64, 50, 600, word),
  ];
}

function fintechCopy(s: Sheet, kicker: string, title: string, tag: string, ink: string, muted: string, px = 88): Layer[] {
  const t = writer(s, "raleway");
  return [
    t("kicker", kicker, 105, 368, 500, 40, 29, 700, muted, "left", { letterSpacing: 0.01 }),
    t("title", title, 103, 424 + (88 - px) * 0.9, 860, 214, px, 700, ink, "left", { lineHeight: 103 / px, letterSpacing: -0.01 }),
    t("hashtag", tag, 105, 913, 600, 44, 30, 600, muted, "left"),
  ];
}

function repeatBadge(s: Sheet, left: number, top: number): Layer[] {
  const size = 86;
  const x = (v: number) => left + v;
  const y = (v: number) => top + v;
  return [
    s.card("badge", s.at(left, top, size, size), "#7d97b4", 14, { gradient: linear("#a3b8cf", "#5c7896", 90) }),
    line(s, "badge_top", `M${x(22)} ${y(44)} L${x(22)} ${y(36)} C${x(22)} ${y(30)} ${x(26)} ${y(28)} ${x(32)} ${y(28)} L${x(58)} ${y(28)}`, "#ffffff", 7),
    vector(s, "badge_top_head", `M${x(56)} ${y(18)} L${x(70)} ${y(28)} L${x(56)} ${y(38)} Z`, "#ffffff"),
    line(s, "badge_bottom", `M${x(64)} ${y(44)} L${x(64)} ${y(52)} C${x(64)} ${y(58)} ${x(60)} ${y(60)} ${x(54)} ${y(60)} L${x(28)} ${y(60)}`, "#ffffff", 7),
    vector(s, "badge_bottom_head", `M${x(30)} ${y(50)} L${x(16)} ${y(60)} L${x(30)} ${y(70)} Z`, "#ffffff"),
  ];
}

export function fintechArcs(): Artboard {
  const s = sheet(1080, 1080);
  return s.board(NAVY, [
    sector(s, "ring_top_a", 761, -20, 206, 101, 0, 180, MINT),
    sector(s, "ring_top_b", 761, -20, 206, 101, 180, 360, MINT),
    sector(s, "arc_right", 1050, 582, 212, 107, 104, 220, MINT),
    sector(s, "arc_mid", 597, 767, 208, 101, 332, 59, MINT),
    sector(s, "arc_low_left", 660, 940, 218, 113, 92, 204, MINT),
    sector(s, "arc_low_right", 950, 1113, 206, 102, 160, 300, MINT),
    ...fintechLogo(s, "#ffffff"),
    ...fintechCopy(s, "GESTÃO", "Usando transações\nrecorrentes", "#conheçaoapp", "#ffffff", "#6f6f80", 78),
    ...repeatBadge(s, 556, 543),
  ]);
}

export function fintechLines(): Artboard {
  const s = sheet(1080, 1080);
  const count = 18;
  const arches = Array.from({ length: count }, (_, i) => {
    const k = i / (count - 1);
    const left = 453 + 347 * (1 - (1 - k) * (1 - k));
    const apexX = 957 - 87 * k;
    const apexY = 637 + 153 * k * k;
    const right = 1461 - 371 * k;
    const base = 1100;
    const c = 0.5523;
    const d = `M${left} ${base} C${left} ${base - c * (base - apexY)} ${apexX - c * (apexX - left)} ${apexY} ${apexX} ${apexY} C${apexX + c * (right - apexX)} ${apexY} ${right} ${base - c * (base - apexY)} ${right} ${base}`;
    return line(s, `arch${i}`, d, NAVY, i % 3 === 1 ? 2 : 3.6);
  });
  return s.board("#f3f3f3", [...arches, ...fintechLogo(s, NAVY), ...fintechCopy(s, "PLANEJAMENTO", "Foque na sua\nrenda real", "#nós fazemos por você", NAVY, "#9a9aa6")]);
}

const TEAL_DARK = "#084550";

function rumpiFooter(s: Sheet, page: string): Layer[] {
  const t = writer(s, "fredoka");
  return [t("page", page, 595, 994, 200, 40, 28, 500, "#ffffff", "left"), t("hashtag", "#vocêsabia", 760, 990, 266, 44, 31, 500, "#ffffff", "right")];
}

function rumpiLogo(s: Sheet, left: number, top: number): Layer {
  return writer(s, "fredoka")("logo", "LUMI", left, top, 160, 40, 34, 700, "#ffffff", "left", { letterSpacing: 0.02 });
}

export function tealTips(): Artboard {
  const s = sheet(1080, 1080);
  const t = writer(s, "inter");
  const cells = [0, 1, 2].flatMap((row) =>
    [0, 1, 2].flatMap((col) => {
      const left = col * 180;
      const top = 540 + row * 180;
      return [ellipse(`dot_${row}_${col}`, s.at(left, top, 180, 180), (row + col) % 2 === 0 ? "#ffffff" : "#538892"), rect(`dot_${row}_${col}_cut`, s.at(left, top, 90, 90), TEAL_DARK)];
    }),
  );
  const body = "O marketing eficaz começa com uma\nestratégia pensada e bem\ninformada. Uma boa estratégia\nde marketing ajuda você a\ndefinir objetivos claros, realistas\ne mensuráveis para o seu\nnegócio.";
  return s.board("#185c67", [
    rect("photo_back", s.at(0, 0, 540, 540), "#4e818a"),
    placedPhoto("photo", "potPlant", s.at(0, 0, 540, 540), s, {}, 0.5, 0.55),
    rect("photo_shade", s.at(0, 0, 540, 540, 0, 0.45), "#4e818a", { blendMode: "multiply" }),
    rect("photo_tint", s.at(0, 0, 540, 540, 0, 0.6), "#4e818a", { blendMode: "color" }),
    rect("pattern_back", s.at(0, 540, 540, 540), TEAL_DARK),
    ...cells,
    rumpiLogo(s, 595, 50),
    t("title", "10 dicas para\ncriar uma\nestratégia de\nmarketing\neficaz", 594, 141, 480, 380, 62, 700, "#ffffff", "left", { lineHeight: 1.18, letterSpacing: -0.01 }),
    t("body", body, 595, 552, 480, 300, 25, 400, "#ffffff", "left", { lineHeight: 1.7 }),
    ...rumpiFooter(s, "1 DE 6"),
  ]);
}

const CHECKER = ["DWDPDW", "WWPPWW", "DPDWDP", "PPWWPP", "DWDPDW", "WWPPWW"];
const CHECKER_FILL: Record<string, string> = { D: "#d33537", W: "#ffffff", P: "#ff7a7b" };

function quoteMark(s: Sheet, id: string, x: number, y: number): Layer {
  return vector(s, id, `M${x} ${y + 44} L${x} ${y + 22} C${x} ${y + 8} ${x + 8} ${y} ${x + 20} ${y} L${x + 21} ${y + 9} C${x + 14} ${y + 11} ${x + 12} ${y + 15} ${x + 12} ${y + 21} L${x + 21} ${y + 21} L${x + 21} ${y + 44} Z`, "#ffffff");
}

export function redPlan(): Artboard {
  const s = sheet(1080, 1080);
  const t = writer(s, "inter");
  const checker = CHECKER.flatMap((rowKeys, row) => [...rowKeys].map((k, col) => rect(`check_${row}_${col}`, s.at(540 + col * 90, row * 90, 90, 90), CHECKER_FILL[k])));
  const quote = "Um plano de negócios é um bom ponto\nde partida: define suas habilidades e\nfraquezas, o que você oferece, como\nisso é único e como você pretende\nexpandir a sua oferta.";
  return s.board("#ff4d4f", [
    rect("title_block", s.at(0, 0, 540, 540), "#fc4d4f"),
    rect("checker_back", s.at(540, 0, 540, 540), "#ffffff"),
    ...checker,
    rect("photo_back", s.at(0, 540, 540, 540), "#ff7a7b"),
    placedPhoto("photo", "coffeeRed", s.at(0, 540, 540, 540), s, {}, 0.5, 0.5),
    rect("quote_block", s.at(540, 540, 540, 540), "#ff4d4f"),
    rumpiLogo(s, 55, 47),
    t("title", "Tenha um plano\nde negócio sólido", 54, 222, 486, 160, 55, 700, "#ffffff", "left", { lineHeight: 1.31, letterSpacing: -0.01 }),
    t("body", "O planejamento tem papel decisivo\nno sucesso de qualquer negócio.", 55, 408, 485, 90, 25, 400, "#ffffff", "left", { lineHeight: 1.7 }),
    quoteMark(s, "quote_a", 596, 596),
    quoteMark(s, "quote_b", 624, 596),
    t("quote", quote, 595, 670, 480, 220, 25, 400, "#ffffff", "left", { lineHeight: 1.7 }),
    t("swipe", "Deslize →", 595, 905, 300, 40, 25, 700, "#ffffff", "left"),
    ...rumpiFooter(s, "1 DE 5"),
  ]);
}

function heartPath(cx: number, cy: number, w: number, h: number): string {
  const x = (v: number) => cx + v * w;
  const y = (v: number) => cy + v * h;
  return `M${x(0)} ${y(0.5)} C${x(-0.2)} ${y(0.27)} ${x(-0.5)} ${y(0.04)} ${x(-0.5)} ${y(-0.22)} C${x(-0.5)} ${y(-0.4)} ${x(-0.4)} ${y(-0.5)} ${x(-0.26)} ${y(-0.5)} C${x(-0.13)} ${y(-0.5)} ${x(-0.05)} ${y(-0.4)} ${x(0)} ${y(-0.3)} C${x(0.05)} ${y(-0.4)} ${x(0.13)} ${y(-0.5)} ${x(0.26)} ${y(-0.5)} C${x(0.4)} ${y(-0.5)} ${x(0.5)} ${y(-0.4)} ${x(0.5)} ${y(-0.22)} C${x(0.5)} ${y(0.04)} ${x(0.2)} ${y(0.27)} ${x(0)} ${y(0.5)} Z`;
}

const BLUSH = "#ffb4c8";

export function spreadLove(): Artboard {
  const s = sheet(1080, 1080);
  const rings = [158, 197, 237, 277, 318, 357, 396, 436, 476, 516].map((r, i) => ellipse(`ring${i}`, s.mid(540, 390, 2 * r, 2 * r, 0, 0.7), CLEAR, { stroke: "#dc5f88", strokeWidth: 5 }));
  return s.board(BLUSH, [
    ellipse("glow_top", s.mid(540, 150, 640, 1100), CLEAR, { gradient: radial("#f562a3", "#f562a300", 0.5, 0.45, 0.5) }),
    ellipse("glow_mid", s.mid(540, 560, 680, 900), CLEAR, { gradient: radial("#f47aa6", "#f47aa600", 0.5, 0.5, 0.5) }),
    ellipse("glow_low", s.mid(540, 1010, 720, 700), CLEAR, { gradient: radial("#ee3f47", "#ee3f4700", 0.5, 0.55, 0.5) }),
    ellipse("glow_core", s.mid(540, 1040, 460, 420), CLEAR, { gradient: radial("#ef444c", "#ef444c00", 0.5, 0.5, 0.5) }),
    ...rings,
    rect("mask_left", s.at(0, 0, 180, 1080), BLUSH),
    rect("mask_right", s.at(900, 0, 180, 1080), BLUSH),
    vector(s, "heart", heartPath(540, 393, 96, 78), "#000000"),
    s.label("title", "ESPALHE\nAMOR", s.at(90, 818, 900, 250), 108, { font: "archivo-black", weight: 400, fill: "#000000", align: "center", leading: 1.11, spacing: 0.03 }),
  ]);
}

export function stripesQuestion(): Artboard {
  const s = sheet(1080, 1080);
  const stripes = Array.from({ length: 33 }, (_, i) => rect(`stripe${i}`, s.at(152 + i * 24.16 - 3, 0, 6, 1080), "#7d6e7f"));
  return s.board("#d5c4d6", [...stripes, s.label("question", "É POSSÍVEL\nVIVER O\nMOMENTO\nPRESENTE?", s.at(90, 404, 900, 390), 70, { font: "archivo-black", weight: 400, fill: "#000000", align: "center", leading: 1.36, spacing: 0.06 })]);
}

export function dessertDetail(): Artboard {
  const s = sheet(750, 1630);
  const ink = "#282a3a";
  const t = writer(s, "roboto");
  const body = "Este Morango com Coco Crocante vem cheio de\nmorangos frescos, só um pouco de açúcar e\ncoco para virar a sobremesa mais deliciosa,\ndourada e borbulhante!";
  return s.board("#dddfec", [
    ...photoIn(s.card("hero", s.at(0, 0, 750, 900), "#e1e0e7", 50), "bowl", s, 0.5, 0.5),
    s.card("back", s.at(52, 70, 68, 68), ink, 20, { effects: soft("back", "#000000", 0.2, 8, 18) }),
    line(s, "back_arrow", "M101 104 L71 104 M85 90 L71 104 L85 118", "#ffffff", 5),
    s.card("menu", s.at(628, 70, 69, 68), ink, 20, { effects: soft("menu", "#000000", 0.2, 8, 18) }),
    ...[93, 104, 115].map((y, i) => ellipse(`menu_dot${i}`, s.mid(662, y, 7, 7), "#ffffff")),
    s.card("rating", s.at(130, 680, 490, 58), "#ffba59", 29),
    ...[0, 1, 2, 3, 4].map((i) => star(`rating_star${i}`, s.mid(163 + i * 36, 709, 30, 30, 0, i === 4 ? 0.45 : 1), "#ffffff", 5, 0.45)),
    t("rating_value", "4,5", 343, 692, 70, 34, 24, 700, "#ffffff"),
    t("rating_link", "VER AVALIAÇÕES", 392, 693, 206, 34, 22, 700, "#ffffff", "right"),
    s.card("sheet", s.at(0, 773, 750, 857), "#ffffff", 75),
    s.label("title", "Morango com\nCoco Crocante", s.at(48, 872, 690, 270), 116, { font: "great-vibes", weight: 400, fill: ink, align: "left", leading: 0.98 }),
    t("body", body, 63, 1176, 680, 200, 28, 400, "#6e7191", "left", { lineHeight: 1.71 }),
    s.card("cta", s.at(70, 1430, 462, 127), ink, 63),
    t("cta_text", "ADICIONAR AO PEDIDO", 70, 1474, 462, 40, 25, 700, "#ffffff", "center", { letterSpacing: 0.06 }),
    ellipse("fav", s.mid(615, 1493, 128, 128), "#ff468d", { effects: [drop("fav_glow", "#ff468d", 0.4, 0, 28, 44)] }),
    vector(s, "fav_heart", heartPath(615, 1494, 42, 36), "#ffffff"),
  ]);
}

const ORANGE = "#d9692b";
const LABEL = "#fcf7f1";
const BEE = "#1f1a18";

function hatchedFruit(s: Sheet, id: string, cx: number, cy: number, w: number, h: number, step: number): Layer[] {
  const strokes: string[] = [];
  for (let x = cx - w / 2 + step / 2; x < cx + w / 2; x += step) strokes.push(`M${x} ${cy - h / 2 - 4} Q${x + (x - cx) * 0.35} ${cy} ${x} ${cy + h / 2 + 4}`);
  return [ellipse(id, s.mid(cx, cy, w, h), LABEL, { stroke: ORANGE, strokeWidth: 5 }), line(s, `${id}_hatch`, strokes.join(" "), ORANGE, 2.4, { clip: true, lineCap: "butt" })];
}

function leaf(s: Sheet, id: string, bx: number, by: number, tx: number, ty: number, width: number): Layer[] {
  const mx = (bx + tx) / 2;
  const my = (by + ty) / 2;
  const len = Math.hypot(tx - bx, ty - by);
  const nx = (-(ty - by) / len) * width;
  const ny = ((tx - bx) / len) * width;
  return [
    vector(s, id, `M${bx} ${by} Q${mx + nx} ${my + ny} ${tx} ${ty} Q${mx - nx} ${my - ny} ${bx} ${by} Z`, ORANGE),
    line(s, `${id}_vein`, `M${bx + (tx - bx) * 0.06} ${by + (ty - by) * 0.06} Q${mx + nx * 0.12} ${my + ny * 0.12} ${bx + (tx - bx) * 0.9} ${by + (ty - by) * 0.9}`, LABEL, 2.2),
  ];
}

function bee(s: Sheet, id: string, cx: number, cy: number, size: number, dir: 1 | -1): Layer[] {
  const u = size / 100;
  const x = (v: number) => cx + v * u * dir;
  const y = (v: number) => cy + v * u;
  const tilt = 20 * dir;
  return [
    ellipse(`${id}_wing_back`, s.mid(x(-14), y(-34), 34 * u, 62 * u, -30 * dir), LABEL, { stroke: BEE, strokeWidth: Math.max(1, 1.6 * u) }),
    ellipse(`${id}_wing_front`, s.mid(x(4), y(-38), 30 * u, 58 * u, -6 * dir), LABEL, { stroke: BEE, strokeWidth: Math.max(1, 1.6 * u) }),
    line(s, `${id}_wing_veins`, `M${x(-8)} ${y(-10)} L${x(-20)} ${y(-56)} M${x(2)} ${y(-10)} L${x(6)} ${y(-60)}`, BEE, Math.max(0.8, 1 * u)),
    ellipse(`${id}_body`, s.mid(x(-6), y(4), 64 * u, 40 * u, tilt), BEE),
    line(s, `${id}_stripes`, `M${x(-18)} ${y(-12)} Q${x(-24)} ${y(4)} ${x(-14)} ${y(22)} M${x(-2)} ${y(-14)} Q${x(-8)} ${y(4)} ${x(2)} ${y(22)}`, LABEL, Math.max(1, 3 * u)),
    ellipse(`${id}_head`, s.mid(x(32), y(16), 22 * u, 22 * u), BEE),
    line(s, `${id}_legs`, `M${x(-4)} ${y(22)} L${x(-12)} ${y(38)} M${x(8)} ${y(24)} L${x(6)} ${y(42)} M${x(18)} ${y(22)} L${x(24)} ${y(38)}`, BEE, Math.max(1, 2 * u)),
    line(s, `${id}_antenna`, `M${x(38)} ${y(8)} Q${x(46)} ${y(-6)} ${x(56)} ${y(-4)} M${x(40)} ${y(12)} Q${x(52)} ${y(4)} ${x(60)} ${y(8)}`, BEE, Math.max(0.8, 1.4 * u)),
  ];
}

export function lemonadeLabel(): Artboard {
  const s = sheet(1000, 1210);
  const brown = "#3a0a03";
  const t = writer(s, "poppins");
  return s.board(LABEL, [
    s.label("brand", "FLORABELA", s.at(110, 70, 770, 260), 94, { font: "libre-baskerville", weight: 400, fill: brown, align: "center", leading: 1, spacing: 0.15 }, { curve: 0.52 }),
    t("flavor", "SABOR LARANJA", 300, 262, 400, 42, 29, 600, "#4f3229", "center", { letterSpacing: 0.01 }),
    t("volume", "33,3cl/330ml", 140, 384, 200, 28, 17, 400, "#3d2a25", "left", { letterSpacing: 0.02 }),
    t("abv", "Alc. 0% Vol", 700, 384, 154, 28, 17, 400, "#3d2a25", "right", { letterSpacing: 0.02 }),
    line(s, "branch", "M560 600 C600 560 630 520 640 480 C650 450 670 420 703 400 M590 610 C640 640 680 650 700 660 C740 690 770 720 798 742 M640 640 C650 700 660 760 662 860", ORANGE, 5),
    ...leaf(s, "leaf_top_a", 505, 458, 366, 395, 30),
    ...leaf(s, "leaf_top_b", 548, 445, 488, 342, 34),
    ...leaf(s, "leaf_stem", 640, 470, 703, 402, 14),
    ...hatchedFruit(s, "orange_back", 520, 532, 232, 200, 9),
    ...leaf(s, "leaf_right_a", 600, 560, 690, 640, 26),
    ...leaf(s, "leaf_right_b", 590, 610, 600, 770, 34),
    ...leaf(s, "leaf_right_c", 640, 610, 668, 790, 30),
    ...leaf(s, "leaf_right_d", 700, 660, 798, 742, 26),
    ...leaf(s, "leaf_right_e", 720, 700, 744, 815, 20),
    ...leaf(s, "leaf_right_f", 690, 720, 658, 866, 22),
    ...leaf(s, "leaf_low_a", 560, 780, 574, 910, 30),
    ...leaf(s, "leaf_low_b", 600, 770, 642, 826, 22),
    ...hatchedFruit(s, "orange_main", 390, 732, 276, 262, 8),
    ...hatchedFruit(s, "orange_slice", 418, 842, 232, 138, 8),
    ...leaf(s, "leaf_left", 262, 606, 560, 600, 50),
    ...bee(s, "bee_a", 205, 548, 130, 1),
    ...bee(s, "bee_b", 795, 560, 92, -1),
    ...bee(s, "bee_c", 205, 826, 58, 1),
    ...bee(s, "bee_d", 815, 840, 30, -1),
    t("product", "limonada artesanal", 100, 944, 800, 76, 62, 500, "#6a4e47", "center", { letterSpacing: -0.01 }),
    t("tagline", "A GRANDE HISTÓRIA DAS FRUTAS", 250, 1031, 500, 28, 18, 400, "#4a3530", "center", { letterSpacing: 0.06 }),
    t("contact", "contato.florabela.com", 290, 1080, 420, 80, 24, 400, "#9c918d", "center", { letterSpacing: 0.22, curve: -0.18 }),
  ]);
}

const QUANTEC = dribbble("12019084-Quantec-Social-Media-posts", "Fintech app social media posts (navy and light variants)", "2.1k likes, 522k views");
const RUMPI = dribbble("18568928-RUMPI-Social-Media-Post", "Agency social media posts (teal tips and red plan)", "754 likes, 409k views");
const CAROUSEL = dribbble("16177695-Instagram-Posts-Instagram-Carousel-Design-Template", "Instagram carousel post templates (pink rings and lilac stripes)", "250 likes, 208k views");
const MENU = dribbble("7824349-Restaurant-Menu", "Restaurant menu app (dessert detail screen)", "732 likes, 348k views");
const BUMBLE = dribbble("27534675-BUMBLEBEE-Branding-and-Packaging-Design", "Lemonade branding and packaging (flat bottle label)", "291 likes, 310k views");

export function socialCorpus(): CorpusEntry[] {
  return [
    {
      id: "sota-fintech-arcs",
      title: "Post de app financeiro com arcos verdes",
      useCase: "post de rede social de app financeiro",
      sources: [QUANTEC],
      intent: "Square fintech post on deep navy: five thick mint ring sectors (one full ring cut by the top edge, four C shaped fragments of the same ring width turned at different angles) cascade down the right half and off the bottom edge. A small mint ring mark and a semibold geometric sans wordmark top left, then a left aligned stack in one column: a muted gray caps kicker, a huge bold geometric sans title over two lines in white with a blue gray repeat emoji badge at the end, and a muted hashtag low on the left. Only navy, mint, white and gray.",
      brief: "Post quadrado do app Fundora sobre 'Usando transações recorrentes': fundo azul marinho, arcos grossos verde menta descendo pela direita, logo pequeno no topo, 'GESTÃO' em cinza, título grande branco e '#conheçaoapp' embaixo.",
      photos: [],
      make: fintechArcs,
    },
    {
      id: "sota-fintech-lines",
      title: "Post de app financeiro com arcos em linha",
      useCase: "post de rede social de app financeiro",
      sources: [QUANTEC],
      intent: "Light variant of the same fintech template: near white background, the same logo, kicker, two line bold geometric title and hashtag in a left column, and in the bottom right a bundle of about eighteen thin navy line arches that fan out at their left feet and crowd together at the top like a twisted ribbon, in alternating hairline and medium strokes. Navy on light gray with a single mint mark.",
      brief: "Post claro do app Fundora: 'Foque na sua renda real', com 'PLANEJAMENTO' em cinza, título azul marinho grande, '#nós fazemos por você' e um feixe de arcos em linha fina no canto inferior direito.",
      photos: [],
      make: fintechLines,
    },
    {
      id: "sota-teal-tips",
      title: "Post de dicas em quadrantes azul petróleo",
      useCase: "post carrossel de dicas para rede social",
      sources: [RUMPI],
      intent: "Square post split into quadrants: a photo on a teal gray backdrop top left, a bold geometric pattern bottom left (three by three cells of 180 px on dark teal, each a circle alternating white and soft teal with its top left quarter covered by a dark square), and a right column on deep teal with a small wordmark, a five line bold sans title, a seven line regular body with generous leading and a footer with the page count left and a hashtag right.",
      brief: "Primeiro card de um carrossel 'Dicas de marketing' da agência Lumi: foto à esquerda, padrão geométrico de círculos embaixo, título grande '10 dicas para criar uma estratégia de marketing eficaz', texto explicativo e rodapé '1 DE 6' com '#vocêsabia'.",
      photos: ["potPlant"],
      make: tealTips,
    },
    {
      id: "sota-red-plan",
      title: "Post de citação em quadrantes vermelhos",
      useCase: "post carrossel de citação para rede social",
      sources: [RUMPI],
      intent: "Square post in four red quadrants: a coral title block top left with wordmark, two line bold sans title and two line body; a six by six checker of 90 px cells in dark red, white and pink top right; a photo on pink bottom left; and a red quote block bottom right with a bold quotation mark, a five line quote with generous leading, a bold 'swipe' with an arrow and the footer page count and hashtag.",
      brief: "Card de carrossel da agência Lumi: 'Tenha um plano de negócio sólido', com xadrez vermelho, rosa e branco, foto de café, uma citação sobre plano de negócios, 'Deslize' e rodapé '1 DE 5' e '#vocêsabia'.",
      photos: ["coffeeRed"],
      make: redPlan,
    },
    {
      id: "sota-spread-love",
      title: "Post de carrossel com anéis e coração",
      useCase: "post de carrossel para Instagram",
      sources: [CAROUSEL],
      intent: "Square carousel post in soft pink: a column of thin darker pink concentric rings (clipped to the central two thirds of the width, so the outer ones show only as corner arcs) radiates from a small solid black heart in the upper middle, a hot pink glow runs down the column and turns red at the bottom, and a very wide heavy black display title in two centered lines sits on the red glow at the foot of the post.",
      brief: "Post de carrossel 'ESPALHE AMOR': fundo rosa claro, anéis concêntricos finos em volta de um pequeno coração preto, brilho rosa choque que fica vermelho embaixo e o título em letras pretas largas e pesadas.",
      photos: [],
      make: spreadLove,
    },
    {
      id: "sota-stripes-question",
      title: "Post de carrossel com listras e pergunta",
      useCase: "post de carrossel para Instagram",
      sources: [CAROUSEL],
      intent: "Square carousel post in lilac: about thirty three thin evenly spaced vertical gray violet lines fill the middle of the canvas, leaving plain margins left and right, and a centered four line caps question in a wide heavy black display font with airy leading sits across the middle.",
      brief: "Post de carrossel com a pergunta 'É POSSÍVEL VIVER O MOMENTO PRESENTE?': fundo lilás com listras verticais finas e o texto centralizado em caixa alta preta, larga e pesada.",
      photos: [],
      make: stripesQuestion,
    },
    {
      id: "sota-dessert-detail",
      title: "Tela de detalhe de sobremesa em app de restaurante",
      useCase: "tela de app de cardápio de restaurante",
      sources: [MENU],
      intent: "Phone detail screen: a top down dessert photo fills the upper half with two dark rounded square buttons (back arrow, menu dots) and a wide yellow rating pill with white stars, score and a caps link near its bottom edge; a white sheet with large rounded top corners rises over it holding a big two line script title in near black, a four line gray paragraph with loose leading, a wide dark pill button with tracked caps and a hot pink circular heart button with a soft pink glow.",
      brief: "Tela do app de restaurante para a sobremesa 'Morango com Coco Crocante': foto da tigela no topo, botões escuros de voltar e menu, avaliação 4,5 em pílula amarela, título manuscrito grande, descrição em cinza, botão escuro 'ADICIONAR AO PEDIDO' e botão rosa de favorito.",
      photos: ["bowl"],
      make: dessertDetail,
    },
    {
      id: "sota-lemonade-label",
      title: "Rótulo de limonada artesanal com abelhas",
      useCase: "rótulo de embalagem de bebida",
      sources: [BUMBLE],
      intent: "Flat bottle label on warm off white: the brand name in a wide classical serif set on a strong upward arch across the top in near black brown, a small bold caps flavor line under it, tiny volume and alcohol notes left and right, a central engraved orange branch (two oranges, a cut half and pointed leaves, all in fine orange hatching) with small black line art bees around it, a large lowercase geometric sans product name, a small tracked caps tagline and a gray contact line curved like a smile at the bottom.",
      brief: "Rótulo da limonada artesanal FLORABELA sabor laranja: nome em serifa clássica arqueado no topo, 'SABOR LARANJA', 330ml e 0% de álcool, ilustração gravada de laranjas e folhas em laranja, abelhinhas em traço preto, 'limonada artesanal', 'A GRANDE HISTÓRIA DAS FRUTAS' e o contato curvo embaixo.",
      photos: [],
      make: lemonadeLabel,
    },
  ];
}
