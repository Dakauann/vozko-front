"use client";

import { clearClip, IDLE_METER, METER_FLOOR_DB, meterIdle, ShortTermLoudness, stepMeter, type StereoMeter } from "@/lib/studio/live-meter";

import type { MeterFrame, StereoPeak } from "./audio-meters";
import type { FrameScheduler } from "./playback-controller";

export interface MasterReading {
  meter: StereoMeter;
  shortTermLufs: number | null;
}

export interface MeterHubDeps {
  read: () => MeterFrame | null;
  playing: () => boolean;
  frames: FrameScheduler;
  now: () => number;
}

const SILENT: StereoPeak = { left: 0, right: 0 };

export class MeterHub {
  private master: StereoMeter = IDLE_METER;
  private readonly shortTerm = new ShortTermLoudness();
  private readonly tracks = new Map<string, StereoMeter>();
  private readonly masterDraws = new Set<(reading: MasterReading) => void>();
  private readonly trackDraws = new Map<string, Set<(meter: StereoMeter) => void>>();
  private frame: number | null = null;

  constructor(private readonly deps: MeterHubDeps) {}

  onMaster(draw: (reading: MasterReading) => void): () => void {
    this.masterDraws.add(draw);
    draw(this.masterReading());
    this.wake();
    return () => {
      this.masterDraws.delete(draw);
      this.sleepWhenUnheard();
    };
  }

  onTrack(trackId: string, draw: (meter: StereoMeter) => void): () => void {
    const draws = this.trackDraws.get(trackId) ?? new Set();
    draws.add(draw);
    this.trackDraws.set(trackId, draws);
    draw(this.tracks.get(trackId) ?? IDLE_METER);
    this.wake();
    return () => {
      draws.delete(draw);
      if (draws.size === 0) {
        this.trackDraws.delete(trackId);
        this.tracks.delete(trackId);
      }
      this.sleepWhenUnheard();
    };
  }

  wake(): void {
    if (this.frame === null && this.heard()) this.frame = this.deps.frames.request(this.tick);
  }

  clearClips(): void {
    this.master = clearClip(this.master);
    for (const [trackId, meter] of this.tracks) this.tracks.set(trackId, clearClip(meter));
    this.draw();
  }

  dispose(): void {
    this.masterDraws.clear();
    this.trackDraws.clear();
    this.sleepWhenUnheard();
  }

  private heard(): boolean {
    return this.masterDraws.size > 0 || this.trackDraws.size > 0;
  }

  private sleepWhenUnheard(): void {
    if (this.heard() || this.frame === null) return;
    this.deps.frames.cancel(this.frame);
    this.frame = null;
  }

  private masterReading(): MasterReading {
    return { meter: this.master, shortTermLufs: this.shortTerm.lufs() };
  }

  private draw(): void {
    const reading = this.masterReading();
    for (const draw of this.masterDraws) draw(reading);
    for (const [trackId, draws] of this.trackDraws) {
      const meter = this.tracks.get(trackId) ?? IDLE_METER;
      for (const draw of draws) draw(meter);
    }
  }

  private settled(): boolean {
    const lufs = this.shortTerm.lufs();
    return meterIdle(this.master) && [...this.tracks.values()].every(meterIdle) && !(lufs !== null && lufs > METER_FLOOR_DB);
  }

  private readonly tick = () => {
    this.frame = null;
    const now = this.deps.now();
    const frame = this.deps.read();
    this.master = stepMeter(this.master, frame?.master ?? SILENT, now);
    this.shortTerm.push(frame?.master.power ?? 0, now);
    for (const trackId of this.trackDraws.keys()) this.tracks.set(trackId, stepMeter(this.tracks.get(trackId) ?? IDLE_METER, frame?.tracks[trackId] ?? SILENT, now));
    this.draw();
    if (this.deps.playing() || !this.settled()) this.wake();
  };
}
