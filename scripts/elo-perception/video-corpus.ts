import { emptyVideoDocument, type Clip, type Layer, type Transform, type VideoDocument } from "@/lib/studio/document";
import type { Keyframe } from "@/lib/studio/keyframes";
import type { Effect } from "@/lib/studio/layer-paint";

export const VIDEO_DEFECT_KINDS = ["motion_jump", "leaves_frame", "flash", "moving_overlap", "linear_motion", "shadow_direction", "reading_time"] as const;

export type VideoDefectKind = (typeof VIDEO_DEFECT_KINDS)[number];

export const VIDEO_NOTE_KINDS = ["motion_variety"] as const;

export type VideoNoteKind = (typeof VIDEO_NOTE_KINDS)[number];

export interface VideoCase {
  id: string;
  defect: { kind: VideoDefectKind; ids: string[]; note: string } | null;
  expects: VideoNoteKind[];
  doc: VideoDocument;
}

const FULL: Transform = { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 };

function box(x: number, y: number, w: number, h: number): Transform {
  return { x, y, w, h, rotation: 0, opacity: 1 };
}

function key(atMs: number, value: number, easing: Keyframe["easing"] = "easeOut"): Keyframe {
  return { atMs, value, easing };
}

function overlay(id: string, layer: Omit<Layer, "id" | "transform">, startMs: number, durationMs: number, transform: Transform, extra: Partial<Clip> = {}): Clip {
  return { id, type: "overlay", startMs, durationMs, trimInMs: 0, volume: 1, fadeInMs: 0, fadeOutMs: 0, transform, layer: { ...layer, id: `${id}-layer`, transform: FULL }, ...extra };
}

function text(id: string, value: string, startMs: number, durationMs: number, transform: Transform, size: number, extra: Partial<Clip> = {}): Clip {
  return overlay(id, { type: "text", text: value, fontId: "inter", fontSize: size, fontWeight: 800, align: "center", lineHeight: 1.1, fill: "#ffffff" }, startMs, durationMs, transform, extra);
}

const SHADOW = (y: number): Effect[] => [{ id: "d", type: "drop-shadow", color: "#020617", opacity: 0.45, x: 0, y, blur: 14, spread: 0 }];

function promo(): Clip[] {
  return [
    overlay("panel", { type: "shape", shape: "rect", fill: "#c2410c", radius: 0.1 }, 0, 6000, box(0.5, 0.48, 0.86, 0.26)),
    text("title", "Liquida de verão", 0, 6000, box(0.5, 0.25, 0.86, 0.08), 0.045, { keyframes: { x: [key(0, 0.3), key(700, 0.5)], opacity: [key(0, 0, "linear"), key(300, 1, "linear")] }, effects: SHADOW(10) }),
    text("offer", "Até 50% em tudo", 1000, 5000, box(0.5, 0.45, 0.6, 0.06), 0.035, { keyframes: { y: [key(0, 0.5), key(600, 0.45)] }, effects: SHADOW(10) }),
    text("cta", "Compre no site", 2500, 3500, box(0.5, 0.54, 0.6, 0.05), 0.032, { keyframes: { opacity: [key(0, 0, "linear"), key(400, 1, "linear")] }, effects: SHADOW(10) }),
  ];
}

function launch(): Clip[] {
  return [
    overlay("ring", { type: "shape", shape: "ellipse", fill: "#1d4ed8" }, 0, 5000, box(0.5, 0.38, 0.7, 0.36), { keyframes: { scale: [key(0, 0.8), key(900, 1)] } }),
    text("name", "Fone Aurora", 0, 5000, box(0.5, 0.38, 0.8, 0.07), 0.05, { keyframes: { y: [key(0, 0.43), key(800, 0.38)] } }),
    text("price", "R$ 399", 1500, 3500, box(0.5, 0.56, 0.5, 0.06), 0.04, { keyframes: { opacity: [key(0, 0, "linear"), key(300, 1, "linear")] } }),
  ];
}

function film(clips: Clip[], background: string, durationMs: number): VideoDocument {
  const doc = emptyVideoDocument("story", background);
  doc.tracks = [{ id: "v1", kind: "visual", clips }, ...doc.tracks.slice(1)];
  doc.durationMs = durationMs;
  return doc;
}

type Edit = (clips: Clip[]) => Clip[];

function patch(id: string, change: (clip: Clip) => Partial<Clip>): Edit {
  return (clips) => clips.map((clip) => (clip.id === id ? { ...clip, ...change(clip) } : clip));
}

const BASES: Record<string, () => VideoDocument> = { promo: () => film(promo(), "#0f172a", 6000), launch: () => film(launch(), "#020617", 5000) };

const SEEDS: { base: string; kind: VideoDefectKind; ids: string[]; note: string; edit: Edit }[] = [
  { base: "promo", kind: "motion_jump", ids: ["offer"], note: "a oferta pula de um lado ao outro em um quadro", edit: patch("offer", () => ({ keyframes: { y: [key(0, 0.5), key(600, 0.45)], x: [key(2000, 0.35, "linear"), key(2033, 0.65, "hold")] } })) },
  { base: "launch", kind: "leaves_frame", ids: ["name"], note: "o nome sai pela direita no meio e volta", edit: patch("name", () => ({ keyframes: { y: [key(0, 0.43), key(800, 0.38)], x: [key(1200, 0.5, "easeInOut"), key(2000, 0.9, "easeInOut"), key(2800, 0.5, "easeInOut")] } })) },
  { base: "promo", kind: "flash", ids: ["strobe"], note: "um quadro branco pisca 5 vezes por segundo", edit: (clips) => [...clips, overlay("strobe", { type: "shape", shape: "rect", fill: "#ffffff" }, 3000, 1500, FULL, { keyframes: { opacity: Array.from({ length: 15 }, (_, i) => key(i * 100, i % 2, "hold")) } })] },
  { base: "launch", kind: "moving_overlap", ids: ["name", "price"], note: "o preço sobe e cruza o nome durante a animação", edit: patch("price", () => ({ startMs: 0, durationMs: 5000, keyframes: { y: [key(0, 0.56, "easeInOut"), key(1500, 0.38, "easeInOut"), key(3000, 0.2, "easeInOut")] } })) },
  { base: "promo", kind: "linear_motion", ids: ["title"], note: "o título entra com easing linear por um caminho longo", edit: patch("title", () => ({ keyframes: { x: [key(0, 0.05, "linear"), key(900, 0.5, "linear")], opacity: [key(0, 0, "linear"), key(300, 1, "linear")] } })) },
  { base: "promo", kind: "shadow_direction", ids: ["cta"], note: "a sombra do chamado sobe enquanto as outras descem", edit: patch("cta", () => ({ effects: SHADOW(-10) })) },
  { base: "launch", kind: "reading_time", ids: ["price"], note: "o preço com frase longa fica só meio segundo", edit: patch("price", (clip) => ({ durationMs: 500, layer: { ...clip.layer!, text: "R$ 399 à vista ou em dez vezes sem juros no cartão" } })) },
];

const POP: Partial<Clip> = { keyframes: { scale: [key(0, 0.6), key(500, 1)], opacity: [key(0, 0), key(300, 1)] } };

const NOTES: { base: string; kind: VideoNoteKind; edit: Edit }[] = [{ base: "promo", kind: "motion_variety", edit: (clips) => ["title", "offer", "cta"].reduce((next, id) => patch(id, () => POP)(next), clips) }];

function edited(base: string, edit: Edit): VideoDocument {
  const doc = BASES[base]();
  return { ...doc, tracks: [{ ...doc.tracks[0], clips: edit(doc.tracks[0].clips) }, ...doc.tracks.slice(1)] };
}

export function videoCorpus(): VideoCase[] {
  const clean = Object.entries(BASES).map(([base, make]): VideoCase => ({ id: `video-${base}-clean`, defect: null, expects: [], doc: make() }));
  const seeded = SEEDS.map((seed): VideoCase => ({ id: `video-${seed.base}-${seed.kind}`, defect: { kind: seed.kind, ids: seed.ids, note: seed.note }, expects: [], doc: edited(seed.base, seed.edit) }));
  const noted = NOTES.map((seed): VideoCase => ({ id: `video-${seed.base}-${seed.kind}`, defect: null, expects: [seed.kind], doc: edited(seed.base, seed.edit) }));
  return [...clean, ...seeded, ...noted];
}
