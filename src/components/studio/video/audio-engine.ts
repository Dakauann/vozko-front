"use client";

import { fetchMediaFileAction } from "@/app/actions/medias";
import type { VideoDocument } from "@/lib/studio/document";
import { audioPlan, type AudioPlanOptions, type AudioVoice } from "@/lib/studio/playback";
import { computePeaks, type Peaks } from "@/lib/studio/waveform";

export const SCHEDULE_LEAD_SEC = 0.05;

type AudioContextClass = typeof AudioContext;

function audioContextClass(): AudioContextClass | null {
  if (typeof window === "undefined") return null;
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextClass }).webkitAudioContext ?? null;
}

async function decode(assetId: string): Promise<AudioBuffer | null> {
  const { data } = await fetchMediaFileAction(assetId);
  if (!data || typeof OfflineAudioContext === "undefined") return null;
  try {
    const bytes = await data.blob.arrayBuffer();
    return await new OfflineAudioContext(1, 1, 44_100).decodeAudioData(bytes);
  } catch {
    return null;
  }
}

interface LiveVoice {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private peaks = new Map<string, Promise<Peaks | null>>();
  private live: LiveVoice[] = [];
  private session = 0;

  now(): number {
    return this.context ? this.context.currentTime : performance.now() / 1000;
  }

  async prepare(): Promise<void> {
    if (!this.context) {
      const Context = audioContextClass();
      if (!Context) return;
      this.context = new Context();
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
    }
    if (this.context.state === "suspended") await this.context.resume().catch(() => undefined);
  }

  buffer(assetId: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(assetId);
    if (cached) return cached;
    const loading = decode(assetId);
    this.buffers.set(assetId, loading);
    loading.then((value) => {
      if (value === null) this.buffers.delete(assetId);
    });
    return loading;
  }

  peaksFor(assetId: string): Promise<Peaks | null> {
    const cached = this.peaks.get(assetId);
    if (cached) return cached;
    const computing = this.buffer(assetId).then((buffer) => {
      if (!buffer) return null;
      const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
      return computePeaks(channels, buffer.sampleRate);
    });
    this.peaks.set(assetId, computing);
    computing.then((value) => {
      if (value === null) this.peaks.delete(assetId);
    });
    return computing;
  }

  play(doc: VideoDocument, fromMs: number, position: () => number, options: AudioPlanOptions = {}): void {
    this.stop();
    const context = this.context;
    if (!context || !this.master) return;
    const session = this.session;
    const startedAt = context.currentTime + SCHEDULE_LEAD_SEC;
    for (const voice of audioPlan(doc, fromMs, options)) {
      void this.buffer(voice.assetId).then((buffer) => {
        if (!buffer || session !== this.session) return;
        const lateMs = (context.currentTime - startedAt) * 1000;
        if (lateMs <= voice.delayMs) {
          this.schedule(buffer, voice, startedAt + voice.delayMs / 1000);
          return;
        }
        const resumed = audioPlan(doc, position(), options).find((candidate) => candidate.clipId === voice.clipId);
        if (resumed) this.schedule(buffer, resumed, context.currentTime + SCHEDULE_LEAD_SEC + resumed.delayMs / 1000);
      });
    }
  }

  stop(): void {
    this.session += 1;
    for (const voice of this.live) {
      voice.source.onended = null;
      voice.source.stop();
      voice.source.disconnect();
      voice.gain.disconnect();
    }
    this.live = [];
  }

  dispose(): void {
    this.stop();
    void this.context?.close().catch(() => undefined);
    this.context = null;
    this.master = null;
  }

  private schedule(buffer: AudioBuffer, voice: AudioVoice, when: number): void {
    const context = this.context;
    if (!context || !this.master) return;
    const offset = voice.offsetMs / 1000;
    if (offset >= buffer.duration) return;
    const duration = Math.min(voice.durationMs / 1000, buffer.duration - offset);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    const [first, ...rest] = voice.gain;
    gain.gain.setValueAtTime(first?.value ?? 0, when);
    for (const point of rest) gain.gain.linearRampToValueAtTime(point.value, when + point.atMs / 1000);
    source.connect(gain);
    gain.connect(this.master);
    source.start(when, offset, duration);
    const live = { source, gain };
    this.live.push(live);
    source.onended = () => {
      this.live = this.live.filter((candidate) => candidate !== live);
      source.disconnect();
      gain.disconnect();
    };
  }
}
