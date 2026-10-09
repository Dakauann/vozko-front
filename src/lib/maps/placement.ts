import { BRAZIL_BOUNDS, bboxCentre } from "./geometry";
import { zoomForPrecision } from "./precision";
import type { ReferencePoint } from "./reference-point";
import type { LatLng, MapViewport } from "./types";

export const COUNTRY_ZOOM = 3;

export interface PinStart {
  position: LatLng;
  zoom: number;
}

export function pinStart(viewport: MapViewport | null, reference: ReferencePoint | null = null): PinStart {
  if (reference) return { position: reference.position, zoom: zoomForPrecision(reference.precision) };
  if (!viewport) return { position: bboxCentre(BRAZIL_BOUNDS), zoom: COUNTRY_ZOOM };
  return {
    position: bboxCentre(viewport.bbox),
    zoom: viewport.basis === "country" ? COUNTRY_ZOOM : zoomForPrecision("city"),
  };
}
