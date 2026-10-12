"use client";

import { loadMediaFile } from "@/components/studio/canvas/media-files";
import type { GainPoint } from "@/lib/studio/audio-gain";
import { panGains } from "@/lib/studio/audio-pan";
import { retimeChannels, type AudioRetime } from "@/lib/studio/audio-retime";
import type { AudioVoice, VoicePan } from "@/lib/studio/playback";

export const PREVIEW_SAMPLE_RATE = 44_100;

export interface ScheduledVoice {
  source: AudioBufferSourceNode;
  nodes: AudioNode[];
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

interface PlayedBuffer {
  buffer: AudioBuffer;
  rate: number;
}

const RETIMED_PER_SOURCE = 8;
const retimedCache = new WeakMap<AudioBuffer, Map<string, PlayedBuffer>>();

function retimedBuffer(buffer: AudioBuffer, retime: AudioRetime): PlayedBuffer {
  const key = JSON.stringify(retime);
  const known = retimedCache.get(buffer) ?? new Map<string, PlayedBuffer>();
  retimedCache.set(buffer, known);
  const cached = known.get(key);
  if (cached) return cached;
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
  const result = retimeChannels(channels, buffer.sampleRate, retime);
  const length = Math.max(1, result.channels[0]?.length ?? 0);
  const derived = new AudioBuffer({ length, numberOfChannels: buffer.numberOfChannels, sampleRate: buffer.sampleRate });
  result.channels.forEach((channel, c) => derived.copyToChannel(channel, c));
  const played = { buffer: derived, rate: result.rate };
  if (known.size >= RETIMED_PER_SOURCE) known.delete(known.keys().next().value!);
  known.set(key, played);
  return played;
}

function automate(param: AudioParam, points: readonly GainPoint[], when: number, level: (value: number) => number): void {
  const [first, ...rest] = points;
  param.setValueAtTime(first ? level(first.value) : 0, when);
  for (const point of rest) param.linearRampToValueAtTime(level(point.value), when + point.atMs / 1000);
}

function panned(context: BaseAudioContext, input: AudioNode, pan: VoicePan, channels: number, when: number): { output: AudioNode; nodes: AudioNode[] } {
  const splitter = context.createChannelSplitter(2);
  const left = context.createGain();
  const right = context.createGain();
  const merger = context.createChannelMerger(2);
  automate(left.gain, pan.points, when, (value) => panGains(value, pan.track, channels).left);
  automate(right.gain, pan.points, when, (value) => panGains(value, pan.track, channels).right);
  input.connect(splitter);
  splitter.connect(left, 0);
  splitter.connect(right, channels === 1 ? 0 : 1);
  left.connect(merger, 0, 0);
  right.connect(merger, 0, 1);
  return { output: merger, nodes: [splitter, left, right, merger] };
}

export function scheduleVoice(context: BaseAudioContext, destination: AudioNode, buffer: AudioBuffer, voice: AudioVoice, when: number): ScheduledVoice | null {
  const played = voice.retime ? retimedBuffer(buffer, voice.retime) : { buffer, rate: 1 };
  const offset = (voice.offsetMs / 1000) * played.rate;
  if (offset >= played.buffer.duration) return null;
  const duration = Math.min((voice.durationMs / 1000) * played.rate, played.buffer.duration - offset);
  const source = context.createBufferSource();
  source.buffer = played.buffer;
  source.playbackRate.value = played.rate;
  const gain = context.createGain();
  automate(gain.gain, voice.gain, when, (value) => value);
  source.connect(gain);
  const stage = voice.pan ? panned(context, gain, voice.pan, played.buffer.numberOfChannels, when) : { output: gain, nodes: [] };
  stage.output.connect(destination);
  source.start(when, offset, duration);
  return { source, nodes: [gain, ...stage.nodes] };
}
