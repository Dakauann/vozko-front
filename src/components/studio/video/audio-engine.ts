"use client";

import type { VideoDocument } from "@/lib/studio/document";
import { audioPlan, audioPlanChange, audioVoiceKeys, outputLatencySec, soundAssetIds, type AudioPlanOptions, type AudioVoice } from "@/lib/studio/playback";
import { loudnessProfile, type LoudnessProfile } from "@/lib/studio/loudness";
import { computePeaks, type Peaks } from "@/lib/studio/waveform";

import type { SpeechAnalysis } from "@/lib/studio/ducking";

import { decodeAudioFile, PREVIEW_SAMPLE_RATE, scheduleVoice, type ScheduledVoice } from "./audio-graph";
import { LoudnessTap, PeakTap, stereoBus, type MeterFrame } from "./audio-meters";
import { channelsOf } from "./export/audio-mixdown";
import { analyzeBuffer, speechOfTriggers } from "./speech-analysis";

export const SCHEDULE_LEAD_SEC = 0.05;

type AudioContextClass = typeof AudioContext;

function audioContextClass(): AudioContextClass | null {
  if (typeof window === "undefined") return null;
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextClass }).webkitAudioContext ?? null;
}

export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private masterPeak: PeakTap | null = null;
  private masterLoudness: LoudnessTap | null = null;
  private buses = new Map<string, { bus: GainNode; peak: PeakTap }>();
  private lengths = new Map<string, number>();
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private peaks = new Map<string, Promise<Peaks | null>>();
  private analyses = new Map<string, Promise<SpeechAnalysis | null>>();
  private speech = new Map<string, SpeechAnalysis>();
  private profiles = new Map<string, Promise<LoudnessProfile | null>>();
  private measured = new Map<string, LoudnessProfile>();
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
      this.master = stereoBus(this.context);
      this.master.connect(this.context.destination);
      this.masterPeak = new PeakTap(this.context, this.master);
      this.masterLoudness = new LoudnessTap(this.context, this.master);
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

  private fromBuffer<T>(cache: Map<string, Promise<T | null>>, assetId: string, compute: (buffer: AudioBuffer) => T, settled?: Map<string, T>): Promise<T | null> {
    const cached = cache.get(assetId);
    if (cached) return cached;
    const computing = this.buffer(assetId).then((buffer) => (buffer ? compute(buffer) : null));
    cache.set(assetId, computing);
    computing.then((value) => {
      if (value === null) cache.delete(assetId);
      else settled?.set(assetId, value);
    });
    return computing;
  }

  peaksFor(assetId: string): Promise<Peaks | null> {
    return this.fromBuffer(this.peaks, assetId, (buffer) => computePeaks(channelsOf(buffer), buffer.sampleRate));
  }

  analysis(assetId: string): Promise<SpeechAnalysis | null> {
    return this.fromBuffer(this.analyses, assetId, analyzeBuffer, this.speech);
  }

  speechOf(assetId: string): SpeechAnalysis | undefined {
    return this.speech.get(assetId);
  }

  loudness(assetId: string): Promise<LoudnessProfile | null> {
    return this.fromBuffer(this.profiles, assetId, (buffer) => loudnessProfile(channelsOf(buffer), buffer.sampleRate), this.measured);
  }

  loudnessOf(assetId: string): LoudnessProfile | undefined {
    return this.measured.get(assetId);
  }

  meters(): MeterFrame | null {
    if (!this.masterPeak || !this.masterLoudness) return null;
    const tracks = Object.fromEntries([...this.buses].map(([trackId, entry]) => [trackId, entry.peak.read()]));
    return { master: { ...this.masterPeak.read(), power: this.masterLoudness.power() }, tracks };
  }

  private async facts(doc: VideoDocument): Promise<void> {
    const [speech] = await Promise.all([
      speechOfTriggers(doc, (assetId) => this.analysis(assetId)),
      ...soundAssetIds(doc).map((assetId) =>
        this.buffer(assetId).then((buffer) => {
          if (buffer) this.lengths.set(assetId, buffer.duration * 1000);
        }),
      ),
    ]);
    for (const [assetId, analysis] of speech) this.speech.set(assetId, analysis);
  }

  private bus(trackId: string): AudioNode | null {
    if (!this.context || !this.master) return null;
    const known = this.buses.get(trackId);
    if (known) return known.bus;
    const bus = stereoBus(this.context);
    bus.connect(this.master);
    this.buses.set(trackId, { bus, peak: new PeakTap(this.context, bus) });
    return bus;
  }

  play(doc: VideoDocument, positionAt: (clockSec: number) => number, options: AudioPlanOptions = {}): void {
    this.stop();
    if (!this.context || !this.master) return;
    const session = this.session;
    void this.facts(doc).then(() => {
      if (session !== this.session) return;
      const heard = this.withFacts(options);
      this.scheduled = audioVoiceKeys(doc, heard);
      this.scheduleFrom(doc, positionAt, heard, null);
    });
  }

  update(doc: VideoDocument, positionAt: (clockSec: number) => number, options: AudioPlanOptions = {}): void {
    if (!this.context || !this.master) return;
    const session = this.session;
    void this.facts(doc).then(() => {
      if (session !== this.session) return;
      this.apply(doc, positionAt, this.withFacts(options));
    });
  }

  private withFacts(options: AudioPlanOptions): AudioPlanOptions {
    return { ...options, speech: (assetId) => this.speech.get(assetId), sourceMs: (assetId) => this.lengths.get(assetId) };
  }

  private apply(doc: VideoDocument, positionAt: (clockSec: number) => number, options: AudioPlanOptions): void {
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
    this.masterPeak = null;
    this.masterLoudness = null;
    this.buses.clear();
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
      for (const node of voice.nodes) node.disconnect();
    }
    this.live = this.live.filter((entry) => !silenced.includes(entry));
  }

  private schedule(buffer: AudioBuffer, voice: AudioVoice, when: number): void {
    const destination = this.bus(voice.trackId);
    if (!this.context || !destination) return;
    const live = scheduleVoice(this.context, destination, buffer, voice, when);
    if (!live) return;
    const entry = { clipId: voice.clipId, voice: live };
    this.live.push(entry);
    live.source.onended = () => {
      this.live = this.live.filter((candidate) => candidate !== entry);
      live.source.disconnect();
      for (const node of live.nodes) node.disconnect();
    };
  }
}
