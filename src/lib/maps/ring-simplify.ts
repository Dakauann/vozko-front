import type { LatLng } from "./types";

export const MAX_AREA_VERTICES = 200;

const TOUCH_EPSILON = 1e-12;

function orientation(a: LatLng, b: LatLng, c: LatLng): number {
  return (b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng);
}

function onSegment(a: LatLng, b: LatLng, p: LatLng): boolean {
  if (Math.abs(orientation(a, b, p)) > TOUCH_EPSILON) return false;
  return (
    p.lng >= Math.min(a.lng, b.lng) &&
    p.lng <= Math.max(a.lng, b.lng) &&
    p.lat >= Math.min(a.lat, b.lat) &&
    p.lat <= Math.max(a.lat, b.lat)
  );
}

function segmentsTouch(p1: LatLng, p2: LatLng, q1: LatLng, q2: LatLng): boolean {
  const d1 = orientation(q1, q2, p1);
  const d2 = orientation(q1, q2, p2);
  const d3 = orientation(p1, p2, q1);
  const d4 = orientation(p1, p2, q2);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  return onSegment(q1, q2, p1) || onSegment(q1, q2, p2) || onSegment(p1, p2, q1) || onSegment(p1, p2, q2);
}

export function ringSelfCrosses(ring: LatLng[]): boolean {
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsTouch(ring[i], ring[(i + 1) % n], ring[j], ring[(j + 1) % n])) return true;
    }
  }
  return false;
}

function cornerArea(ring: LatLng[], index: number): number {
  const n = ring.length;
  return Math.abs(orientation(ring[(index - 1 + n) % n], ring[index], ring[(index + 1) % n]));
}

function shortcutCrosses(ring: LatLng[], index: number): boolean {
  const n = ring.length;
  const before = (index - 1 + n) % n;
  const after = (index + 1) % n;
  for (let edge = 0; edge < n; edge++) {
    const end = (edge + 1) % n;
    if (edge === before || edge === index || end === before || edge === after) continue;
    if (segmentsTouch(ring[before], ring[after], ring[edge], ring[end])) return true;
  }
  return false;
}

export function simplifyRing(ring: LatLng[], maxVertices: number = MAX_AREA_VERTICES): LatLng[] {
  if (ring.length <= maxVertices) return ring;
  const kept = [...ring];
  while (kept.length > maxVertices) {
    const areas = kept.map((_, index) => cornerArea(kept, index));
    const candidates = kept.map((_, index) => index).sort((a, b) => areas[a] - areas[b]);
    const removable = candidates.find((index) => !shortcutCrosses(kept, index)) ?? candidates[0];
    kept.splice(removable, 1);
  }
  return kept;
}
