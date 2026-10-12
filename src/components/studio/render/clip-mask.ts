import { Container, Sprite, Texture } from "pixi.js";

import { maskRasterSize, rasterizeMasks, type Mask } from "@/lib/studio/masks";
import type { SceneBox } from "@/lib/studio/scene/scene";

export class MaskTexture {
  private canvas: HTMLCanvasElement | null = null;
  private key = "";
  private current: Texture = Texture.EMPTY;

  update(masks: readonly Mask[], box: Pick<SceneBox, "width" | "height">, scale: number): Texture {
    const size = maskRasterSize(box.width, box.height, scale);
    const key = `${size.width}x${size.height}:${JSON.stringify(masks)}`;
    if (key !== this.key) {
      this.paint(masks, size.width, size.height);
      this.key = key;
    }
    return this.current;
  }

  destroy(): void {
    if (this.current !== Texture.EMPTY) this.current.destroy(true);
    this.current = Texture.EMPTY;
    this.canvas = null;
  }

  private paint(masks: readonly Mask[], width: number, height: number): void {
    const resized = !this.canvas || this.canvas.width !== width || this.canvas.height !== height;
    const canvas = (this.canvas ??= document.createElement("canvas"));
    if (resized) {
      canvas.width = width;
      canvas.height = height;
    }
    canvas.getContext("2d")!.putImageData(new ImageData(rasterizeMasks(masks, width, height), width, height), 0, 0);
    if (!resized && this.current !== Texture.EMPTY) {
      this.current.source.update();
      return;
    }
    if (this.current !== Texture.EMPTY) this.current.destroy(true);
    this.current = Texture.from(canvas, true);
  }
}

export class ClipMask {
  readonly holder = new Container();
  readonly inner = new Container({ sortableChildren: true });
  private readonly cover = new Sprite(Texture.EMPTY);
  private readonly raster = new MaskTexture();

  constructor() {
    this.cover.anchor.set(0.5);
    this.holder.addChild(this.inner, this.cover);
    this.inner.mask = this.cover;
  }

  update(masks: readonly Mask[], box: SceneBox, scale: number): void {
    this.cover.texture = this.raster.update(masks, box, scale);
    this.cover.position.set(box.x, box.y);
    this.cover.angle = box.rotation;
    this.cover.setSize(box.width, box.height);
  }

  release(home: Container): void {
    for (const child of [...this.inner.children]) home.addChild(child);
    this.destroy();
  }

  destroy(): void {
    this.inner.mask = null;
    this.cover.texture = Texture.EMPTY;
    this.raster.destroy();
    this.cover.destroy();
    this.inner.destroy({ children: false });
    this.holder.destroy({ children: false });
  }
}
