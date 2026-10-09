import type { ToneKey } from "@/lib/tones/tones";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface BBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface Viewport {
  bbox: BBox;
  zoom: number;
}

export interface TileRange {
  zoom: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface SnappedViewport extends Viewport {
  tiles: TileRange;
  key: string;
}

export const PRECISIONS = ["exact", "address", "street", "postal_code", "district", "city"] as const;

export type Precision = (typeof PRECISIONS)[number];

export { TONE_KEYS } from "@/lib/tones/tones";
export type { ToneKey };

export interface GeoSummary {
  total: number;
  onMap: number;
  approximate: number;
  withoutAddress: number;
  notFound: number;
  pending: number;
  quotaExceeded: number;
  refused: number;
}

export const MAP_PLACEMENTS = ["on_map", "approximate"] as const;

export type MapPlacement = (typeof MAP_PLACEMENTS)[number];

export interface MapSpot extends LatLng {
  placement: MapPlacement;
}

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  precision: Precision;
  placement: MapPlacement;
  tone: ToneKey;
  count: number;
  leadIds: string[];
}

export interface MapCell {
  ix: number;
  iy: number;
  placement: MapPlacement;
  count: number;
  lat: number;
  lng: number;
}

export type MapLayerResponse =
  | { kind: "points"; points: MapPoint[] }
  | { kind: "cells"; cellSizeDegrees: number; cells: MapCell[] };

export interface DistrictCount {
  pair: string;
  cityKey: string;
  districtKey: string;
  name: string;
  lat: number;
  lng: number;
  count: number;
}

export interface LeftOutDistrict {
  pair: string;
  cityKey: string;
  districtKey: string;
  name: string;
  city: string;
  state: string;
  count: number;
}

export type MapPlaceMarker = { kind: "bounds"; bounds: BBox } | { kind: "point"; at: LatLng };

export type MapGoTo = { key: number; bounds: BBox } | { key: number; center: LatLng; zoom: number };

export const AREA_KINDS = ["polygon", "rectangle", "circle"] as const;

export type AreaKind = (typeof AREA_KINDS)[number];

export type AreaShape =
  | { kind: "polygon"; ring: LatLng[] }
  | { kind: "rectangle"; ring: LatLng[] }
  | { kind: "circle"; center: LatLng; radiusM: number };

export const VIEWPORT_BASES = ["area", "located", "city", "country"] as const;

export type ViewportBasis = (typeof VIEWPORT_BASES)[number];

export const MAP_VIEWS = ["positions", "districts"] as const;

export type MapView = (typeof MAP_VIEWS)[number];

export const MAP_LAYER_MODES = ["heat", "points", "districts"] as const;

export type MapLayerMode = (typeof MAP_LAYER_MODES)[number];

export interface ViewportCity {
  cityKey: string;
  name: string;
  state: string;
  count: number;
}

export interface MapViewport {
  bbox: BBox;
  basis: ViewportBasis;
  view: MapView;
  city?: ViewportCity;
}

export const AREA_VISIBILITIES = ["private", "shared"] as const;

export type AreaVisibility = (typeof AREA_VISIBILITIES)[number];

export interface DrawnArea {
  id: string;
  name: string;
  visibility: AreaVisibility;
  ownerId: string;
  canEdit: boolean;
  shape: AreaShape;
  createdAt: string;
  updatedAt: string;
}
