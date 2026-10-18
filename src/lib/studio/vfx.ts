import { editFieldValue, fieldKeyState, fieldValue, lanesIssue, setFieldKey, setFieldLane, shiftLanes, toggleFieldKey, type AnimatedFields, type Lanes } from "./animated-fields";
import { parseColor } from "./color";
import { fullFrame, newStudioId, STUDIO_LIMITS, type Clip, type Transform } from "./document";
import type { KeyState } from "./keyframe-edit";
import type { Keyframe } from "./keyframes";
import { isValidToken } from "./tokens";
import type { IssueCode } from "./validate";

export const VFX_KINDS = [
  "grain",
  "lightLeak",
  "glitch",
  "particles",
  "lensFlare",
  "shake",
  "vignette",
  "chromaticAberration",
  "glow",
  "mosaic",
  "posterize",
  "mirror",
  "offset",
  "directionalBlur",
  "zoomBlur",
  "spinBlur",
  "waveWarp",
  "ripple",
  "twirl",
  "bulge",
  "cornerPin",
  "fractalNoise",
  "gradientRamp",
  "fourColorGradient",
  "audioSpectrum",
  "audioWaveform",
  "posterizeTime",
  "echo",
] as const;

export type VfxKind = (typeof VFX_KINDS)[number];

export const VFX_PARAMS = [
  "amount",
  "size",
  "speed",
  "rate",
  "chroma",
  "x",
  "y",
  "frequency",
  "split",
  "scanlines",
  "count",
  "angle",
  "softness",
  "twinkle",
  "ghosts",
  "streak",
  "flicker",
  "rotation",
  "roundness",
  "radial",
  "threshold",
  "levels",
  "shiftX",
  "shiftY",
  "length",
  "height",
  "phase",
  "topLeftX",
  "topLeftY",
  "topRightX",
  "topRightY",
  "bottomRightX",
  "bottomRightY",
  "bottomLeftX",
  "bottomLeftY",
  "complexity",
  "contrast",
  "brightness",
  "toX",
  "toY",
  "width",
  "gap",
  "gain",
  "window",
  "delay",
  "decay",
] as const;

export type VfxParam = (typeof VFX_PARAMS)[number];

export const VFX_COLORS = ["color", "color2", "color3", "color4"] as const;

export type VfxColor = (typeof VFX_COLORS)[number];

const VFX_GROUPS = ["light", "stylize", "blur", "distort", "generate", "time", "sound"] as const;

type VfxGroup = (typeof VFX_GROUPS)[number];

interface ParamSpec {
  range: readonly [number, number];
  fallback: number;
  keyed: boolean;
}

interface VfxKindSpec {
  group: VfxGroup;
  params: Partial<Record<VfxParam, ParamSpec>>;
  colors: Partial<Record<VfxColor, string>>;
}

function param(low: number, high: number, fallback: number): ParamSpec {
  return { range: [low, high], fallback, keyed: true };
}

function pace(low: number, high: number, fallback: number): ParamSpec {
  return { range: [low, high], fallback, keyed: false };
}

const POINT = [-0.5, 1.5] as const;

function point(fallback: number): ParamSpec {
  return param(POINT[0], POINT[1], fallback);
}

const SOUND_LAYOUT = { amount: param(0, 1, 1), x: point(0.5), y: point(0.85), width: param(0.05, 1, 0.8), size: param(0, 1, 0.3), gap: param(0, 0.9, 0.3), roundness: param(0, 1, 1), gain: param(-24, 24, 0) };

export const VFX_SPECS: Record<VfxKind, VfxKindSpec> = {
  grain: { group: "stylize", params: { amount: param(0, 1, 0.35), size: param(0.5, 8, 1.5), rate: pace(1, 60, 24), chroma: param(0, 1, 0) }, colors: {} },
  lightLeak: { group: "light", params: { amount: param(0, 1, 0.7), size: param(0.2, 2, 0.9), speed: pace(0, 4, 1), x: param(-0.5, 1.5, 0.15), y: param(-0.5, 1.5, 0.2) }, colors: { color: "#ff7a2f", color2: "#ff2f6d" } },
  glitch: { group: "stylize", params: { amount: param(0, 1, 0.5), frequency: pace(0, 30, 3), split: param(0, 100, 12), size: param(0.005, 0.5, 0.06), scanlines: param(0, 1, 0.2) }, colors: {} },
  particles: {
    group: "light",
    params: { amount: param(0, 1, 0.85), count: pace(1, 1000, 80), size: param(0.5, 80, 6), speed: pace(0, 4, 1), angle: pace(-180, 180, 90), softness: param(0, 1, 0.5), twinkle: param(0, 1, 0.3) },
    colors: { color: "#ffffff" },
  },
  lensFlare: { group: "light", params: { amount: param(0, 1, 0.8), x: param(-0.5, 1.5, 0.25), y: param(-0.5, 1.5, 0.25), size: param(0.2, 3, 1), ghosts: param(0, 1, 0.6), streak: param(0, 1, 0.4), flicker: param(0, 1, 0.15) }, colors: { color: "#ffd29a" } },
  shake: { group: "time", params: { amount: param(0, 1, 0.3), frequency: pace(0.2, 30, 6), rotation: param(0, 15, 1) }, colors: {} },
  vignette: { group: "stylize", params: { amount: param(0, 1, 0.5), size: param(0, 1, 0.5), softness: param(0.01, 1, 0.5), roundness: param(0, 1, 1) }, colors: { color: "#000000" } },
  chromaticAberration: { group: "stylize", params: { amount: param(0, 1, 0.4), radial: param(0, 1, 1), angle: param(-180, 180, 0) }, colors: {} },
  glow: { group: "light", params: { amount: param(0, 1, 0.6), threshold: param(0, 1, 0.6), size: param(1, 200, 24) }, colors: { color: "#ffffff" } },
  mosaic: { group: "stylize", params: { amount: param(0, 1, 1), size: param(2, 200, 24) }, colors: {} },
  posterize: { group: "stylize", params: { amount: param(0, 1, 1), levels: param(2, 32, 5) }, colors: {} },
  mirror: { group: "stylize", params: { amount: param(0, 1, 1), x: param(0, 1, 0.5), y: param(0, 1, 0.5), angle: param(-180, 180, 0) }, colors: {} },
  offset: { group: "stylize", params: { amount: param(0, 1, 1), shiftX: param(-1, 1, 0.25), shiftY: param(-1, 1, 0) }, colors: {} },
  directionalBlur: { group: "blur", params: { amount: param(0, 1, 1), length: param(0, 400, 30), angle: param(-180, 180, 0) }, colors: {} },
  zoomBlur: { group: "blur", params: { amount: param(0, 1, 1), length: param(0, 1, 0.2), x: point(0.5), y: point(0.5) }, colors: {} },
  spinBlur: { group: "blur", params: { amount: param(0, 1, 1), angle: param(0, 180, 12), x: point(0.5), y: point(0.5) }, colors: {} },
  waveWarp: { group: "distort", params: { amount: param(0, 1, 1), height: param(0, 200, 12), length: param(4, 2000, 160), angle: param(-180, 180, 0), speed: pace(-10, 10, 1), phase: param(0, 360, 0) }, colors: {} },
  ripple: { group: "distort", params: { amount: param(0, 1, 1), x: point(0.5), y: point(0.5), height: param(0, 200, 10), length: param(4, 2000, 80), size: param(0, 2, 0.8), speed: pace(-10, 10, 1), phase: param(0, 360, 0) }, colors: {} },
  twirl: { group: "distort", params: { amount: param(0, 1, 1), angle: param(-1080, 1080, 180), size: param(0, 2, 0.5), x: point(0.5), y: point(0.5) }, colors: {} },
  bulge: { group: "distort", params: { amount: param(0, 1, 1), height: param(-1, 1, 0.5), size: param(0, 2, 0.4), x: point(0.5), y: point(0.5) }, colors: {} },
  cornerPin: {
    group: "distort",
    params: { amount: param(0, 1, 1), topLeftX: point(0), topLeftY: point(0), topRightX: point(1), topRightY: point(0), bottomRightX: point(1), bottomRightY: point(1), bottomLeftX: point(0), bottomLeftY: point(1) },
    colors: {},
  },
  fractalNoise: {
    group: "generate",
    params: { amount: param(0, 1, 1), size: param(4, 2000, 160), complexity: param(1, 8, 4), contrast: param(0, 4, 1), brightness: param(-1, 1, 0), speed: pace(0, 4, 0.5) },
    colors: { color: "#000000", color2: "#ffffff" },
  },
  gradientRamp: { group: "generate", params: { amount: param(0, 1, 1), x: point(0.5), y: point(0), toX: point(0.5), toY: point(1), radial: param(0, 1, 0) }, colors: { color: "#000000", color2: "#ffffff" } },
  fourColorGradient: {
    group: "generate",
    params: { amount: param(0, 1, 1), topLeftX: point(0.15), topLeftY: point(0.15), topRightX: point(0.85), topRightY: point(0.15), bottomRightX: point(0.85), bottomRightY: point(0.85), bottomLeftX: point(0.15), bottomLeftY: point(0.85), softness: param(0.01, 1, 0.5) },
    colors: { color: "#ff4d6d", color2: "#ffb347", color3: "#4dd2ff", color4: "#7a5cff" },
  },
  audioSpectrum: { group: "sound", params: { ...SOUND_LAYOUT, count: pace(4, 128, 32) }, colors: { color: "#ffffff", color2: "#7ad7ff" } },
  audioWaveform: { group: "sound", params: { ...SOUND_LAYOUT, y: point(0.5), count: pace(8, 512, 64), window: pace(250, 10_000, 3000) }, colors: { color: "#ffffff", color2: "#7ad7ff" } },
  posterizeTime: { group: "time", params: { rate: pace(1, 30, 8) }, colors: {} },
  echo: { group: "time", params: { amount: param(0, 1, 1), count: pace(1, 32, 6), delay: pace(10, 1000, 80), decay: param(0, 1, 0.6) }, colors: {} },
};

function kindsInGroup<K extends VfxKind>(kinds: readonly K[], group: VfxGroup): K[] {
  return kinds.filter((kind) => VFX_SPECS[kind].group === group);
}

export function groupedKinds<K extends VfxKind>(kinds: readonly K[]): { group: VfxGroup; kinds: K[] }[] {
  return VFX_GROUPS.map((group) => ({ group, kinds: kindsInGroup(kinds, group) })).filter((entry) => entry.kinds.length > 0);
}

export function listensToTrack(kind: VfxKind): boolean {
  return VFX_SPECS[kind].group === "sound";
}

const PLAN_KINDS = ["posterizeTime", "echo"] as const satisfies readonly VfxKind[];

export type PlanVfxKind = (typeof PLAN_KINDS)[number];

export type DrawnVfxKind = Exclude<VfxKind, PlanVfxKind>;

export function actsOnPlan(kind: VfxKind): kind is PlanVfxKind {
  return (PLAN_KINDS as readonly string[]).includes(kind);
}

export function refusedOnEffectClips(kind: VfxKind): boolean {
  return kind === "echo";
}

export const VFX_SEED_RANGE = [0, 999_999] as const;

export interface Vfx {
  id: string;
  kind: VfxKind;
  seed: number;
  hidden?: boolean;
  offsetMs?: number;
  params?: Partial<Record<VfxParam, number>>;
  colors?: Partial<Record<VfxColor, string>>;
  keyframes?: Lanes<VfxParam>;
  trackId?: string;
}

export interface VfxLook {
  id: string;
  kind: VfxKind;
  seed: number;
  timeMs: number;
  values: Readonly<Partial<Record<VfxParam, number>>>;
  colors: Readonly<Partial<Record<VfxColor, string>>>;
  bars?: readonly number[];
}

export function isVfxKind(value: string): value is VfxKind {
  return (VFX_KINDS as readonly string[]).includes(value);
}

export function vfxParams(kind: VfxKind): VfxParam[] {
  return VFX_PARAMS.filter((name) => VFX_SPECS[kind].params[name] !== undefined);
}

export function vfxColors(kind: VfxKind): VfxColor[] {
  return VFX_COLORS.filter((name) => VFX_SPECS[kind].colors[name] !== undefined);
}

export function paramSpec(kind: VfxKind, name: VfxParam): ParamSpec | null {
  return VFX_SPECS[kind].params[name] ?? null;
}

export function keyedParams(kind: VfxKind): VfxParam[] {
  return vfxParams(kind).filter((name) => VFX_SPECS[kind].params[name]!.keyed);
}

export function isKeyedParam(kind: VfxKind, name: VfxParam): boolean {
  return paramSpec(kind, name)?.keyed ?? false;
}

export function newVfx<K extends VfxKind>(kind: K, id: string, seed: number): Vfx & { kind: K } {
  return { id, kind, seed };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * (VFX_SEED_RANGE[1] + 1));
}

export function freshVfx(kind: VfxKind, trackId?: string): Vfx {
  const vfx = newVfx(kind, newStudioId("vfx"), randomSeed());
  return listensToTrack(kind) && trackId ? { ...vfx, trackId } : vfx;
}

const SEEDED_KINDS: ReadonlySet<VfxKind> = new Set(["grain", "lightLeak", "glitch", "particles", "lensFlare", "shake", "fractalNoise"]);

export function usesSeed(kind: VfxKind): boolean {
  return SEEDED_KINDS.has(kind);
}

export const DEFAULT_EFFECT_MS = 2000;

export function newEffectClip(vfx: Vfx[], startMs: number, durationMs: number): Clip {
  return {
    id: newStudioId("c"),
    type: "effect",
    startMs: Math.round(startMs),
    durationMs: Math.round(durationMs),
    trimInMs: 0,
    volume: 1,
    fadeInMs: 0,
    fadeOutMs: 0,
    transform: fullFrame(),
    vfx,
  };
}

const VFX_FIELDS: AnimatedFields<Vfx, VfxParam> = {
  staticValue: (vfx, name) => vfx.params?.[name] ?? paramSpec(vfx.kind, name)?.fallback ?? 0,
  withStatic: (vfx, name, value) => ({ ...vfx, params: { ...vfx.params, [name]: value } }),
  range: (name, vfx) => paramSpec(vfx.kind, name)?.range ?? [0, 0],
};

export function vfxValue(vfx: Vfx, name: VfxParam, localMs: number): number {
  return fieldValue(VFX_FIELDS, vfx, name, localMs);
}

export function vfxColor(vfx: Vfx, name: VfxColor): string {
  return vfx.colors?.[name] ?? VFX_SPECS[vfx.kind].colors[name] ?? "#000000";
}

export function setVfxKey(vfx: Vfx, name: VfxParam, atMs: number, value: number): Vfx {
  return setFieldKey(VFX_FIELDS, vfx, name, atMs, value);
}

export function setVfxLane(vfx: Vfx, name: VfxParam, frames: readonly Keyframe[]): Vfx {
  return setFieldLane(VFX_FIELDS, vfx, name, frames);
}

export function toggleVfxKey(vfx: Vfx, name: VfxParam, atMs: number): Vfx {
  return toggleFieldKey(VFX_FIELDS, vfx, name, atMs);
}

export function vfxKeyState(vfx: Vfx, name: VfxParam, localMs: number | null): KeyState {
  return fieldKeyState(vfx, name, localMs);
}

export function editVfxValue(vfx: Vfx, name: VfxParam, value: number, localMs: number | null): Vfx | null {
  return editFieldValue(VFX_FIELDS, vfx, name, value, localMs);
}

export function vfxLook(vfx: Vfx, localMs: number): VfxLook {
  return {
    id: vfx.id,
    kind: vfx.kind,
    seed: vfx.seed,
    timeMs: localMs + (vfx.offsetMs ?? 0),
    values: Object.fromEntries(vfxParams(vfx.kind).map((name) => [name, vfxValue(vfx, name, localMs)])),
    colors: Object.fromEntries(vfxColors(vfx.kind).map((name) => [name, vfxColor(vfx, name)])),
  };
}

export function vfxLooks(list: readonly Vfx[], localMs: number): VfxLook[] {
  return list.filter((vfx) => !vfx.hidden).map((vfx) => vfxLook(vfx, localMs));
}

export function splitVfx(list: readonly Vfx[], atLocalMs: number): Vfx[] {
  return list.map((vfx) => {
    const keyframes = shiftLanes(vfx.keyframes, -atLocalMs);
    return { ...vfx, offsetMs: (vfx.offsetMs ?? 0) + atLocalMs, ...(keyframes ? { keyframes } : {}) };
  });
}

export function lookValue(look: VfxLook, name: VfxParam): number {
  return look.values[name] ?? paramSpec(look.kind, name)?.fallback ?? 0;
}

export function unitRgb(hex: string | undefined): [number, number, number] {
  const color = parseColor(hex ?? "#000000");
  return color ? [color.r / 255, color.g / 255, color.b / 255] : [0, 0, 0];
}

function isZero(value: unknown): boolean {
  return value === undefined || value === "" || value === false || value === 0 || (Array.isArray(value) && value.length === 0);
}

export function carriesOnly(clip: Clip, fields: ReadonlySet<string>): boolean {
  return Object.entries(clip).every(([key, value]) => fields.has(key) || isZero(value));
}

const COLOR = /^#[0-9a-fA-F]{6}$/;

function within(value: number, [low, high]: readonly [number, number]): boolean {
  return Number.isFinite(value) && value >= low && value <= high;
}

function oneVfxIssue(vfx: Vfx): IssueCode | null {
  if (!isVfxKind(vfx.kind)) return "unknown";
  if (!Number.isInteger(vfx.seed) || !within(vfx.seed, VFX_SEED_RANGE)) return "out_of_range";
  if (vfx.offsetMs !== undefined && (!Number.isInteger(vfx.offsetMs) || !within(vfx.offsetMs, [0, STUDIO_LIMITS.maxVideoMs]))) return "out_of_range";
  for (const [name, value] of Object.entries(vfx.params ?? {})) {
    if (value === undefined) continue;
    const spec = paramSpec(vfx.kind, name as VfxParam);
    if (!spec) return "invalid";
    if (!within(value, spec.range)) return "out_of_range";
  }
  for (const [name, value] of Object.entries(vfx.colors ?? {})) {
    if (value === undefined) continue;
    if (VFX_SPECS[vfx.kind].colors[name as VfxColor] === undefined || !COLOR.test(value)) return "invalid";
  }
  if (listensToTrack(vfx.kind) ? !isValidToken(vfx.trackId ?? "") : vfx.trackId !== undefined && vfx.trackId !== "") return "invalid";
  return lanesIssue(vfx.keyframes ?? {}, (name) => (isKeyedParam(vfx.kind, name as VfxParam) ? paramSpec(vfx.kind, name as VfxParam)!.range : null));
}

export function vfxIssue(list: readonly Vfx[]): IssueCode | null {
  const ids = new Set<string>();
  for (const vfx of list) {
    if (!isValidToken(vfx.id) || ids.has(vfx.id)) return "invalid";
    ids.add(vfx.id);
    const issue = oneVfxIssue(vfx);
    if (issue) return issue;
  }
  return null;
}

function mix32(h: number, value: number): number {
  let next = Math.imul(h ^ (value >>> 0), 0x85ebca6b);
  next ^= next >>> 13;
  next = Math.imul(next, 0xc2b2ae35);
  return next ^ (next >>> 16);
}

export function hash32(a: number, b: number, c: number): number {
  return mix32(mix32(mix32(0x9e3779b9, a), b), c) >>> 0;
}

export function hash01(a: number, b: number, c: number): number {
  return (hash32(a, b, c) >>> 8) / 16_777_216;
}

export function hash4(a: number, b: number, c: number, d: number): number {
  return ((mix32(mix32(mix32(mix32(0x9e3779b9, a), b), c), d) >>> 0) >>> 8) / 16_777_216;
}

export function noise1(seed: number, channel: number, t: number): number {
  const i = Math.floor(t);
  const f = t - i;
  const a = hash01(seed, channel, i) * 2 - 1;
  const b = hash01(seed, channel, i + 1) * 2 - 1;
  return a + (b - a) * f * f * (3 - 2 * f);
}

function seconds(look: VfxLook): number {
  return look.timeMs / 1000;
}

export function grainFrame(look: VfxLook): number {
  return Math.floor((look.timeMs * lookValue(look, "rate")) / 1000 + 1e-9);
}

export const GLITCH_SLOTS_PER_SECOND = 12;

interface GlitchBurst {
  slot: number;
  strength: number;
}

export function glitchBurst(look: VfxLook): GlitchBurst {
  const slot = Math.floor((look.timeMs * GLITCH_SLOTS_PER_SECOND) / 1000 + 1e-9);
  const chance = Math.min(1, lookValue(look, "frequency") / GLITCH_SLOTS_PER_SECOND);
  const fires = chance > 0 && hash01(look.seed, 1, slot) < chance;
  return { slot, strength: fires ? 0.35 + 0.65 * hash01(look.seed, 2, slot) : 0 };
}

const SHAKE_REACH = 0.06;

export const CHROMATIC_REACH = 40;

interface ShakeOffset {
  dx: number;
  dy: number;
  rotation: number;
}

export function layeredNoise(seed: number, channel: number, t: number): number {
  return noise1(seed, channel, t) * 0.7 + noise1(seed, channel + 16, t * 2.3) * 0.3;
}

export function shakeAt(look: VfxLook, width: number, height: number): ShakeOffset {
  const t = seconds(look) * lookValue(look, "frequency");
  const reach = lookValue(look, "amount") * SHAKE_REACH * Math.min(width, height);
  const turn = lookValue(look, "rotation");
  return {
    dx: reach === 0 ? 0 : reach * layeredNoise(look.seed, 3, t),
    dy: reach === 0 ? 0 : reach * layeredNoise(look.seed, 4, t),
    rotation: turn === 0 ? 0 : turn * layeredNoise(look.seed, 5, t),
  };
}

export function shakenTransform(transform: Transform, looks: readonly VfxLook[], width: number, height: number): Transform {
  return looks.reduce((current, look) => {
    if (look.kind !== "shake") return current;
    const offset = shakeAt(look, width, height);
    return { ...current, x: current.x + offset.dx / width, y: current.y + offset.dy / height, rotation: current.rotation + offset.rotation };
  }, transform);
}

export interface DrawnLook extends VfxLook {
  kind: DrawnVfxKind;
}

export function isDrawnLook(look: VfxLook): look is DrawnLook {
  return !actsOnPlan(look.kind);
}

export function drawnLooks(looks: readonly VfxLook[], adjusts: boolean): DrawnLook[] {
  return looks.filter(isDrawnLook).filter((look) => adjusts || look.kind !== "shake");
}

export function shakeCover(look: VfxLook, width: number, height: number): number {
  const reach = lookValue(look, "amount") * SHAKE_REACH * Math.min(width, height);
  const turn = (lookValue(look, "rotation") * Math.PI) / 180;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const across = (cos * width + sin * height + 2 * reach) / width;
  const down = (sin * width + cos * height + 2 * reach) / height;
  return Math.max(1, across, down);
}

interface LeakBlob {
  x: number;
  y: number;
  radius: number;
  tone: number;
  weight: number;
}

export const LEAK_BLOBS = 3;

export function leakBlobs(look: VfxLook, width: number, height: number): LeakBlob[] {
  const t = seconds(look) * lookValue(look, "speed");
  const diagonal = Math.hypot(width, height);
  const originX = lookValue(look, "x") * width;
  const originY = lookValue(look, "y") * height;
  return Array.from({ length: LEAK_BLOBS }, (_, i) => ({
    x: originX + noise1(look.seed, 10 + i, t * 0.15 + i * 3.1) * 0.35 * width,
    y: originY + noise1(look.seed, 20 + i, t * 0.15 + i * 5.7) * 0.35 * height,
    radius: lookValue(look, "size") * diagonal * (0.22 + 0.18 * hash01(look.seed, 30 + i, 0)),
    tone: hash01(look.seed, 50 + i, 0),
    weight: 0.6 + 0.4 * (0.5 + 0.5 * noise1(look.seed, 40 + i, t * 0.4 + i)),
  }));
}

interface FlareGhost {
  along: number;
  radius: number;
  strength: number;
  tint: number;
}

export const FLARE_GHOSTS = 5;

export function flareGhosts(look: VfxLook): FlareGhost[] {
  return Array.from({ length: FLARE_GHOSTS }, (_, i) => ({
    along: -0.6 + 2.2 * hash01(look.seed, 70 + i, 0),
    radius: 0.015 + 0.07 * hash01(look.seed, 80 + i, 0),
    strength: 0.25 + 0.75 * hash01(look.seed, 90 + i, 0),
    tint: hash01(look.seed, 100 + i, 0),
  }));
}

export function flareFlicker(look: VfxLook): number {
  const flicker = lookValue(look, "flicker");
  if (flicker === 0) return 1;
  return 1 - flicker * (0.5 + 0.5 * noise1(look.seed, 60, seconds(look) * 9));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function vignetteWeight(look: VfxLook, u: number, v: number, width: number, height: number): number {
  const roundness = lookValue(look, "roundness");
  const short = Math.min(width, height);
  const qx = (u - 0.5) * 2 * (1 + roundness * (width / short - 1));
  const qy = (v - 0.5) * 2 * (1 + roundness * (height / short - 1));
  const distance = Math.hypot(qx, qy) / Math.SQRT2;
  const size = lookValue(look, "size");
  return smoothstep(size, size + lookValue(look, "softness"), distance);
}
