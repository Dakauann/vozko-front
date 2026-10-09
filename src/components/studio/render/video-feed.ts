"use client";

import type { VideoPicture } from "@/lib/studio/render/renderer";
import type { SceneVideo } from "@/lib/studio/scene/scene";

import type { DecodedVideos } from "../media/decoded-videos";
import type { PlaybackState, VideoPool } from "./video-pool";

export interface VideoPictures {
  picture(clipId: string): VideoPicture | null;
}

export class VideoFeed implements VideoPictures {
  constructor(
    private readonly decoded: DecodedVideos,
    private readonly elements: VideoPool,
  ) {}

  sync(clips: readonly SceneVideo[], state: PlaybackState): void {
    this.elements.sync(this.decoded.sync(clips), state);
  }

  picture(clipId: string): VideoPicture | null {
    return this.decoded.picture(clipId) ?? this.elements.element(clipId);
  }

  dispose(): void {
    this.decoded.dispose();
    this.elements.dispose();
  }
}
