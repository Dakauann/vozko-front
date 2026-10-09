import { circleRing64, distanceMeters, isValidPosition } from "./geometry";
import { latToMercatorY, mercatorYToLat } from "./tiles";
import type { AreaShape, LatLng } from "./types";

export interface DrawnFeature {
  type: "Feature";
  geometry: { type: string; coordinates: unknown };
  properties?: Record<string, unknown> | null;
}

function toPosition(coordinate: unknown): LatLng | null {
  if (!Array.isArray(coordinate) || coordinate.length < 2) return null;
  const [lng, lat] = coordinate;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  const position = { lat, lng };
  return isValidPosition(position) ? position : null;
}

function openRing(feature: DrawnFeature): LatLng[] | null {
  if (feature.geometry?.type !== "Polygon" || !Array.isArray(feature.geometry.coordinates)) return null;
  const outer = feature.geometry.coordinates[0];
  if (!Array.isArray(outer)) return null;
  const ring: LatLng[] = [];
  for (const coordinate of outer) {
    const position = toPosition(coordinate);
    if (!position) return null;
    ring.push(position);
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (ring.length > 1 && first.lat === last.lat && first.lng === last.lng) ring.pop();
  return ring.length >= 3 ? ring : null;
}

function bounds(ring: LatLng[]) {
  return {
    south: Math.min(...ring.map((p) => p.lat)),
    north: Math.max(...ring.map((p) => p.lat)),
    west: Math.min(...ring.map((p) => p.lng)),
    east: Math.max(...ring.map((p) => p.lng)),
  };
}

function rectangle(ring: LatLng[]): AreaShape | null {
  const { south, north, west, east } = bounds(ring);
  if (south === north || west === east) return null;
  return {
    kind: "rectangle",
    ring: [
      { lat: south, lng: west },
      { lat: south, lng: east },
      { lat: north, lng: east },
      { lat: north, lng: west },
    ],
  };
}

function circle(ring: LatLng[], radiusKilometers: unknown): AreaShape | null {
  const { south, north, west, east } = bounds(ring);
  const center = {
    lat: mercatorYToLat((latToMercatorY(south) + latToMercatorY(north)) / 2),
    lng: (west + east) / 2,
  };
  if (!isValidPosition(center)) return null;
  const radiusM =
    radiusKilometers === undefined || radiusKilometers === null
      ? distanceMeters(center, ring[0])
      : typeof radiusKilometers === "number"
        ? radiusKilometers * 1000
        : Number.NaN;
  if (!Number.isFinite(radiusM) || radiusM <= 0) return null;
  return { kind: "circle", center, radiusM };
}

export function drawnFeatureToArea(feature: DrawnFeature | null | undefined): AreaShape | null {
  if (!feature) return null;
  const ring = openRing(feature);
  if (!ring) return null;
  switch (feature.properties?.mode) {
    case "polygon":
      return { kind: "polygon", ring };
    case "rectangle":
      return rectangle(ring);
    case "circle":
      return circle(ring, feature.properties?.radiusKilometers);
    default:
      return null;
  }
}

export function areaOutline(area: AreaShape): Array<[number, number]> {
  const ring = area.kind === "circle" ? circleRing64(area.center, area.radiusM) : area.ring;
  const outline = ring.map((p): [number, number] => [p.lng, p.lat]);
  if (outline.length > 0) outline.push(outline[0]);
  return outline;
}

export const RADIUS_CHOICES_M = [500, 1000, 2000, 5000] as const;
