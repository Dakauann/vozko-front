import { LOUDNESS_STEP_MS, type LoudnessProfile } from "./loudness";

export const BEAT_TEMPO_RANGE = [60, 200] as const;

export interface BeatAnalysis {
  bpm: number;
  beatsMs: number[];
}

const FLOOR_DB = 60;
const MEAN_STEPS = 25;
const TEMPO_CENTER_MS = 500;
const TEMPO_SPREAD_OCTAVES = 1;
const TIGHTNESS = 100;
const MIN_PERIODS = 4;
const QUIET = 1e-9;
const MS_PER_MINUTE = 60_000;

function summedEnergy(profile: LoudnessProfile): Float64Array {
  const length = profile.channels[0]?.length ?? 0;
  const energy = new Float64Array(length);
  for (const channel of profile.channels) for (let k = 0; k < length; k++) energy[k] += channel[k] ?? 0;
  return energy;
}

function onsetStrength(energy: Float64Array): Float64Array {
  const levels = Array.from(energy, (e) => 10 * Math.log10(e + 1e-12));
  const floor = Math.max(...levels) - FLOOR_DB;
  const flux = new Float64Array(energy.length);
  for (let k = 1; k < energy.length; k++) flux[k] = Math.max(0, Math.max(floor, levels[k]) - Math.max(floor, levels[k - 1]));
  const sums = new Float64Array(flux.length + 1);
  for (let k = 0; k < flux.length; k++) sums[k + 1] = sums[k] + flux[k];
  const onsets = new Float64Array(flux.length);
  for (let k = 0; k < flux.length; k++) {
    const from = Math.max(0, k - MEAN_STEPS);
    const to = Math.min(flux.length, k + MEAN_STEPS + 1);
    onsets[k] = Math.max(0, flux[k] - (sums[to] - sums[from]) / (to - from));
  }
  return onsets;
}

function tempoWeight(lagSteps: number): number {
  const octaves = Math.log2((lagSteps * LOUDNESS_STEP_MS) / TEMPO_CENTER_MS);
  return Math.exp(-0.5 * (octaves / TEMPO_SPREAD_OCTAVES) ** 2);
}

function correlation(onsets: Float64Array, lag: number): number {
  let sum = 0;
  for (let k = 0; k + lag < onsets.length; k++) sum += onsets[k] * onsets[k + lag];
  return sum;
}

function periodSteps(onsets: Float64Array): number | null {
  const shortest = Math.round(MS_PER_MINUTE / BEAT_TEMPO_RANGE[1] / LOUDNESS_STEP_MS);
  const longest = Math.round(MS_PER_MINUTE / BEAT_TEMPO_RANGE[0] / LOUDNESS_STEP_MS);
  if (onsets.length < longest * MIN_PERIODS) return null;
  const scores = new Map<number, number>();
  for (let lag = shortest - 1; lag <= longest + 1; lag++) scores.set(lag, correlation(onsets, lag));
  let best = shortest;
  for (let lag = shortest; lag <= longest; lag++) if (scores.get(lag)! * tempoWeight(lag) > scores.get(best)! * tempoWeight(best)) best = lag;
  if (scores.get(best)! <= QUIET) return null;
  const left = scores.get(best - 1)!;
  const mid = scores.get(best)!;
  const right = scores.get(best + 1)!;
  const bend = left - 2 * mid + right;
  return bend < 0 ? best + (0.5 * (left - right)) / bend : best;
}

function trackBeats(onsets: Float64Array, period: number): number[] {
  const score = new Float64Array(onsets.length);
  const from = new Int32Array(onsets.length).fill(-1);
  const reach = Math.round(2 * period);
  const near = Math.max(1, Math.round(period / 2));
  for (let t = 0; t < onsets.length; t++) {
    let best = 0;
    for (let p = Math.max(0, t - reach); p <= t - near; p++) {
      const candidate = score[p] - TIGHTNESS * Math.log((t - p) / period) ** 2;
      if (from[t] < 0 || candidate > best) {
        best = candidate;
        from[t] = p;
      }
    }
    score[t] = onsets[t] + (from[t] >= 0 ? Math.max(0, best) : 0);
    if (from[t] >= 0 && best <= 0) from[t] = -1;
  }
  const tail = Math.max(0, onsets.length - Math.ceil(period));
  let last = tail;
  for (let t = tail; t < onsets.length; t++) if (score[t] > score[last]) last = t;
  const beats: number[] = [];
  for (let t = last; t >= 0; t = from[t]) beats.push(t);
  return beats.reverse();
}

export function detectBeats(profile: LoudnessProfile): BeatAnalysis | null {
  const onsets = onsetStrength(summedEnergy(profile));
  if (!onsets.some((value) => value > QUIET)) return null;
  const period = periodSteps(onsets);
  if (period === null) return null;
  const beats = trackBeats(onsets, period);
  return { bpm: Math.round((MS_PER_MINUTE / (period * LOUDNESS_STEP_MS)) * 10) / 10, beatsMs: beats.map((step) => step * LOUDNESS_STEP_MS) };
}
