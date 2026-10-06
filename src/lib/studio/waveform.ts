export const PEAKS_PER_SECOND = 100;

export interface Peaks {
  perSecond: number;
  values: Float32Array;
}

export function computePeaks(channels: readonly Float32Array[], sampleRate: number, perSecond: number = PEAKS_PER_SECOND): Peaks {
  const length = channels.reduce((max, channel) => Math.max(max, channel.length), 0);
  if (length === 0 || sampleRate <= 0) return { perSecond, values: new Float32Array(0) };
  const bucket = sampleRate / perSecond;
  const count = Math.ceil(length / bucket);
  const values = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const from = Math.floor(i * bucket);
    const to = Math.min(length, Math.floor((i + 1) * bucket));
    let peak = 0;
    for (const channel of channels) {
      for (let s = from; s < to && s < channel.length; s++) {
        const value = Math.abs(channel[s]);
        if (value > peak) peak = value;
      }
    }
    values[i] = Math.min(1, peak);
  }
  return { perSecond, values };
}

export function slicePeaks(peaks: Peaks, fromMs: number, durationMs: number, bars: number): number[] {
  const count = Math.max(0, Math.floor(bars));
  if (count === 0 || durationMs <= 0) return [];
  const out: number[] = new Array(count).fill(0);
  const msPerBar = durationMs / count;
  for (let i = 0; i < count; i++) {
    const start = Math.floor(((fromMs + i * msPerBar) * peaks.perSecond) / 1000);
    const end = Math.max(start + 1, Math.floor(((fromMs + (i + 1) * msPerBar) * peaks.perSecond) / 1000));
    let peak = 0;
    for (let p = Math.max(0, start); p < end && p < peaks.values.length; p++) {
      if (peaks.values[p] > peak) peak = peaks.values[p];
    }
    out[i] = peak;
  }
  return out;
}

export function peakGain(peaks: Peaks, floor: number = 0.05): number {
  let max = 0;
  for (const value of peaks.values) if (value > max) max = value;
  return 1 / Math.max(floor, max);
}
