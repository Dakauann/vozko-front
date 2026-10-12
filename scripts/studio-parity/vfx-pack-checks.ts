import { emptyVideoDocument, fullFrame, newMediaClip, newShapeLayer, videoCanvasSize, type Clip, type VideoDocument } from "@/lib/studio/document";
import { overlayClip } from "@/lib/studio/media-clips";
import { listensToTrack, newEffectClip, newVfx, refusedOnEffectClips, type Vfx, type VfxColor, type VfxKind, type VfxParam } from "@/lib/studio/vfx";

type Report = Record<string, number | string | boolean | null>;

export interface VfxPackTools {
  rendererFrames: (doc: VideoDocument, width: number, height: number, times?: readonly number[]) => Promise<Uint8Array[]>;
  exportedPsnr: (doc: VideoDocument) => Promise<Record<string, unknown>>;
}

const FILM_MS = 400;
const PROBE_MS = [200];
const MIN_PSNR_DB = 35;
const MIN_CHANGE = 32;
const SEED = 77;
const MOVER_ID = "mover";
const SOUND_TRACK = "sound";

export const PACK_SETTINGS: Partial<Record<VfxKind, Partial<Record<VfxParam, number>>>> = {
  glow: { amount: 1, threshold: 0.3, size: 20 },
  mosaic: { size: 30 },
  posterize: { levels: 3 },
  mirror: { x: 0.4, angle: 30 },
  offset: { shiftX: 0.3, shiftY: 0.2 },
  directionalBlur: { length: 40, angle: 30 },
  zoomBlur: { length: 0.3 },
  spinBlur: { angle: 30 },
  waveWarp: { height: 14, length: 90, speed: 2 },
  ripple: { height: 10, length: 40, size: 1, speed: 1 },
  twirl: { angle: 240, size: 0.6 },
  bulge: { height: 0.9, size: 0.5 },
  cornerPin: { topLeftX: 0.1, topLeftY: 0.05, topRightX: 0.95, topRightY: 0.15, bottomRightX: 0.85, bottomRightY: 0.9, bottomLeftX: 0.05, bottomLeftY: 0.95 },
  fractalNoise: { amount: 0.8, size: 60, speed: 2 },
  gradientRamp: { amount: 0.7, radial: 0.4 },
  fourColorGradient: { amount: 0.7 },
  audioSpectrum: { size: 0.6, gap: 0.2, gain: 12 },
  audioWaveform: { size: 0.6, window: 300 },
  posterizeTime: { rate: 4 },
  echo: { count: 4, delay: 50, decay: 0.8 },
};

export const PACK_KINDS = Object.keys(PACK_SETTINGS) as VfxKind[];

const PACK_COLORS: Partial<Record<VfxKind, Partial<Record<VfxColor, string>>>> = {
  fourColorGradient: { color: "#806868", color2: "#688068", color3: "#686880", color4: "#808068" },
  audioSpectrum: { color: "#ffffff", color2: "#c0c0c0" },
  audioWaveform: { color: "#ffffff", color2: "#c0c0c0" },
};

const TILES = [
  { fill: "#303030", x: 0.25, y: 0.25 },
  { fill: "#707070", x: 0.75, y: 0.25 },
  { fill: "#b0b0b0", x: 0.25, y: 0.75 },
  { fill: "#e0e0e0", x: 0.75, y: 0.75 },
] as const;

function backdropTile(tile: (typeof TILES)[number], index: number): Clip {
  const transform = { x: tile.x, y: tile.y, w: 0.5, h: 0.5, rotation: 0, opacity: 1 };
  return { ...overlayClip({ ...newShapeLayer("rect"), id: `l-tile-${index}`, fill: tile.fill }, 0, transform), id: `tile-${index}`, startMs: 0, durationMs: FILM_MS };
}

function mover(vfx: Vfx[]): Clip {
  const layer = { ...newShapeLayer("ellipse"), id: "l-mover", fill: "#d0d0d0" };
  const clip = { ...overlayClip(layer, 0, { x: 0.3, y: 0.5, w: 0.25, h: 0.25, rotation: 0, opacity: 1 }), id: MOVER_ID, startMs: 0, durationMs: FILM_MS };
  return {
    ...clip,
    keyframes: { x: [{ atMs: 0, value: 0.2, easing: "linear" }, { atMs: FILM_MS, value: 0.8, easing: "linear" }] },
    ...(vfx.length > 0 ? { vfx } : {}),
  };
}

function film(kind: VfxKind | null): VideoDocument {
  const vfx = kind ? [{ ...newVfx(kind, `pack-${kind}`, SEED), params: PACK_SETTINGS[kind], ...(PACK_COLORS[kind] ? { colors: PACK_COLORS[kind] } : {}), ...(listensToTrack(kind) ? { trackId: SOUND_TRACK } : {}) }] : [];
  const onMover = kind !== null && refusedOnEffectClips(kind);
  const doc = emptyVideoDocument("square");
  doc.canvas.background = "#181818";
  doc.tracks = [
    ...TILES.map((tile, i) => ({ id: `tile-${i}`, kind: "visual" as const, clips: [backdropTile(tile, i)] })),
    { id: "moving", kind: "visual", clips: [mover(onMover ? vfx : [])] },
    ...(kind && !onMover ? [{ id: "fx", kind: "visual" as const, clips: [{ ...newEffectClip(vfx, 0, FILM_MS), id: "effect" }] }] : []),
    ...(kind && listensToTrack(kind) ? [{ id: SOUND_TRACK, kind: "audio" as const, clips: [{ ...newMediaClip("audio", "low.m4a", 0, FILM_MS), id: "tone", transform: fullFrame() }] }] : []),
  ];
  doc.durationMs = FILM_MS;
  return doc;
}

function largestChange(a: Uint8Array, b: Uint8Array): number {
  let most = 0;
  for (let i = 0; i < a.length; i++) most = Math.max(most, Math.abs(a[i] - b[i]));
  return most;
}

function same(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

export async function vfxPackParity(tools: VfxPackTools): Promise<Report> {
  const { width, height } = videoCanvasSize(film(null));
  const [plain] = await tools.rendererFrames(film(null), width, height, PROBE_MS);
  const rows: string[] = [];
  let worst = Infinity;
  let changed = true;
  let repeatOk = true;
  let exported = true;
  for (const kind of PACK_KINDS) {
    const doc = film(kind);
    const [first] = await tools.rendererFrames(doc, width, height, PROBE_MS);
    const [again] = await tools.rendererFrames(doc, width, height, PROBE_MS);
    const change = largestChange(first, plain);
    const result = await tools.exportedPsnr(doc);
    const db = Number(result.psnrMin ?? 0);
    const complete = result.status === "done" && result.frames === result.expectedFrames && Number(result.frames) > 0;
    worst = Math.min(worst, db);
    changed &&= change > MIN_CHANGE;
    repeatOk &&= same(first, again);
    exported &&= complete;
    rows.push(`${kind} ${db.toFixed(1)}dB change ${change}${complete ? "" : ` export ${String(result.status)}`}`);
  }
  return { results: rows.join("; "), worstDb: Number(worst.toFixed(2)), changed, repeatOk, exported, vfxPackOk: exported && worst >= MIN_PSNR_DB && changed && repeatOk };
}
