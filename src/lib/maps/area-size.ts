import { distanceMeters } from "./geometry";
import type { AreaShape } from "./types";

export type AreaSize = { kind: "box"; widthM: number; heightM: number } | { kind: "radius"; radiusM: number };

interface DistanceValue {
  unit: "meters" | "kilometers";
  value: number;
}

const METERS_PER_KILOMETER = 1000;
const WHOLE_KILOMETERS_FROM = 9.95;

export function areaSize(shape: AreaShape | null): AreaSize | null {
  if (!shape) return null;
  if (shape.kind === "circle") return shape.radiusM > 0 ? { kind: "radius", radiusM: shape.radiusM } : null;
  const lats = shape.ring.map((p) => p.lat);
  const lngs = shape.ring.map((p) => p.lng);
  const south = Math.min(...lats);
  const north = Math.max(...lats);
  const west = Math.min(...lngs);
  const east = Math.max(...lngs);
  const middleLat = (south + north) / 2;
  const middleLng = (west + east) / 2;
  const widthM = distanceMeters({ lat: middleLat, lng: west }, { lat: middleLat, lng: east });
  const heightM = distanceMeters({ lat: south, lng: middleLng }, { lat: north, lng: middleLng });
  return widthM > 0 || heightM > 0 ? { kind: "box", widthM, heightM } : null;
}

export function distanceValue(meters: number): DistanceValue {
  const wholeMeters = Math.round(meters);
  if (wholeMeters < METERS_PER_KILOMETER) return { unit: "meters", value: wholeMeters };
  const kilometers = meters / METERS_PER_KILOMETER;
  const value = kilometers < WHOLE_KILOMETERS_FROM ? Math.round(kilometers * 10) / 10 : Math.round(kilometers);
  return { unit: "kilometers", value };
}
