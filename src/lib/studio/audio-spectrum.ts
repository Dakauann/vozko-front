import { LOUDNESS_STEP_MS, type LoudnessProfile } from "./loudness";

export const SPECTRUM_BANDS = 48;
export const SPECTRUM_FFT = 1024;
export const SPECTRUM_HZ = [40, 16_000] as const;

const FULL_SCALE = (SPECTRUM_FFT / 4) ** 2;

export interface SpectrumProfile {
  durationMs: number;
  bands: Float32Array[];
}

export type SpectrumSource = (assetId: string) => SpectrumProfile | undefined;

const HANN = Float64Array.from({ length: SPECTRUM_FFT }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / SPECTRUM_FFT));

function transform(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const r = re[i];
      re[i] = re[j];
      re[j] = r;
      const m = im[i];
      im[i] = im[j];
      im[j] = m;
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const turn = (-2 * Math.PI) / size;
    const wr = Math.cos(turn);
    const wi = Math.sin(turn);
    for (let start = 0; start < n; start += size) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < size / 2; k++) {
        const a = start + k;
        const b = a + size / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const next = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = next;
      }
    }
  }
}

export function bandEdges(sampleRate: number): number[] {
  const binHz = sampleRate / SPECTRUM_FFT;
  const top = SPECTRUM_FFT / 2;
  const edges: number[] = [];
  for (let b = 0; b <= SPECTRUM_BANDS; b++) {
    const hz = SPECTRUM_HZ[0] * (SPECTRUM_HZ[1] / SPECTRUM_HZ[0]) ** (b / SPECTRUM_BANDS);
    const bin = Math.max(1, Math.round(hz / binHz));
    edges.push(Math.min(top, b === 0 ? bin : Math.max(edges[b - 1] + 1, bin)));
  }
  return edges;
}

function mono(channels: readonly Float32Array[]): Float32Array {
  const length = channels[0]?.length ?? 0;
  const out = new Float32Array(length);
  for (const channel of channels) for (let i = 0; i < length; i++) out[i] += channel[i] / channels.length;
  return out;
}

export function spectrumProfile(channels: readonly Float32Array[], sampleRate: number): SpectrumProfile {
  const signal = mono(channels);
  const step = Math.max(1, Math.round((sampleRate * LOUDNESS_STEP_MS) / 1000));
  const steps = Math.ceil(signal.length / step);
  const edges = bandEdges(sampleRate);
  const bands = Array.from({ length: SPECTRUM_BANDS }, () => new Float32Array(steps));
  const re = new Float64Array(SPECTRUM_FFT);
  const im = new Float64Array(SPECTRUM_FFT);
  for (let k = 0; k < steps; k++) {
    const start = k * step + Math.floor(step / 2) - SPECTRUM_FFT / 2;
    for (let i = 0; i < SPECTRUM_FFT; i++) {
      const at = start + i;
      re[i] = at >= 0 && at < signal.length ? signal[at] * HANN[i] : 0;
      im[i] = 0;
    }
    transform(re, im);
    for (let b = 0; b < SPECTRUM_BANDS; b++) {
      let sum = 0;
      for (let bin = edges[b]; bin < edges[b + 1]; bin++) sum += re[bin] * re[bin] + im[bin] * im[bin];
      bands[b][k] = sum / FULL_SCALE;
    }
  }
  return { durationMs: (signal.length / sampleRate) * 1000, bands };
}

export function bandProfile(spectrum: SpectrumProfile, band: number): LoudnessProfile {
  return { durationMs: spectrum.durationMs, channels: [spectrum.bands[band]] };
}
