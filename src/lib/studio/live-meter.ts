import { loudnessOfPower, LOUDNESS_BLOCK_MS } from "./audio-meter";

export const METER_FLOOR_DB = -60;
const PEAK_HOLD_MS = 1000;
const PEAK_FALL_DB_PER_SECOND = 20;
const SHORT_TERM_MS = 3000;
export const MOMENTARY_MS = LOUDNESS_BLOCK_MS;

export interface HeldPeak {
  db: number;
  holdUntilMs: number;
  atMs: number;
}

export const IDLE_PEAK: HeldPeak = { db: METER_FLOOR_DB, holdUntilMs: 0, atMs: 0 };

export function peakOf(samples: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  return peak;
}

export function tailPower(samples: Float32Array, count: number): number {
  const from = Math.max(0, samples.length - count);
  let sum = 0;
  for (let i = from; i < samples.length; i++) sum += samples[i] * samples[i];
  return samples.length > from ? sum / (samples.length - from) : 0;
}

function peakDb(peak: number): number {
  return peak > 0 ? Math.max(METER_FLOOR_DB, 20 * Math.log10(peak)) : METER_FLOOR_DB;
}

export function heldPeak(state: HeldPeak, db: number, nowMs: number): HeldPeak {
  const level = Math.max(METER_FLOOR_DB, db);
  if (nowMs <= state.holdUntilMs && level < state.db) return state;
  const shown = Math.max(METER_FLOOR_DB, state.db - (PEAK_FALL_DB_PER_SECOND * (nowMs - Math.max(state.holdUntilMs, state.atMs))) / 1000);
  if (level >= shown) return { db: level, holdUntilMs: nowMs + PEAK_HOLD_MS, atMs: nowMs };
  return { db: shown, holdUntilMs: nowMs, atMs: nowMs };
}

const CLIP_LEVEL = 1;

export interface StereoMeter {
  left: HeldPeak;
  right: HeldPeak;
  leftDb: number;
  rightDb: number;
  clipped: boolean;
}

export const IDLE_METER: StereoMeter = { left: IDLE_PEAK, right: IDLE_PEAK, leftDb: METER_FLOOR_DB, rightDb: METER_FLOOR_DB, clipped: false };

export function stepMeter(state: StereoMeter, peak: { left: number; right: number }, nowMs: number): StereoMeter {
  const leftDb = peakDb(peak.left);
  const rightDb = peakDb(peak.right);
  return {
    left: heldPeak(state.left, leftDb, nowMs),
    right: heldPeak(state.right, rightDb, nowMs),
    leftDb,
    rightDb,
    clipped: state.clipped || Math.max(peak.left, peak.right) >= CLIP_LEVEL,
  };
}

export function meterIdle(state: StereoMeter): boolean {
  return [state.left.db, state.right.db, state.leftDb, state.rightDb].every((db) => db <= METER_FLOOR_DB);
}

export function clearClip(state: StereoMeter): StereoMeter {
  return state.clipped ? { ...state, clipped: false } : state;
}

export function formatLevel(db: number | null): string {
  if (db === null || !(db > METER_FLOOR_DB)) return "-∞";
  return `${db > 0 ? "+" : ""}${db.toFixed(1)}`;
}

export function meterFill(db: number): number {
  return Math.min(1, Math.max(0, (db - METER_FLOOR_DB) / -METER_FLOOR_DB));
}

export class ShortTermLoudness {
  private entries: { atMs: number; power: number }[] = [];

  push(power: number, atMs: number): void {
    this.entries.push({ atMs, power });
    this.entries = this.entries.filter((entry) => entry.atMs > atMs - SHORT_TERM_MS);
  }

  lufs(): number | null {
    if (this.entries.length === 0) return null;
    return loudnessOfPower(this.entries.reduce((sum, entry) => sum + entry.power, 0) / this.entries.length);
  }

  reset(): void {
    this.entries = [];
  }
}
