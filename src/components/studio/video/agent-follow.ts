"use client";

import { glidePosition, GLIDE_MS } from "@/lib/studio/agent/follow";

import type { FrameScheduler } from "./playback-controller";
import type { VideoViewStore } from "./view-store";

export interface FollowDeps {
  view: VideoViewStore;
  seek: (ms: number) => void;
  frames: FrameScheduler;
  now: () => number;
  reduceMotion: () => boolean;
}

export class AgentFollower {
  private following = true;
  private writing = false;
  private animation: number | null = null;

  constructor(private readonly deps: FollowDeps) {}

  attach(): () => void {
    const unsubscribe = this.deps.view.subscribe((state, previous) => {
      if (this.writing) return;
      if (state.playing || state.playheadMs !== previous.playheadMs) this.release();
    });
    return () => {
      unsubscribe();
      this.stopGlide();
    };
  }

  resume(): void {
    this.following = true;
  }

  toward(ms: number): void {
    if (!this.following) return;
    this.stopGlide();
    const from = this.deps.view.getState().playheadMs;
    if (this.deps.reduceMotion()) {
      this.write(() => this.deps.seek(ms));
      return;
    }
    const started = this.deps.now();
    this.write(() => this.deps.view.setState({ agentFollowing: true }));
    const tick = () => {
      const progress = (this.deps.now() - started) / GLIDE_MS;
      this.write(() => this.deps.seek(glidePosition(from, ms, progress)));
      if (progress < 1) this.animation = this.deps.frames.request(tick);
      else this.stopGlide();
    };
    this.animation = this.deps.frames.request(tick);
  }

  private release(): void {
    this.following = false;
    this.stopGlide();
  }

  private stopGlide(): void {
    if (this.animation !== null) this.deps.frames.cancel(this.animation);
    this.animation = null;
    if (this.deps.view.getState().agentFollowing) this.write(() => this.deps.view.setState({ agentFollowing: false }));
  }

  private write(change: () => void): void {
    this.writing = true;
    try {
      change();
    } finally {
      this.writing = false;
    }
  }
}
