export const MIN_BUCKET_MS = 100;
export const DEFAULT_TILE_ASPECT = 16 / 9;

export interface FilmstripInput {
  clipWidthPx: number;
  heightPx: number;
  aspect?: number;
  trimInMs: number;
  durationMs: number;
  visibleFromPx: number;
  visibleToPx: number;
  sourceDurationMs?: number;
}

export interface FilmstripTile {
  index: number;
  leftPx: number;
  widthPx: number;
  sourceMs: number;
}

export function tileWidth(heightPx: number, aspect: number = DEFAULT_TILE_ASPECT): number {
  const ratio = Number.isFinite(aspect) && aspect > 0 ? Math.min(Math.max(aspect, 0.4), 2.5) : DEFAULT_TILE_ASPECT;
  return Math.max(16, Math.round(heightPx * ratio));
}

export function bucketFor(msPerTile: number): number {
  if (!(msPerTile > MIN_BUCKET_MS)) return MIN_BUCKET_MS;
  return MIN_BUCKET_MS * Math.pow(2, Math.ceil(Math.log2(msPerTile / MIN_BUCKET_MS)));
}

export function planFilmstrip(input: FilmstripInput): FilmstripTile[] {
  const { clipWidthPx, durationMs, trimInMs } = input;
  if (clipWidthPx <= 0 || durationMs <= 0 || input.heightPx <= 0) return [];
  const width = tileWidth(input.heightPx, input.aspect);
  const msPerPx = durationMs / clipWidthPx;
  const bucket = bucketFor(width * msPerPx);
  const lastSource = input.sourceDurationMs !== undefined ? Math.max(0, input.sourceDurationMs - 1) : Infinity;
  const first = Math.max(0, Math.floor(Math.max(0, input.visibleFromPx) / width));
  const last = Math.ceil(Math.min(clipWidthPx, input.visibleToPx) / width);
  const tiles: FilmstripTile[] = [];
  for (let index = first; index < last; index++) {
    const leftPx = index * width;
    const widthPx = Math.min(width, clipWidthPx - leftPx);
    if (widthPx <= 0) break;
    const centreMs = trimInMs + (leftPx + widthPx / 2) * msPerPx;
    tiles.push({ index, leftPx, widthPx, sourceMs: Math.min(Math.floor(centreMs / bucket) * bucket, lastSource) });
  }
  return tiles;
}

export class LruCache<K, V> {
  private readonly entries = new Map<K, V>();

  constructor(private readonly capacity: number) {}

  get(key: K): V | undefined {
    const value = this.entries.get(key);
    if (value === undefined) return undefined;
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    while (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next().value as K;
      this.entries.delete(oldest);
    }
  }

  has(key: K): boolean {
    return this.entries.has(key);
  }

  get size(): number {
    return this.entries.size;
  }
}

export function waveformBars(visibleWidthPx: number, barPx: number = 2): number {
  return Math.max(0, Math.floor(visibleWidthPx / Math.max(1, barPx)));
}
