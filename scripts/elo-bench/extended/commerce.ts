import type { Artboard } from "@/lib/studio/document";

import { CLEAR, drop, ellipse, glow, icon, linear, path, radial, rect, sheet, soft, star, writer } from "../authoring";
import { photoIn, placedPhoto } from "../photos";
import { source, type CorpusEntry } from "./corpus";

const TICKET = "M0 0 L1 0 L1 0.32 C0.94 0.36 0.94 0.64 1 0.68 L1 1 L0 1 L0 0.68 C0.06 0.64 0.06 0.36 0 0.32 Z";
const TOOTH = "M0.2 0.05 C0.35 0 0.42 0.1 0.5 0.1 C0.58 0.1 0.65 0 0.8 0.05 C1 0.12 0.98 0.45 0.88 0.62 C0.82 0.75 0.8 1 0.7 1 C0.6 1 0.6 0.7 0.5 0.7 C0.4 0.7 0.4 1 0.3 1 C0.2 1 0.18 0.75 0.12 0.62 C0.02 0.45 0 0.12 0.2 0.05 Z";
const HOUSE = "M0.5 0.05 L0.95 0.45 L0.82 0.45 L0.82 0.95 L0.18 0.95 L0.18 0.45 L0.05 0.45 Z";
const BED = "M0.05 0.85 L0.05 0.25 M0.05 0.6 L0.95 0.6 L0.95 0.85 M0.05 0.6 L0.05 0.45 L0.4 0.45 L0.4 0.6 M0.4 0.5 L0.95 0.5 L0.95 0.6";
const BATH = "M0.05 0.5 L0.95 0.5 L0.88 0.8 L0.12 0.8 Z M0.2 0.5 L0.2 0.15 C0.2 0.05 0.35 0.05 0.36 0.18 M0.2 0.8 L0.15 0.95 M0.8 0.8 L0.85 0.95";
const AREA = "M0.1 0.1 L0.9 0.1 L0.9 0.9 L0.1 0.9 Z M0.1 0.35 L0.25 0.35 M0.1 0.6 L0.25 0.6 M0.35 0.1 L0.35 0.25 M0.6 0.1 L0.6 0.25";
const CAR = "M0.05 0.7 L0.05 0.5 L0.2 0.45 L0.32 0.22 L0.68 0.22 L0.8 0.45 L0.95 0.5 L0.95 0.7 Z M0.22 0.78 A0.08 0.08 0 1 1 0.2201 0.78 M0.78 0.78 A0.08 0.08 0 1 1 0.7801 0.78";
const SWOOSH = "M0 0.7 C0.3 0.2 0.7 0.2 1 0.5";

function promoSale(): Artboard {
  const s = sheet(1080, 1080);
  const t = writer(s, "archivo-black");
  const ink = "#2b2b2b";
  const ring = Array.from({ length: 12 }, (_, i) => {
    const angle = i * 30;
    const radians = (angle * Math.PI) / 180;
    return s.label(`ring${i + 1}`, "OFERTA •", s.mid(540 + 362 * Math.sin(radians), 508 - 362 * Math.cos(radians), 170, 34, angle), 28, { font: "oswald", weight: 600, fill: ink, align: "center", spacing: 0.1 });
  });
  return s.board("#efe6d8", [
    ...ring,
    star("badge", s.mid(540, 508, 610, 610), "#f6c343", 24, 0.92, { effects: [drop("badge_shadow", "#3c2800", 0.22, 0, 14, 30)] }),
    ellipse("badge_ring", s.mid(540, 508, 520, 520), CLEAR, { stroke: ink, strokeWidth: 3 }),
    ellipse("badge_light", s.mid(470, 430, 420, 360), "#ffffff", { gradient: radial("#ffffff40", "#ffffff00") }),
    t("badge_upto", "ATÉ", 340, 300, 400, 50, 38, 400, ink, "center", { letterSpacing: 0.12 }),
    t("badge_value", "50", 300, 330, 380, 270, 250, 400, ink, "center", { lineHeight: 1 }),
    t("badge_percent", "%", 640, 360, 140, 150, 140, 400, ink, "left", { lineHeight: 1 }),
    s.label("badge_off", "OFF", s.at(340, 590, 400, 60), 52, { font: "oswald", weight: 700, fill: ink, align: "center", spacing: 0.2 }),
    ellipse("product_contact", s.mid(800, 830, 380, 40), "#00000040", { effects: [glow("product_contact_blur", "#000000", 0.25, 18)] }),
    placedPhoto("product", "sneakerCutout", s.mid(790, 690, 470, 470, -20), s, { effects: [drop("product_shadow", "#3c2800", 0.25, 0, 18, 30)] }),
    s.card("cta", s.at(324, 930, 432, 82), ink, 41, { effects: [drop("cta_shadow", "#c49a2a", 1, 0, 6, 0)] }),
    t("cta_text", "COMPRAR AGORA", 344, 955, 330, 34, 26, 400, "#f6efe2", "center", { letterSpacing: 0.06 }),
    icon("cta_arrow", "arrow-right", s.at(690, 955, 34, 34), "#f6efe2"),
    star("sparkle", s.mid(90, 90, 70, 70), ink, 4, 0.35),
    path("ticket", TICKET, s.mid(940, 110, 200, 92, 10), CLEAR, { stroke: ink, strokeWidth: 3 }),
    s.label("ticket_text", "SÓ 3 DIAS", s.mid(940, 110, 170, 36, 10), 26, { font: "oswald", weight: 700, fill: ink, align: "center", spacing: 0.08 }),
  ]);
}

function productCard(): Artboard {
  const s = sheet(1080, 1350);
  const t = writer(s, "plus-jakarta-sans");
  const ink = "#1f1f1f";
  return s.board("#f5f1ec", [
    ...photoIn(s.card("stage", s.at(65, 81, 950, 810), "#e8dfd3", 54, { effects: soft("stage", "#3a2e20", 0.12, 24, 50) }), "headphones", s, 0.5, 0.5),
    s.card("new_tag", s.at(108, 124, 150, 56), "#ffffffcc", 28, { stroke: "#ffffff", strokeWidth: 2 }),
    t("new_tag_text", "NOVO", 108, 139, 150, 28, 22, 800, ink, "center", { letterSpacing: 0.12 }),
    ellipse("discount", s.mid(886, 140, 216, 216), "#e2493b", { effects: [drop("discount_shadow", "#781408", 0.3, 0, 8, 16)] }),
    s.label("discount_text", "-30%", s.mid(886, 140, 200, 80, 10), 64, { font: "plus-jakarta-sans", weight: 800, fill: "#ffffff", align: "center", leading: 1 }),
    t("name", "Fone Aura Max", 65, 930, 900, 60, 46, 700, ink),
    t("category", "Fone sem fio com cancelamento de ruído", 65, 994, 900, 32, 23, 500, "#6e6e6e"),
    ...[0, 1, 2, 3, 4].map((i) => star(`rating${i + 1}`, s.at(65 + i * 36, 1046, 30, 30), "#f2b33d", 5, 0.45)),
    t("rating_count", "4,8 (128 avaliações)", 260, 1046, 400, 32, 22, 600, "#6e6e6e"),
    t("price", "R$ 699", 65, 1100, 330, 100, 84, 800, ink, "left", { lineHeight: 1 }),
    t("old_price", "R$ 999", 410, 1132, 160, 44, 34, 500, "#9a9a9a"),
    rect("old_price_strike", s.at(410, 1153, 120, 3), "#9a9a9a"),
    s.card("save", s.at(65, 1222, 300, 56), "#fce3df", 28),
    t("save_text", "Economize R$ 300", 65, 1236, 300, 30, 22, 800, "#c2382a", "center"),
    ellipse("cta", s.at(870, 1110, 150, 150), ink, { effects: [drop("cta_shadow", "#000000", 0.25, 0, 8, 18)] }),
    icon("cta_icon", "arrow-right", s.at(915, 1155, 60, 60), "#ffffff"),
  ]);
}

const HOME = { bg: "#f7f5f0", navy: "#13293d", gold: "#c9a35b", muted: "#6b7783", line: "#e3ded3" };

function realEstate(): Artboard {
  const s = sheet(1080, 1350);
  const t = writer(s, "dm-sans");
  const shade = (id: string) => soft(id, HOME.navy, 0.18, 12, 28);
  const specs: [string, string, string][] = [
    [BED, "4", "quartos"],
    [BATH, "3", "banheiros"],
    [AREA, "320 m²", "de área"],
    [CAR, "2", "vagas"],
  ];
  return s.board(HOME.bg, [
    path("arc", "M0 1 A1 1 0 0 1 1 0", s.at(700, 40, 380, 380), CLEAR, { stroke: "#c9a35b99", strokeWidth: 3 }),
    path("logo_mark", HOUSE, s.at(60, 40, 44, 44), HOME.navy),
    t("logo", "Lar Prime", 114, 42, 300, 42, 32, 700, HOME.navy),
    s.card("status", s.at(820, 38, 200, 52), HOME.gold, 26),
    t("status_text", "À VENDA", 820, 51, 200, 28, 22, 700, "#ffffff", "center", { letterSpacing: 0.15 }),
    ...photoIn(s.card("photo_main", s.at(60, 122, 626, 675), "#d7d2c8", 38, { effects: shade("photo_main") }), "house", s, 0.5, 0.45),
    ...photoIn(s.card("photo_living", s.at(702, 122, 318, 330), "#d7d2c8", 38, { effects: shade("photo_living") }), "living", s, 0.55, 0.55),
    ...photoIn(s.card("photo_pool", s.at(702, 467, 318, 330), "#d7d2c8", 38, { effects: shade("photo_pool") }), "house", s, 0.4, 0.85),
    s.card("photo_more", s.at(728, 730, 156, 46), "#ffffff40", 23, { stroke: "#ffffff99", strokeWidth: 2 }),
    t("photo_more_text", "+12 fotos", 728, 741, 156, 26, 20, 700, "#ffffff", "center"),
    s.card("price_card", s.at(97, 728, 562, 150), HOME.navy, 32, { effects: soft("price_card", HOME.navy, 0.35, 16, 32) }),
    t("price", "R$ 1.890.000", 133, 752, 500, 70, 60, 700, "#ffffff"),
    t("price_label", "VALOR DE VENDA", 133, 826, 400, 28, 19, 600, "#ffffff99", "left", { letterSpacing: 0.15 }),
    s.label("address", "Rua das Acácias, 742", s.at(60, 908, 960, 56), 46, { font: "dm-serif-display", weight: 400, fill: HOME.navy, align: "left" }),
    icon("pin", "map-pin", s.at(60, 970, 28, 28), HOME.gold),
    t("district", "Alto de Pinheiros, São Paulo", 96, 970, 700, 30, 22, 500, HOME.muted),
    ...specs.flatMap(([glyph, value, label], i) => [
      s.card(`spec${i + 1}`, s.at(60 + i * 246, 1030, 222, 112), "#ffffff", 27, { stroke: HOME.line, strokeWidth: 2 }),
      path(`spec${i + 1}_icon`, glyph, s.at(80 + i * 246, 1060, 52, 52), CLEAR, { stroke: HOME.navy, strokeWidth: 3, lineCap: "round", lineJoin: "round" }),
      t(`spec${i + 1}_value`, value, 146 + i * 246, 1050, 126, 38, 30, 700, HOME.navy),
      t(`spec${i + 1}_label`, label, 146 + i * 246, 1090, 126, 28, 19, 500, HOME.muted),
    ]),
    icon("feature_icon", "check-circle", s.at(60, 1170, 32, 32), HOME.gold),
    t("feature", "Piscina aquecida, cozinha reformada e vista para o parque", 104, 1170, 916, 32, 23, 500, HOME.navy),
    rect("agent_rule", s.at(60, 1224, 960, 2), HOME.line),
    ellipse("agent_avatar", s.at(60, 1244, 72, 72), HOME.gold, { gradient: linear("#e2c48a", "#9c7a3c", 135), stroke: "#ffffff", strokeWidth: 3 }),
    t("agent_initials", "PN", 60, 1264, 72, 32, 24, 700, "#ffffff", "center"),
    t("agent_name", "Paula Nunes, corretora", 150, 1248, 600, 32, 24, 700, HOME.navy),
    t("agent_phone", "(11) 97777-0742", 150, 1282, 600, 30, 21, 500, HOME.muted),
    ellipse("agent_button", s.at(952, 1246, 68, 68), HOME.gold),
    icon("agent_arrow", "arrow-right", s.at(970, 1264, 32, 32), "#ffffff"),
  ]);
}

const CARE = { teal: "#0f8b8d", mint: "#7fd1c4", ink: "#0b3b4a", muted: "#4f646d", tint: "#e6f6f4", blue: "#1e6fd9" };

function clinic(): Artboard {
  const s = sheet(1080, 1080);
  const t = writer(s, "dm-sans");
  const services: [string, string][] = [
    ["heart", "Pronto atendimento"],
    ["shield-check", "Exames laboratoriais"],
  ];
  return s.board("#ffffff", [
    path("slab_back", "M0 1 L1 0 L1 1 Z", s.at(540, 430, 540, 650), CARE.mint),
    path("slab_front", "M0 1 L1 0 L1 1 Z", s.at(600, 500, 480, 580), CARE.teal),
    ...[0, 1, 2, 3].flatMap((row) => [0, 1, 2, 3].map((col) => ellipse(`dot${row * 4 + col + 1}`, s.mid(80 + col * 28, 780 + row * 28, 7, 7), CARE.mint))),
    s.card("logo_mark", s.at(70, 64, 56, 56), CARE.teal, 13),
    rect("logo_cross_v", s.mid(98, 92, 10, 32), "#ffffff"),
    rect("logo_cross_h", s.mid(98, 92, 32, 10), "#ffffff"),
    t("logo", "Clínica Vitalle", 140, 72, 400, 40, 30, 700, CARE.ink),
    s.label("headline", "Cuidado que\nacompanha\nsua vida", s.at(70, 168, 520, 250), 74, { font: "fraunces", weight: 700, fill: CARE.ink, align: "left", leading: 1.05 }, { runs: [{ start: 26, end: 30, fill: CARE.teal }] }),
    t("body", "Clínica geral, exames e acompanhamento contínuo com a equipe que já conhece você.", 70, 432, 440, 100, 22, 400, CARE.muted, "left", { lineHeight: 1.45 }),
    ...services.flatMap(([glyph, label], i) => [ellipse(`service${i + 1}_bg`, s.at(70, 560 + i * 82, 62, 62), CARE.tint), icon(`service${i + 1}_icon`, glyph, s.at(86, 576 + i * 82, 30, 30), CARE.teal), t(`service${i + 1}`, label, 150, 574 + i * 82, 360, 34, 25, 700, CARE.ink)]),
    ellipse("photo_ring", s.mid(790, 455, 590, 590), CLEAR, { stroke: CARE.teal, strokeWidth: 3 }),
    ...photoIn(ellipse("photo", s.mid(790, 455, 540, 540), CARE.tint, { effects: soft("photo", CARE.ink, 0.2, 20, 40) }), "botanical", s, 0.5, 0.45),
    ellipse("badge", s.mid(586, 690, 184, 184), CARE.blue, { effects: [drop("badge_shadow", CARE.blue, 0.35, 0, 10, 20)] }),
    t("badge_value", "24h", 506, 640, 160, 64, 56, 800, "#ffffff", "center"),
    t("badge_label", "TODOS OS DIAS", 506, 708, 160, 26, 17, 700, "#ffffff", "center", { letterSpacing: 0.06 }),
    s.card("cta", s.at(70, 930, 470, 78), CARE.ink, 39),
    t("cta_text", "Agende: (11) 3000-2424", 70, 952, 470, 34, 25, 700, "#ffffff", "center"),
  ]);
}

const SMILE = { bg: "#eaf4ff", blob: "#cfe5ff", navy: "#0a2e6e", blue: "#1e7bff", text: "#3d5a80" };

function dentist(): Artboard {
  const s = sheet(1080, 1080);
  const t = writer(s, "montserrat");
  const services = ["CLAREAMENTO", "IMPLANTES", "ORTODONTIA"];
  return s.board(SMILE.bg, [
    path("blob", "M0.18 0.12 C0.36 -0.04 0.72 0 0.9 0.16 C1.04 0.3 0.98 0.62 0.86 0.8 C0.7 1.02 0.34 1.02 0.16 0.86 C-0.02 0.7 0 0.28 0.18 0.12 Z", s.at(486, -54, 702, 648), SMILE.blob),
    ...photoIn(s.card("capsule", s.at(562, 108, 454, 778), SMILE.blob, 227, { effects: soft("capsule", "#14468c", 0.22, 24, 48) }), "dental", s, 0.72, 0.5),
    ...photoIn(s.card("capsule_small", s.at(432, 626, 216, 324), SMILE.blob, 108, { stroke: "#ffffff", strokeWidth: 10, effects: soft("capsule_small", "#14468c", 0.25, 16, 32) }), "dental", s, 0.42, 0.35),
    s.label("headline", "SEU SORRISO\nEM BOAS MÃOS", s.at(65, 120, 480, 230), 104, { font: "bebas-neue", weight: 400, fill: SMILE.navy, align: "left", leading: 1 }, { runs: [{ start: 12, end: 24, fill: SMILE.blue }] }),
    path("swoosh", SWOOSH, s.at(70, 336, 330, 36), CLEAR, { stroke: SMILE.blue, strokeWidth: 7, lineCap: "round" }),
    t("subhead", "Tratamentos modernos, sem dor e com hora marcada.", 65, 392, 440, 70, 24, 500, SMILE.text, "left", { lineHeight: 1.4 }),
    ...services.flatMap((label, i) => [
      ellipse(`service${i + 1}_bg`, s.at(65, 498 + i * 88, 66, 66), "#ffffff", { effects: [drop(`service${i + 1}_shadow`, "#000000", 0.08, 0, 4, 10)] }),
      path(`service${i + 1}_icon`, TOOTH, s.at(82, 514 + i * 88, 32, 34), CLEAR, { stroke: SMILE.blue, strokeWidth: 3, lineJoin: "round" }),
      s.label(`service${i + 1}`, label, s.at(150, 512 + i * 88, 300, 40), 32, { font: "oswald", weight: 600, fill: SMILE.navy, align: "left", spacing: 0.06 }),
    ]),
    s.card("rating", s.at(760, 132, 236, 100), "#ffffffb3", 32, { stroke: "#ffffff", strokeWidth: 2, effects: soft("rating", "#14468c", 0.12, 10, 24) }),
    ...[0, 1, 2, 3, 4].map((i) => star(`rating_star${i + 1}`, s.at(784 + i * 36, 152, 28, 28), "#f5b301", 5, 0.45)),
    t("rating_text", "4,9 de 1.200 pacientes", 784, 190, 210, 28, 17, 700, SMILE.navy),
    star("sparkle_white", s.mid(540, 560, 56, 56), "#ffffff", 4, 0.35),
    star("sparkle_blue", s.mid(500, 620, 32, 32), SMILE.blue, 4, 0.35),
    rect("footer", s.at(0, 972, 1080, 108), SMILE.navy),
    t("footer_phone", "(11) 3555-0101", 65, 1008, 300, 36, 26, 700, "#ffffff"),
    t("footer_site", "sorrisoclaro.com.br", 370, 1010, 340, 34, 24, 500, "#c8dbff"),
    s.card("footer_cta", s.at(820, 996, 200, 60), SMILE.blue, 30),
    t("footer_cta_text", "AGENDAR", 820, 1012, 200, 30, 23, 800, "#ffffff", "center", { letterSpacing: 0.08 }),
  ]);
}

const LAW = { navy: "#0e1e3a", cream: "#f4efe6", amber: "#e39b2d" };

function lawOffice(): Artboard {
  const s = sheet(1080, 1080);
  const t = writer(s, "dm-sans");
  const areas = ["Direito de família", "Empresarial", "Defesa criminal"];
  return s.board(LAW.navy, [
    rect("cream_block", s.at(626, 0, 454, 1080), LAW.cream),
    s.label("watermark", "§", s.at(30, 560, 420, 460), 440, { font: "playfair-display", weight: 400, fill: "#ffffff0f", align: "center", leading: 1 }),
    rect("frame", s.at(32, 32, 1016, 1016), CLEAR, { stroke: "#c6a15b99", strokeWidth: 2 }),
    path("amber_block", "M0.27 0 L1 0 L0.73 1 L0 1 Z", s.at(540, 86, 216, 908), LAW.amber),
    ...photoIn(rect("portrait", s.at(470, 150, 560, 930), "#2a2a2a", { effects: [drop("portrait_shadow", "#000000", 0.3, -16, 0, 30)] }), "law", s, 0.5, 0.45),
    rect("logo_pillar1", s.at(70, 70, 6, 34), LAW.amber),
    rect("logo_pillar2", s.at(84, 70, 6, 34), LAW.amber),
    rect("logo_pillar3", s.at(98, 70, 6, 34), LAW.amber),
    path("logo_roof", "M0 1 L0.5 0 L1 1 Z", s.at(64, 56, 46, 14), LAW.amber),
    s.label("logo", "ANDRADE & COSTA", s.at(124, 70, 400, 36), 26, { font: "playfair-display", weight: 600, fill: LAW.amber, align: "left", spacing: 0.12 }),
    s.label("headline", "Defendendo\nseus direitos\ndesde 1998", s.at(70, 206, 520, 250), 66, { font: "playfair-display", weight: 600, fill: "#ffffff", align: "left", leading: 1.12 }, { runs: [{ start: 11, end: 24, fill: LAW.amber, italic: true }] }),
    rect("rule", s.at(70, 560, 86, 4), LAW.amber),
    ...areas.flatMap((label, i) => [star(`area${i + 1}_bullet`, s.mid(82, 626 + i * 64, 16, 16), LAW.amber, 4, 0.5), t(`area${i + 1}`, label, 106, 610 + i * 64, 380, 34, 26, 500, "#ffffffd9")]),
    s.card("cta", s.at(70, 900, 390, 80), LAW.amber, 10),
    t("cta_text", "Consulta gratuita", 70, 922, 390, 36, 27, 700, LAW.navy, "center"),
  ]);
}

export function commerceCorpus(): CorpusEntry[] {
  return [
    {
      id: "promo-sale",
      title: "Promoção relâmpago com selo de desconto",
      useCase: "card de venda e promoção de e-commerce com preço e desconto",
      sources: [source("Linearity Templates", "Sale Promotion Instagram Post", "https://www.linearity.io/templates/social-media/instagram-posts/sale-promotion-instagram-post"), source("Envato Elements", "Product Sale Social Media Post Feed (docqueen)", "https://elements.envato.com/product-sale-social-media-post-feed-NU3QJM7")],
      intent:
        "Post quadrado em bege: um selo amarelo recortado em 24 ondas ocupa o centro, com aro interno fino, brilho no alto à esquerda e sombra; dentro, ATÉ, o número enorme com o % sobrescrito e OFF espaçado; um anel de palavras repetidas gira em volta criando urgência; o tênis recortado invade a borda inferior direita do selo e fica na frente dele com sombra de contato; botão pílula escuro com sombra dura dourada estilo adesivo retrô; brilho e ingresso girado nos cantos. Tipografia: Archivo Black e Oswald. Cor: bege, amarelo, grafite. Raios: pílula inteira; selo ondulado.",
      brief:
        "Post quadrado de promoção relâmpago de uma loja de tênis: até 50% off, só 3 dias, botão Comprar agora. Selo de desconto amarelo grande no centro, palavras OFERTA girando em volta e um tênis branco recortado entrando na frente do selo.",
      photos: ["sneakerCutout"],
      make: promoSale,
    },
    {
      id: "product-card",
      title: "Card de produto com preço e desconto",
      useCase: "card de venda e promoção de e-commerce com preço e desconto",
      sources: [source("Linearity Templates", "Sale Promotion Instagram Post", "https://www.linearity.io/templates/social-media/instagram-posts/sale-promotion-instagram-post"), source("Envato Elements", "Product Sale Social Media Post Feed (docqueen)", "https://elements.envato.com/product-sale-social-media-post-feed-NU3QJM7")],
      intent:
        "Card 4:5 de vitrine: a foto do produto ocupa um palco arredondado de 54 px no topo com sombra suave; um selo vermelho de desconto girado invade o canto superior direito do palco; etiqueta NOVO em vidro claro no canto oposto. Abaixo, na grade de 65 px: nome, categoria, cinco estrelas com a nota, preço grande, preço antigo riscado, pílula de economia e um botão redondo escuro com seta alinhado à direita. Tipografia Plus Jakarta Sans em quatro pesos. Cor: creme, grafite, vermelho de oferta, amarelo das estrelas.",
      brief:
        "Card de produto 4:5 para o Fone Aura Max, fone sem fio com cancelamento de ruído: de R$ 999 por R$ 699 (-30%), economize R$ 300, nota 4,8 com 128 avaliações, selo NOVO. Use a foto do fone sobre fundo amarelo, preço bem destacado e um botão de compra.",
      photos: ["headphones"],
      make: productCard,
    },
    {
      id: "real-estate",
      title: "Anúncio de imóvel à venda",
      useCase: "anúncio imobiliário",
      sources: [source("Envato Elements", "Real Estate Social Media Post (OnpointStudio)", "https://elements.envato.com/real-estate-social-media-post-SCQH8TM"), source("htmlcsstoimage", "Just Listed Instagram Post", "https://htmlcsstoimage.com/templates/details/just-listed.md")],
      intent:
        "Post 4:5 com margem de 60 px e calha de 16: cabeçalho com marca e pílula dourada À VENDA; grade de fotos com a fachada grande à esquerda e duas fotos menores empilhadas à direita, todas com raio de 38 px e sombra; chip de vidro +12 fotos; card azul-marinho do preço sobreposto à base da foto principal (plano da frente); endereço em serifa display com o bairro e um pino dourado; quatro chips brancos com ícones de linha (quartos, banheiros, área, vagas); linha de destaque e faixa do corretor. Tipografia: DM Serif Display e DM Sans. Cor: marinho, dourado, off-white. Profundidade: fotos, card do preço por cima e um arco dourado passando por trás da grade.",
      brief:
        "Post 4:5 da imobiliária Lar Prime anunciando casa à venda na Rua das Acácias, 742, Alto de Pinheiros, São Paulo: R$ 1.890.000, 4 quartos, 3 banheiros, 320 m², 2 vagas, piscina aquecida, cozinha reformada e vista para o parque. Corretora Paula Nunes, (11) 97777-0742. Use fotos da casa e da sala.",
      photos: ["house", "living"],
      make: realEstate,
    },
    {
      id: "clinic",
      title: "Post de clínica médica",
      useCase: "clínica, dentista e escritório de advocacia",
      sources: [source("Envato Elements", "Instagram Post Template, medical (simplestudios)", "https://elements.envato.com/instagram-post-template-instagram-post-R6V6FE5")],
      intent:
        "Post quadrado branco com duas lâminas diagonais verde-água no canto inferior direito (a clara atrás, deslocada), grade de pontos menta, marca com cruz num quadrado arredondado, título serifado em três linhas com a última palavra em verde, texto, dois serviços com ícone em círculo claro, foto num círculo com anel fino concêntrico e sombra, selo azul de 24h sobreposto à borda da foto e um botão pílula escuro. Tipografia: Fraunces e DM Sans. Cor: verde-água, menta, azul petróleo, azul do selo. Profundidade: três planos (lâminas, foto, selo). Raios: 13 no logo, pílula no botão.",
      brief:
        "Post quadrado da Clínica Vitalle: Cuidado que acompanha sua vida. Clínica geral, exames e acompanhamento contínuo; serviços pronto atendimento e exames laboratoriais; atendimento 24h todos os dias; agende pelo (11) 3000-2424. Limpo, verde-água e branco, com uma foto de folhas e flores num círculo.",
      photos: ["botanical"],
      make: clinic,
    },
    {
      id: "dentist",
      title: "Post de consultório odontológico",
      useCase: "clínica, dentista e escritório de advocacia",
      sources: [source("Visme", "Dental Health Instagram Stories", "https://www.visme.co/templates/social-media-graphics/dental-health-instagram-stories-1425282403/"), source("Envato Elements", "Dental Care Services Social Media Post Template (C-Kav)", "https://elements.envato.com/dental-care-services-social-media-post-template-N7UVCZP")],
      intent:
        "Post quadrado azul-claro: uma mancha suave no alto à direita, a foto do consultório numa cápsula vertical alta e uma segunda cápsula menor com borda branca sobreposta à esquerda (dois planos de foto), título em display condensada em duas linhas (marinho e azul) com um traço de pincel embaixo, subtítulo, três serviços com dente em círculo branco, um chip de vidro com estrelas por cima da cápsula, brilhos em estrela e uma faixa marinho de rodapé com botão. Tipografia: Bebas Neue, Oswald e Montserrat. Raios: cápsulas inteiras, 32 no chip, pílula no botão.",
      brief:
        "Post quadrado do consultório Sorriso Claro: Seu sorriso em boas mãos. Tratamentos modernos, sem dor e com hora marcada: clareamento, implantes e ortodontia. Nota 4,9 de 1.200 pacientes. (11) 3555-0101, sorrisoclaro.com.br, botão Agendar. Azul e branco, com fotos do consultório em formatos de cápsula.",
      photos: ["dental"],
      make: dentist,
    },
    {
      id: "law",
      title: "Post de escritório de advocacia",
      useCase: "clínica, dentista e escritório de advocacia",
      sources: [source("Visme", "Ross and Rogers Law Firm Square Template", "https://www.visme.co/templates/graphics-for-websites/ross-and-rogers-law-firm-square-1425281856"), source("Envato Elements", "Attorney, Law and Firm Instagram Post Template (StringLabs)", "https://elements.envato.com/attorney-law-firm-instagram-post-template-3WSRE73")],
      intent:
        "Post quadrado em blocos de cor de arestas vivas: metade esquerda marinho, faixa creme à direita, um paralelogramo âmbar inclinado sobre a emenda e a foto (balança e martelo) em retângulo alto sangrando pela base, na frente do âmbar com sombra lateral; moldura dourada fina interrompida pela foto. Esquerda: marca com coluna clássica, título em serifa Didone em três linhas com seus direitos em itálico âmbar, filete, três áreas com losangos e um botão retangular âmbar quase reto; um § gigante em marca d'água. Tipografia: Playfair Display e DM Sans. Raios: 10 no botão, resto reto.",
      brief:
        "Post quadrado do escritório Andrade & Costa: Defendendo seus direitos desde 1998. Áreas: direito de família, empresarial e defesa criminal. Botão Consulta gratuita. Marinho, âmbar e creme, sóbrio e com arestas retas, com uma foto de balança da justiça.",
      photos: ["law"],
      make: lawOffice,
    },
  ];
}
