"use client";

import type { VideoDocument } from "@/lib/studio/document";
import { audioPlan, audioPlanChange, audioVoiceKeys, outputLatencySec, type AudioPlanOptions, type AudioVoice } from "@/lib/studio/playback";
import { computePeaks, type Peaks } from "@/lib/studio/waveform";

import { decodeAudioFile, PREVIEW_SAMPLE_RATE, scheduleVoice, type ScheduledVoice } from "./audio-graph";

export const SCHEDULE_LEAD_SEC = 0.05;

type AudioContextClass = typeof AudioContext;

function audioContextClass(): AudioContextClass | null {
  if (typeof window === "undefined") return null;
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextClass }).webkitAudioContext ?? null;
}

export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private peaks = new Map<string, Promise<Peaks | null>>();
  private live: { clipId: string; voice: ScheduledVoice }[] = [];
  private scheduled = new Map<string, string>();
  private session = 0;

  constructor(private readonly fileOf: (assetId: string) => string = (assetId) => assetId) {}

  heard(): number {
    return this.context ? this.context.currentTime - outputLatencySec(this.context) : performance.now() / 1000;
  }

  startsAt(): number {
    return this.context ? this.context.currentTime + SCHEDULE_LEAD_SEC : performance.now() / 1000;
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
    const loading = decodeAudioFile(this.fileOf(assetId), PREVIEW_SAMPLE_RATE);
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

  play(doc: VideoDocument, positionAt: (clockSec: number) => number, options: AudioPlanOptions = {}): void {
    this.stop();
    if (!this.context || !this.master) return;
    this.scheduled = audioVoiceKeys(doc, options);
    this.scheduleFrom(doc, positionAt, options, null);
  }

  update(doc: VideoDocument, positionAt: (clockSec: number) => number, options: AudioPlanOptions = {}): void {
    if (!this.context || !this.master) return;
    const next = audioVoiceKeys(doc, options);
    const change = audioPlanChange(this.scheduled, next);
    this.scheduled = next;
    this.silence(new Set(change.stop));
    if (change.start.length > 0) this.scheduleFrom(doc, positionAt, options, new Set(change.start));
  }

  stop(): void {
    this.session += 1;
    this.scheduled = new Map();
    this.silence(null);
  }

  dispose(): void {
    this.stop();
    void this.context?.close().catch(() => undefined);
    this.context = null;
    this.master = null;
  }

  private scheduleFrom(doc: VideoDocument, positionAt: (clockSec: number) => number, options: AudioPlanOptions, only: ReadonlySet<string> | null): void {
    const context = this.context;
    if (!context) return;
    const session = this.session;
    const startedAt = context.currentTime + SCHEDULE_LEAD_SEC;
    for (const voice of audioPlan(doc, positionAt(startedAt), options)) {
      if (only && !only.has(voice.clipId)) continue;
      const key = this.scheduled.get(voice.clipId);
      void this.buffer(voice.assetId).then((buffer) => {
        if (!buffer || session !== this.session || this.scheduled.get(voice.clipId) !== key) return;
        const lateMs = (context.currentTime - startedAt) * 1000;
        if (lateMs <= voice.delayMs) {
          this.schedule(buffer, voice, startedAt + voice.delayMs / 1000);
          return;
        }
        const resumeAt = context.currentTime + SCHEDULE_LEAD_SEC;
        const resumed = audioPlan(doc, positionAt(resumeAt), options).find((candidate) => candidate.clipId === voice.clipId);
        if (resumed) this.schedule(buffer, resumed, resumeAt + resumed.delayMs / 1000);
      });
    }
  }

  private silence(clipIds: ReadonlySet<string> | null): void {
    const silenced = this.live.filter((entry) => clipIds === null || clipIds.has(entry.clipId));
    for (const { voice } of silenced) {
      voice.source.onended = null;
      voice.source.stop();
      voice.source.disconnect();
      voice.gain.disconnect();
    }
    this.live = this.live.filter((entry) => !silenced.includes(entry));
  }

  private schedule(buffer: AudioBuffer, voice: AudioVoice, when: number): void {
    if (!this.context || !this.master) return;
    const live = scheduleVoice(this.context, this.master, buffer, voice, when);
    if (!live) return;
    const entry = { clipId: voice.clipId, voice: live };
    this.live.push(entry);
    live.source.onended = () => {
      this.live = this.live.filter((candidate) => candidate !== entry);
      live.source.disconnect();
      live.gain.disconnect();
    };
  }
}
