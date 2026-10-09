import type { BBox, LatLng } from "./types";

export const EARTH_RADIUS_M = 6371008.8;
export const METERS_PER_DEGREE_LAT = (EARTH_RADIUS_M * Math.PI) / 180;
export const CIRCLE_VERTICES = 64;

export function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function isValidPosition(position: LatLng): boolean {
  const { lat, lng } = position;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  return !(lat === 0 && lng === 0);
}

export function distanceMeters(a: LatLng, b: LatLng): number {
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const dLat = lat2 - lat1;
  const dLng = radians(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function circleRing64(center: LatLng, radiusM: number): LatLng[] {
  const ring: LatLng[] = [];
  for (let i = 0; i < CIRCLE_VERTICES; i++) {
    const angle = (2 * Math.PI * i) / CIRCLE_VERTICES;
    const lat = center.lat + (radiusM * Math.cos(angle)) / METERS_PER_DEGREE_LAT;
    const lng = center.lng + (radiusM * Math.sin(angle)) / (METERS_PER_DEGREE_LAT * Math.cos(radians(lat)));
    ring.push({ lat, lng });
  }
  return ring;
}

export function offsetMeters(position: LatLng, northM: number, eastM: number): LatLng {
  const lat = northM === 0 ? position.lat : position.lat + northM / METERS_PER_DEGREE_LAT;
  const lng = eastM === 0 ? position.lng : position.lng + eastM / (METERS_PER_DEGREE_LAT * Math.cos(radians(position.lat)));
  return { lat, lng };
}

export const BRAZIL_BOUNDS: BBox = { south: -33.8, west: -74.1, north: 5.3, east: -28.8 };

const NATIONAL_SHARE = 0.6;

function validBox(bbox: BBox): boolean {
  return [bbox.south, bbox.west, bbox.north, bbox.east].every(Number.isFinite) && bbox.south <= bbox.north && bbox.west <= bbox.east;
}

function containedIn(inner: BBox, outer: BBox): boolean {
  return inner.south >= outer.south && inner.north <= outer.north && inner.west >= outer.west && inner.east <= outer.east;
}

function overlaps(a: BBox, b: BBox): boolean {
  return a.south <= b.north && a.north >= b.south && a.west <= b.east && a.east >= b.west;
}

export function openingBounds(extent: BBox | null | undefined): BBox {
  if (!extent || !validBox(extent)) return BRAZIL_BOUNDS;
  const spansBrazil =
    extent.north - extent.south >= NATIONAL_SHARE * (BRAZIL_BOUNDS.north - BRAZIL_BOUNDS.south) ||
    extent.east - extent.west >= NATIONAL_SHARE * (BRAZIL_BOUNDS.east - BRAZIL_BOUNDS.west);
  if (spansBrazil) return BRAZIL_BOUNDS;
  if (overlaps(extent, BRAZIL_BOUNDS) && !containedIn(extent, BRAZIL_BOUNDS)) return BRAZIL_BOUNDS;
  return extent;
}

export function bboxCentre(bbox: BBox): LatLng {
  return { lat: (bbox.south + bbox.north) / 2, lng: (bbox.west + bbox.east) / 2 };
}
