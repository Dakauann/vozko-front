import { loudnessOfPower } from "./audio-meter";
import { bandProfile, SPECTRUM_BANDS, type SpectrumSource } from "./audio-spectrum";
import { reactTrackIds, type TrackLevel, type TrackLevels } from "./behaviors";
import type { VideoDocument } from "./document";
import { groupTimeline, isGroupClip } from "./group-scope";
import { LOUDNESS_STEP_MS, loudnessAssetIds, trackPowers, type LoudnessSource } from "./loudness";
import { spectrumTrackIds } from "./vfx-sound";
import { vfxTrackIds } from "./vfx-tracks";

const SILENT_POWER = 1e-12;

export interface HeardTrack {
  timeline: VideoDocument;
  trackId: string;
  spectrum: boolean;
}

function timelines(doc: VideoDocument): VideoDocument[] {
  return [doc, ...doc.tracks.flatMap((track) => track.clips.flatMap((clip) => (isGroupClip(clip) ? timelines(groupTimeline(doc, clip)) : [])))];
}

export function heardTracks(doc: VideoDocument): HeardTrack[] {
  return timelines(doc).flatMap((timeline) => {
    const spectra = new Set(timeline.tracks.flatMap((track) => track.clips.flatMap((clip) => spectrumTrackIds(clip.vfx ?? []))));
    const ids = new Set([...reactTrackIds(timeline), ...vfxTrackIds(timeline.tracks)]);
    return [...ids].map((trackId) => ({ timeline, trackId, spectrum: spectra.has(trackId) }));
  });
}

export function trackBands(doc: VideoDocument, trackId: string, spectra: SpectrumSource): Float32Array[] | null {
  const track = doc.tracks.find((candidate) => candidate.id === trackId && candidate.kind === "audio");
  if (!track) return null;
  const bands: Float32Array[] = [];
  for (let band = 0; band < SPECTRUM_BANDS; band++) {
    const powers = trackPowers(doc, track, (assetId) => {
      const spectrum = spectra(assetId);
      return spectrum ? bandProfile(spectrum, band) : undefined;
    }, { trackGainDb: 0 });
    if (!powers) return null;
    bands.push(Float32Array.from(powers, (power) => 10 * Math.log10(Math.max(power, SILENT_POWER))));
  }
  return bands;
}

export const REACT_WINDOW_MS = 100;

const WINDOW_STEPS = REACT_WINDOW_MS / LOUDNESS_STEP_MS;

export function trackLevel(doc: VideoDocument, trackId: string, profiles: LoudnessSource): TrackLevel | null {
  const track = doc.tracks.find((candidate) => candidate.id === trackId && candidate.kind === "audio");
  if (!track) return null;
  const powers = trackPowers(doc, track, profiles, { trackGainDb: 0 });
  if (!powers) return null;
  const sums = new Float64Array(powers.length + 1);
  powers.forEach((power, index) => {
    sums[index + 1] = sums[index] + power;
  });
  const half = WINDOW_STEPS / 2;
  const db = new Float32Array(powers.length + 1);
  for (let k = 0; k <= powers.length; k++) {
    const from = Math.max(0, k - half);
    const to = Math.min(powers.length, k + half);
    db[k] = loudnessOfPower((sums[to] - sums[from]) / WINDOW_STEPS);
  }
  return { stepMs: LOUDNESS_STEP_MS, db };
}

function heardAssetIds(heard: readonly HeardTrack[]): string[] {
  return [...new Set(heard.flatMap(({ timeline, trackId }) => loudnessAssetIds(timeline, { trackId })))];
}

export function reactAssetIds(doc: VideoDocument): string[] {
  return heardAssetIds(heardTracks(doc));
}

export function spectrumAssetIds(doc: VideoDocument): string[] {
  return heardAssetIds(heardTracks(doc).filter((heard) => heard.spectrum));
}

const NO_SPECTRA: SpectrumSource = () => undefined;

export function levelsOf(doc: VideoDocument, profiles: LoudnessSource, spectra: SpectrumSource = NO_SPECTRA): TrackLevels | null {
  const levels = new Map<string, TrackLevel>();
  for (const { timeline, trackId, spectrum } of heardTracks(doc)) {
    const level = trackLevel(timeline, trackId, profiles);
    if (!level) return null;
    const bands = spectrum ? trackBands(timeline, trackId, spectra) : null;
    if (spectrum && !bands) return null;
    levels.set(trackId, bands ? { ...level, bands } : level);
  }
  return (trackId) => levels.get(trackId);
}

export function reactKey(doc: VideoDocument): string {
  const heard = heardTracks(doc);
  if (heard.length === 0) return "";
  return JSON.stringify(heard.map(({ timeline, trackId, spectrum }) => [timeline.durationMs, trackId, spectrum, timeline.tracks.find((track) => track.id === trackId) ?? null]));
}
