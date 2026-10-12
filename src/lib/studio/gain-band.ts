import { dbToGain, gainAt, MAX_GAIN_DB, SILENCE_DB } from "./audio-gain";
import { STUDIO_LIMITS, type Clip } from "./document";
import { framesOf, propertyValue, setPropertyKey } from "./keyframe-edit";
import { removeKeyframe, setKeyframe, withLane, type Keyframe, type Keyframes } from "./keyframes";
import type { ClipPatch } from "./timeline";

const BAND_TOP = dbToGain(MAX_GAIN_DB);
const TAPER = 4;
export const BAND_KEY_HIT_PX = 6;

type BandClip = Pick<Clip, "startMs" | "durationMs" | "fadeInMs" | "fadeOutMs" | "volume" | "keyframes" | "transform" | "blur" | "layer" | "type">;

export function bandY(gain: number, heightPx: number): number {
  const position = Math.min(1, Math.max(0, gain / BAND_TOP) ** (1 / TAPER));
  return heightPx * (1 - position);
}

export function bandGain(y: number, heightPx: number): number {
  if (heightPx <= 0) return 0;
  const position = 1 - Math.min(1, Math.max(0, y / heightPx));
  return BAND_TOP * position ** TAPER;
}

function clampDb(db: number): number {
  return Math.min(MAX_GAIN_DB, Math.max(SILENCE_DB, db));
}

function lane(clip: Pick<Clip, "keyframes">): readonly Keyframe[] {
  return framesOf(clip, "gainDb");
}

export function addGainKey(clip: BandClip, localMs: number): ClipPatch {
  return { keyframes: setPropertyKey(clip, "gainDb", localMs, propertyValue(clip, "gainDb", localMs)) };
}

export function dragGainKey(clip: BandClip, atMs: number, toMs: number, valueDb: number): Keyframes | undefined {
  const frames = lane(clip);
  const index = frames.findIndex((frame) => frame.atMs === atMs);
  if (index < 0) return clip.keyframes;
  const low = index > 0 ? frames[index - 1].atMs + 1 : 0;
  const high = index < frames.length - 1 ? frames[index + 1].atMs - 1 : clip.durationMs;
  const time = Math.round(Math.min(high, Math.max(low, toMs)));
  return setKeyframe(removeKeyframe(clip.keyframes, "gainDb", atMs), "gainDb", time, clampDb(valueDb), frames[index].easing);
}

export function segmentKeys(clip: Pick<Clip, "keyframes">, localMs: number): number[] {
  const frames = lane(clip);
  if (frames.length === 0) return [];
  if (localMs <= frames[0].atMs) return [frames[0].atMs];
  if (localMs >= frames[frames.length - 1].atMs) return [frames[frames.length - 1].atMs];
  const next = frames.findIndex((frame) => frame.atMs > localMs);
  return [frames[next - 1].atMs, frames[next].atMs];
}

export function dragGainLine(clip: BandClip, localMs: number, deltaDb: number): ClipPatch {
  const moving = new Set(segmentKeys(clip, localMs));
  if (moving.size === 0) return { volume: Math.round(Math.min(STUDIO_LIMITS.maxVolume, Math.max(0, clip.volume * dbToGain(deltaDb))) * 1000) / 1000 };
  return { keyframes: withLane(clip.keyframes, "gainDb", lane(clip).map((frame) => (moving.has(frame.atMs) ? { ...frame, value: clampDb(frame.value + deltaDb) } : frame))) };
}

export function removeGainKey(clip: Pick<Clip, "keyframes">, atMs: number): ClipPatch {
  return { keyframes: removeKeyframe(clip.keyframes, "gainDb", atMs) };
}

export function nudgeGainKey(clip: Pick<Clip, "keyframes">, atMs: number, deltaDb: number): ClipPatch {
  return { keyframes: withLane(clip.keyframes, "gainDb", lane(clip).map((frame) => (frame.atMs === atMs ? { ...frame, value: clampDb(frame.value + deltaDb) } : frame))) };
}

export function bandKeyAt(clip: BandClip, trackGainDb: number, x: number, y: number, widthPx: number, heightPx: number): number | null {
  let best: number | null = null;
  let distance = Infinity;
  for (const frame of lane(clip)) {
    const dx = (frame.atMs / clip.durationMs) * widthPx - x;
    const dy = bandY(gainAt(clip, frame.atMs, { trackGainDb }), heightPx) - y;
    const d = Math.hypot(dx, dy);
    if (Math.abs(dx) <= BAND_KEY_HIT_PX && Math.abs(dy) <= BAND_KEY_HIT_PX * 1.5 && d < distance) {
      distance = d;
      best = frame.atMs;
    }
  }
  return best;
}
