export const LIMIT_CEILING = 0.95;
export const LIMIT_ATTACK_MS = 5;
export const LIMIT_RELEASE_MS = 50;

function wantedGain(channels: readonly Float32Array[], length: number): Float32Array | null {
  const gain = new Float32Array(length);
  let limited = false;
  for (let i = 0; i < length; i++) {
    let level = 0;
    for (const channel of channels) level = Math.max(level, Math.abs(channel[i]));
    gain[i] = level > LIMIT_CEILING ? LIMIT_CEILING / level : 1;
    limited ||= gain[i] < 1;
  }
  return limited ? gain : null;
}

function aheadMinimum(values: Float32Array, window: number): Float32Array {
  const out = new Float32Array(values.length);
  const queue = new Int32Array(values.length);
  let head = 0;
  let tail = 0;
  for (let i = values.length - 1; i >= 0; i--) {
    while (tail > head && values[queue[tail - 1]] >= values[i]) tail--;
    queue[tail++] = i;
    while (queue[head] > i + window - 1) head++;
    out[i] = values[queue[head]];
  }
  return out;
}

function trailingMean(values: Float32Array, window: number): Float32Array {
  const out = new Float32Array(values.length);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= window) sum -= values[i - window];
    out[i] = sum / Math.min(i + 1, window);
  }
  return out;
}

function released(values: Float32Array, coefficient: number): Float32Array {
  let previous = 1;
  for (let i = 0; i < values.length; i++) {
    previous = values[i] <= previous ? values[i] : previous + (values[i] - previous) * coefficient;
    values[i] = previous;
  }
  return values;
}

export function limitPeaks(channels: readonly Float32Array[], sampleRate: number): void {
  const length = Math.min(...channels.map((channel) => channel.length));
  const wanted = wantedGain(channels, length);
  if (!wanted) return;
  const attack = Math.max(1, Math.round((LIMIT_ATTACK_MS / 1000) * sampleRate));
  const coefficient = 1 - Math.exp(-1 / ((LIMIT_RELEASE_MS / 1000) * sampleRate));
  const gain = released(trailingMean(aheadMinimum(wanted, attack), attack), coefficient);
  for (const channel of channels) for (let i = 0; i < length; i++) channel[i] *= gain[i];
}
