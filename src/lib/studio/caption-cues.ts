import { localAtSource, sourceSpanMs } from "./clip-time";

interface CaptionCue {
  startMs: number;
  endMs: number;
  text: string;
}

const TIMING = /^((?:\d+:)?\d{1,2}:\d{2}[.,]\d{1,3})\s+-->\s+((?:\d+:)?\d{1,2}:\d{2}[.,]\d{1,3})/;

export function parseTimestamp(value: string): number | null {
  const match = /^(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})$/.exec(value.trim());
  if (!match) return null;
  const [, hours, minutes, seconds, fraction] = match;
  const ms = Number(fraction.padEnd(3, "0"));
  return ((Number(hours ?? 0) * 60 + Number(minutes)) * 60 + Number(seconds)) * 1000 + ms;
}

function cleanText(lines: readonly string[]): string {
  return lines
    .map((line) => line.replace(/<[^>]*>/g, "").replace(/\{\\[^}]*\}/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim())
    .filter(Boolean)
    .join("\n");
}

export function parseCaptionCues(source: string): CaptionCue[] {
  const blocks = source.replace(/^﻿/, "").replace(/\r\n?/g, "\n").split(/\n[ \t]*\n/);
  const cues: CaptionCue[] = [];
  for (const block of blocks) {
    const lines = block.split("\n");
    const timingIndex = lines.findIndex((line) => TIMING.test(line.trim()));
    if (timingIndex < 0) continue;
    const match = TIMING.exec(lines[timingIndex].trim());
    if (!match) continue;
    const startMs = parseTimestamp(match[1]);
    const endMs = parseTimestamp(match[2]);
    const text = cleanText(lines.slice(timingIndex + 1));
    if (startMs === null || endMs === null || endMs <= startMs || text === "") continue;
    cues.push({ startMs, endMs, text });
  }
  return cues.sort((a, b) => a.startMs - b.startMs);
}

export interface SourceWindow {
  startMs: number;
  durationMs: number;
  trimInMs: number;
  speed?: number;
  reverse?: boolean;
}

export function cuesOnTimeline(cues: readonly CaptionCue[], window: SourceWindow): CaptionCue[] {
  const sourceEnd = window.trimInMs + sourceSpanMs(window);
  const placed = (sourceMs: number) => window.startMs + Math.round(localAtSource(window, sourceMs));
  return cues
    .filter((cue) => cue.endMs > window.trimInMs && cue.startMs < sourceEnd)
    .map((cue) => {
      const from = placed(Math.max(cue.startMs, window.trimInMs));
      const to = placed(Math.min(cue.endMs, sourceEnd));
      return { text: cue.text, startMs: Math.min(from, to), endMs: Math.max(from, to) };
    })
    .sort((a, b) => a.startMs - b.startMs);
}
