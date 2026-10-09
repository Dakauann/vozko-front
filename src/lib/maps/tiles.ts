import type { BBox, MapCell, MapLayerResponse, MapPlacement, MapPoint, SnappedViewport, TileRange, Viewport } from "./types";

export const MAX_TILE_ZOOM = 22;
export const MAX_MERCATOR_LAT = 85.0511287798066;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function latToMercatorY(lat: number): number {
  const clamped = clamp(lat, -MAX_MERCATOR_LAT, MAX_MERCATOR_LAT);
  return Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360));
}

export function mercatorYToLat(y: number): number {
  return ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;
}

function tileX(lng: number, zoom: number): number {
  const tiles = 2 ** zoom;
  return clamp(Math.floor(((clamp(lng, -180, 180) + 180) / 360) * tiles), 0, tiles - 1);
}

function tileY(lat: number, zoom: number): number {
  const tiles = 2 ** zoom;
  return clamp(Math.floor(((1 - latToMercatorY(lat) / Math.PI) / 2) * tiles), 0, tiles - 1);
}

function tileWest(x: number, zoom: number): number {
  return (x / 2 ** zoom) * 360 - 180;
}

function tileNorth(y: number, zoom: number): number {
  return mercatorYToLat(Math.PI * (1 - (2 * y) / 2 ** zoom));
}

function validBBox(bbox: BBox): boolean {
  const values = [bbox.south, bbox.west, bbox.north, bbox.east];
  return values.every(Number.isFinite) && bbox.south < bbox.north && bbox.west < bbox.east;
}

export function tileKey(tiles: TileRange): string {
  return `${tiles.zoom}/${tiles.minX}:${tiles.maxX}/${tiles.minY}:${tiles.maxY}`;
}

export function snapViewport(viewport: Viewport): SnappedViewport | null {
  if (!validBBox(viewport.bbox) || !Number.isFinite(viewport.zoom)) return null;
  const zoom = clamp(Math.floor(viewport.zoom), 0, MAX_TILE_ZOOM);
  const tiles: TileRange = {
    zoom,
    minX: tileX(viewport.bbox.west, zoom),
    maxX: tileX(viewport.bbox.east, zoom),
    minY: tileY(viewport.bbox.north, zoom),
    maxY: tileY(viewport.bbox.south, zoom),
  };
  return {
    zoom,
    tiles,
    key: tileKey(tiles),
    bbox: {
      west: tileWest(tiles.minX, zoom),
      east: tileWest(tiles.maxX + 1, zoom),
      north: tileNorth(tiles.minY, zoom),
      south: tileNorth(tiles.maxY + 1, zoom),
    },
  };
}

export interface MapTile {
  z: number;
  x: number;
  y: number;
}

export function tileId(tile: MapTile): string {
  return `${tile.z}/${tile.x}/${tile.y}`;
}

export function visibleTiles(viewport: SnappedViewport): MapTile[] {
  const { zoom, minX, maxX, minY, maxY } = viewport.tiles;
  const centreX = (minX + maxX) / 2;
  const centreY = (minY + maxY) / 2;
  const tiles: MapTile[] = [];
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) tiles.push({ z: zoom, x, y });
  }
  const distance = (tile: MapTile) => Math.hypot(tile.x - centreX, tile.y - centreY);
  return tiles.sort((a, b) => distance(a) - distance(b) || a.y - b.y || a.x - b.x);
}

interface CellSum {
  ix: number;
  iy: number;
  placement: MapPlacement;
  count: number;
  latTotal: number;
  lngTotal: number;
}

function joinPoints(answers: readonly MapLayerResponse[]): MapLayerResponse {
  const byId = new Map<string, MapPoint>();
  for (const answer of answers) {
    if (answer.kind !== "points") continue;
    for (const point of answer.points) if (!byId.has(point.id)) byId.set(point.id, point);
  }
  return { kind: "points", points: [...byId.values()] };
}

function sumCells(answers: readonly MapLayerResponse[], size: number): MapLayerResponse {
  const sums = new Map<string, CellSum>();
  const add = (spot: { placement: MapPlacement; count: number; lat: number; lng: number }, ix: number, iy: number) => {
    const key = `${spot.placement}:${ix}:${iy}`;
    const sum = sums.get(key) ?? { ix, iy, placement: spot.placement, count: 0, latTotal: 0, lngTotal: 0 };
    sum.count += spot.count;
    sum.latTotal += spot.lat * spot.count;
    sum.lngTotal += spot.lng * spot.count;
    sums.set(key, sum);
  };
  const binned = (spot: { lat: number; lng: number }) => [Math.floor(spot.lng / size), Math.floor(spot.lat / size)] as const;
  for (const answer of answers) {
    if (answer.kind === "points") {
      for (const point of answer.points) add(point, ...binned(point));
    } else if (answer.cellSizeDegrees === size) {
      for (const cell of answer.cells) add(cell, cell.ix, cell.iy);
    } else {
      for (const cell of answer.cells) add(cell, ...binned(cell));
    }
  }
  const cells: MapCell[] = [...sums.values()]
    .filter((sum) => sum.count > 0)
    .map((sum) => ({ ix: sum.ix, iy: sum.iy, placement: sum.placement, count: sum.count, lat: sum.latTotal / sum.count, lng: sum.lngTotal / sum.count }));
  return { kind: "cells", cellSizeDegrees: size, cells };
}

export function mergeTileLayers(answers: readonly MapLayerResponse[]): MapLayerResponse | null {
  if (answers.length === 0) return null;
  const firstCells = answers.find((answer) => answer.kind === "cells");
  return firstCells?.kind === "cells" ? sumCells(answers, firstCells.cellSizeDegrees) : joinPoints(answers);
}

export const MAX_TILE_REQUESTS = 6;

export interface TileLimiter {
  run<T>(signal: AbortSignal | undefined, task: () => Promise<T>): Promise<T>;
}

function cancelled(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("tile request cancelled", "AbortError");
}

export function createTileLimiter(max: number = MAX_TILE_REQUESTS): TileLimiter {
  let running = 0;
  const waiting: Array<() => void> = [];

  const next = () => {
    while (running < max && waiting.length > 0) waiting.shift()?.();
  };

  return {
    run<T>(signal: AbortSignal | undefined, task: () => Promise<T>): Promise<T> {
      if (signal?.aborted) return Promise.reject(cancelled(signal));
      return new Promise<T>((resolve, reject) => {
        const start = () => {
          signal?.removeEventListener("abort", drop);
          running += 1;
          let work: Promise<T>;
          try {
            work = task();
          } catch (error: unknown) {
            work = Promise.reject(error);
          }
          work.then(resolve, reject).finally(() => {
            running -= 1;
            next();
          });
        };
        const drop = () => {
          const index = waiting.indexOf(start);
          if (index >= 0) waiting.splice(index, 1);
          if (signal) reject(cancelled(signal));
        };
        signal?.addEventListener("abort", drop, { once: true });
        waiting.push(start);
        next();
      });
    },
  };
}
