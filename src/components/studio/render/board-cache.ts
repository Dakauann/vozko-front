import { Container, Matrix, RenderTexture, Sprite, Texture, type Renderer as PixiRenderer } from "pixi.js";

import type { GestureSplit } from "@/lib/studio/render/gesture-split";
import type { Camera, Viewport } from "@/lib/studio/render/renderer";

export interface CachedLayer {
  object: Container;
  index: number;
}

export interface CachedBoard {
  root: Container;
  content: Container;
  layers: readonly CachedLayer[];
  origin: { x: number; y: number };
  size: { width: number; height: number };
  paint: (shown: boolean) => void;
  halo: (shown: boolean) => void;
}

interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const TRANSPARENT: [number, number, number, number] = [0, 0, 0, 0];

function screenRect(board: CachedBoard, camera: Camera, viewport: Viewport): ScreenRect | null {
  const r = viewport.resolution;
  const left = Math.max(0, Math.floor((camera.x + board.origin.x * camera.scale) * r) / r);
  const top = Math.max(0, Math.floor((camera.y + board.origin.y * camera.scale) * r) / r);
  const right = Math.min(viewport.width, Math.ceil((camera.x + (board.origin.x + board.size.width) * camera.scale) * r) / r);
  const bottom = Math.min(viewport.height, Math.ceil((camera.y + (board.origin.y + board.size.height) * camera.scale) * r) / r);
  return right > left && bottom > top ? { x: left, y: top, width: right - left, height: bottom - top } : null;
}

class Snapshot {
  readonly sprite = new Sprite(Texture.EMPTY);
  private texture: RenderTexture | null = null;

  constructor() {
    this.sprite.renderable = false;
  }

  draw(gpu: PixiRenderer, board: CachedBoard, rect: ScreenRect, camera: Camera, resolution: number, antialias: boolean): void {
    const held = this.texture;
    const reusable = held !== null && held.source.width === rect.width && held.source.height === rect.height && held.source.resolution === resolution;
    if (!reusable) held?.destroy(true);
    const target = reusable ? held : RenderTexture.create({ width: rect.width, height: rect.height, resolution, antialias });
    this.texture = target;
    const transform = new Matrix(camera.scale, 0, 0, camera.scale, camera.x + board.origin.x * camera.scale - rect.x, camera.y + board.origin.y * camera.scale - rect.y);
    gpu.render({ container: board.root, target, clear: true, clearColor: TRANSPARENT, transform });
    this.sprite.texture = target;
    this.sprite.position.set((rect.x - camera.x) / camera.scale - board.origin.x, (rect.y - camera.y) / camera.scale - board.origin.y);
    this.sprite.scale.set(1 / camera.scale);
  }

  seatUnder(board: CachedBoard): void {
    if (this.sprite.parent !== board.root) board.root.addChildAt(this.sprite, board.root.getChildIndex(board.content));
  }

  seatOver(board: CachedBoard): void {
    if (this.sprite.parent !== board.root) board.root.addChild(this.sprite);
  }

  shown(visible: boolean): void {
    this.sprite.renderable = visible;
  }

  destroy(): void {
    this.sprite.removeFromParent();
    this.sprite.destroy();
    this.texture?.destroy(true);
    this.texture = null;
  }
}

export class BoardCache {
  private readonly below = new Snapshot();
  private readonly above = new Snapshot();
  private key: string | null = null;
  private split: GestureSplit | null = null;
  private count = 0;

  constructor(
    private readonly gpu: PixiRenderer,
    private readonly antialias: boolean,
  ) {}

  get active(): boolean {
    return this.split !== null;
  }

  apply(board: CachedBoard, split: GestureSplit | null, count: number, key: string, camera: Camera, viewport: Viewport): void {
    if (!split) {
      this.release(board);
      return;
    }
    this.below.seatUnder(board);
    this.above.seatOver(board);
    const rect = screenRect(board, camera, viewport);
    const stale = key !== this.key || split.below !== this.split?.below || split.above !== this.split?.above || count !== this.count;
    if (rect && stale) this.redraw(board, split, count, rect, camera, viewport.resolution);
    this.key = rect ? key : null;
    this.split = split;
    this.count = count;
    this.showLive(board, split, count, rect !== null);
  }

  release(board: CachedBoard): void {
    if (this.split === null) return;
    this.key = null;
    this.split = null;
    this.below.shown(false);
    this.above.shown(false);
    board.paint(true);
    board.halo(true);
    for (const layer of board.layers) layer.object.renderable = true;
  }

  destroy(): void {
    this.below.destroy();
    this.above.destroy();
  }

  private redraw(board: CachedBoard, split: GestureSplit, count: number, rect: ScreenRect, camera: Camera, resolution: number): void {
    this.below.shown(false);
    this.above.shown(false);
    board.halo(false);
    if (split.below > 0) {
      board.paint(true);
      this.only(board, (index) => index < split.below);
      this.below.draw(this.gpu, board, rect, camera, resolution, this.antialias);
    }
    if (split.above < count) {
      board.paint(false);
      this.only(board, (index) => index >= split.above);
      this.above.draw(this.gpu, board, rect, camera, resolution, this.antialias);
    }
    board.halo(true);
  }

  private only(board: CachedBoard, wanted: (index: number) => boolean): void {
    for (const layer of board.layers) layer.object.renderable = wanted(layer.index);
  }

  private showLive(board: CachedBoard, split: GestureSplit, count: number, onScreen: boolean): void {
    const cachedBelow = split.below > 0;
    const cachedAbove = split.above < count;
    board.paint(!cachedBelow);
    this.below.shown(cachedBelow && onScreen);
    this.above.shown(cachedAbove && onScreen);
    this.only(board, (index) => !(cachedBelow && index < split.below) && !(cachedAbove && index >= split.above));
  }
}
