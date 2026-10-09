import type { ReactNode } from "react";
import type { PaddingOptions } from "maplibre-gl";

import type { AreaShape, BBox, DistrictCount, MapGoTo, MapLayerMode, MapLayerResponse, MapPlaceMarker, MapPoint, SnappedViewport } from "@/lib/maps/types";

export interface MapPointerPosition {
  x: number;
  y: number;
}

export interface LeadMapProps {
  layer: MapLayerResponse | null;
  districts?: DistrictCount[] | null;
  mode?: MapLayerMode;
  coloured?: boolean;
  selectedPointIds?: readonly string[];
  allSelected?: boolean;
  areas?: readonly AreaShape[];
  bounds?: BBox | null;
  fitPadding?: number | PaddingOptions;
  goTo?: MapGoTo | null;
  placeMarker?: MapPlaceMarker | null;
  tools?: ReactNode;
  toolsBesidePanel?: boolean;
  ariaLabel?: string;
  className?: string;
  onViewportChange?: (viewport: SnappedViewport) => void;
  onPointClick?: (point: MapPoint, at: MapPointerPosition) => void;
  onPointShiftClick?: (point: MapPoint) => void;
  onDistrictClick?: (district: DistrictCount) => void;
  onAreaDrawn?: (area: AreaShape) => void;
  onUserPan?: () => void;
  children?: ReactNode;
}

export interface MiniMapProps {
  position: { lat: number; lng: number } | null;
  precision?: string | null;
  zoom?: number;
  interactive?: boolean;
  draggable?: boolean;
  ariaLabel?: string;
  className?: string;
  onPinMoved?: (position: { lat: number; lng: number }) => void;
}
