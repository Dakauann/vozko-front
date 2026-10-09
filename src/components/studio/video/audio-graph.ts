"use client";

import { loadMediaFile } from "@/components/studio/canvas/media-files";
import type { AudioVoice } from "@/lib/studio/playback";

export const PREVIEW_SAMPLE_RATE = 44_100;

export interface ScheduledVoice {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

export async function decodeAudioFile(file: string, sampleRate: number): Promise<AudioBuffer | null> {
  const loaded = await loadMediaFile(file);
  if (!loaded || typeof OfflineAudioContext === "undefined") return null;
  try {
    const bytes = await loaded.blob.arrayBuffer();
    return await new OfflineAudioContext(1, 1, sampleRate).decodeAudioData(bytes);
  } catch {
    return null;
  }
}

export function scheduleVoice(context: BaseAudioContext, destination: AudioNode, buffer: AudioBuffer, voice: AudioVoice, when: number): ScheduledVoice | null {
  const offset = voice.offsetMs / 1000;
  if (offset >= buffer.duration) return null;
  const duration = Math.min(voice.durationMs / 1000, buffer.duration - offset);
  const source = context.createBufferSource();
  source.buffer = buffer;
  const gain = context.createGain();
  const [first, ...rest] = voice.gain;
  gain.gain.setValueAtTime(first?.value ?? 0, when);
  for (const point of rest) gain.gain.linearRampToValueAtTime(point.value, when + point.atMs / 1000);
  source.connect(gain);
  gain.connect(destination);
  source.start(when, offset, duration);
  return { source, gain };
}
