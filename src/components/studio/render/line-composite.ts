"use client";

import { CanvasSource, Texture } from "pixi.js";

import { drawLineFrame } from "@/lib/studio/line-draw";
import { lineFrame } from "@/lib/studio/line-geometry";
import type { LineNode, RasterSource } from "@/lib/studio/scene/scene";

interface CompositePart {
  image: CanvasImageSource;
  weight: number;
  id: number;
}

export class LineComposite {
  private readonly canvas = document.createElement("canvas");
  private texture: Texture | null = null;
  private key = "";

  draw(line: LineNode, source: RasterSource, ratio: number, parts: readonly CompositePart[]): Texture {
    const width = Math.max(1, Math.round(source.widthPx * ratio));
    const height = Math.max(1, Math.round(source.heightPx * ratio));
    const key = `${line.key}|${ratio}|${width}x${height}|${parts.map((part) => `${part.id}:${part.weight}`).join(",")}`;
    if (this.texture && key === this.key) return this.texture;
    if (!this.texture || this.canvas.width !== width || this.canvas.height !== height) {
      this.texture?.destroy(true);
      this.canvas.width = width;
      this.canvas.height = height;
      this.texture = new Texture({ source: new CanvasSource({ resource: this.canvas }) });
    }
    this.paint(line, source, ratio, parts, width, height);
    this.texture.source.update();
    this.key = key;
    return this.texture;
  }

  destroy(): void {
    this.texture?.destroy(true);
    this.texture = null;
  }

  private paint(line: LineNode, source: RasterSource, ratio: number, parts: readonly CompositePart[], width: number, height: number): void {
    const ctx = this.canvas.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const total = parts.reduce((sum, part) => sum + part.weight, 0);
    ctx.globalCompositeOperation = parts.length > 1 ? "lighter" : "source-over";
    for (const part of parts) {
      ctx.globalAlpha = total > 0 ? part.weight / total : 0;
      ctx.drawImage(part.image, 0, 0, width, height);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawLineFrame(ctx, lineFrame({ layer: line.layer, widthPx: source.widthPx, heightPx: source.heightPx, line: line.resolved, color: line.color, step: line.step }));
  }
}
