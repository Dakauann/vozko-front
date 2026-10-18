import { LIMIT_CEILING } from "./audio-limiter";

export const SILENT_DB = -90;

const SHELF_HZ = 1681.974450955533;
const SHELF_GAIN_DB = 3.999843853973347;
const SHELF_Q = 0.7071752369554196;
const SHELF_BANDWIDTH = 0.4996667741545416;
const HIGH_PASS_HZ = 38.13547087602444;
const HIGH_PASS_Q = 0.5003270373238773;
const LOUDNESS_OFFSET = -0.691;
export const LOUDNESS_BLOCK_MS = 400;
export const LOUDNESS_HOP_MS = 100;
const ABSOLUTE_GATE = -70;
const RELATIVE_GATE = -10;

interface Biquad {
  b: [number, number, number];
  a: [number, number];
}

export function kWeightingStages(sampleRate: number): [Biquad, Biquad] {
  const k1 = Math.tan((Math.PI * SHELF_HZ) / sampleRate);
  const vh = 10 ** (SHELF_GAIN_DB / 20);
  const vb = vh ** SHELF_BANDWIDTH;
  const a0 = 1 + k1 / SHELF_Q + k1 * k1;
  const shelf: Biquad = {
    b: [(vh + (vb * k1) / SHELF_Q + k1 * k1) / a0, (2 * (k1 * k1 - vh)) / a0, (vh - (vb * k1) / SHELF_Q + k1 * k1) / a0],
    a: [(2 * (k1 * k1 - 1)) / a0, (1 - k1 / SHELF_Q + k1 * k1) / a0],
  };
  const k2 = Math.tan((Math.PI * HIGH_PASS_HZ) / sampleRate);
  const d = 1 + k2 / HIGH_PASS_Q + k2 * k2;
  const highPass: Biquad = { b: [1, -2, 1], a: [(2 * (k2 * k2 - 1)) / d, (1 - k2 / HIGH_PASS_Q + k2 * k2) / d] };
  return [shelf, highPass];
}

function filtered(input: Float32Array, stage: Biquad): Float32Array {
  const out = new Float32Array(input.length);
  const [b0, b1, b2] = stage.b;
  const [a1, a2] = stage.a;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const x = input[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    out[i] = y;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
  }
  return out;
}

export function kWeighted(channel: Float32Array, sampleRate: number): Float32Array {
  const [shelf, highPass] = kWeightingStages(sampleRate);
  return filtered(filtered(channel, shelf), highPass);
}

function decibels(power: number, offset = 0): number {
  return power > 0 ? Math.max(SILENT_DB, offset + 10 * Math.log10(power)) : SILENT_DB;
}

export function loudnessOfPower(power: number): number {
  return decibels(power, LOUDNESS_OFFSET);
}

export function gatedLoudness(powers: readonly number[]): number | null {
  const loudness = (power: number) => LOUDNESS_OFFSET + 10 * Math.log10(power);
  const loud = powers.filter((power) => power > 0 && loudness(power) > ABSOLUTE_GATE);
  if (loud.length === 0) return null;
  const relative = loudness(loud.reduce((sum, power) => sum + power, 0) / loud.length) + RELATIVE_GATE;
  const kept = loud.filter((power) => loudness(power) > relative);
  return loudness(kept.reduce((sum, power) => sum + power, 0) / kept.length);
}

function meanSquare(channel: Float32Array, from: number, to: number): number {
  let sum = 0;
  for (let i = from; i < to; i++) sum += channel[i] * channel[i];
  return to > from ? sum / (to - from) : 0;
}

function summedPower(weighted: readonly Float32Array[], from: number, to: number): number {
  return weighted.reduce((sum, channel) => sum + meanSquare(channel, from, Math.min(to, channel.length)), 0);
}

function sampleAt(ms: number, sampleRate: number): number {
  return Math.max(0, Math.round((ms * sampleRate) / 1000));
}

export function integratedLoudness(weighted: readonly Float32Array[], sampleRate: number): number | null {
  const length = Math.min(...weighted.map((channel) => channel.length));
  const block = sampleAt(LOUDNESS_BLOCK_MS, sampleRate);
  const hop = sampleAt(LOUDNESS_HOP_MS, sampleRate);
  const powers: number[] = [];
  for (let from = 0; from + block <= length; from += hop) powers.push(summedPower(weighted, from, from + block));
  return gatedLoudness(powers);
}

export const BALANCE_LIMIT_DB = 60;

export interface Levels {
  peakDb: number;
  rmsDb: number;
  lufs: number;
  balanceDb?: number;
}

function balanceOf(powers: readonly number[]): number | undefined {
  if (powers.length !== 2 || powers[0] + powers[1] <= 0) return undefined;
  return Math.max(-BALANCE_LIMIT_DB, Math.min(BALANCE_LIMIT_DB, 10 * Math.log10(powers[1] / powers[0])));
}

export function levelsBetween(channels: readonly Float32Array[], weighted: readonly Float32Array[], sampleRate: number, fromMs: number, toMs: number): Levels {
  const from = sampleAt(fromMs, sampleRate);
  const to = sampleAt(toMs, sampleRate);
  let peak = 0;
  for (const channel of channels) for (let i = from; i < Math.min(to, channel.length); i++) peak = Math.max(peak, Math.abs(channel[i]));
  const powers = channels.map((channel) => meanSquare(channel, from, Math.min(to, channel.length)));
  const power = powers.reduce((sum, value) => sum + value, 0) / Math.max(1, channels.length);
  const balanceDb = balanceOf(powers);
  return { peakDb: decibels(peak * peak), rmsDb: decibels(power), lufs: loudnessOfPower(summedPower(weighted, from, to)), ...(balanceDb !== undefined ? { balanceDb } : {}) };
}

export function ceilingHits(channels: readonly Float32Array[], from: number, to: number): number {
  let hits = 0;
  const end = Math.min(to, ...channels.map((channel) => channel.length));
  for (let i = from; i < end; i++) {
    if (channels.some((channel) => Math.abs(channel[i]) > LIMIT_CEILING)) hits += 1;
  }
  return hits;
}
