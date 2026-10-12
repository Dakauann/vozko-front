import { imageDocument, type Artboard, type ImageDocument, type Layer, type StudioGroup, type Transform } from "@/lib/studio/document";
import type { FontId } from "@/lib/studio/fonts";
import type { StudioStyle } from "@/lib/studio/shared-styles";

export const HEAVY_ASSETS = {
  header: { file: "header.jpg", type: "image/jpeg", width: 4000, height: 3000 },
  portrait: { file: "portrait.jpg", type: "image/jpeg", width: 3000, height: 2000 },
  dragon: { file: "dragon.png", type: "image/png", width: 2160, height: 3840 },
  cutout: { file: "cutout.png", type: "image/png", width: 2048, height: 2048 },
} as const;

export type HeavyAsset = keyof typeof HEAVY_ASSETS;

export const HEAVY_BOARD = { width: 1080, height: 1600 };
const COMPONENT_BOARD = { width: 320, height: 120 };
const BOARD_GAP = 120;
const SERIFS: FontId[] = ["playfair-display", "merriweather", "eb-garamond", "lora", "libre-baskerville", "cormorant-garamond"];
const INK = "#2b1d0e";
const PARCHMENT = "#f4ead5";
const ACCENT = "#8b1e1e";
const GOLD = "#d4a017";
const STAT_NAMES = ["Força", "Destreza", "Constituição", "Inteligência", "Sabedoria", "Carisma", "Iniciativa", "Defesa", "Vida", "Mana", "Sorte", "Fôlego"];
const CHECKS = ["Atletismo", "Acrobacia", "Furtividade", "Arcanismo", "História", "Investigação", "Natureza", "Religião", "Intuição", "Medicina"];
const NOTES = 12;
const PARAGRAPH = "Nascido sob a lua vermelha, o herói carrega a marca do dragão ancestral. Cada cicatriz conta uma batalha vencida nas terras do norte, onde o gelo nunca derrete.";

export const HEAVY_STYLES: StudioStyle[] = [
  { id: "style-ink", kind: "color", name: "Tinta", color: INK },
  { id: "style-accent", kind: "color", name: "Destaque", color: ACCENT },
];

export interface HeavyRoles {
  artboard: string;
  smallLabel: string;
  header: string;
  multi: string[];
  multiAnchor: string;
}

function px(x: number, y: number, w: number, h: number, size = HEAVY_BOARD): Transform {
  return { x: x / size.width, y: y / size.height, w: w / size.width, h: h / size.height, rotation: 0, opacity: 1 };
}

function fontPx(value: number, size = HEAVY_BOARD): number {
  return value / size.height;
}

function text(id: string, value: string, fontId: FontId, sizePx: number, weight: number, transform: Transform, extra: Partial<Layer> = {}): Layer {
  return { id, type: "text", transform, text: value, fontId, fontSize: fontPx(sizePx), fontWeight: weight, align: "left", lineHeight: 1.2, fill: INK, fillStyleId: "style-ink", ...extra };
}

function rect(id: string, transform: Transform, extra: Partial<Layer> = {}): Layer {
  return { id, type: "shape", shape: "rect", transform, fill: PARCHMENT, stroke: INK, strokeWidth: 3, radius: 0.12, ...extra };
}

function image(id: string, assetId: HeavyAsset, transform: Transform, extra: Partial<Layer> = {}): Layer {
  return { id, type: "image", assetId, transform, ...extra };
}

function boardContent(prefix: string, variant: number): { layers: Layer[]; groups: StudioGroup[] } {
  const id = (name: string) => `${prefix}-${name}`;
  const font = (i: number) => SERIFS[(i + variant) % SERIFS.length];
  const white = { fill: "#ffffff", fillStyleId: undefined };
  const layers: Layer[] = [
    rect(id("parchment"), px(540, 800, 1040, 1560), { stroke: ACCENT, strokeWidth: 6, radius: 0.03, shadow: { color: "#00000055", blur: 24, x: 0, y: 8 } }),
    image(id("header"), "header", px(540, 260, 1000, 440), { radius: 0.05, crop: { x: 0.05, y: 0.1, w: 0.9, h: 0.6 } }),
    text(id("title"), variant === 0 ? "CARTA DO HERÓI" : "CARTA DO DRAGÃO", "playfair-display", 56, 800, px(540, 110, 860, 80), { ...white, align: "center", letterSpacing: 0.12, shadow: { color: "#000000aa", blur: 12, x: 0, y: 3 } }),
    text(id("subtitle"), "Nível 12 · Guardião das Cinzas", "cormorant-garamond", 30, 600, px(540, 180, 860, 44), { ...white, align: "center", italic: true }),
    rect(id("portrait-ring"), px(240, 690, 360, 360), { shape: "ellipse", fill: undefined, stroke: ACCENT, strokeWidth: 10, radius: undefined, effects: [{ id: "glow", type: "outer-glow", color: GOLD, opacity: 0.8, x: 0, y: 0, blur: 18, spread: 2 }] }),
    image(id("portrait"), "portrait", px(240, 690, 330, 330), { frame: "ellipse", crop: { x: 0.2, y: 0, w: 0.6, h: 0.9 } }),
    image(id("dragon"), variant === 0 ? "dragon" : "cutout", variant === 0 ? px(800, 760, 420, 746) : px(800, 760, 440, 440), {
      vfx: [{ id: "glow", kind: "glow", seed: 7, params: { amount: 0.5, threshold: 0.55, size: 28 } }],
      filters: { brightness: 0.05, contrast: 0.1, saturation: 0.15, blur: 0 },
      shadow: { color: "#00000080", blur: 30, x: 0, y: 12 },
    }),
    text(id("story"), PARAGRAPH, "eb-garamond", 24, 400, px(250, 960, 440, 130), { runs: [{ start: 0, end: 21, fontWeight: 700, fill: ACCENT }, { start: 60, end: 78, italic: true }] }),
  ];
  for (let i = 0; i < 3; i++) layers.push({ id: id(`divider-${i}`), type: "shape", shape: "line", transform: px(540, [500, 880, 1245][i], 1000, 10), stroke: ACCENT, strokeWidth: 3, dash: i === 1 });
  for (let i = 0; i < NOTES; i++) layers.push(text(id(`note-${i}`), `Inventário ${i + 1}: espada longa, escudo de carvalho, poção de cura`, font(i), 14, 400, px(250, 1048 + i * 16, 440, 16), { italic: i % 2 === 0 }));
  STAT_NAMES.forEach((name, i) => {
    const x = 110 + (i % 3) * 140;
    const y = 1290 + Math.floor(i / 3) * 65;
    layers.push(rect(id(`stat-box-${i}`), px(x, y, 130, 56), { shadow: { color: "#00000040", blur: 10, x: 0, y: 4 }, strokeStyleId: "style-ink", stroke: INK }));
    layers.push(text(id(`stat-name-${i}`), name.toUpperCase(), font(i), 12, 700, px(x, y - 14, 116, 16), { align: "center", letterSpacing: 0.08 }));
    layers.push(text(id(`stat-value-${i}`), `${10 + ((i * 7 + variant * 3) % 11)} (+${i % 5})`, "playfair-display", 22, 800, px(x, y + 10, 116, 28), { align: "center", runs: [{ start: 0, end: 2, fill: ACCENT }] }));
  });
  const groups: StudioGroup[] = [];
  CHECKS.forEach((name, i) => {
    const x = 620 + (i % 2) * 220;
    const y = 1180 + Math.floor(i / 2) * 44;
    const groupId = i % 2 === 1 ? id(`check-row-${i}`) : undefined;
    if (groupId) groups.push({ id: groupId, name });
    const grouped = groupId ? { groupId } : {};
    layers.push(rect(id(`check-box-${i}`), px(x, y, 24, 24), { radius: 0.15, strokeWidth: 2, fill: i % 3 === 0 ? INK : "#ffffff", ...grouped }));
    layers.push(text(id(`check-label-${i}`), `${name} +${(i * 3) % 7}`, font(i + 2), 18, 500, px(x + 105, y, 170, 26), { runs: [{ start: name.length + 1, end: name.length + 3, fontWeight: 800, fill: ACCENT }], ...grouped }));
  });
  layers.push(rect(id("frame-plate"), px(830, 1455, 400, 130), { radius: 0.3, stroke: GOLD, strokeWidth: 5 }));
  layers.push(image(id("framed-photo"), "portrait", px(830, 1455, 420, 280), { clip: true }));
  for (let i = 0; i < 3; i++) layers.push({ id: id(`badge-${i}`), type: "instance", componentId: "component-badge", transform: px(220 + i * 320, 1548, 260, 48), overrides: [{ layerId: "badge-label", text: `Selo ${i + 1}` }] });
  return { layers, groups };
}

function board(id: string, x: number, variant: number): Artboard {
  const { layers, groups } = boardContent(id, variant);
  return { id, name: variant === 0 ? "Frente" : "Verso", x, y: 0, canvas: { width: HEAVY_BOARD.width, height: HEAVY_BOARD.height, background: "#1c1410" }, layers, groups };
}

function component(): Artboard {
  const size = COMPONENT_BOARD;
  return {
    id: "component-badge",
    name: "Selo",
    component: true,
    x: 0,
    y: HEAVY_BOARD.height + BOARD_GAP,
    canvas: { width: size.width, height: size.height, background: "" },
    layers: [
      rect("badge-plate", px(160, 60, 308, 108, size), { fill: ACCENT, fillStyleId: "style-accent", stroke: GOLD, strokeWidth: 4, radius: 0.5 }),
      text("badge-label", "Selo", "playfair-display", 48, 700, px(160, 60, 288, 72, size), { fontSize: fontPx(48, size), align: "center", fill: "#ffffff", fillStyleId: undefined }),
    ],
  };
}

export function heavyDocument(): ImageDocument {
  return { ...imageDocument([board("card-front", 0, 0), board("card-back", HEAVY_BOARD.width + BOARD_GAP, 1), component()]), styles: HEAVY_STYLES };
}

export function heavyRoles(): HeavyRoles {
  const front = "card-front";
  const range = (name: string, count: number) => Array.from({ length: count }, (_, i) => `${front}-${name}-${i}`);
  return {
    artboard: front,
    smallLabel: `${front}-check-label-4`,
    header: `${front}-header`,
    multiAnchor: `${front}-story`,
    multi: [`${front}-title`, `${front}-subtitle`, `${front}-portrait-ring`, `${front}-portrait`, `${front}-dragon`, `${front}-story`, ...range("stat-box", 4), ...range("stat-name", 4)],
  };
}
