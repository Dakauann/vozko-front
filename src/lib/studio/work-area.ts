import { clampPosition } from "./playback";

export interface MarkRange {
  inMs: number | null;
  outMs: number | null;
}

export interface TimeSpan {
  startMs: number;
  endMs: number;
}

export function filmSpan(durationMs: number): TimeSpan {
  return { startMs: 0, endMs: Math.max(0, durationMs) };
}

export function spanLength(span: TimeSpan): number {
  return span.endMs - span.startMs;
}

export function insideSpan(span: TimeSpan, ms: number): boolean {
  return ms >= span.startMs && ms <= span.endMs;
}

export function clampSpan(span: TimeSpan, durationMs: number): TimeSpan | null {
  const startMs = clampPosition(span.startMs, durationMs);
  const endMs = clampPosition(span.endMs, durationMs);
  return endMs > startMs ? { startMs, endMs } : null;
}

export function workArea(range: MarkRange, durationMs: number): TimeSpan | null {
  if (range.inMs === null || range.outMs === null) return null;
  return clampSpan({ startMs: range.inMs, endMs: range.outMs }, durationMs);
}

export function playSpan(range: MarkRange, durationMs: number, rangeOnly: boolean): TimeSpan {
  return (rangeOnly ? workArea(range, durationMs) : null) ?? filmSpan(durationMs);
}

export function playStart(span: TimeSpan, fromMs: number, rate: number, loop: boolean): number | null {
  if (rate > 0) return fromMs < span.startMs || fromMs >= span.endMs ? span.startMs : fromMs;
  if (fromMs > span.endMs) return span.endMs;
  if (fromMs > span.startMs) return fromMs;
  return loop ? span.endMs : null;
}
