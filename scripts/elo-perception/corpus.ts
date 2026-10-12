import type { Artboard, Layer, Transform } from "@/lib/studio/document";
import type { Effect } from "@/lib/studio/layer-paint";

export const DEFECT_KINDS = [
  "shadow_direction",
  "shadow_clipped",
  "shadow_heavy",
  "shadow_invisible",
  "shadow_neutral",
  "misalign",
  "crowded_margin",
  "tangent",
  "hierarchy",
  "hidden_layer",
  "near_parallel",
  "overlap",
  "text_legibility",
] as const;

export type DefectKind = (typeof DEFECT_KINDS)[number];

export const NOTE_KINDS = ["symmetry"] as const;

export type NoteKind = (typeof NOTE_KINDS)[number];

export interface Seeded {
  kind: DefectKind;
  ids: string[];
  related: string[];
  also: DefectKind[];
  note: string;
}

export interface PerceptionCase {
  id: string;
  base: string;
  defect: Seeded | null;
  expects: NoteKind[];
  artboard: Artboard;
}

export const PHOTO = "busy.png";
export const PRODUCT = "product.png";

const W = 1080;
const H = 1350;

function box(x: number, y: number, w: number, h: number, rotation = 0, opacity = 1): Transform {
  return { x, y, w, h, rotation, opacity };
}

function text(id: string, value: string, transform: Transform, size: number, fill: string, extra: Partial<Layer> = {}): Layer {
  return { id, type: "text", transform, text: value, fontId: "inter", fontSize: size, fontWeight: 600, align: "center", lineHeight: 1.15, fill, ...extra };
}

function rect(id: string, transform: Transform, fill: string, extra: Partial<Layer> = {}): Layer {
  return { id, type: "shape", shape: "rect", transform, fill, ...extra };
}

function shape(id: string, kind: "ellipse" | "star", transform: Transform, fill: string, extra: Partial<Layer> = {}): Layer {
  return { id, type: "shape", shape: kind, transform, fill, ...(kind === "star" ? { points: 5, inner: 0.5 } : {}), ...extra };
}

function image(id: string, assetId: string, transform: Transform, extra: Partial<Layer> = {}): Layer {
  return { id, type: "image", assetId, transform, ...extra };
}

function drop(id: string, color: string, opacity: number, x: number, y: number, blur: number): Effect {
  return { id, type: "drop-shadow", color, opacity, x, y, blur, spread: 0 };
}

function board(id: string, background: string, layers: Layer[], gradient?: Artboard["canvas"]["gradient"]): Artboard {
  return { id, x: 0, y: 0, canvas: { width: W, height: H, background, ...(gradient ? { gradient } : {}) }, layers };
}

const CARD_SHADOW = (id: string) => drop(id, "#5a3a1a", 0.22, 0, 14, 30);

function cards(): Artboard {
  return board("cards", "#f4efe6", [
    text("title", "Coleção de Outono", box(0.5, 0.12, 0.84, 0.1), 0.07, "#2b1d12", { align: "left", fontWeight: 800 }),
    text("subtitle", "Peças novas toda semana", box(0.5, 0.2, 0.84, 0.05), 0.035, "#5b4636", { align: "left", fontWeight: 500 }),
    rect("card1", box(0.21, 0.48, 0.26, 0.36), "#ffffff", { radius: 0.12, effects: [CARD_SHADOW("s1")] }),
    rect("card2", box(0.5, 0.48, 0.26, 0.36), "#ffffff", { radius: 0.12, effects: [CARD_SHADOW("s2")] }),
    rect("card3", box(0.79, 0.48, 0.26, 0.36), "#ffffff", { radius: 0.12, effects: [CARD_SHADOW("s3")] }),
    shape("item1", "ellipse", box(0.21, 0.43, 0.17, 0.136), "#e9a273"),
    shape("item2", "ellipse", box(0.5, 0.43, 0.17, 0.136), "#a3b18a"),
    shape("item3", "ellipse", box(0.79, 0.43, 0.17, 0.136), "#8d6e63"),
    text("label1", "Casacos", box(0.21, 0.58, 0.22, 0.05), 0.03, "#2b1d12"),
    text("label2", "Malhas", box(0.5, 0.58, 0.22, 0.05), 0.03, "#2b1d12"),
    text("label3", "Botas", box(0.79, 0.58, 0.22, 0.05), 0.03, "#2b1d12"),
    rect("cta", box(0.26, 0.84, 0.36, 0.07), "#c2410c", { radius: 1, effects: [drop("sc", "#7c2d12", 0.25, 0, 6, 14)] }),
    text("cta_text", "Ver coleção", box(0.26, 0.84, 0.34, 0.05), 0.032, "#ffffff", { fontWeight: 700 }),
    text("footer", "loja.exemplo", box(0.72, 0.84, 0.4, 0.04), 0.03, "#5b4636", { align: "right", fontWeight: 500 }),
  ]);
}

function poster(): Artboard {
  return board("poster", "#0f172a", [
    image("photo", PHOTO, box(0.5, 0.3, 1, 0.6)),
    rect("band", box(0.5, 0.8, 1, 0.4), "#0f172a"),
    text("title", "Noite de Jazz", box(0.5, 0.7, 0.84, 0.1), 0.07, "#ffffff", { fontWeight: 800 }),
    text("subtitle", "Sexta, 21h, Teatro Municipal", box(0.5, 0.78, 0.84, 0.05), 0.032, "#cbd5e1", { fontWeight: 500 }),
    rect("cta", box(0.5, 0.89, 0.44, 0.065), "#facc15", { radius: 1 }),
    text("cta_text", "Garanta seu ingresso", box(0.5, 0.89, 0.42, 0.05), 0.03, "#111827", { fontWeight: 700 }),
  ]);
}

const TILT = -8;
const WARM_SHADOW = (id: string) => drop(id, "#7c2d12", 0.3, 10, 16, 28);

function collage(): Artboard {
  return board("collage", "#c2410c", [
    text("headline", "Liquida Verão", box(0.5, 0.14, 0.84, 0.12), 0.085, "#ffffff", { fontWeight: 900 }),
    rect("card1", box(0.31, 0.43, 0.34, 0.3, TILT), "#fff7ed", { radius: 0.1, effects: [WARM_SHADOW("w1")] }),
    rect("card2", box(0.69, 0.45, 0.34, 0.3, TILT), "#fff7ed", { radius: 0.1, effects: [WARM_SHADOW("w2")] }),
    text("card1_text", "Biquínis", box(0.31, 0.43, 0.28, 0.06, TILT), 0.042, "#7c2d12", { fontWeight: 800 }),
    text("card2_text", "Saídas", box(0.69, 0.45, 0.28, 0.06, TILT), 0.042, "#7c2d12", { fontWeight: 800 }),
    rect("ribbon", box(0.5, 0.74, 1.3, 0.1, TILT), "#111827"),
    text("ribbon_text", "ATÉ 50% OFF", box(0.5, 0.74, 0.8, 0.07, TILT), 0.05, "#ffffff", { fontWeight: 800 }),
    shape("sticker", "star", box(0.85, 0.27, 0.17, 0.136, 12), "#fde047", { effects: [WARM_SHADOW("w3")] }),
    text("footer", "loja.exemplo", box(0.5, 0.93, 0.5, 0.04), 0.03, "#fff7ed", { fontWeight: 600 }),
  ]);
}

function flyer(): Artboard {
  return board("flyer", "#0b1026", [
    shape("halo", "ellipse", box(0.5, 0.33, 0.7, 0.56), "#1e3a8a", { effects: [{ id: "g1", type: "outer-glow", color: "#60a5fa", opacity: 0.6, x: 0, y: 0, blur: 60, spread: 0 }] }),
    text("headline", "SUMMIT 2026", box(0.5, 0.33, 0.84, 0.12), 0.09, "#ffffff", { fontWeight: 900 }),
    text("date", "12 e 13 de novembro", box(0.5, 0.45, 0.84, 0.05), 0.035, "#93c5fd", { fontWeight: 500 }),
    rect("card1", box(0.29, 0.73, 0.36, 0.2), "#172554", { radius: 0.15, stroke: "#1e40af", strokeWidth: 3 }),
    rect("card2", box(0.71, 0.73, 0.36, 0.2), "#172554", { radius: 0.15, stroke: "#1e40af", strokeWidth: 3 }),
    text("name1", "Ana Lima", box(0.29, 0.71, 0.3, 0.05), 0.036, "#ffffff", { fontWeight: 700 }),
    text("role1", "Produto", box(0.29, 0.765, 0.3, 0.04), 0.03, "#93c5fd", { fontWeight: 500 }),
    text("name2", "Rui Costa", box(0.71, 0.71, 0.3, 0.05), 0.036, "#ffffff", { fontWeight: 700 }),
    text("role2", "Engenharia", box(0.71, 0.765, 0.3, 0.04), 0.03, "#93c5fd", { fontWeight: 500 }),
    text("footer", "inscricoes.exemplo", box(0.5, 0.93, 0.6, 0.04), 0.03, "#93c5fd", { fontWeight: 500 }),
  ]);
}

function hero(): Artboard {
  return board(
    "hero",
    "#f1f5f9",
    [
      text("headline", "Fone Aurora", box(0.5, 0.12, 0.84, 0.1), 0.075, "#0f172a", { fontWeight: 800 }),
      text("sub", "Som que acompanha você", box(0.5, 0.2, 0.84, 0.05), 0.035, "#475569", { fontWeight: 500 }),
      shape("contact", "ellipse", box(0.5, 0.7, 0.4, 0.035, 0, 0.25), "#0f172a"),
      image("product", PRODUCT, box(0.5, 0.48, 0.44, 0.36), { effects: [drop("p1", "#0f172a", 0.25, 0, 18, 36)] }),
      shape("badge", "star", box(0.82, 0.27, 0.2, 0.16), "#dc2626", { effects: [drop("b1", "#7f1d1d", 0.3, 0, 8, 16)] }),
      text("badge_text", "-30%", box(0.82, 0.275, 0.11, 0.04), 0.03, "#ffffff", { fontWeight: 800 }),
      rect("cta", box(0.5, 0.85, 0.44, 0.07), "#0f172a", { radius: 1, effects: [drop("c1", "#0f172a", 0.25, 0, 8, 18)] }),
      text("cta_text", "Comprar agora", box(0.5, 0.85, 0.4, 0.05), 0.032, "#ffffff", { fontWeight: 700 }),
    ],
    { from: "#f8fafc", to: "#e2e8f0", angle: 90 },
  );
}

function doors(): Artboard {
  return board("doors", "#efe7da", [
    text("headline", "Portas Abertas", box(0.5, 0.12, 0.84, 0.1), 0.07, "#2b1d12", { align: "left", fontWeight: 800 }),
    rect("door1", box(0.11, 0.52, 0.14, 0.42), "#8d6e63", { radius: 0.08 }),
    rect("door2", box(0.28, 0.52, 0.14, 0.42), "#8d6e63", { radius: 0.08 }),
    rect("door3", box(0.45, 0.52, 0.14, 0.42), "#8d6e63", { radius: 0.08 }),
    rect("door4", box(0.62, 0.52, 0.14, 0.42), "#8d6e63", { radius: 0.08 }),
    text("label", "Entrada", box(0.85, 0.52 + 14 / H, 0.24, 0.05), 0.035, "#2b1d12", { align: "left" }),
    text("caption", "Visite de segunda a sábado", box(0.5, 0.86, 0.84, 0.05), 0.035, "#5b4636", { align: "left", fontWeight: 500 }),
  ]);
}

const BASES: Record<string, () => Artboard> = { cards, poster, collage, flyer, hero, doors };

type Edit = (layers: Layer[]) => Layer[];

function patch(id: string, change: (layer: Layer) => Partial<Layer>): Edit {
  return (layers) => layers.map((layer) => (layer.id === id ? { ...layer, ...change(layer) } : layer));
}

function moveTo(id: string, at: Partial<Transform>): Edit {
  return patch(id, (layer) => ({ transform: { ...layer.transform, ...at } }));
}

function both(...edits: Edit[]): Edit {
  return (layers) => edits.reduce((acc, edit) => edit(acc), layers);
}

function effects(id: string, change: (effect: Effect) => Partial<Effect>): Edit {
  return patch(id, (layer) => ({ effects: (layer.effects ?? []).map((effect) => ({ ...effect, ...change(effect) })) }));
}

function toTop(id: string): Edit {
  return (layers) => [...layers.filter((layer) => layer.id !== id), layers.find((layer) => layer.id === id)!];
}

function without(...ids: string[]): Edit {
  return (layers) => layers.filter((layer) => !ids.includes(layer.id));
}

function add(layer: Layer): Edit {
  return (layers) => [...layers, layer];
}

function sendBelow(id: string, anchor: string): Edit {
  return (layers) => {
    const moving = layers.find((layer) => layer.id === id)!;
    const rest = layers.filter((layer) => layer.id !== id);
    const at = rest.findIndex((layer) => layer.id === anchor);
    return [...rest.slice(0, at), moving, ...rest.slice(at)];
  };
}

interface Seed {
  base: string;
  kind: DefectKind;
  ids: string[];
  related?: string[];
  also?: DefectKind[];
  note: string;
  edit: Edit;
}

const SEEDS: Seed[] = [
  { base: "cards", kind: "shadow_direction", ids: ["card2"], note: "sombra do card do meio virada para cima", edit: effects("card2", (e) => ({ y: -e.y })) },
  { base: "collage", kind: "shadow_direction", ids: ["card2"], note: "sombra do segundo card para cima e para a esquerda", edit: effects("card2", (e) => ({ x: -e.x, y: -e.y })) },
  { base: "hero", kind: "shadow_direction", ids: ["badge"], note: "sombra do selo para cima", edit: effects("badge", (e) => ({ y: -e.y })) },
  { base: "cards", kind: "shadow_direction", ids: ["card3"], note: "sombra do terceiro card para o lado", edit: effects("card3", () => ({ x: 24, y: 2 })) },
  { base: "hero", kind: "shadow_direction", ids: ["cta"], note: "sombra do botão para a esquerda", edit: effects("cta", () => ({ x: -14, y: 3 })) },
  { base: "hero", kind: "shadow_clipped", ids: ["cta"], related: ["cta_text"], also: ["crowded_margin"], note: "botão colado na base com a sombra cortada pela borda", edit: both(moveTo("cta", { y: 0.961 }), moveTo("cta_text", { y: 0.961 })) },
  { base: "collage", kind: "shadow_clipped", ids: ["card2"], related: ["card2_text"], also: ["crowded_margin"], note: "card encostado na borda direita com a sombra cortada", edit: both(moveTo("card2", { x: 0.8 }), moveTo("card2_text", { x: 0.8 })) },
  { base: "hero", kind: "shadow_direction", ids: ["badge"], note: "selo girado 60 graus: a sombra gira junto e sai para o lado", edit: moveTo("badge", { rotation: 60 }) },
  { base: "cards", kind: "shadow_heavy", ids: ["card1"], note: "sombra preta opaca e dura no primeiro card", edit: effects("card1", () => ({ color: "#000000", opacity: 1, y: 26, blur: 4 })) },
  { base: "collage", kind: "shadow_heavy", ids: ["sticker"], also: ["shadow_neutral"], note: "sombra preta pesada no selo", edit: effects("sticker", () => ({ color: "#000000", opacity: 0.9, x: 20, y: 32, blur: 44 })) },
  { base: "hero", kind: "shadow_heavy", ids: ["product"], note: "sombra preta pesada no produto", edit: effects("product", () => ({ color: "#000000", opacity: 0.85, y: 40, blur: 20 })) },
  { base: "flyer", kind: "shadow_invisible", ids: ["card1"], note: "sombra preta sobre o fundo azul escuro, invisível", edit: patch("card1", () => ({ effects: [drop("d1", "#000000", 0.5, 0, 14, 30)] })) },
  { base: "poster", kind: "shadow_invisible", ids: ["cta"], note: "sombra escura do botão sobre a faixa escura", edit: patch("cta", () => ({ effects: [drop("d2", "#020617", 0.45, 0, 10, 24)] })) },
  { base: "collage", kind: "shadow_neutral", ids: ["card1"], note: "sombra cinza neutra sobre o laranja queimado saturado", edit: effects("card1", () => ({ color: "#000000", opacity: 0.32 })) },
  { base: "cards", kind: "misalign", ids: ["subtitle"], related: ["title"], note: "subtítulo 1,5% à direita da margem do título", edit: moveTo("subtitle", { x: 0.515 }) },
  { base: "flyer", kind: "misalign", ids: ["date"], related: ["headline"], note: "data 1,2% fora do centro do título", edit: moveTo("date", { x: 0.512 }) },
  { base: "hero", kind: "misalign", ids: ["cta", "cta_text"], related: ["headline", "sub"], note: "botão 1,8% fora do eixo central", edit: both(moveTo("cta", { x: 0.518 }), moveTo("cta_text", { x: 0.518 })) },
  { base: "cards", kind: "crowded_margin", ids: ["footer"], note: "rodapé colado na borda direita", edit: moveTo("footer", { x: 0.79 }) },
  { base: "hero", kind: "crowded_margin", ids: ["headline"], note: "título colado no topo", edit: moveTo("headline", { y: 0.052 }) },
  { base: "cards", kind: "tangent", ids: ["cta", "cta_text"], related: ["card1"], note: "botão quase encostando no card de cima", edit: both(moveTo("cta", { y: 0.698 }), moveTo("cta_text", { y: 0.698 })) },
  { base: "hero", kind: "tangent", ids: ["cta", "cta_text"], related: ["product"], note: "botão quase encostando no produto", edit: both(moveTo("cta", { y: 0.699 }), moveTo("cta_text", { y: 0.699 }), patch("contact", () => ({ hidden: true }))) },
  { base: "cards", kind: "hierarchy", ids: ["subtitle"], related: ["title"], note: "subtítulo quase do tamanho do título", edit: patch("subtitle", (l) => ({ text: "Peças novas", fontSize: 0.066, transform: { ...l.transform, y: 0.215, h: 0.08 } })) },
  { base: "flyer", kind: "hierarchy", ids: ["date"], related: ["headline"], note: "data maior que o título", edit: patch("date", (l) => ({ text: "12 e 13 nov", fontSize: 0.1, fontWeight: 800, transform: { ...l.transform, y: 0.48, h: 0.12 } })) },
  { base: "poster", kind: "hierarchy", ids: ["subtitle"], related: ["title"], note: "subtítulo quase do tamanho do título", edit: patch("subtitle", (l) => ({ text: "Sexta, 21h", fontSize: 0.064, transform: { ...l.transform, y: 0.79, h: 0.08 } })) },
  { base: "cards", kind: "hidden_layer", ids: ["label2"], related: ["card2"], note: "rótulo do card do meio atrás do card", edit: sendBelow("label2", "card2") },
  { base: "cards", kind: "hidden_layer", ids: ["item3"], related: ["card3"], note: "ilustração do terceiro card atrás do card", edit: sendBelow("item3", "card3") },
  { base: "poster", kind: "hidden_layer", ids: ["title"], related: ["band"], note: "título atrás da faixa", edit: sendBelow("title", "band") },
  { base: "collage", kind: "near_parallel", ids: ["card2"], related: ["card1", "ribbon"], note: "segundo card 2,5 graus fora do ângulo dos outros", edit: both(moveTo("card2", { rotation: -10.5 }), moveTo("card2_text", { rotation: -10.5 })) },
  { base: "collage", kind: "near_parallel", ids: ["ribbon_text"], related: ["ribbon"], note: "texto da faixa 1,6 grau fora da faixa", edit: moveTo("ribbon_text", { rotation: -9.6 }) },
  { base: "cards", kind: "overlap", ids: ["card2"], related: ["card1"], note: "card do meio invadindo o primeiro", edit: both(moveTo("card2", { x: 0.4 }), moveTo("item2", { x: 0.4 }), moveTo("label2", { x: 0.4 })) },
  { base: "poster", kind: "overlap", ids: ["subtitle"], related: ["title"], note: "subtítulo sobre o título", edit: moveTo("subtitle", { y: 0.725 }) },
  { base: "hero", kind: "overlap", ids: ["cta_text"], related: ["cta"], note: "texto do botão saindo do botão", edit: moveTo("cta_text", { x: 0.66 }) },
  { base: "hero", kind: "overlap", ids: ["rule"], related: ["sub"], also: ["text_legibility"], note: "linha de largura total cortando o subtítulo", edit: add({ id: "rule", type: "shape", shape: "line", transform: box(0.5, 0.2, 1, 0.01), stroke: "#0f172a", strokeWidth: 4 }) },
  { base: "doors", kind: "misalign", ids: ["caption"], related: ["headline"], note: "legenda 1,5% à direita da margem do título, com as portas entre as duas", edit: moveTo("caption", { x: 0.515 }) },
  { base: "poster", kind: "text_legibility", ids: ["title"], related: ["photo"], note: "título sobre a foto agitada sem apoio", edit: moveTo("title", { y: 0.42 }) },
  { base: "hero", kind: "text_legibility", ids: ["sub"], related: ["product"], note: "subtítulo sobre o produto", edit: both(patch("sub", (l) => ({ fill: "#94a3b8", transform: { ...l.transform, y: 0.5, w: 0.38, h: 0.1 } })), toTop("sub")) },
];

interface NoteSeed {
  base: string;
  kind: NoteKind;
  edit: Edit;
}

const NOTES: NoteSeed[] = [{ base: "hero", kind: "symmetry", edit: without("badge", "badge_text") }];

function cloned(artboard: Artboard): Artboard {
  return JSON.parse(JSON.stringify(artboard));
}

export function perceptionCorpus(): PerceptionCase[] {
  const clean = Object.entries(BASES).map(([base, make]): PerceptionCase => ({ id: `${base}-clean`, base, defect: null, expects: [], artboard: make() }));
  const counts = new Map<string, number>();
  const seeded = SEEDS.map((seed): PerceptionCase => {
    const artboard = cloned(BASES[seed.base]());
    const key = `${seed.base}-${seed.kind}`;
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    return { id: n > 1 ? `${key}-${n}` : key, base: seed.base, defect: { kind: seed.kind, ids: seed.ids, related: seed.related ?? [], also: seed.also ?? [], note: seed.note }, expects: [], artboard: { ...artboard, layers: seed.edit(artboard.layers) } };
  });
  const noted = NOTES.map((seed): PerceptionCase => {
    const artboard = cloned(BASES[seed.base]());
    return { id: `${seed.base}-${seed.kind}`, base: seed.base, defect: null, expects: [seed.kind], artboard: { ...artboard, layers: seed.edit(artboard.layers) } };
  });
  return [...clean, ...seeded, ...noted];
}
