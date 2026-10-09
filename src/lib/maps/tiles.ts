import type { BBox, SnappedViewport, TileRange, Viewport } from "./types";

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
