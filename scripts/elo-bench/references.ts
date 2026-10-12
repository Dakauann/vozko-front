import type { Artboard, Layer, VideoDocument } from "@/lib/studio/document";

import { board, box, caption, chart, drop, ellipse, film, glow, icon, key, linear, overlay, path, radial, rect, star, text } from "./authoring";
import type { Reference } from "./model";
import { extendedReferences } from "./references-extended";
import { sotaReferences } from "./references-sota";

const AUTHORED = "authored for this benchmark in the studio document format; vector shapes, text and charts only, no photo";

const MENU_INK = "#f5e6cc";
const MENU_ACCENT = "#e8a33d";
const MENU_MUTED = "#b8a48c";

function menuItem(n: number, name: string, description: string, price: string, y: number): Layer[] {
  return [
    text(`item${n}`, name, box(0.4, y, 0.6, 0.04), { font: "oswald", size: 0.03, weight: 600, fill: MENU_INK, align: "left" }),
    text(`price${n}`, price, box(0.8, y, 0.2, 0.04), { font: "oswald", size: 0.03, weight: 700, fill: MENU_ACCENT, align: "right" }),
    ...(description ? [text(`desc${n}`, description, box(0.45, y + 0.032, 0.7, 0.032), { font: "dm-sans", size: 0.022, fill: MENU_MUTED, align: "left" })] : []),
    rect(`rule${n}`, box(0.5, y + (description ? 0.058 : 0.03), 0.8, 0.0015), "#3a2c20"),
  ];
}

function menu(): Artboard {
  const burgers: [string, string, string][] = [
    ["Clássico da Casa", "Blend de 160 g, queijo prato, alface e tomate", "R$ 32,90"],
    ["Smash Duplo", "Dois smash de 90 g, cheddar e cebola na chapa", "R$ 36,90"],
    ["Bacon Brasa", "Blend de 180 g, bacon crocante e barbecue da casa", "R$ 39,90"],
    ["Veggie da Horta", "Grão de bico, rúcula e maionese de ervas", "R$ 34,90"],
    ["Trufado", "Blend de 180 g, brie, cogumelos e maionese trufada", "R$ 44,90"],
  ];
  const drinks: [string, string][] = [
    ["Limonada Suíça", "R$ 12,90"],
    ["Chá Gelado da Casa", "R$ 10,90"],
    ["Refrigerante Lata", "R$ 7,90"],
  ];
  return board(1080, 1350, "#17120e", [
    ellipse("ember", box(0.86, 0.06, 0.7, 0.56, 0, 0.55), "#3a2414", { gradient: radial("#5a3418", "#17120e00") }),
    text("kicker", "HAMBURGUERIA ARTESANAL", box(0.5, 0.05, 0.8, 0.03), { font: "oswald", size: 0.022, weight: 500, fill: MENU_ACCENT, spacing: 0.3 }),
    text("title", "BRASA & PÃO", box(0.5, 0.132, 0.9, 0.09), { font: "bebas-neue", size: 0.1, fill: MENU_INK, spacing: 0.04 }),
    rect("title_rule", box(0.5, 0.185, 0.16, 0.003), MENU_ACCENT),
    ellipse("seal", box(0.88, 0.085, 0.13, 0.104), "#17120e", { stroke: MENU_ACCENT, strokeWidth: 3 }),
    text("seal_text", "DESDE\n2014", box(0.88, 0.085, 0.11, 0.07), { font: "oswald", size: 0.022, weight: 600, fill: MENU_ACCENT, leading: 1.1 }),
    text("burgers", "BURGERS", box(0.5, 0.24, 0.8, 0.04), { font: "oswald", size: 0.03, weight: 700, fill: MENU_ACCENT, align: "left", spacing: 0.15 }),
    ...burgers.flatMap(([name, description, price], i) => menuItem(i + 1, name, description, price, 0.295 + i * 0.08)),
    text("drinks", "BEBIDAS", box(0.5, 0.71, 0.8, 0.04), { font: "oswald", size: 0.03, weight: 700, fill: MENU_ACCENT, align: "left", spacing: 0.15 }),
    ...drinks.flatMap(([name, price], i) => menuItem(i + 6, name, "", price, 0.765 + i * 0.05)),
    rect("order", box(0.5, 0.93, 0.66, 0.062), "#17120e", { radius: 1, stroke: MENU_ACCENT, strokeWidth: 3 }),
    icon("order_icon", "whatsapp-logo", box(0.25, 0.93, 0.045, 0.036), MENU_ACCENT),
    text("order_text", "Peça pelo WhatsApp (11) 4002-8922", box(0.535, 0.93, 0.5, 0.04), { font: "dm-sans", size: 0.022, weight: 700, fill: MENU_INK }),
  ]);
}

const NIGHT = "#12062a";
const PINK = "#ff2e88";

function event(): Artboard {
  const deep = (id: string) => [drop(`${id}a`, "#05010c", 0.4, 4, 8, 16), drop(`${id}b`, "#05010c", 0.3, 14, 28, 56), drop(`${id}c`, PINK, 0.22, 30, 60, 120)];
  return board(
    1080,
    1350,
    "#1b0b3a",
    [
      ellipse("ring_outer", box(0.5, 0.33, 0.9, 0.72, 0, 0.35), "#00000000", { stroke: "#ff8a3d", strokeWidth: 3 }),
      ellipse("ring_inner", box(0.5, 0.33, 0.76, 0.608, 0, 0.5), "#00000000", { stroke: "#ff8a3d", strokeWidth: 2 }),
      ellipse("sun", box(0.5, 0.33, 0.62, 0.496), "#ff8a3d", { gradient: linear("#ffb03d", PINK, 90), effects: [glow("sg", "#ff4f8b", 0.6, 90)] }),
      rect("stage", box(0.5, 0.56, 0.82, 0.2), NIGHT, { radius: 0.1, effects: deep("st") }),
      text("title", "PULSO", box(0.5, 0.555, 0.8, 0.2), { font: "anton", size: 0.17, fill: "#ffffff", spacing: 0.06 }, { effects: [drop("t1", PINK, 1, 6, 12, 0), drop("t2", "#7b2ff7", 1, 12, 24, 0), drop("t3", "#05010c", 0.55, 20, 40, 40)] }),
      text("subtitle", "FESTIVAL DE MÚSICA ELETRÔNICA", box(0.5, 0.71, 0.86, 0.04), { font: "dm-sans", size: 0.026, weight: 700, fill: "#ffd1e8", spacing: 0.25 }),
      rect("date_chip", box(0.5, 0.79, 0.5, 0.068), "#ffffff", { radius: 1, effects: [drop("d1", "#2a0640", 0.45, 5, 10, 20), drop("d2", "#2a0640", 0.25, 12, 24, 48)] }),
      text("date", "14 DEZ · 22H", box(0.5, 0.79, 0.46, 0.05), { font: "space-grotesk", size: 0.036, weight: 700, fill: "#2a0640", spacing: 0.08 }),
      text("footer", "Arena Lagoa · ingressos em pulso.app", box(0.5, 0.9, 0.8, 0.03), { font: "dm-sans", size: 0.022, weight: 500, fill: "#e9d5ff" }),
    ],
    linear("#1b0b3a", "#4a0e5c", 90),
  );
}

const PAPER = "#f3e9dd";
const WOOD = "#2b1d12";
const AMBER = "#c2410c";

function product(): Artboard {
  return board(1080, 1080, PAPER, [
    rect("card", box(0.5, 0.5, 0.86, 0.84), "#fffaf4", { radius: 0.08, effects: [drop("c1", "#6b4a2b", 0.16, 0, 6, 14), drop("c2", "#6b4a2b", 0.14, 0, 24, 60)] }),
    ellipse("floor", box(0.31, 0.77, 0.3, 0.035, 0, 0.3), "#6b4a2b", { effects: [{ id: "fb", type: "outer-glow", color: "#6b4a2b", opacity: 0.4, x: 0, y: 0, blur: 18, spread: 0 }] }),
    rect("bottle", box(0.31, 0.56, 0.27, 0.38), "#e8873a", { radius: 0.22, gradient: linear("#f7b267", AMBER, 90), effects: [drop("b1", "#6b4a2b", 0.25, 0, 12, 24)] }),
    rect("shine", box(0.235, 0.53, 0.026, 0.24, 0, 0.4), "#ffffff", { radius: 1 }),
    rect("neck", box(0.31, 0.35, 0.07, 0.04), "#d6c3a5"),
    rect("cap", box(0.31, 0.3, 0.14, 0.085), WOOD, { radius: 0.25 }),
    rect("label", box(0.31, 0.6, 0.17, 0.1), "#fff7ed", { radius: 0.12 }),
    text("label_text", "ÂMBAR", box(0.31, 0.6, 0.15, 0.05), { font: "playfair-display", size: 0.026, weight: 700, fill: "#7c2d12", spacing: 0.12 }),
    text("kicker", "PERFUME", box(0.68, 0.22, 0.34, 0.035), { font: "dm-sans", size: 0.026, weight: 700, fill: "#a16207", align: "left", spacing: 0.3 }),
    text("name", "Âmbar\nNoturno", box(0.68, 0.315, 0.34, 0.13), { font: "playfair-display", size: 0.055, weight: 700, fill: WOOD, align: "left", leading: 1.05 }),
    text("variant", "Eau de parfum · 100 ml", box(0.68, 0.425, 0.34, 0.04), { font: "dm-sans", size: 0.028, fill: "#6b5a4a", align: "left" }),
    text("old_price", "de R$ 249,90", box(0.68, 0.505, 0.34, 0.04), { font: "dm-sans", size: 0.028, fill: "#7a6a5a", align: "left" }),
    rect("strike", box(0.593, 0.506, 0.172, 0.003), "#7a6a5a"),
    text("price", "R$ 189,90", box(0.71, 0.59, 0.4, 0.09), { font: "dm-sans", size: 0.07, weight: 800, fill: AMBER, align: "left" }),
    text("installments", "ou 6x de R$ 31,65", box(0.68, 0.665, 0.34, 0.04), { font: "dm-sans", size: 0.026, fill: "#6b5a4a", align: "left" }),
    rect("cta", box(0.66, 0.78, 0.3, 0.085), WOOD, { radius: 1, effects: [drop("k1", "#6b4a2b", 0.3, 0, 8, 16)] }),
    text("cta_text", "Comprar agora", box(0.66, 0.78, 0.28, 0.05), { font: "dm-sans", size: 0.028, weight: 700, fill: "#fff7ed" }),
    star("badge", box(0.85, 0.15, 0.16, 0.16, 12), AMBER, 14, 0.84),
    text("badge_text", "-24%", box(0.85, 0.15, 0.12, 0.05, 12), { font: "dm-sans", size: 0.034, weight: 800, fill: "#ffffff" }),
  ]);
}

function pepperoni(n: number, x: number, y: number): Layer {
  return ellipse(`pep${n}`, box(x, y, 0.076, 0.061), "#a4161a", { gradient: radial("#c1272d", "#7f0f12") });
}

function feedAd(): Artboard {
  const spots: [number, number][] = [
    [0.515, 0.466],
    [0.676, 0.439],
    [0.765, 0.555],
    [0.587, 0.582],
    [0.462, 0.626],
    [0.676, 0.68],
    [0.809, 0.662],
  ];
  return board(1080, 1350, "#c8102e", [
    text("brand", "Forno da Vila", box(0.3, 0.075, 0.5, 0.06), { font: "pacifico", size: 0.042, fill: "#fff3e0", align: "left" }),
    text("headline", "Pizza grande\n+ refri 2 L", box(0.5, 0.235, 0.84, 0.2), { font: "anton", size: 0.09, fill: "#fff3e0", align: "left", leading: 1.05 }),
    ellipse("crust", box(0.64, 0.555, 0.64, 0.512), "#e9a23b", { effects: [drop("p1", "#5c0712", 0.45, 10, 18, 36)] }),
    ellipse("sauce", box(0.64, 0.555, 0.57, 0.456), "#d7261e"),
    ellipse("cheese", box(0.64, 0.555, 0.53, 0.424), "#ffcf4a", { gradient: radial("#ffe08a", "#f4b63f") }),
    ...spots.map(([x, y], i) => pepperoni(i + 1, x, y)),
    path("basil1", "M0 0.5 C0.3 0 0.7 0 1 0.5 C0.7 1 0.3 1 0 0.5 Z", box(0.604, 0.484, 0.055, 0.027, 30), "#2d6a4f"),
    path("basil2", "M0 0.5 C0.3 0 0.7 0 1 0.5 C0.7 1 0.3 1 0 0.5 Z", box(0.747, 0.657, 0.055, 0.027, -20), "#2d6a4f"),
    star("burst", box(0.19, 0.6, 0.3, 0.24, -10), "#ffd60a", 18, 0.84, { effects: [drop("bb", "#5c0712", 0.4, 6, 12, 20)] }),
    text("burst_price", "R$\n59,90", box(0.19, 0.6, 0.22, 0.13, -10), { font: "anton", size: 0.048, fill: "#c8102e", leading: 0.95 }),
    text("note", "Entrega grátis no bairro · até 22h", box(0.5, 0.858, 0.84, 0.035), { font: "dm-sans", size: 0.025, weight: 500, fill: "#ffe4e1" }),
    rect("cta", box(0.5, 0.93, 0.66, 0.07), "#15803d", { radius: 1, effects: [drop("c1", "#5c0712", 0.35, 5, 10, 20)] }),
    icon("cta_icon", "whatsapp-logo", box(0.27, 0.93, 0.05, 0.04), "#ffffff"),
    text("cta_text", "Peça pelo WhatsApp", box(0.54, 0.93, 0.44, 0.045), { font: "dm-sans", size: 0.03, weight: 700, fill: "#ffffff" }),
  ]);
}

function flake(n: number, x: number, y: number, size: number, opacity: number): Layer {
  return star(`flake${n}`, box(x, y, size, size * 0.5625, 0, opacity), "#ffffff", 6, 0.3);
}

function storyAd(): Artboard {
  const flakes: [number, number, number, number][] = [
    [0.12, 0.08, 0.05, 0.5],
    [0.86, 0.12, 0.07, 0.4],
    [0.9, 0.42, 0.04, 0.5],
    [0.08, 0.5, 0.06, 0.35],
    [0.18, 0.74, 0.08, 0.3],
    [0.82, 0.8, 0.05, 0.4],
  ];
  return board(
    1080,
    1920,
    "#0f2a4a",
    [
      ...flakes.map(([x, y, s, o], i) => flake(i + 1, x, y, s, o)),
      text("kicker", "LIQUIDA DE INVERNO", box(0.5, 0.19, 0.86, 0.04), { font: "montserrat", size: 0.026, weight: 800, fill: "#bfe3ff", spacing: 0.25 }),
      text("big", "60%", box(0.5, 0.33, 0.96, 0.2), { font: "bebas-neue", size: 0.22, fill: "#ffffff" }, { effects: [drop("b1", "#081a30", 0.5, 8, 16, 0), drop("b2", "#081a30", 0.35, 20, 40, 40)] }),
      text("off", "OFF EM CASACOS E MALHAS", box(0.5, 0.465, 0.94, 0.04), { font: "montserrat", size: 0.025, weight: 800, fill: "#ffffff", spacing: 0.12 }),
      rect("sticker", box(0.5, 0.53, 0.5, 0.05, -5), "#ffd166", { radius: 0.3, effects: [drop("s1", "#081a30", 0.35, 6, 12, 20)] }),
      text("sticker_text", "Só até domingo", box(0.5, 0.53, 0.46, 0.035, -5), { font: "montserrat", size: 0.024, weight: 800, fill: "#0f2a4a" }),
      rect("cta", box(0.5, 0.615, 0.56, 0.048), "#ffffff", { radius: 1 }),
      text("cta_text", "Toque e garanta o seu", box(0.5, 0.615, 0.52, 0.03), { font: "montserrat", size: 0.021, weight: 700, fill: "#0f2a4a" }),
      path("wave", "M0 0.4 C0.2 0.1 0.4 0.1 0.55 0.35 S0.85 0.6 1 0.3 L1 1 L0 1 Z", box(0.5, 0.92, 1.02, 0.16, 0, 0.18), "#ffffff"),
    ],
    linear("#0f2a4a", "#1e5a8a", 90),
  );
}

const RIBBON_TEXT = "DOCES · BOLOS · TORTAS · DOCES · BOLOS · TORTAS";

function ribbons(): Artboard {
  const strip = (id: string, y: number, fill: string, ink: string): Layer[] => [
    rect(id, box(0.5, y, 1.3, 0.066, -8), fill, { radius: 1, effects: [drop(`${id}s`, "#6b2d5c", 0.2, 4, 10, 18)] }),
    text(`${id}_text`, RIBBON_TEXT, box(0.5, y, 1.2, 0.04, -8), { font: "fredoka", size: 0.026, weight: 700, fill: ink, spacing: 0.12 }),
  ];
  return board(1080, 1350, "#fff1e6", [
    text("title", "Doceria Mel", box(0.5, 0.12, 0.84, 0.12), { font: "pacifico", size: 0.08, fill: "#6b2d5c" }),
    ...strip("strip1", 0.3, "#c2255c", "#ffffff"),
    ...strip("strip2", 0.385, "#ffc75f", "#6b2d5c"),
    ...strip("strip3", 0.47, "#845ec2", "#ffffff"),
    path("tail_left", "M0 0 L1 0 L1 1 L0 1 L0.32 0.5 Z", box(0.17, 0.645, 0.16, 0.085), "#4a1d40"),
    path("tail_right", "M0 0 L1 0 L0.68 0.5 L1 1 L0 1 Z", box(0.83, 0.645, 0.16, 0.085), "#4a1d40"),
    path("fold_left", "M0 0 L1 0 L1 1 Z", box(0.235, 0.67, 0.03, 0.025), "#2e1028"),
    path("fold_right", "M0 0 L1 0 L0 1 Z", box(0.765, 0.67, 0.03, 0.025), "#2e1028"),
    rect("banner", box(0.5, 0.625, 0.56, 0.09), "#6b2d5c", { effects: [drop("bn", "#6b2d5c", 0.3, 4, 10, 20)] }),
    text("banner_text", "10 ANOS DE DOÇURA", box(0.5, 0.625, 0.54, 0.05), { font: "fredoka", size: 0.036, weight: 700, fill: "#ffffff", spacing: 0.06 }),
    text("when", "Festa de aniversário: 25/10, a partir das 15h", box(0.5, 0.77, 0.84, 0.04), { font: "dm-sans", size: 0.028, weight: 700, fill: "#6b2d5c" }),
    text("where", "Rua das Flores, 120 · Vila Mariana", box(0.5, 0.815, 0.84, 0.03), { font: "dm-sans", size: 0.022, fill: "#8a4f7d" }),
    rect("free", box(0.5, 0.9, 0.36, 0.06), "#fff1e6", { radius: 1, stroke: "#6b2d5c", strokeWidth: 4 }),
    text("free_text", "Entrada livre", box(0.5, 0.9, 0.32, 0.035), { font: "fredoka", size: 0.026, weight: 700, fill: "#6b2d5c" }),
  ]);
}

const TILT = -12;

function sports(): Artboard {
  const speed = (n: number, x: number, y: number, w: number, opacity: number) => rect(`speed${n}`, box(x, y, w, 0.006, TILT, opacity), "#ffffff", { radius: 1 });
  return board(1080, 1350, "#0b0f19", [
    speed(1, 0.2, 0.08, 0.3, 0.25),
    speed(2, 0.3, 0.12, 0.45, 0.18),
    speed(3, 0.15, 0.16, 0.22, 0.3),
    speed(4, 0.8, 0.9, 0.35, 0.2),
    speed(5, 0.75, 0.95, 0.25, 0.28),
    text("league", "CAMPEONATO METROPOLITANO DE BASQUETE", box(0.42, 0.255, 0.8, 0.03, TILT), { font: "oswald", size: 0.02, weight: 600, fill: "#ff9500", spacing: 0.2 }),
    rect("band_thin", box(0.5, 0.33, 1.6, 0.014, TILT, 0.7), "#ff9500"),
    rect("band", box(0.5, 0.5, 1.6, 0.28, TILT), "#ff3c00", { gradient: linear("#ff3c00", "#ff9500", 0) }),
    rect("band_white", box(0.5, 0.665, 1.6, 0.022, TILT), "#ffffff"),
    text("title", "GRANDE FINAL", box(0.5, 0.465, 1, 0.12, TILT), { font: "anton", size: 0.105, fill: "#ffffff" }, { effects: [drop("t1", "#3d0d00", 0.45, 8, 10, 0)] }),
    text("teams", "TUBARÕES  x  FALCÕES", box(0.5, 0.56, 0.9, 0.05, TILT), { font: "oswald", size: 0.045, weight: 700, fill: "#0b0f19", spacing: 0.06 }),
    ellipse("ball", box(0.86, 0.12, 0.16, 0.128, TILT), "#ff7a00", { stroke: "#0b0f19", strokeWidth: 6, effects: [drop("bl", "#000000", 0.4, 8, 10, 0)] }),
    path("seam", "M0.5 0 C0.25 0.3 0.25 0.7 0.5 1", box(0.86, 0.12, 0.16, 0.128, TILT), "#00000000", { stroke: "#0b0f19", strokeWidth: 6 }),
    text("when", "SÁBADO · 16H", box(0.5, 0.79, 0.9, 0.08, TILT), { font: "anton", size: 0.065, fill: "#ffffff" }),
    text("where", "Ginásio Central · ingressos na bilheteria", box(0.52, 0.87, 0.8, 0.03, TILT), { font: "dm-sans", size: 0.022, weight: 500, fill: "#9aa4b2" }),
  ]);
}

const GOLD = "#b08d57";
const INK = "#1c1a17";

function luxury(): Artboard {
  return board(1080, 1350, "#f6f1e8", [
    rect("frame", box(0.5, 0.5, 0.9, 0.92), "#00000000", { stroke: GOLD, strokeWidth: 2 }),
    rect("frame_inner", box(0.5, 0.5, 0.87, 0.896, 0, 0.6), "#00000000", { stroke: GOLD, strokeWidth: 1 }),
    text("house", "MAISON ÉLAN", box(0.5, 0.12, 0.7, 0.04), { font: "cormorant-garamond", size: 0.026, weight: 600, fill: INK, spacing: 0.4 }),
    ellipse("ring", box(0.5, 0.42, 0.24, 0.192), "#00000000", { stroke: GOLD, strokeWidth: 10, effects: [drop("r1", "#6b5233", 0.18, 0, 10, 24)] }),
    path("gem", "M0.5 0 L1 0.38 L0.5 1 L0 0.38 Z", box(0.5, 0.315, 0.075, 0.07), "#cfe0ec", { gradient: linear("#f2f8fc", "#8fa9bd", 90), effects: [drop("g1", "#6b5233", 0.2, 0, 6, 12)] }),
    text("headline", "Aurora", box(0.5, 0.62, 0.7, 0.1), { font: "cormorant-garamond", size: 0.095, weight: 500, fill: INK, italic: true }),
    text("sub", "Joias atemporais em ouro 18k", box(0.5, 0.69, 0.7, 0.04), { font: "eb-garamond", size: 0.026, fill: "#5c5347" }),
    rect("rule", box(0.5, 0.74, 0.08, 0.002), GOLD),
    text("footer", "COLEÇÃO 2026 · SÃO PAULO", box(0.5, 0.87, 0.7, 0.03), { font: "cormorant-garamond", size: 0.022, weight: 600, fill: "#6f6658", spacing: 0.3 }),
  ]);
}

const SLATE = "#0f172a";

function kpi(n: number, x: number, value: string, label: string, ink: string): Layer[] {
  return [
    rect(`kpi${n}`, box(x, 0.27, 0.27, 0.12), "#ffffff", { radius: 0.18, effects: [drop(`k${n}a`, "#0f172a", 0.06, 0, 2, 4), drop(`k${n}b`, "#0f172a", 0.08, 0, 10, 24)] }),
    text(`kpi${n}_value`, value, box(x, 0.253, 0.25, 0.05), { font: "plus-jakarta-sans", size: 0.036, weight: 800, fill: ink }),
    text(`kpi${n}_label`, label, box(x, 0.302, 0.24, 0.03), { font: "plus-jakarta-sans", size: 0.021, weight: 500, fill: "#64748b" }),
  ];
}

function infographic(): Artboard {
  return board(1080, 1350, "#f8fafc", [
    text("title", "Vendas do 1º semestre", box(0.5, 0.09, 0.86, 0.06), { font: "plus-jakarta-sans", size: 0.05, weight: 800, fill: SLATE, align: "left" }),
    text("subtitle", "Loja online · valores em milhares de reais", box(0.5, 0.14, 0.86, 0.03), { font: "plus-jakarta-sans", size: 0.022, weight: 500, fill: "#64748b", align: "left" }),
    ...kpi(1, 0.205, "R$ 482 mil", "Faturamento", SLATE),
    ...kpi(2, 0.5, "+38%", "contra 2025", "#059669"),
    ...kpi(3, 0.795, "12,4 mil", "Pedidos", SLATE),
    rect("chart_card", box(0.5, 0.585, 0.86, 0.4), "#ffffff", { radius: 0.06, effects: [drop("cc1", "#0f172a", 0.06, 0, 2, 4), drop("cc2", "#0f172a", 0.08, 0, 14, 32)] }),
    text("chart_title", "Faturamento por mês", box(0.5, 0.42, 0.78, 0.03), { font: "plus-jakarta-sans", size: 0.022, weight: 700, fill: SLATE, align: "left" }),
    { id: "bars", type: "chart", transform: box(0.5, 0.61, 0.78, 0.31), chart: chart("bar", ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"], [52, 61, 70, 83, 98, 118], ["#2563eb"]) },
    { id: "donut", type: "chart", transform: box(0.24, 0.885, 0.22, 0.176), chart: chart("donut", ["Site", "App", "Marketplace"], [62, 28, 10], ["#2563eb", "#10b981", "#f59e0b"], { valueLabels: false, axes: false, gridlines: false }) },
    text("legend1", "Site · 62%", box(0.56, 0.85, 0.36, 0.03), { font: "plus-jakarta-sans", size: 0.022, weight: 600, fill: "#2563eb", align: "left" }),
    text("legend2", "App · 28%", box(0.56, 0.885, 0.36, 0.03), { font: "plus-jakarta-sans", size: 0.022, weight: 600, fill: "#059669", align: "left" }),
    text("legend3", "Marketplace · 10%", box(0.56, 0.92, 0.36, 0.03), { font: "plus-jakarta-sans", size: 0.022, weight: 600, fill: "#b45309", align: "left" }),
  ]);
}

const LEATHER = "#5a3e1b";
const QUILL = "#3b2610";

function attribute(n: number, label: string, value: string, modifier: string, x: number, y: number): Layer[] {
  return [
    rect(`attr${n}`, box(x, y, 0.125, 0.1), "#f7eedb", { radius: 0.15, stroke: LEATHER, strokeWidth: 3 }),
    text(`attr${n}_label`, label, box(x, y - 0.03, 0.11, 0.025), { font: "eb-garamond", size: 0.018, weight: 700, fill: LEATHER, spacing: 0.15 }),
    text(`attr${n}_value`, value, box(x, y + 0.002, 0.11, 0.04), { font: "fraunces", size: 0.036, weight: 700, fill: QUILL }),
    text(`attr${n}_mod`, modifier, box(x, y + 0.033, 0.11, 0.022), { font: "eb-garamond", size: 0.017, weight: 600, fill: "#7a5a2e" }),
  ];
}

function bar(id: string, label: string, y: number, share: number, fill: string): Layer[] {
  const left = 0.08;
  const width = 0.84;
  return [
    text(`${id}_label`, label, box(0.5, y - 0.035, width, 0.03), { font: "eb-garamond", size: 0.022, weight: 700, fill: QUILL, align: "left" }),
    rect(`${id}_track`, box(0.5, y, width, 0.026), "#c9b28a", { radius: 1 }),
    rect(`${id}_fill`, box(left + (width * share) / 2, y, width * share, 0.026), fill, { radius: 1 }),
  ];
}

function rpgSheet(): Artboard {
  const stats: [string, string, string][] = [
    ["FOR", "12", "+1"],
    ["DES", "18", "+4"],
    ["CON", "14", "+2"],
    ["INT", "13", "+1"],
    ["SAB", "15", "+2"],
    ["CAR", "10", "+0"],
  ];
  return board(
    1080,
    1350,
    "#efe2c4",
    [
      rect("frame", box(0.5, 0.5, 0.94, 0.95), "#00000000", { stroke: LEATHER, strokeWidth: 4, radius: 0.03 }),
      rect("frame_inner", box(0.5, 0.5, 0.915, 0.93), "#00000000", { stroke: LEATHER, strokeWidth: 1.5, radius: 0.03 }),
      text("sheet", "FICHA DE PERSONAGEM", box(0.5, 0.065, 0.8, 0.035), { font: "eb-garamond", size: 0.026, weight: 700, fill: LEATHER, spacing: 0.3 }),
      text("name", "Lyra Ventoleve", box(0.5, 0.12, 0.84, 0.06), { font: "fraunces", size: 0.052, weight: 700, fill: QUILL }),
      text("class", "Elfa · Arqueira · Nível 7", box(0.5, 0.165, 0.84, 0.03), { font: "eb-garamond", size: 0.024, fill: "#6b4e2a", italic: true }),
      ellipse("portrait", box(0.23, 0.32, 0.27, 0.216), "#d9c39a", { stroke: LEATHER, strokeWidth: 6, effects: [drop("pt", LEATHER, 0.25, 0, 6, 12)] }),
      star("emblem", box(0.23, 0.32, 0.15, 0.12), LEATHER, 8, 0.38, { transform: box(0.23, 0.32, 0.15, 0.12, 22.5, 0.85) }),
      ...stats.flatMap(([label, value, modifier], i) => attribute(i + 1, label, value, modifier, 0.53 + (i % 3) * 0.15, 0.27 + Math.floor(i / 3) * 0.125)),
      ...bar("hp", "Pontos de vida · 42 / 56", 0.53, 0.75, "#9b2226"),
      ...bar("mana", "Mana · 18 / 30", 0.61, 0.6, "#1d4e89"),
      text("skills", "PERÍCIAS", box(0.5, 0.68, 0.84, 0.03), { font: "eb-garamond", size: 0.024, weight: 700, fill: LEATHER, align: "left", spacing: 0.2 }),
      text("skill1", "Furtividade +8", box(0.29, 0.725, 0.42, 0.03), { font: "eb-garamond", size: 0.024, fill: QUILL, align: "left" }),
      text("skill2", "Percepção +7", box(0.71, 0.725, 0.42, 0.03), { font: "eb-garamond", size: 0.024, fill: QUILL, align: "left" }),
      text("skill3", "Sobrevivência +6", box(0.29, 0.765, 0.42, 0.03), { font: "eb-garamond", size: 0.024, fill: QUILL, align: "left" }),
      text("skill4", "Acrobacia +7", box(0.71, 0.765, 0.42, 0.03), { font: "eb-garamond", size: 0.024, fill: QUILL, align: "left" }),
      rect("gear_box", box(0.5, 0.875, 0.84, 0.11), "#f7eedb", { radius: 0.12, stroke: LEATHER, strokeWidth: 3 }),
      text("gear", "EQUIPAMENTO", box(0.5, 0.84, 0.76, 0.03), { font: "eb-garamond", size: 0.02, weight: 700, fill: LEATHER, align: "left", spacing: 0.2 }),
      text("gear1", "Arco longo élfico · 1d8 + 4", box(0.5, 0.875, 0.76, 0.03), { font: "eb-garamond", size: 0.024, fill: QUILL, align: "left" }),
      text("gear2", "Aljava com 24 flechas · capa da floresta", box(0.5, 0.91, 0.76, 0.03), { font: "eb-garamond", size: 0.024, fill: QUILL, align: "left" }),
    ],
    radial("#f4ead3", "#d9c39a", 0.5, 0.45, 1.1),
  );
}

function videoPromo(): VideoDocument {
  const end = 6000;
  return film("story", "#111827", end, [
    overlay("blob", { type: "shape", shape: "ellipse", fill: "#c2410c", gradient: radial("#ea580c", "#9a3412") }, 0, end, box(0.5, 0.33, 0.76, 0.4275), { keyframes: { scale: [key(0, 0.4, "backOut"), key(700, 1)] } }),
    overlay("title", { ...caption("Café Gelado", "poppins", 0.06, 800, "#ffffff"), effects: [drop("ts", "#7c2d12", 0.45, 0, 10, 20)] }, 300, end - 300, box(0.5, 0.31, 0.7, 0.08), { keyframes: { y: [key(0, 0.37), key(600, 0.31)], opacity: [key(0, 0, "linear"), key(300, 1, "linear")] } }),
    overlay("subtitle", caption("Novo no cardápio", "poppins", 0.028, 600, "#ffedd5"), 900, end - 900, box(0.5, 0.37, 0.6, 0.04), { keyframes: { opacity: [key(0, 0, "linear"), key(400, 1, "linear")] } }),
    overlay("price_pill", { type: "shape", shape: "rect", fill: "#ffffff", radius: 1 }, 1800, end - 1800, box(0.5, 0.585, 0.5, 0.06), { keyframes: { scale: [key(0, 0.6, "backOut"), key(500, 1)] } }),
    overlay("price", caption("R$ 14,90", "poppins", 0.04, 800, "#111827"), 1800, end - 1800, box(0.5, 0.585, 0.46, 0.05), { keyframes: { scale: [key(0, 0.6, "backOut"), key(500, 1)] } }),
    overlay("cta", caption("Peça no app", "poppins", 0.028, 700, "#fdba74"), 3000, end - 3000, box(0.5, 0.635, 0.6, 0.04), { keyframes: { y: [key(0, 0.66), key(500, 0.635)], opacity: [key(0, 0, "linear"), key(400, 1, "linear")] } }),
  ]);
}

export function references(): Reference[] {
  const image = (id: string, title: string, make: () => Artboard): Reference => ({ id, title, kind: "image", origin: AUTHORED, artboard: make() });
  return [
    image("menu", "Cardápio de hamburgueria", menu),
    image("event", "Pôster de evento com sombras em camadas", event),
    image("product", "Card de venda com preço", product),
    image("feed", "Anúncio de feed", feedAd),
    image("story", "Anúncio de story 9:16", storyAd),
    image("ribbons", "Faixas arredondadas e fitas", ribbons),
    image("sports", "Peça esportiva diagonal", sports),
    image("luxury", "Peça minimalista de luxo", luxury),
    image("infographic", "Infográfico com gráfico", infographic),
    image("rpg", "Ficha de personagem de RPG", rpgSheet),
    { id: "promo", title: "Vídeo curto promocional com movimento", kind: "video", origin: AUTHORED, doc: videoPromo() },
    ...extendedReferences(),
    ...sotaReferences(),
  ];
}
