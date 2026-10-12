import { SPECTRUM_BANDS } from "./audio-spectrum";
import { levelDbAt, type TrackLevel, type TrackLevels } from "./behaviors";
import { listensToTrack, lookValue, type Vfx, type VfxLook } from "./vfx";

export const SOUND_BAR_SLOTS = 512;
export const SPECTRUM_RANGE_DB = [-60, -6] as const;
export const WAVEFORM_RANGE_DB = [-50, -6] as const;

export function barCount(look: VfxLook): number {
  return Math.round(lookValue(look, "count"));
}

export function soundBars(look: VfxLook): number[] {
  const count = barCount(look);
  return Array.from({ length: count }, (_, i) => look.bars?.[i] ?? 0);
}

function share(db: number, gain: number, [floor, ceiling]: readonly [number, number]): number {
  return Math.min(1, Math.max(0, (db + gain - floor) / (ceiling - floor)));
}

export function spectrumBars(look: VfxLook, level: TrackLevel, timelineMs: number): number[] | undefined {
  const bands = level.bands;
  if (!bands || bands.length !== SPECTRUM_BANDS) return undefined;
  const count = barCount(look);
  const gain = lookValue(look, "gain");
  const db = bands.map((series) => levelDbAt({ stepMs: level.stepMs, db: series }, timelineMs));
  return Array.from({ length: count }, (_, i) => {
    const from = Math.min(SPECTRUM_BANDS - 1, Math.floor((i * SPECTRUM_BANDS) / count));
    const to = Math.max(from + 1, Math.floor(((i + 1) * SPECTRUM_BANDS) / count));
    return share(Math.max(...db.slice(from, to)), gain, SPECTRUM_RANGE_DB);
  });
}

export function waveformBars(look: VfxLook, level: TrackLevel, timelineMs: number): number[] {
  const count = barCount(look);
  const span = lookValue(look, "window");
  const gain = lookValue(look, "gain");
  return Array.from({ length: count }, (_, i) => share(levelDbAt(level, timelineMs - span + ((i + 0.5) * span) / count), gain, WAVEFORM_RANGE_DB));
}

function heardBars(look: VfxLook, level: TrackLevel | undefined, timelineMs: number): number[] | undefined {
  if (!level) return undefined;
  return look.kind === "audioSpectrum" ? spectrumBars(look, level, timelineMs) : waveformBars(look, level, timelineMs);
}

export function withSound(looks: readonly VfxLook[], list: readonly Vfx[], timelineMs: number, levels: TrackLevels): VfxLook[] {
  return looks.map((look) => {
    if (!listensToTrack(look.kind)) return look;
    const trackId = list.find((vfx) => vfx.id === look.id)?.trackId;
    const bars = trackId ? heardBars(look, levels(trackId), timelineMs) : undefined;
    return bars ? { ...look, bars } : look;
  });
}

export function spectrumTrackIds(list: readonly Vfx[]): string[] {
  return list.flatMap((vfx) => (vfx.kind === "audioSpectrum" && vfx.trackId ? [vfx.trackId] : []));
}
