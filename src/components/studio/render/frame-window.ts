"use client";

import { RenderTexture, Sprite, type Renderer as PixiRenderer, type Texture } from "pixi.js";

import { windowPlacement, type FrameWindow } from "@/lib/studio/point-track";

interface WindowedFrame {
  target: RenderTexture;
  sprite: Sprite;
  lastUsed: number;
}

export class WindowedFrames {
  private readonly frames = new Map<string, WindowedFrame>();

  constructor(private readonly gpu: PixiRenderer) {}

  draw(clipId: string, texture: Texture, window: FrameWindow, frame: number): Texture {
    const width = texture.source.pixelWidth;
    const height = texture.source.pixelHeight;
    if (width <= 0 || height <= 0) return texture;
    let known = this.frames.get(clipId);
    if (known && (known.target.source.pixelWidth !== width || known.target.source.pixelHeight !== height)) {
      this.release(clipId, known);
      known = undefined;
    }
    if (!known) {
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      known = { target: RenderTexture.create({ width, height, resolution: 1 }), sprite, lastUsed: frame };
      this.frames.set(clipId, known);
    }
    const placed = windowPlacement(window, width, height);
    known.lastUsed = frame;
    known.sprite.texture = texture;
    known.sprite.setSize(width, height);
    known.sprite.position.set(placed.x, placed.y);
    known.sprite.rotation = placed.rotation;
    known.sprite.scale.set(known.sprite.scale.x * placed.scale, known.sprite.scale.y * placed.scale);
    this.gpu.render({ container: known.sprite, target: known.target, clear: true, clearColor: [0, 0, 0, 0] });
    return known.target;
  }

  prune(frame: number, staleFrames: number): void {
    for (const [clipId, known] of this.frames) if (frame - known.lastUsed > staleFrames) this.release(clipId, known);
  }

  destroy(): void {
    for (const [clipId, known] of this.frames) this.release(clipId, known);
  }

  private release(clipId: string, known: WindowedFrame): void {
    this.frames.delete(clipId);
    known.sprite.destroy();
    known.target.destroy(true);
  }
}
