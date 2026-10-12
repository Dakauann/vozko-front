import { voiceEdges } from "./audio-crossfade";
import { dbToGain, gainAt, gainToDb, type GainContext } from "./audio-gain";
import { gatedLoudness, kWeighted, LOUDNESS_BLOCK_MS, LOUDNESS_HOP_MS } from "./audio-meter";
import { clipPanAt, panGains } from "./audio-pan";
import { sourceAt } from "./clip-time";
import { STUDIO_LIMITS, type Clip, type Track, type VideoDocument } from "./document";
import { TRACK_GAIN_RANGE, type SpeechSource } from "./ducking";
import { gainContext } from "./playback";
import { findClip, updateClip, updateTrack } from "./timeline";

export const LOUDNESS_STEP_MS = 10;
export const LOUDNESS_TARGETS = { social: -14, podcast: -16, broadcast: -23 } as const;
export type LoudnessTarget = keyof typeof LOUDNESS_TARGETS;
export const LOUDNESS_TARGET_RANGE = [-40, -5] as const;

const BLOCK_STEPS = LOUDNESS_BLOCK_MS / LOUDNESS_STEP_MS;
const HOP_STEPS = LOUDNESS_HOP_MS / LOUDNESS_STEP_MS;

export interface LoudnessProfile {
  durationMs: number;
  channels: Float32Array[];
}

export type LoudnessSource = (assetId: string) => LoudnessProfile | undefined;

export type NormalizeRefusal = "missing" | "locked" | "notAudio" | "target" | "unmeasured" | "silent";

export type NormalizeResult = { ok: true; document: VideoDocument; measured: number; gainDb: number; limited: boolean } | { ok: false; reason: NormalizeRefusal };

type Measure = { ok: true; lufs: number | null } | { ok: false };

export function loudnessProfile(channels: readonly Float32Array[], sampleRate: number): LoudnessProfile {
  const step = Math.max(1, Math.round((sampleRate * LOUDNESS_STEP_MS) / 1000));
  const length = channels[0]?.length ?? 0;
  const steps = Math.ceil(length / step);
  return {
    durationMs: (length / sampleRate) * 1000,
    channels: channels.map((channel) => {
      const weighted = kWeighted(channel, sampleRate);
      const energies = new Float32Array(steps);
      for (let k = 0; k < steps; k++) {
        const end = Math.min(weighted.length, (k + 1) * step);
        let sum = 0;
        for (let i = k * step; i < end; i++) sum += weighted[i] * weighted[i];
        energies[k] = sum / step;
      }
      return energies;
    }),
  };
}

function sourceEnergy(energies: Float32Array, fromMs: number, toMs: number): number {
  const first = Math.floor(fromMs / LOUDNESS_STEP_MS);
  if (toMs <= fromMs) return energies[first] ?? 0;
  let sum = 0;
  for (let k = first; k * LOUDNESS_STEP_MS < toMs; k++) {
    const overlap = Math.min(toMs, (k + 1) * LOUDNESS_STEP_MS) - Math.max(fromMs, k * LOUDNESS_STEP_MS);
    sum += (energies[k] ?? 0) * overlap;
  }
  return sum / (toMs - fromMs);
}

type Timed = Pick<Clip, "type" | "durationMs" | "trimInMs" | "speed" | "reverse" | "freeze">;

function heardEnergy(profile: LoudnessProfile, clip: Timed, fromLocalMs: number, toLocalMs: number, gains: { left: number; right: number }): number {
  const a = sourceAt(clip, fromLocalMs);
  const b = sourceAt(clip, toLocalMs);
  const [first, second] = profile.channels.map((energies) => sourceEnergy(energies, Math.min(a, b), Math.max(a, b)));
  if (second === undefined) return (gains.left * gains.left + gains.right * gains.right) * first;
  return gains.left * gains.left * first + gains.right * gains.right * second;
}

function gated(powers: readonly number[]): number | null {
  const blocks: number[] = [];
  for (let from = 0; from + BLOCK_STEPS <= powers.length; from += HOP_STEPS) {
    let sum = 0;
    for (let k = from; k < from + BLOCK_STEPS; k++) sum += powers[k];
    blocks.push(sum / BLOCK_STEPS);
  }
  return gatedLoudness(blocks);
}

export function clipLoudness(profile: LoudnessProfile, clip: Timed): number | null {
  const powers = Array.from({ length: Math.floor(clip.durationMs / LOUDNESS_STEP_MS) }, (_, k) => heardEnergy(profile, clip, k * LOUDNESS_STEP_MS, (k + 1) * LOUDNESS_STEP_MS, { left: 1, right: 1 }));
  return gated(powers);
}

function measuredClips(track: Track): (Clip & { assetId: string })[] {
  return track.clips.filter((clip): clip is Clip & { assetId: string } => Boolean(clip.assetId) && !clip.disabled && clip.volume > 0);
}

function speechKnown(doc: VideoDocument, track: Track, speech: SpeechSource | undefined): boolean {
  const triggers = track.ducking?.triggerTrackIds ?? [];
  return doc.tracks.filter((other) => triggers.includes(other.id)).every((other) => other.clips.every((clip) => !clip.assetId || speech?.(clip.assetId) !== undefined));
}

export function trackPowers(doc: VideoDocument, track: Track, profiles: LoudnessSource, base: GainContext): number[] | null {
  const clips = measuredClips(track);
  if (clips.some((clip) => !profiles(clip.assetId))) return null;
  const sourceMs = (assetId: string) => profiles(assetId)?.durationMs;
  const powers = new Array<number>(Math.floor(doc.durationMs / LOUDNESS_STEP_MS)).fill(0);
  for (const clip of clips) {
    const profile = profiles(clip.assetId)!;
    const edges = voiceEdges(track, clip, sourceMs);
    const context = { ...base, fadeIn: edges.fadeIn, fadeOut: edges.fadeOut };
    const from = Math.max(0, Math.floor((clip.startMs - edges.headMs) / LOUDNESS_STEP_MS));
    const to = Math.min(powers.length, Math.ceil((clip.startMs + clip.durationMs + edges.tailMs) / LOUDNESS_STEP_MS));
    for (let k = from; k < to; k++) {
      const local = k * LOUDNESS_STEP_MS - clip.startMs;
      const level = gainAt(clip, local + LOUDNESS_STEP_MS / 2, context);
      const gains = panGains(clipPanAt(clip, Math.min(clip.durationMs, Math.max(0, local))), track.pan ?? 0, profile.channels.length);
      powers[k] += level * level * heardEnergy(profile, clip, local, local + LOUDNESS_STEP_MS, gains);
    }
  }
  return powers;
}

function measureTrack(doc: VideoDocument, track: Track, profiles: LoudnessSource, speech: SpeechSource | undefined): Measure {
  if (!speechKnown(doc, track, speech)) return { ok: false };
  const powers = trackPowers(doc, track, profiles, { ...gainContext(doc, track, { speech }), trackGainDb: 0 });
  return powers ? { ok: true, lufs: gated(powers) } : { ok: false };
}

export function trackLoudness(doc: VideoDocument, trackId: string, profiles: LoudnessSource, speech?: SpeechSource): number | null {
  const track = doc.tracks.find((candidate) => candidate.id === trackId);
  const measure = track ? measureTrack(doc, track, profiles, speech) : { ok: false as const };
  return measure.ok ? measure.lufs : null;
}

function targetValid(targetLufs: number): boolean {
  return Number.isFinite(targetLufs) && targetLufs >= LOUDNESS_TARGET_RANGE[0] && targetLufs <= LOUDNESS_TARGET_RANGE[1];
}

const round = (value: number, step: number) => Math.round(value / step) * step;

export function normalizeClip(doc: VideoDocument, clipId: string, targetLufs: number, profiles: LoudnessSource): NormalizeResult {
  const found = findClip(doc, clipId);
  if (!found) return { ok: false, reason: "missing" };
  if (found.track.locked) return { ok: false, reason: "locked" };
  if (found.clip.type !== "audio" || !found.clip.assetId) return { ok: false, reason: "notAudio" };
  if (!targetValid(targetLufs)) return { ok: false, reason: "target" };
  const profile = profiles(found.clip.assetId);
  if (!profile) return { ok: false, reason: "unmeasured" };
  const measured = clipLoudness(profile, found.clip);
  if (measured === null) return { ok: false, reason: "silent" };
  const wanted = dbToGain(targetLufs - measured);
  const volume = round(Math.min(STUDIO_LIMITS.maxVolume, wanted), 0.001);
  return { ok: true, document: updateClip(doc, clipId, { volume }), measured, gainDb: gainToDb(volume), limited: wanted > STUDIO_LIMITS.maxVolume };
}

export function normalizeTrack(doc: VideoDocument, trackId: string, targetLufs: number, profiles: LoudnessSource, speech?: SpeechSource): NormalizeResult {
  const track = doc.tracks.find((candidate) => candidate.id === trackId);
  if (!track) return { ok: false, reason: "missing" };
  if (track.locked) return { ok: false, reason: "locked" };
  if (track.kind !== "audio") return { ok: false, reason: "notAudio" };
  if (!targetValid(targetLufs)) return { ok: false, reason: "target" };
  const measure = measureTrack(doc, track, profiles, speech);
  if (!measure.ok) return { ok: false, reason: "unmeasured" };
  if (measure.lufs === null) return { ok: false, reason: "silent" };
  const wanted = targetLufs - measure.lufs;
  const gainDb = round(Math.min(TRACK_GAIN_RANGE[1], Math.max(TRACK_GAIN_RANGE[0], wanted)), 0.1);
  return { ok: true, document: updateTrack(doc, trackId, { gainDb: gainDb === 0 ? undefined : gainDb }), measured: measure.lufs, gainDb, limited: wanted > TRACK_GAIN_RANGE[1] };
}

export type NormalizeTarget = { clipIds: readonly string[] } | { trackId: string };

export interface NormalizedPart {
  id: string;
  measured: number;
  gainDb: number;
  limited: boolean;
}

export type NormalizeOutcome = { ok: true; document: VideoDocument; parts: NormalizedPart[] } | { ok: false; reason: NormalizeRefusal; id?: string };

export function loudnessAssetIds(doc: VideoDocument, target: NormalizeTarget): string[] {
  if ("trackId" in target) {
    const track = doc.tracks.find((candidate) => candidate.id === target.trackId);
    return [...new Set(track ? measuredClips(track).map((clip) => clip.assetId) : [])];
  }
  return [...new Set(target.clipIds.flatMap((id) => findClip(doc, id)?.clip.assetId ?? []))];
}

export function normalizeLoudness(doc: VideoDocument, target: NormalizeTarget, targetLufs: number, profiles: LoudnessSource, speech?: SpeechSource): NormalizeOutcome {
  if ("trackId" in target) {
    const result = normalizeTrack(doc, target.trackId, targetLufs, profiles, speech);
    if (!result.ok) return { ok: false, reason: result.reason, id: target.trackId };
    return { ok: true, document: result.document, parts: [{ id: target.trackId, measured: result.measured, gainDb: result.gainDb, limited: result.limited }] };
  }
  if (target.clipIds.length === 0) return { ok: false, reason: "missing" };
  let document = doc;
  const parts: NormalizedPart[] = [];
  for (const id of target.clipIds) {
    const result = normalizeClip(document, id, targetLufs, profiles);
    if (!result.ok) return { ok: false, reason: result.reason, id };
    document = result.document;
    parts.push({ id, measured: result.measured, gainDb: result.gainDb, limited: result.limited });
  }
  return { ok: true, document, parts };
}
