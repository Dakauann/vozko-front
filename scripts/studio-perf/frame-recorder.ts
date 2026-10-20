const SLOW_FRAME_MS = 34;

export interface FrameStats {
  frames: number;
  p50: number;
  p95: number;
  max: number;
  slow: number;
}

export interface FrameRecorder {
  start: () => void;
  stop: () => FrameStats;
}

export function frameStats(durations: readonly number[]): FrameStats {
  const sorted = [...durations].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
  return { frames: sorted.length, p50: at(0.5), p95: at(0.95), max: sorted[sorted.length - 1] ?? 0, slow: sorted.filter((d) => d > SLOW_FRAME_MS).length };
}

export function createFrameRecorder(): FrameRecorder {
  const frames: number[] = [];
  let recording = false;
  let last = 0;
  const tick = (now: number) => {
    if (recording && last > 0) frames.push(now - last);
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return {
    start() {
      frames.length = 0;
      recording = true;
    },
    stop() {
      recording = false;
      return frameStats(frames);
    },
  };
}
