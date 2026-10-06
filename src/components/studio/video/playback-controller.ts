"use client";

import { msOfFrame, frameOf, type VideoDocument } from "@/lib/studio/document";
import {
  type AudioPlanOptions,
  clampPosition,
  clockPosition,
  clockReachedEdge,
  idleClock,
  shuttleRate,
  startClock,
  type PlaybackClock,
  type ShuttleDirection,
} from "@/lib/studio/playback";

import type { VideoViewStore } from "./view-store";

export interface PlaybackAudio {
  now: () => number;
  prepare: () => Promise<void>;
  play: (doc: VideoDocument, fromMs: number, position: () => number, options?: AudioPlanOptions) => void;
  stop: () => void;
}

export interface FrameScheduler {
  request: (callback: () => void) => number;
  cancel: (handle: number) => void;
}

const browserFrames: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
};

export class PlaybackController {
  private clock: PlaybackClock = idleClock(0);
  private frame: number | null = null;

  constructor(
    private readonly view: VideoViewStore,
    private readonly audio: PlaybackAudio,
    private readonly document: () => VideoDocument,
    private readonly frames: FrameScheduler = browserFrames,
  ) {}

  position(): number {
    return clockPosition(this.clock, this.audio.now(), this.document().durationMs);
  }

  async play(rate: number = 1): Promise<void> {
    const durationMs = this.document().durationMs;
    if (durationMs <= 0 || rate === 0) return this.pause();
    let from = this.clock.playing ? this.position() : this.view.getState().playheadMs;
    if (rate > 0 && from >= durationMs) from = 0;
    if (rate < 0 && from <= 0) return this.pause();
    this.audio.stop();
    await this.audio.prepare();
    this.clock = startClock(clampPosition(from, durationMs), this.audio.now(), rate);
    if (rate === 1) this.audio.play(this.document(), this.clock.originMs, () => this.position(), this.audioOptions());
    this.view.setState({ playing: true, rate, playheadMs: this.clock.originMs });
    this.loop();
  }

  pause(): void {
    const position = this.clock.playing ? this.position() : this.view.getState().playheadMs;
    this.halt(position);
  }

  toggle(): void {
    if (this.clock.playing) this.pause();
    else void this.play(1);
  }

  shuttle(direction: ShuttleDirection): void {
    const next = shuttleRate(this.clock.rate, this.clock.playing, direction);
    if (next === 0) this.pause();
    else void this.play(next);
  }

  seek(ms: number): void {
    const target = clampPosition(Math.round(ms), Math.max(this.document().durationMs, 0));
    if (this.clock.playing) {
      const rate = this.clock.rate;
      this.halt(target);
      void this.play(rate);
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
    if (this.clock.rate === 1) {
      const position = this.position();
      this.audio.stop();
      this.clock = startClock(position, this.audio.now(), 1);
      this.audio.play(this.document(), position, () => this.position(), this.audioOptions());
    }
  }

  private audioOptions(): AudioPlanOptions {
    return { soloTrackIds: this.view.getState().soloTrackIds };
  }

  dispose(): void {
    if (this.frame !== null) this.frames.cancel(this.frame);
    this.frame = null;
    this.audio.stop();
  }

  private halt(positionMs: number): void {
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
      const durationMs = this.document().durationMs;
      if (clockReachedEdge(this.clock, this.audio.now(), durationMs)) {
        this.halt(this.clock.rate > 0 ? durationMs : 0);
        return;
      }
      this.view.setState({ playheadMs: Math.round(this.position()) });
      this.frame = this.frames.request(tick);
    };
    this.frame = this.frames.request(tick);
  }
}
