import { sourceTable } from "./clip-time";
import type { Keyframe } from "./keyframes";

export interface SpeedCurveWindow {
  keys: Keyframe[];
  fromMs: number;
  toMs: number;
  rate: number;
}

export interface AudioRetime {
  trimInMs: number;
  spanMs: number;
  speed: number;
  reverse: boolean;
  preservePitch: boolean;
  curve?: SpeedCurveWindow;
}

type SampleMap = (outSample: number) => number;

function curveMap(curve: SpeedCurveWindow, sampleRate: number): SampleMap {
  const table = sourceTable({ keyframes: { speed: curve.keys } }, curve.fromMs, curve.toMs, 1);
  const last = table.length - 1;
  return (outSample) => {
    const ms = Math.min(last, Math.max(0, ((outSample / sampleRate) * 1000) * curve.rate));
    const index = Math.min(last - 1, Math.floor(ms));
    const sourceMs = table[index] + (table[index + 1] - table[index]) * (ms - index);
    return (sourceMs * sampleRate) / 1000;
  };
}

function resampled(channels: readonly Float32Array[], map: SampleMap, outLength: number): Float32Array<ArrayBuffer>[] {
  return channels.map((channel) => {
    const out = new Float32Array(outLength);
    for (let i = 0; i < outLength; i++) {
      const at = map(i);
      const low = Math.floor(at);
      if (low < 0 || low >= channel.length) continue;
      const high = Math.min(low + 1, channel.length - 1);
      out[i] = channel[low] + (channel[high] - channel[low]) * (at - low);
    }
    return out;
  });
}

function curvedChannels(windowed: readonly Float32Array[], sampleRate: number, retime: AudioRetime, curve: SpeedCurveWindow): RetimedChannels {
  const map = curveMap(curve, sampleRate);
  const outLength = Math.max(1, Math.round((((curve.toMs - curve.fromMs) / curve.rate) * sampleRate) / 1000));
  return { channels: retime.preservePitch ? stretchMapped(windowed, map, outLength, sampleRate) : resampled(windowed, map, outLength), rate: 1 };
}

interface RetimedChannels {
  channels: Float32Array<ArrayBuffer>[];
  rate: number;
}

const FRAME_SEC = 0.03;
const SEARCH_SEC = 0.012;
const STEP_RATE = 12_000;

function windowOf(channel: Float32Array, from: number, to: number, reverse: boolean): Float32Array<ArrayBuffer> {
  const window = new Float32Array(Math.max(0, to - from));
  window.set(channel.subarray(Math.min(from, channel.length), Math.min(to, channel.length)));
  return reverse ? window.reverse() : window;
}

export function retimeChannels(channels: readonly Float32Array[], sampleRate: number, retime: AudioRetime): RetimedChannels {
  const from = Math.max(0, Math.round((retime.trimInMs * sampleRate) / 1000));
  const to = from + Math.round((retime.spanMs * sampleRate) / 1000);
  const windowed = channels.map((channel) => windowOf(channel, from, to, retime.reverse));
  if (retime.curve) return curvedChannels(windowed, sampleRate, retime, retime.curve);
  if (retime.speed === 1) return { channels: windowed, rate: 1 };
  if (!retime.preservePitch) return { channels: windowed, rate: retime.speed };
  return { channels: stretchChannels(windowed, retime.speed, sampleRate), rate: 1 };
}

function hann(size: number): Float32Array {
  return Float32Array.from({ length: size }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size));
}

function mono(channels: readonly Float32Array[], length: number): Float32Array {
  const mixed = new Float32Array(length);
  for (const channel of channels) for (let i = 0; i < length; i++) mixed[i] += channel[i];
  return mixed;
}

function bestShift(mixed: Float32Array, natural: number, nominal: number, frame: number, search: number, step: number): number {
  let best = 0;
  let bestScore = -Infinity;
  for (let shift = -search; shift <= search; shift += step) {
    const at = nominal + shift;
    if (at < 0 || at + frame > mixed.length) continue;
    let score = 0;
    for (let i = 0; i < frame; i += step) score += mixed[natural + i] * mixed[at + i];
    if (score > bestScore) {
      bestScore = score;
      best = shift;
    }
  }
  return best;
}

export function stretchChannels(channels: readonly Float32Array[], speed: number, sampleRate: number): Float32Array<ArrayBuffer>[] {
  return stretchMapped(channels, (at) => at * speed, Math.round((channels[0]?.length ?? 0) / speed), sampleRate);
}

function stretchMapped(channels: readonly Float32Array[], nominalAt: SampleMap, outLength: number, sampleRate: number): Float32Array<ArrayBuffer>[] {
  const length = channels[0]?.length ?? 0;
  const frame = Math.max(2, 2 * Math.round((FRAME_SEC * sampleRate) / 2));
  const hop = frame / 2;
  const search = Math.round(SEARCH_SEC * sampleRate);
  const step = Math.max(1, Math.round(sampleRate / STEP_RATE));
  const window = hann(frame);
  const mixed = mono(channels, length);
  const out = channels.map(() => new Float32Array(outLength));
  const weight = new Float32Array(outLength);
  let previous = 0;
  for (let at = 0; at < outLength; at += hop) {
    const nominal = Math.min(Math.max(0, Math.round(nominalAt(at))), Math.max(0, length - frame));
    const natural = Math.min(previous + hop, Math.max(0, length - frame));
    const read = at === 0 ? 0 : nominal + bestShift(mixed, natural, nominal, frame, search, step);
    for (let i = 0; i < frame && at + i < outLength && read + i < length; i++) {
      const w = window[i];
      for (let c = 0; c < channels.length; c++) out[c][at + i] += channels[c][read + i] * w;
      weight[at + i] += w;
    }
    previous = read;
  }
  for (const channel of out) for (let i = 0; i < outLength; i++) if (weight[i] > 1e-3) channel[i] /= weight[i];
  return out;
}
