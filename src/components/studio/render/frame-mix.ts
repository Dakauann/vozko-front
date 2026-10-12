"use client";

import { Container, RenderTexture, Sprite, type Renderer as PixiRenderer, type Texture } from "pixi.js";

interface MixedFrame {
  target: RenderTexture;
  stage: Container;
  base: Sprite;
  next: Sprite;
  lastUsed: number;
}

export class MixedFrames {
  private readonly frames = new Map<string, MixedFrame>();

  constructor(private readonly gpu: PixiRenderer) {}

  draw(clipId: string, base: Texture, next: Texture, weight: number, frame: number): Texture {
    const width = base.source.pixelWidth;
    const height = base.source.pixelHeight;
    if (width <= 0 || height <= 0) return base;
    let known = this.frames.get(clipId);
    if (known && (known.target.source.pixelWidth !== width || known.target.source.pixelHeight !== height)) {
      this.release(clipId, known);
      known = undefined;
    }
    if (!known) {
      const stage = new Container();
      const below = new Sprite(base);
      const above = new Sprite(next);
      stage.addChild(below, above);
      known = { target: RenderTexture.create({ width, height, resolution: 1 }), stage, base: below, next: above, lastUsed: frame };
      this.frames.set(clipId, known);
    }
    known.lastUsed = frame;
    known.base.texture = base;
    known.base.setSize(width, height);
    known.next.texture = next;
    known.next.setSize(width, height);
    known.next.alpha = weight;
    this.gpu.render({ container: known.stage, target: known.target, clear: true, clearColor: [0, 0, 0, 0] });
    return known.target;
  }

  prune(frame: number, staleFrames: number): void {
    for (const [clipId, known] of this.frames) if (frame - known.lastUsed > staleFrames) this.release(clipId, known);
  }

  destroy(): void {
    for (const [clipId, known] of this.frames) this.release(clipId, known);
  }

  private release(clipId: string, known: MixedFrame): void {
    this.frames.delete(clipId);
    known.stage.destroy({ children: true });
    known.target.destroy(true);
  }
}
