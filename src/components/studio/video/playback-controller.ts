"use client";

import { msOfFrame, frameOf, type VideoDocument } from "@/lib/studio/document";
import {
  type AudioPlanOptions,
  audibleRate,
  clampPosition,
  clockPosition,
  clockReachedEdge,
  idleClock,
  shuttleRate,
  startClock,
  type PlaybackClock,
  type ShuttleDirection,
} from "@/lib/studio/playback";
import { insideSpan, playSpan, playStart, workArea, type TimeSpan } from "@/lib/studio/work-area";

import type { VideoViewStore } from "./view-store";

export interface PlaybackAudio {
  heard: () => number;
  startsAt: () => number;
  prepare: () => Promise<void>;
  play: (doc: VideoDocument, positionAt: (clockSec: number) => number, options?: AudioPlanOptions) => void;
  update: (doc: VideoDocument, positionAt: (clockSec: number) => number, options?: AudioPlanOptions) => void;
  stop: () => void;
}

export interface FrameScheduler {
  request: (callback: () => void) => number;
  cancel: (handle: number) => void;
}

export const browserFrames: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
};

export class PlaybackController {
  private clock: PlaybackClock = idleClock(0);
  private frame: number | null = null;
  private rangeOnly = false;
  private generation = 0;

  constructor(
    private readonly view: VideoViewStore,
    private readonly audio: PlaybackAudio,
    private readonly document: () => VideoDocument,
    private readonly frames: FrameScheduler = browserFrames,
  ) {}

  position(): number {
    return this.positionAt(this.audio.heard());
  }

  async play(rate: number = 1): Promise<void> {
    this.rangeOnly = false;
    return this.run(rate);
  }

  playRange(): boolean {
    const { range, previewRate } = this.view.getState();
    const area = workArea(range, this.document().durationMs);
    if (!area) return false;
    this.rangeOnly = true;
    void this.run(previewRate, area.startMs);
    return true;
  }

  setLoop(loop: boolean): void {
    this.view.setState({ loop });
  }

  pause(): void {
    const position = this.clock.playing ? this.position() : this.view.getState().playheadMs;
    this.halt(position);
  }

  toggle(): void {
    if (this.clock.playing) this.pause();
    else void this.play(this.view.getState().previewRate);
  }

  setPreviewRate(rate: number): void {
    this.view.setState({ previewRate: rate });
    if (this.clock.playing && this.clock.rate > 0) void this.run(rate);
  }

  shuttle(direction: ShuttleDirection): void {
    const next = shuttleRate(this.clock.rate, this.clock.playing, direction);
    if (next === 0) this.pause();
    else void this.run(next);
  }

  seek(ms: number): void {
    const target = clampPosition(Math.round(ms), Math.max(this.document().durationMs, 0));
    if (this.clock.playing) {
      const rate = this.clock.rate;
      const keep = this.rangeOnly && insideSpan(this.span(), target);
      this.halt(target);
      this.rangeOnly = keep;
      void this.run(rate);
      return;
    }
    this.clock = idleClock(target);
    this.view.setState({ playheadMs: target });
  }

  stepFrames(frames: number): void {
    this.seek(msOfFrame(frameOf(this.view.getState().playheadMs) + frames));
  }

  documentChanged(): void {
    if (!this.clock.playing) {
      const durationMs = this.document().durationMs;
      const playhead = this.view.getState().playheadMs;
      if (playhead > durationMs) this.seek(durationMs);
      return;
    }
    if (audibleRate(this.clock.rate)) this.audio.update(this.document(), (clockSec) => this.positionAt(clockSec), this.audioOptions());
  }

  private span(): TimeSpan {
    return playSpan(this.view.getState().range, this.document().durationMs, this.rangeOnly);
  }

  private async run(rate: number, fromMs?: number): Promise<void> {
    const durationMs = this.document().durationMs;
    if (durationMs <= 0 || rate === 0) return this.pause();
    const current = this.clock.playing ? this.position() : this.view.getState().playheadMs;
    const from = fromMs ?? playStart(this.span(), current, rate, this.view.getState().loop);
    if (from === null) return this.pause();
    const generation = ++this.generation;
    this.audio.stop();
    await this.audio.prepare();
    if (generation !== this.generation) return;
    this.clock = startClock(clampPosition(from, durationMs), this.audio.startsAt(), rate);
    if (audibleRate(rate)) this.playAudio();
    this.view.setState({ playing: true, rate, playheadMs: this.clock.originMs });
    this.loop();
  }

  private positionAt(clockSec: number): number {
    return clockPosition(this.clock, clockSec, this.document().durationMs);
  }

  private audioOptions(): AudioPlanOptions {
    return { soloTrackIds: this.view.getState().soloTrackIds, rate: this.clock.rate };
  }

  private playAudio(): void {
    this.audio.play(this.document(), (clockSec) => this.positionAt(clockSec), this.audioOptions());
  }

  dispose(): void {
    this.generation += 1;
    if (this.frame !== null) this.frames.cancel(this.frame);
    this.frame = null;
    this.audio.stop();
  }

  private halt(positionMs: number): void {
    this.generation += 1;
    this.rangeOnly = false;
    if (this.frame !== null) this.frames.cancel(this.frame);
    this.frame = null;
    this.audio.stop();
    this.clock = idleClock(positionMs);
    this.view.setState({ playing: false, rate: 0, playheadMs: positionMs });
  }

  private loop(): void {
    if (this.frame !== null) this.frames.cancel(this.frame);
    const tick = () => {
      this.frame = null;
      if (!this.clock.playing) return;
      const span = this.span();
      if (clockReachedEdge(this.clock, this.audio.heard(), span)) {
        if (this.view.getState().loop) void this.run(this.clock.rate);
        else this.halt(this.clock.rate > 0 ? span.endMs : span.startMs);
        return;
      }
      this.view.setState({ playheadMs: Math.round(this.position()) });
      this.frame = this.frames.request(tick);
    };
    this.frame = this.frames.request(tick);
  }
}
