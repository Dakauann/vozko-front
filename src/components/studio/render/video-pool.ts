"use client";

import { syncVideo } from "@/lib/studio/playback";
import type { SceneVideo, VideoSource } from "@/lib/studio/scene/scene";

import type { LoadedMediaFile } from "../canvas/media-files";

const HAVE_CURRENT_DATA = 2;

export interface PlaybackState {
  playing: boolean;
  rate: number;
}

interface Entry {
  video: HTMLVideoElement;
  assetId: string;
  sourceMs: number;
  visible: boolean;
  loaded: boolean;
}

export class VideoPool {
  private entries = new Map<string, Entry>();
  private state: PlaybackState = { playing: false, rate: 1 };

  constructor(
    private readonly files: (assetId: string) => Promise<LoadedMediaFile | null>,
    private readonly create: () => HTMLVideoElement,
    private readonly onFrame: () => void,
  ) {}

  sync(clips: readonly SceneVideo[], state: PlaybackState): void {
    this.state = state;
    for (const [clipId, entry] of this.entries) {
      if (!clips.some((clip) => clip.source.clipId === clipId && clip.source.assetId === entry.assetId)) this.release(clipId);
    }
    for (const clip of clips) {
      const entry = this.entries.get(clip.source.clipId) ?? this.open(clip.source);
      entry.sourceMs = clip.source.sourceMs;
      entry.visible = clip.visible;
      this.apply(entry);
    }
  }

  element(clipId: string): HTMLVideoElement | null {
    const entry = this.entries.get(clipId);
    return entry && entry.loaded && entry.video.readyState >= HAVE_CURRENT_DATA ? entry.video : null;
  }

  dispose(): void {
    for (const clipId of [...this.entries.keys()]) this.release(clipId);
  }

  private open(source: VideoSource): Entry {
    const video = this.create();
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.disablePictureInPicture = true;
    const entry: Entry = { video, assetId: source.assetId, sourceMs: source.sourceMs, visible: false, loaded: false };
    const refresh = () => {
      this.apply(entry);
      this.onFrame();
    };
    video.addEventListener("loadeddata", refresh);
    video.addEventListener("seeked", refresh);
    this.entries.set(source.clipId, entry);
    void this.files(source.assetId).then((file) => {
      if (this.entries.get(source.clipId) !== entry || !file || !file.contentType.startsWith("video/")) return;
      video.src = file.url;
      entry.loaded = true;
      this.apply(entry);
    });
    return entry;
  }

  private apply(entry: Entry): void {
    const video = entry.video;
    if (!entry.loaded || video.readyState < 1) return;
    const command = syncVideo(video.currentTime * 1000, entry.sourceMs, { playing: this.state.playing, rate: this.state.rate, active: entry.visible });
    if (command.seekToMs !== null && !video.seeking) video.currentTime = command.seekToMs / 1000;
    if (video.playbackRate !== command.playbackRate) video.playbackRate = command.playbackRate;
    if (command.play && video.paused) void video.play().catch(() => undefined);
    if (!command.play && !video.paused) video.pause();
  }

  private release(clipId: string): void {
    const entry = this.entries.get(clipId);
    if (!entry) return;
    this.entries.delete(clipId);
    entry.video.pause();
    entry.video.removeAttribute("src");
    entry.video.load();
  }
}
