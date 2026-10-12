import type { Artboard, Layer } from "@/lib/studio/document";

import { archPath, CLEAR, drop, ellipse, glow, icon, linear, path, radial, rect, sheet, soft, star, triangle, writer, type Sheet } from "../authoring";
import { photoIn, placedPhoto } from "../photos";
import { source, type CorpusEntry } from "./corpus";

const WAVE = "M0 0.6 C0.17 0.1 0.33 0.1 0.5 0.5 S0.83 0.9 1 0.4";
const ARROW = "M0 0.62 C0.25 0.2 0.6 0.1 0.86 0.28 L0.8 0.08 M0.86 0.28 L0.64 0.36";

function feedPost(): Artboard {
  const s = sheet(1080, 1350);
  const t = writer(s, "dm-sans");
  const brown = "#3b2418";
  const cream = "#f6efe4";
  const caramel = "#c8873a";
  return s.board(cream, [
    ellipse("sun", s.mid(820, 300, 520, 520), "#f2d7b0"),
    path("arch_back", archPath(560, 820), s.at(468, 180, 560, 820), caramel),
    ...photoIn(path("arch", archPath(560, 820), s.at(440, 150, 560, 820), "#e8dccb", { effects: soft("arch", "#3b2418", 0.25, 24, 48) }), "latte", s, 0.5, 0.52),
    t("brand", "café bússola", 60, 64, 400, 40, 30, 700, brown, "left", { letterSpacing: 0.04 }),
    s.label("kicker", "novo no cardápio", s.at(60, 210, 420, 70), 56, { font: "caveat", weight: 700, fill: caramel, align: "left", leading: 1 }),
    s.label("title", "Gelado\nde doce\nde leite", s.at(56, 290, 400, 330), 100, { font: "fraunces", weight: 800, fill: brown, align: "left", leading: 0.95 }),
    t("body", "Espresso duplo, leite gelado e calda de doce de leite da casa.", 60, 690, 360, 124, 26, 500, "#6b5242", "left", { lineHeight: 1.4 }),
    star("price_sticker", s.mid(420, 960, 230, 230, -10), "#e2492f", 16, 0.86, { effects: [drop("price_shadow", "#3b2418", 0.3, 4, 10, 18)] }),
    t("price_from", "só", 330, 892, 180, 34, 28, 700, "#ffe9dc", "center"),
    t("price", "R$ 16", 330, 920, 180, 64, 54, 800, "#ffffff", "center", { lineHeight: 1 }),
    s.card("tag", s.at(760, 1030, 250, 60, 6), "#ffffff", 30, { effects: soft("tag", "#3b2418", 0.2, 10, 20) }),
    s.label("tag_text", "sem lactose", s.at(760, 1044, 250, 32, 6), 24, { font: "dm-sans", weight: 700, fill: brown, align: "center" }),
    path("scribble", ARROW, s.at(250, 1080, 180, 110, 10), CLEAR, { stroke: brown, strokeWidth: 5, lineCap: "round", lineJoin: "round" }),
    s.card("cta", s.at(60, 1220, 360, 76), brown, 38),
    t("cta_text", "Peça no balcão ou no app", 60, 1244, 360, 30, 22, 700, cream, "center"),
    t("handle", "@cafebussola", 640, 1240, 380, 36, 26, 600, "#6b5242", "right"),
  ]);
}

function carousel(): Artboard {
  const s = sheet(3240, 1350);
  const t = writer(s, "plus-jakarta-sans");
  const ink = "#16161d";
  const accent = "#ff6b3d";
  const bg = "#f3f0ff";
  const slideNumber = (n: number) => [s.card(`page${n}`, s.at(1080 * (n - 1) + 900, 70, 120, 56), "#ffffff", 28), t(`page${n}_text`, `${n}/3`, 1080 * (n - 1) + 900, 84, 120, 30, 22, 800, ink, "center")];
  const tip = (n: number, left: number, title: string, body: string): Layer[] => [
    s.card(`tip${n}`, s.at(left, 520, 860, 560), "#ffffff", 48, { effects: soft(`tip${n}`, "#2c2160", 0.12, 24, 50) }),
    ellipse(`tip${n}_number_bg`, s.at(left + 60, 580, 110, 110), accent),
    t(`tip${n}_number`, `0${n}`, left + 60, 610, 110, 52, 44, 800, "#ffffff", "center"),
    t(`tip${n}_title`, title, left + 60, 730, 740, 130, 54, 800, ink, "left", { lineHeight: 1.15 }),
    t(`tip${n}_body`, body, left + 60, 880, 740, 140, 30, 500, "#55556a", "left", { lineHeight: 1.45 }),
  ];
  return s.board(bg, [
    path("wave", WAVE, s.at(-40, 300, 3320, 900), CLEAR, { stroke: "#cfc6ff", strokeWidth: 60, lineCap: "round" }),
    ellipse("blob", s.mid(1080, 760, 760, 760), "#ffd9c9"),
    ...photoIn(ellipse("hero_photo", s.mid(1080, 760, 620, 620), "#ffd9c9", { effects: soft("hero_photo", "#2c2160", 0.2, 30, 60) }), "sneaker", s, 0.7, 0.5),
    ...slideNumber(1),
    ...slideNumber(2),
    ...slideNumber(3),
    t("brand", "estúdio vitrine", 70, 80, 500, 40, 28, 800, ink),
    t("cover_kicker", "GUIA RÁPIDO", 70, 300, 600, 40, 30, 800, accent, "left", { letterSpacing: 0.2 }),
    t("cover_title", "3 truques\npara fotos\nde produto\nque vendem", 64, 350, 720, 520, 112, 800, ink, "left", { lineHeight: 1 }),
    t("cover_swipe", "arraste para o lado", 70, 1200, 500, 40, 30, 600, "#55556a"),
    icon("cover_arrow", "arrow-right", s.at(390, 1202, 40, 40), accent),
    ...tip(1, 1190, "Use um fundo de uma cor só", "Uma cartolina colorida já isola o produto e deixa a cor da marca falar."),
    ...tip(2, 2190, "Luz de janela, de lado", "Fotografe perto de uma janela, sem sol direto, e rebata a sombra com papel branco."),
    star("sparkle", s.mid(1960, 300, 90, 90), accent, 4, 0.35),
    s.card("cta", s.at(2350, 1180, 560, 90), ink, 45),
    t("cta_text", "Salve para a próxima foto", 2350, 1208, 560, 36, 28, 800, "#ffffff", "center"),
    t("tip3_hint", "Bônus: 3ª dica na legenda", 2190, 420, 860, 40, 30, 700, accent),
  ]);
}

function storyPost(): Artboard {
  const s = sheet(1080, 1920);
  const t = writer(s, "outfit");
  return s.board("#0b4f6c", [
    placedPhoto("photo", "beach", s.at(0, 0, 1080, 1920), s, {}, 0.42, 0.5),
    rect("veil_top", s.at(0, 0, 1080, 520), "#00000000", { gradient: linear("#0b2a3a99", "#0b2a3a00", 90) }),
    rect("veil_bottom", s.at(0, 1180, 1080, 740), "#00000000", { gradient: linear("#0b2a3a00", "#0b2a3acc", 90) }),
    s.card("location", s.at(80, 300, 420, 70), "#ffffff", 35, { effects: soft("location", "#0b2a3a", 0.25, 10, 24) }),
    icon("location_icon", "map-pin", s.at(104, 318, 34, 34), "#ff5a5f"),
    t("location_text", "Ilha do Sol, BA", 148, 316, 340, 40, 30, 700, "#0b2a3a"),
    s.label("title", "Férias\nem modo\navião", s.at(80, 400, 800, 480), 150, { font: "dm-serif-display", weight: 400, fill: "#ffffff", align: "left", leading: 0.95 }, { effects: [drop("title_shadow", "#0b2a3a", 0.35, 0, 8, 24)] }),
    s.card("poll", s.at(140, 1060, 800, 330), "#ffffff", 44, { effects: soft("poll", "#0b2a3a", 0.3, 20, 40) }),
    t("poll_question", "Qual é a sua vibe?", 140, 1100, 800, 56, 44, 800, "#0b2a3a", "center"),
    s.card("poll_option_a", s.at(190, 1190, 340, 140), "#f1f5f9", 28),
    t("poll_option_a_text", "Praia\n🌊 62%", 190, 1218, 340, 90, 36, 800, "#0b4f6c", "center", { lineHeight: 1.2 }),
    s.card("poll_option_b", s.at(550, 1190, 340, 140), "#f1f5f9", 28),
    t("poll_option_b_text", "Serra\n⛰ 38%", 550, 1218, 340, 90, 36, 800, "#0b4f6c", "center", { lineHeight: 1.2 }),
    s.card("link", s.at(290, 1460, 500, 84), "#ffffff", 42, { effects: soft("link", "#0b2a3a", 0.3, 12, 24) }),
    icon("link_icon", "arrow-up-right", s.at(324, 1482, 40, 40), "#0b4f6c"),
    t("link_text", "Ver pacotes", 380, 1482, 380, 40, 32, 800, "#0b4f6c"),
  ]);
}

function reelsCover(): Artboard {
  const s = sheet(1080, 1920);
  const t = writer(s, "poppins");
  const pink = "#ff4f8b";
  const choco = "#3a1f14";
  return s.board("#fff1f4", [
    ...photoIn(s.card("photo", s.at(140, 300, 800, 1000), "#f3d6dc", 60, { effects: soft("photo", choco, 0.25, 30, 60) }), "cake", s, 0.5, 0.42),
    s.card("episode", s.at(140, 240, 260, 72), pink, 36, { effects: soft("episode", pink, 0.3, 10, 20) }),
    t("episode_text", "EP. 07", 140, 258, 260, 36, 30, 800, "#ffffff", "center", { letterSpacing: 0.1 }),
    s.card("title_card", s.at(90, 1150, 900, 330), "#ffffff", 48, { effects: soft("title_card", choco, 0.2, 20, 44) }),
    t("title", "Bolo de chocolate\nem 10 minutos", 130, 1190, 820, 200, 76, 800, choco, "center", { lineHeight: 1.1 }),
    t("subtitle", "sem forno e sem batedeira", 130, 1398, 820, 50, 36, 600, pink, "center"),
    star("sparkle_a", s.mid(940, 330, 90, 90), "#ffc93c", 4, 0.35),
    star("sparkle_b", s.mid(1000, 420, 50, 50), pink, 4, 0.35),
    t("handle", "@docesdalu", 240, 1540, 600, 44, 34, 700, choco, "center"),
  ]);
}

function highlights(): Artboard {
  const s = sheet(1080, 1080);
  const t = writer(s, "nunito");
  const covers: [string, string, string][] = [
    ["storefront", "Loja", "#ffd6c9"],
    ["tag", "Ofertas", "#ffe8a8"],
    ["chat-circle", "Dúvidas", "#cfe8ff"],
    ["heart", "Clientes", "#ffd1e3"],
    ["package", "Entregas", "#d4f2df"],
  ];
  const ring = "#c8a27a";
  return s.board("#fbf7f2", [
    t("title", "Destaques do perfil", 80, 110, 920, 60, 48, 800, "#3d2c20", "center"),
    t("subtitle", "Capas em tons pastel com ícones de linha, uma família visual", 80, 180, 920, 40, 28, 600, "#8a7563", "center"),
    ...covers.flatMap(([glyph, label, color], i) => {
      const cx = i < 3 ? 250 + i * 290 : 395 + (i - 3) * 290;
      const cy = i < 3 ? 420 : 760;
      return [
        ellipse(`cover${i + 1}_ring`, s.mid(cx, cy, 230, 230), CLEAR, { stroke: ring, strokeWidth: 4 }),
        ellipse(`cover${i + 1}`, s.mid(cx, cy, 200, 200), color, { effects: soft(`cover${i + 1}`, "#3d2c20", 0.12, 8, 18) }),
        icon(`cover${i + 1}_icon`, glyph, s.mid(cx, cy, 88, 88), "#3d2c20"),
        t(`cover${i + 1}_label`, label, cx - 130, cy + 136, 260, 40, 32, 700, "#3d2c20", "center"),
      ];
    }),
  ]);
}

function adFeed(): Artboard {
  const s = sheet(1080, 1350);
  const t = writer(s, "archivo-black");
  const yellow = "#ffc21a";
  const dark = "#1a0f0a";
  return s.board(dark, [
    ...photoIn(rect("photo", s.at(0, 0, 1080, 900), "#2a1a12"), "burger", s, 0.5, 0.55),
    rect("photo_fade", s.at(0, 600, 1080, 320), "#00000000", { gradient: linear("#1a0f0a00", "#1a0f0a", 90) }),
    s.card("badge", s.at(60, 60, 300, 70), yellow, 35),
    t("badge_text", "SÓ HOJE", 60, 76, 300, 40, 32, 400, dark, "center", { letterSpacing: 0.06 }),
    t("headline", "SMASH\nEM DOBRO", 60, 840, 700, 240, 104, 400, "#ffffff", "left", { lineHeight: 0.98 }),
    ellipse("price_ring", s.mid(860, 880, 280, 280), CLEAR, { stroke: yellow, strokeWidth: 6 }),
    ellipse("price", s.mid(860, 880, 250, 250), yellow, { effects: [glow("price_glow", yellow, 0.35, 30)] }),
    s.label("price_from", "2 por", s.at(760, 800, 200, 40), 32, { font: "dm-sans", weight: 800, fill: dark, align: "center" }),
    t("price_value", "R$ 49", 740, 838, 240, 80, 66, 400, dark, "center", { lineHeight: 1 }),
    s.label("body", "Dois smash burgers com cheddar e batata média. Retirada ou entrega.", s.at(60, 1110, 640, 90), 28, { font: "dm-sans", weight: 500, fill: "#e8d9cf", align: "left", leading: 1.4 }),
    s.card("cta", s.at(60, 1230, 440, 84), yellow, 42),
    t("cta_text", "PEÇA AGORA", 60, 1254, 360, 40, 32, 400, dark, "center"),
    icon("cta_icon", "arrow-right", s.at(420, 1252, 40, 40), dark),
    t("brand", "BRASA BURGER", 620, 1252, 400, 40, 30, 400, yellow, "right", { letterSpacing: 0.06 }),
  ]);
}

function adStory(): Artboard {
  const s = sheet(1080, 1920);
  const t = writer(s, "manrope");
  const peach = "#ffe1cc";
  const rust = "#b5441b";
  const ink = "#2a160c";
  const perks = ["Hidratação por 48 h", "Fórmula vegana", "Para todos os tipos de pele"];
  return s.board(peach, [
    ellipse("glow", s.mid(540, 820, 1100, 1100), "#ffc59e", { gradient: radial("#ffb27d", "#ffe1cc00") }),
    t("brand", "pele.lab", 80, 260, 400, 50, 40, 800, ink),
    s.label("headline", "Pele macia\no dia todo", s.at(80, 340, 920, 260), 120, { font: "fraunces", weight: 700, fill: ink, align: "left", leading: 1 }),
    ...photoIn(s.card("photo", s.at(340, 640, 660, 760), "#f3b48a", 330, { effects: soft("photo", rust, 0.3, 30, 60) }), "skincare", s, 0.5, 0.55),
    ...perks.flatMap((label, i) => [ellipse(`perk${i + 1}_dot`, s.mid(110, 720 + i * 120, 44, 44), rust), icon(`perk${i + 1}_icon`, "check-circle", s.mid(110, 720 + i * 120, 30, 30), "#ffffff"), t(`perk${i + 1}`, label, 150, 700 + i * 120, 220, 80, 28, 700, ink, "left", { lineHeight: 1.2 })]),
    s.card("code", s.at(80, 1450, 440, 110), "#ffffff", 30, { stroke: rust, strokeWidth: 3, dashArray: [10, 8], effects: soft("code", rust, 0.15, 10, 20) }),
    t("code_label", "CUPOM", 80, 1466, 440, 30, 22, 800, rust, "center", { letterSpacing: 0.2 }),
    t("code_value", "PELE20", 80, 1496, 440, 52, 44, 800, ink, "center", { letterSpacing: 0.1 }),
    t("code_note", "20% off na primeira compra", 560, 1478, 440, 70, 30, 700, ink, "left", { lineHeight: 1.2 }),
    s.card("cta", s.at(190, 1610, 700, 100), ink, 50),
    t("cta_text", "Comprar com 20% off", 190, 1640, 700, 42, 34, 800, peach, "center"),
  ]);
}

function campaignPanel(s: Sheet, prefix: string, left: number, top: number, w: number, h: number, scale: number): Layer[] {
  const red = "#d62828";
  const cream = "#fff4e0";
  const px = (n: number) => n * scale;
  const t = writer(s, "anton");
  const tall = h / w > 1.5;
  const photoTop = tall ? top + h * 0.34 : top + h * 0.12;
  const photoSize = tall ? w * 0.92 : Math.min(w, h) * 0.62;
  const photoLeft = tall ? left + (w - photoSize) / 2 : left + w - photoSize * 0.82;
  return [
    s.card(`${prefix}_panel`, s.at(left, top, w, h), red, px(28), { effects: soft(`${prefix}_panel`, "#2a0a0a", 0.25, px(20), px(40)) }),
    ...photoIn(ellipse(`${prefix}_pizza`, s.at(photoLeft, photoTop, photoSize, photoSize), "#b51f1f", { clip: true }), "pizza", s, 0.6, 0.5),
    t(`${prefix}_title`, "TERÇA\nDA PIZZA", left + px(40), top + px(50), w * 0.7, px(250), px(110), 400, cream, "left", { lineHeight: 0.95 }),
    star(`${prefix}_burst`, s.at(left + px(40), tall ? top + h * 0.72 : top + h - px(250), px(200), px(200), -10), "#ffc93c", 16, 0.84),
    t(`${prefix}_price`, "2 por\nR$ 79", left + px(40), (tall ? top + h * 0.72 : top + h - px(250)) + px(52), px(200), px(100), px(40), 400, "#2a0a0a", "center", { lineHeight: 1 }),
    s.card(`${prefix}_cta`, s.at(left + px(40), top + h - px(110), px(330), px(66)), cream, px(33)),
    s.label(`${prefix}_cta_text`, "Peça pelo app", s.at(left + px(40), top + h - px(94), px(330), px(36)), px(26), { font: "dm-sans", weight: 800, fill: red, align: "center" }),
  ];
}

function adCampaign(): Artboard {
  const s = sheet(2400, 1350);
  const t = writer(s, "dm-sans");
  return s.board("#efe9e1", [
    t("title", "Campanha Terça da Pizza  ·  peças por posicionamento", 100, 60, 2200, 50, 38, 800, "#2a2420"),
    ...campaignPanel(s, "story", 100, 170, 590, 1050, 0.8),
    ...campaignPanel(s, "feed", 790, 170, 840, 1050, 1),
    ...campaignPanel(s, "square", 1730, 170, 570, 570, 0.68),
    t("label_story", "Story 9:16", 100, 1240, 590, 40, 30, 700, "#6b6159", "center"),
    t("label_feed", "Feed 4:5", 790, 1240, 840, 40, 30, 700, "#6b6159", "center"),
    t("label_square", "Quadrado 1:1", 1730, 760, 570, 40, 30, 700, "#6b6159", "center"),
    s.card("system_note", s.at(1730, 840, 570, 380), "#ffffff", 28),
    t("system_note_title", "Sistema da campanha", 1770, 876, 500, 40, 30, 800, "#2a2420"),
    t("system_note_body", "Vermelho e creme, pizza vista de cima recortada em círculo, título condensado em duas linhas, selo amarelo do preço e botão creme no pé, sempre na mesma ordem.", 1770, 930, 490, 260, 26, 500, "#6b6159", "left", { lineHeight: 1.45 }),
  ]);
}

function youtubeThumb(): Artboard {
  const s = sheet(1280, 720);
  const t = writer(s, "anton");
  const yellow = "#ffe500";
  const rays = Array.from({ length: 12 }, (_, i) => triangle(`ray${i + 1}`, s.mid(860, 360, 160, 900, i * 30, 0.06), "#ffffff"));
  return s.board("#1b4dff", [
    rect("backdrop", s.at(0, 0, 1280, 720), "#1b4dff", { gradient: radial("#4b7bff", "#0a1f8c", 0.65, 0.5, 0.9) }),
    ...rays,
    ellipse("highlight", s.mid(880, 380, 560, 560), CLEAR, { stroke: "#ff2a2a", strokeWidth: 14 }),
    placedPhoto("product", "sneakerCutout", s.mid(880, 390, 600, 600, -12), s, { effects: [drop("product_shadow", "#000000", 0.45, 0, 24, 40)] }),
    t("headline_top", "TESTEI O", 50, 70, 620, 130, 120, 400, "#ffffff", "left", { lineHeight: 1, stroke: "#000000", strokeWidth: 8 }),
    t("headline_mid", "TÊNIS MAIS", 50, 196, 680, 140, 132, 400, yellow, "left", { lineHeight: 1, stroke: "#000000", strokeWidth: 8 }),
    t("headline_bottom", "LEVE", 50, 330, 620, 190, 180, 400, "#ffffff", "left", { lineHeight: 1, stroke: "#000000", strokeWidth: 10 }),
    s.card("weight", s.at(60, 560, 270, 100, -4), "#ff2a2a", 20, { effects: [drop("weight_shadow", "#000000", 1, 6, 6, 0)] }),
    s.label("weight_text", "180 g", s.at(60, 572, 270, 80, -4), 70, { font: "anton", weight: 400, fill: "#ffffff", align: "center", leading: 1 }),
    path("arrow", ARROW, s.at(420, 470, 230, 150, -15), CLEAR, { stroke: yellow, strokeWidth: 16, lineCap: "round", lineJoin: "round" }),
  ]);
}

export function socialCorpus(): CorpusEntry[] {
  return [
    {
      id: "feed-post",
      title: "Post de feed de cafeteria",
      useCase: "social: post de feed",
      sources: [source("Envato Elements", "Coffee Shop Instagram (peterdraw)", "https://elements.envato.com/coffee-shop-instagram-SVPRQYY"), source("Linearity Templates", "Coffee Shop Instagram Post Design Template", "https://www.linearity.io/templates/social-media/instagram-posts/coffee-shop-instagram-post-design-template/")],
      intent:
        "Post 4:5 em creme com margem de 60 px: à esquerda a chamada manuscrita, o nome da bebida em serifa pesada em três linhas e o texto; à direita a foto num arco de topo semicircular com um segundo arco caramelo deslocado atrás e um círculo pêssego como sol (três planos). Selo estourado vermelho do preço girado sobre a borda do arco, etiqueta branca girada, uma seta desenhada à mão, botão pílula escuro e o perfil no pé. Tipografia: Fraunces, Caveat e DM Sans. Cor: creme, café, caramelo e um vermelho de preço. Raios: arco de raio igual à metade da largura, pílulas inteiras.",
      brief:
        "Post de feed 4:5 da café bússola lançando o Gelado de doce de leite: espresso duplo, leite gelado e calda de doce de leite da casa, só R$ 16, sem lactose, peça no balcão ou no app, @cafebussola. Aconchegante, creme e café, com a foto do copo gelado num arco.",
      photos: ["latte"],
      make: feedPost,
    },
    {
      id: "carousel",
      title: "Carrossel de três cards contínuos",
      useCase: "social: carrossel",
      sources: [source("PicMonkey blog", "Make a Seamless Instagram Carousel Post", "https://www.picmonkey.com/blog/make-a-seamless-instagram-carousel-in-picmonkey"), source("Plann", "Seamless Instagram carousel guide", "https://www.plannthat.com/seamless-instagram-carousel-guide/")],
      intent:
        "Carrossel contínuo de três slides 4:5 (painel de 3240 x 1350): uma onda lilás grossa atravessa os três slides e a foto do produto num círculo sobre uma mancha pêssego fica exatamente sobre a primeira emenda, puxando o deslize. Slide 1: sobretítulo laranja, título enorme em quatro linhas e o convite para arrastar; slides 2 e 3: cards brancos de 48 px com número em círculo laranja, título e texto; slide 3 fecha com o botão escuro. Numeração 1/3, 2/3, 3/3 em pílulas no mesmo lugar. Tipografia Plus Jakarta Sans. Cor: lilás claro, laranja, grafite.",
      brief:
        "Carrossel de 3 slides 4:5 (entregue como um painel de 3240 x 1350) do estúdio vitrine: 3 truques para fotos de produto que vendem. Dica 1: use um fundo de uma cor só. Dica 2: luz de janela, de lado. Bônus na legenda e chamada Salve para a próxima foto. Elementos que atravessam de um slide para o outro e numeração em cada slide.",
      photos: ["sneaker"],
      make: carousel,
    },
    {
      id: "story-post",
      title: "Story de viagem com enquete",
      useCase: "social: story",
      sources: [source("VEED", "Instagram poll story template", "https://www.veed.io/create/instagram-story-templates/instagram-poll-template"), source("Instagram blog", "Introducing polls in Instagram Stories", "https://about.instagram.com/blog/announcements/introducing-polls-in-instagram-stories")],
      intent:
        "Story 9:16 com a foto da praia sangrando a tela toda e véus escuros em degradê no topo e na base para segurar o texto. Dentro das zonas seguras: pílula branca de local com pino, título serifado display enorme em três linhas com sombra, um card de enquete branco de 44 px com duas opções e porcentagens, e uma pílula de link com seta. Tipografia DM Serif Display com Outfit. Cor: azul profundo, branco e o coral do pino.",
      brief:
        "Story 9:16 de agência de viagens: Férias em modo avião, Ilha do Sol, BA. Enquete Qual é a sua vibe? com Praia 62% e Serra 38% e um link Ver pacotes. Foto de praia tropical em tela cheia, respeitando as zonas seguras.",
      photos: ["beach"],
      make: storyPost,
    },
    {
      id: "reels-cover",
      title: "Capa de reels de receita",
      useCase: "social: capa de reels",
      sources: [source("Simplified", "Food Lovers Secret Recipes Instagram Reels Cover", "https://simplified.com/graphic-design/templates/instagram-reels-cover/p/food-lovers-secret-recipes-instagram-reels-cover-f7d543ed-9b35-4695-9c23-f6a112253fb0")],
      intent:
        "Capa 9:16 pensada para o recorte 3:4 da grade: foto do bolo num card de 60 px no centro, pílula rosa EP. 07 encostada no topo do card, um card branco de título sobreposto à base da foto (plano da frente) com o título em duas linhas e o subtítulo rosa, brilhos em estrela e o perfil abaixo. Tipografia Poppins em dois pesos. Cor: rosa claro, chocolate, rosa vivo e um amarelo de brilho.",
      brief:
        "Capa de reels 9:16 da @docesdalu, episódio 7: Bolo de chocolate em 10 minutos, sem forno e sem batedeira. Com a foto do bolo e o título legível no recorte quadrado da grade.",
      photos: ["cake"],
      make: reelsCover,
    },
    {
      id: "highlights",
      title: "Capas de destaques do perfil",
      useCase: "social: capas de destaques",
      sources: [source("Envato Tuts+", "21 best Instagram highlight icons for story covers", "https://design.tutsplus.com/articles/21-best-instagram-highlight-icons-for-story-covers-new-for-2019--cms-33333"), source("Envato Tuts+", "42 best aesthetic highlight covers for Instagram", "https://design.tutsplus.com/articles/42-best-aesthetic-highlight-covers-for-instagram-watercolor-marble-and-more--cms-39337")],
      intent:
        "Folha 1080 x 1080 com cinco capas de destaque como uma família: círculos de 200 px em tons pastel diferentes com o mesmo ícone de linha escuro, anel fino caramelo ao redor e o rótulo embaixo, em duas linhas de três e dois centradas. Título e subtítulo no topo. Tipografia Nunito. Profundidade mínima: sombra muito suave nos círculos.",
      brief:
        "Capas de destaques do perfil de uma loja (folha 1080 x 1080 com as cinco): Loja, Ofertas, Dúvidas, Clientes e Entregas. Círculos pastel com ícones de linha e um anel fino, todas da mesma família.",
      photos: [],
      make: highlights,
    },
    {
      id: "ad-feed",
      title: "Anúncio de feed de hamburgueria",
      useCase: "anúncio: feed",
      sources: [source("Visme", "Burger Brothers Facebook Ad", "https://www.visme.co/templates/social-media-graphics/burger-brothers-facebook-ad-1425281552/")],
      intent:
        "Anúncio 4:5 escuro: a foto do hambúrguer ocupa os dois terços de cima e se funde no fundo por um degradê; selo amarelo SÓ HOJE no topo; título condensado pesado em duas linhas sobre a área escura; preço num círculo amarelo com aro e brilho à direita, cruzando a linha da foto; texto curto, botão amarelo com seta e a marca no pé. Tipografia Archivo Black com DM Sans. Cor: quase preto, amarelo e branco.",
      brief:
        "Anúncio de feed 4:5 da Brasa Burger: smash em dobro, 2 por R$ 49, dois smash burgers com cheddar e batata média, retirada ou entrega, só hoje, botão Peça agora. Escuro e apetitoso, com a foto do hambúrguer.",
      photos: ["burger"],
      make: adFeed,
    },
    {
      id: "ad-story",
      title: "Anúncio de story de skincare",
      useCase: "anúncio: story",
      sources: [source("Linearity Templates", "Skincare Instagram Story Template", "https://linearity.io/templates/social-media/instagram-stories/skincare-instagram-story/"), source("Visme", "Skincare Fresh Glow Instagram Stories", "https://www.visme.co/templates/social-media-graphics/skincare-fresh-glow-instagram-stories-1425282414/")],
      intent:
        "Anúncio 9:16 em pêssego com um brilho suave atrás do produto: marca e título serifado no topo da zona segura, foto do frasco numa cápsula alta à direita com sombra quente, três benefícios com check em círculo à esquerda, cupom em caixa tracejada e botão pílula escuro acima da zona da interface. Tipografia Fraunces com Manrope. Cor: pêssego, ferrugem e marrom escuro. Raios: cápsula inteira, 30 no cupom, pílula no botão.",
      brief:
        "Anúncio de story 9:16 da pele.lab: Pele macia o dia todo, hidratação por 48 h, fórmula vegana, para todos os tipos de pele; cupom PELE20 com 20% off na primeira compra; botão Comprar com 20% off. Com a foto do frasco e respeitando as zonas seguras.",
      photos: ["skincare"],
      make: adStory,
    },
    {
      id: "ad-campaign",
      title: "Campanha em três posicionamentos",
      useCase: "anúncio: conjunto de uma campanha",
      sources: [source("Cropink help", "Auto generate multiple creative sizes from one design", "https://help.cropink.com/en/articles/12891202-auto-generate-multiple-creative-sizes-from-one-design")],
      intent:
        "Prancha 2400 x 1350 com a mesma campanha em story 9:16, feed 4:5 e quadrado 1:1 lado a lado, cada peça com rótulo e uma nota do sistema. O sistema se repete em todas: painel vermelho de 28 px, pizza vista de cima recortada em círculo, título condensado creme em duas linhas, selo estourado amarelo com o preço e botão creme no pé; a posição da pizza se adapta ao formato. Tipografia Anton com DM Sans.",
      brief:
        "Campanha Terça da Pizza em três posicionamentos numa prancha 2400 x 1350: story 9:16, feed 4:5 e quadrado 1:1, com 2 pizzas por R$ 79 e botão Peça pelo app. Mesmo sistema visual nas três, vermelho e creme, com foto de pizza.",
      photos: ["pizza"],
      make: adCampaign,
    },
    {
      id: "yt-thumb",
      title: "Miniatura de vídeo do YouTube",
      useCase: "miniatura do YouTube",
      sources: [source("Linearity Templates", "Bold Ovals YT Thumbnail", "https://linearity.io/templates/social-media/youtube-thumbnails/bold-ovals-yt-thumbnail/"), source("Moda", "YouTube thumbnail: face and object", "https://moda.app/templates/youtube-thumbnails/face-object")],
      intent:
        "Miniatura 1280 x 720 de alto contraste: fundo azul com raios girando atrás do produto, o tênis recortado grande e inclinado dentro de um círculo vermelho de destaque, título em três linhas de caixa alta condensada com contorno preto grosso (branco, amarelo, branco) à esquerda, selo vermelho com sombra dura do peso e uma seta amarela desenhada apontando o produto. Tipografia Anton. Legível em tamanho pequeno.",
      brief:
        "Miniatura do YouTube (1280 x 720) para o vídeo Testei o tênis mais leve, com o destaque 180 g. Alto contraste, texto enorme com contorno, o tênis grande com um círculo vermelho e uma seta.",
      photos: ["sneakerCutout"],
      make: youtubeThumb,
    },
  ];
}
