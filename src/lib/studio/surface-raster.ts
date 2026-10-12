import { applyPixelOp, composeCoverage, createPixels, LiveStroke, type PixelBuffer, type SurfaceSize } from "./pixel-raster";
import { unionRect, type PixelOp, type PixelRect, type PixelSurface, type StrokeOp } from "./pixel-surface";

const CHECKPOINT_EVERY = 8;
const MAX_CHECKPOINTS = 3;

interface Checkpoint {
  count: number;
  data: Uint8ClampedArray;
}

function copyPixels(source: PixelBuffer): PixelBuffer {
  return { width: source.width, height: source.height, data: Uint8ClampedArray.from(source.data) };
}

export class SurfaceRaster {
  readonly pixels: PixelBuffer;
  display: PixelBuffer;
  private ops: readonly PixelOp[] = [];
  private live: LiveStroke | null = null;
  private checkpoints: Checkpoint[] = [];

  constructor(readonly size: SurfaceSize) {
    this.pixels = createPixels(size.width, size.height);
    this.display = this.pixels;
  }

  get bytes(): number {
    const own = this.pixels.data.byteLength;
    const kept = this.checkpoints.reduce((sum, point) => sum + point.data.byteLength, 0);
    return own + kept + (this.display !== this.pixels ? this.display.data.byteLength : 0) + (this.live ? this.live.coverage.data.byteLength : 0);
  }

  fits(surface: Pick<PixelSurface, "width" | "height">): boolean {
    return surface.width === this.size.width && surface.height === this.size.height;
  }

  sync(surface: PixelSurface, live: StrokeOp | null): PixelRect | null {
    const committed = this.syncCommitted(surface.ops);
    if (!live) {
      if (!this.live) return committed;
      this.live = null;
      this.display = this.pixels;
      return this.whole();
    }
    if (committed || !this.live || this.live.op.id !== live.id) {
      const replaced = this.live !== null;
      this.live = new LiveStroke(live, this.size);
      this.display = copyPixels(this.pixels);
      if (this.live.bounds) composeCoverage(this.display, this.live.coverage, live, this.pixels, this.live.bounds);
      return committed || replaced ? this.whole() : this.live.bounds;
    }
    const grown = this.live.extend(live);
    if (grown) composeCoverage(this.display, this.live.coverage, live, this.pixels, grown);
    return grown;
  }

  private whole(): PixelRect {
    return { x: 0, y: 0, width: this.size.width, height: this.size.height };
  }

  private syncCommitted(ops: readonly PixelOp[]): PixelRect | null {
    if (ops === this.ops) return null;
    let shared = 0;
    while (shared < this.ops.length && shared < ops.length && this.ops[shared] === ops[shared]) shared++;
    const grows = shared === this.ops.length;
    const start = grows ? shared : this.restore(shared);
    let dirty: PixelRect | null = grows ? null : this.whole();
    for (let i = start; i < ops.length; i++) {
      dirty = unionRect(dirty, applyPixelOp(this.pixels, ops[i]));
      if ((i + 1) % CHECKPOINT_EVERY === 0) this.keep(i + 1);
    }
    this.ops = ops;
    return dirty;
  }

  private restore(shared: number): number {
    this.checkpoints = this.checkpoints.filter((point) => point.count <= shared);
    const point = this.checkpoints.at(-1);
    if (point) this.pixels.data.set(point.data);
    else this.pixels.data.fill(0);
    return point?.count ?? 0;
  }

  private keep(count: number): void {
    if (this.checkpoints.some((point) => point.count === count)) return;
    this.checkpoints = [...this.checkpoints, { count, data: Uint8ClampedArray.from(this.pixels.data) }].slice(-MAX_CHECKPOINTS);
  }
}
