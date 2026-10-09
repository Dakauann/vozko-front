import { isValidPosition } from "./geometry";
import { isPrecision } from "./precision";
import { isToneKey } from "./tones";
import {
  AREA_KINDS,
  AREA_VISIBILITIES,
  MAP_PLACEMENTS,
  MAP_VIEWS,
  VIEWPORT_BASES,
  type AreaShape,
  type BBox,
  type DistrictCount,
  type DrawnArea,
  type GeoSummary,
  type LeftOutDistrict,
  type LatLng,
  type MapCell,
  type MapLayerResponse,
  type MapPoint,
  type MapViewport,
  type ViewportCity,
} from "./types";

export const MAX_LEAD_IDS_PER_POINT = 5;

export class MapContractError extends Error {
  constructor(reason: string) {
    super(`map contract: ${reason}`);
    this.name = "MapContractError";
  }
}

type Raw = Record<string, unknown>;

function record(value: unknown, what: string): Raw {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new MapContractError(`${what} is not an object`);
  }
  return value as Raw;
}

function list(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) throw new MapContractError(`${what} is not a list`);
  return value;
}

function count(raw: Raw, field: string, minimum = 0): number {
  const value = raw[field];
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum) {
    throw new MapContractError(`${field} is not a count`);
  }
  return value;
}

function integer(raw: Raw, field: string): number {
  const value = raw[field];
  if (typeof value !== "number" || !Number.isInteger(value)) throw new MapContractError(`${field} is not an integer`);
  return value;
}

function text(raw: Raw, field: string): string {
  const value = raw[field];
  if (typeof value !== "string" || value.trim() === "") throw new MapContractError(`${field} is blank`);
  return value;
}

function position(raw: Raw, what: string): { lat: number; lng: number } {
  const lat = raw.lat;
  const lng = raw.lng;
  if (typeof lat !== "number" || typeof lng !== "number" || !isValidPosition({ lat, lng })) {
    throw new MapContractError(`${what} has no valid position`);
  }
  return { lat, lng };
}

export function parseGeoSummary(value: unknown): GeoSummary {
  const raw = record(value, "geo summary");
  return {
    total: count(raw, "total"),
    onMap: count(raw, "onMap"),
    approximate: count(raw, "approximate"),
    withoutAddress: count(raw, "withoutAddress"),
    notFound: count(raw, "notFound"),
    pending: count(raw, "pending"),
    quotaExceeded: count(raw, "quotaExceeded"),
    refused: count(raw, "refused"),
  };
}

function parsePoint(value: unknown): MapPoint {
  const raw = record(value, "point");
  const people = count(raw, "count", 1);
  const leadIds = list(raw.leadIds, "point lead ids");
  if (leadIds.length > MAX_LEAD_IDS_PER_POINT || leadIds.length > people) {
    throw new MapContractError("point carries more lead ids than allowed");
  }
  if (!leadIds.every((id) => typeof id === "string" && id.trim() !== "")) {
    throw new MapContractError("point carries a blank lead id");
  }
  if (!isPrecision(raw.precision)) throw new MapContractError("point precision is unknown");
  if (!isToneKey(raw.tone)) throw new MapContractError("point tone is unknown");
  return {
    id: text(raw, "id"),
    ...position(raw, "point"),
    precision: raw.precision,
    placement: oneOf(raw, "placement", MAP_PLACEMENTS),
    tone: raw.tone,
    count: people,
    leadIds: leadIds as string[],
  };
}

function parseCell(value: unknown): MapCell {
  const raw = record(value, "cell");
  return {
    ix: integer(raw, "ix"),
    iy: integer(raw, "iy"),
    placement: oneOf(raw, "placement", MAP_PLACEMENTS),
    count: count(raw, "count", 1),
    ...position(raw, "cell"),
  };
}

export function parseMapLayer(value: unknown): MapLayerResponse {
  const raw = record(value, "map layer");
  if (raw.kind === "points") {
    return { kind: "points", points: list(raw.points, "points").map(parsePoint) };
  }
  if (raw.kind === "cells") {
    const size = raw.cellSizeDegrees;
    if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) {
      throw new MapContractError("cell size is not positive");
    }
    return { kind: "cells", cellSizeDegrees: size, cells: list(raw.cells, "cells").map(parseCell) };
  }
  throw new MapContractError("map layer kind is unknown");
}

function parseDistrict(value: unknown): DistrictCount {
  const raw = record(value, "district");
  return {
    pair: text(raw, "pair"),
    cityKey: text(raw, "cityKey"),
    districtKey: text(raw, "districtKey"),
    name: text(raw, "name"),
    ...position(raw, "district"),
    count: count(raw, "count"),
  };
}

export function parseDistrictCounts(value: unknown): DistrictCount[] {
  return list(value, "districts").map(parseDistrict);
}

function parseLeftOutDistrict(value: unknown): LeftOutDistrict {
  const raw = record(value, "left out district");
  return {
    pair: text(raw, "pair"),
    cityKey: text(raw, "cityKey"),
    districtKey: text(raw, "districtKey"),
    name: text(raw, "name"),
    city: optionalText(raw, "city"),
    state: optionalText(raw, "state"),
    count: count(raw, "count", 1),
  };
}

export interface LeftOutCounts {
  total: number;
  districts: LeftOutDistrict[];
  filter: unknown;
}

export function parseLeftOutCounts(value: unknown): LeftOutCounts {
  const raw = record(value, "left out");
  return { total: count(raw, "total"), districts: list(raw.districts, "left out districts").map(parseLeftOutDistrict), filter: raw.filter };
}

function oneOf<T extends string>(raw: Raw, field: string, allowed: readonly T[]): T {
  const value = raw[field];
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new MapContractError(`${field} is not one of ${allowed.join(", ")}`);
  }
  return value as T;
}

function bbox(value: unknown): BBox {
  const raw = record(value, "bbox");
  const box = { south: raw.south, west: raw.west, north: raw.north, east: raw.east };
  const corners = [
    { lat: box.south, lng: box.west },
    { lat: box.north, lng: box.east },
  ];
  if (!corners.every((corner) => typeof corner.lat === "number" && typeof corner.lng === "number" && isValidPosition(corner as LatLng))) {
    throw new MapContractError("bbox has an invalid corner");
  }
  const valid = box as BBox;
  if (valid.south >= valid.north || valid.west >= valid.east) throw new MapContractError("bbox is inverted");
  return valid;
}

export function parseMapViewport(value: unknown): MapViewport {
  const raw = record(value, "map viewport");
  const viewport: MapViewport = {
    bbox: bbox(raw.bbox),
    basis: oneOf(raw, "basis", VIEWPORT_BASES),
    view: oneOf(raw, "view", MAP_VIEWS),
  };
  const city = viewportCity(raw.city);
  if (city) viewport.city = city;
  return viewport;
}

function optionalText(raw: Raw, field: string): string {
  const value = raw[field];
  return typeof value === "string" ? value.trim() : "";
}

function viewportCity(value: unknown): ViewportCity | null {
  try {
    const city = record(value, "viewport city");
    const cityKey = text(city, "cityKey");
    return { cityKey, name: optionalText(city, "name") || cityKey, state: optionalText(city, "state"), count: count(city, "count") };
  } catch (error) {
    if (error instanceof MapContractError) return null;
    throw error;
  }
}

function ring(value: unknown): LatLng[] {
  const points = list(value, "area ring").map((point) => position(record(point, "ring point"), "ring point"));
  if (points.length < 3) throw new MapContractError("area ring has fewer than 3 points");
  return points;
}

function areaShape(value: unknown): AreaShape {
  const raw = record(value, "area shape");
  const kind = oneOf(raw, "kind", AREA_KINDS);
  if (kind === "circle") {
    const radiusM = raw.radiusM;
    if (typeof radiusM !== "number" || !Number.isFinite(radiusM) || radiusM <= 0) {
      throw new MapContractError("circle radius is not positive");
    }
    return { kind, center: position(record(raw.center, "circle center"), "circle center"), radiusM };
  }
  return { kind, ring: ring(raw.ring) };
}

export function parseDrawnArea(value: unknown): DrawnArea {
  const raw = record(value, "drawn area");
  if (typeof raw.canEdit !== "boolean") throw new MapContractError("canEdit is not a flag");
  return {
    id: text(raw, "id"),
    name: text(raw, "name"),
    visibility: oneOf(raw, "visibility", AREA_VISIBILITIES),
    ownerId: text(raw, "ownerId"),
    canEdit: raw.canEdit,
    shape: areaShape(raw.shape),
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
  };
}

export function parseDrawnAreas(value: unknown): DrawnArea[] {
  return list(record(value, "drawn areas").items, "drawn area items").map(parseDrawnArea);
}

export interface PointPeople<T extends { id: string }> {
  total: number;
  items: T[];
}

export function parsePointPeople<T extends { id: string }>(value: unknown): PointPeople<T> {
  const raw = record(value, "map peek");
  const total = count(raw, "total");
  const items = list(raw.items, "map peek items");
  if (items.length > total) throw new MapContractError("map peek lists more people than it counts");
  for (const item of items) text(record(item, "map peek item"), "id");
  return { total, items: items as T[] };
}
