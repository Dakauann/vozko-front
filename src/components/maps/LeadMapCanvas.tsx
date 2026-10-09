"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Map as MapLibreMap,
  type GeoJSONSource,
  type LngLatBoundsLike,
  type MapGeoJSONFeature,
  type MapLayerMouseEvent,
} from "maplibre-gl";

import { applyPatchesToMap, layerPaintPatches } from "@/lib/maps/basemap";
import { heatFeatureCollection, heatRadius, heatWeight } from "@/lib/maps/heat";
import {
  AREA_HANDLE_IMAGE,
  approximateFeatureCollection,
  areaFeatureCollection,
  areaHandleFeatureCollection,
  areaHandleImage,
  clusteredSourceOptions,
  dataLayers,
  districtKey,
  districtsFeatureCollection,
  dotFilter,
  placeFeatureCollection,
  LEAD_MAP_LAYERS,
  LEAD_MAP_SOURCES,
  layerVisibility,
  pointsFeatureCollection,
  selectedApproximateFilter,
  selectedFilter,
  type MapSelection,
} from "@/lib/maps/layers";
import { BRAZIL_BOUNDS, openingBounds } from "@/lib/maps/geometry";
import type { MapPalette } from "@/lib/maps/palette";
import type { AreaShape, BBox, DistrictCount, MapPoint } from "@/lib/maps/types";
import { MAP_LOAD_TIMEOUT_MS, ensureMapLibreWorker, isFatalMapStartError } from "@/lib/maps/maplibre-worker";
import { createViewportEmitter } from "@/lib/maps/viewport-emitter";
import { cn } from "@/lib/utils";

import { AreaDrawControl } from "./AreaDrawControl";
import { BESIDE_MAP_PANEL, MAPLIBRE_CONTAINER, MAP_CONTROL_COLUMN, MAP_TOOLS_TOP } from "./map-layout";
import type { LeadMapProps, MapPointerPosition } from "./lead-map-types";
import { LeadMapContext } from "./map-context";
import { mapLibreLocale } from "./maplibre-locale";
import { MapFailure, MapScreenLoader } from "./MapStatus";
import { MapZoomButtons } from "./MapZoomButtons";
import { mapStyleFailureView, reportMapFailure, styleFailureCode, type MapStartFailureCode } from "./map-style-failure";
import { useMapStyle } from "./use-map-style";

export { BRAZIL_BOUNDS };
const NO_AREAS: readonly AreaShape[] = [];
const NO_IDS: readonly string[] = [];
const FIT_PADDING = 32;
const FIT_MAX_ZOOM = 15;
const MAX_ZOOM = 19;
const BUBBLE_ZOOM_STEP = 2;
const BELOW_LABELS = new Set<string>([LEAD_MAP_LAYERS.heat, LEAD_MAP_LAYERS.districts]);
const BUBBLE_LAYERS = [
  { layer: LEAD_MAP_LAYERS.clusters, source: LEAD_MAP_SOURCES.points },
  { layer: LEAD_MAP_LAYERS.approximateClusters, source: LEAD_MAP_SOURCES.approximate },
];
const CLICKABLE = [
  LEAD_MAP_LAYERS.dots,
  LEAD_MAP_LAYERS.approximate,
  LEAD_MAP_LAYERS.clusters,
  LEAD_MAP_LAYERS.approximateClusters,
  LEAD_MAP_LAYERS.districts,
];
const POINT_LAYERS = [LEAD_MAP_LAYERS.dots, LEAD_MAP_LAYERS.approximate];

function lngLatBounds(bbox: BBox): LngLatBoundsLike {
  return [
    [bbox.west, bbox.south],
    [bbox.east, bbox.north],
  ];
}

function boundsKey(bbox: BBox | null | undefined): string {
  return bbox ? `${bbox.south},${bbox.west},${bbox.north},${bbox.east}` : "";
}

function firstFeatureProperty(event: MapLayerMouseEvent, name: string): unknown {
  const feature: MapGeoJSONFeature | undefined = event.features?.[0];
  return feature?.properties?.[name];
}

const PHONE_WIDTH = 640;

function paddingFor(element: HTMLElement | null, padding: LeadMapProps["fitPadding"]): LeadMapProps["fitPadding"] {
  const width = element?.clientWidth ?? 0;
  return width > 0 && width < PHONE_WIDTH ? FIT_PADDING : padding;
}

function screenPixelRatio(): number {
  return typeof window === "undefined" ? 1 : Math.max(1, Math.round(window.devicePixelRatio || 1));
}

function handleImageFor(palette: MapPalette) {
  return areaHandleImage(palette.surfaceHex, palette.primaryEdgeHex, screenPixelRatio());
}

export function LeadMapCanvas({
  layer,
  districts = null,
  mode = "points",
  coloured = false,
  selectedPointIds = NO_IDS,
  allSelected = false,
  areas = NO_AREAS,
  bounds = null,
  fitPadding = FIT_PADDING,
  goTo = null,
  placeMarker = null,
  tools,
  toolsBesidePanel = false,
  ariaLabel,
  className,
  onViewportChange,
  onPointClick,
  onPointShiftClick,
  onDistrictClick,
  onAreaDrawn,
  onUserPan,
  children,
}: LeadMapProps) {
  const t = useTranslations("leadMap");
  const locale = useLocale();
  const { status, failure, cause, style, basemapPatches, palette, font, boldFont, retry } = useMapStyle(locale.split("-")[0]);
  const container = useRef<HTMLDivElement>(null);
  const drawing = useRef(false);
  const setDrawing = useCallback((active: boolean) => {
    drawing.current = active;
  }, []);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [startFailure, setStartFailure] = useState<{ code: MapStartFailureCode; cause: unknown } | null>(null);

  const heat = useMemo(() => ({ weight: heatWeight(layer), radius: heatRadius(layer) }), [layer]);
  const maxDistrictCount = useMemo(
    () => (districts ?? []).reduce((highest, district) => Math.max(highest, district.count), 0),
    [districts],
  );
  const layers = useMemo(
    () => (palette ? dataLayers(palette, { font, boldFont, maxDistrictCount, locale, coloured, heat }) : null),
    [palette, font, boldFont, maxDistrictCount, locale, coloured, heat],
  );
  const pointsById = useMemo(
    () => new Map<string, MapPoint>(layer?.kind === "points" ? layer.points.map((point) => [point.id, point]) : []),
    [layer],
  );
  const districtsByKey = useMemo(
    () => new Map<string, DistrictCount>((districts ?? []).map((district) => [districtKey(district), district])),
    [districts],
  );

  const latest = useRef({ style, layers, palette, bounds, fitPadding, label: ariaLabel ?? t("mapLabel"), localeStrings: mapLibreLocale(t) });
  const handlers = useRef({ onViewportChange, onPointClick, onPointShiftClick, onDistrictClick, onUserPan, pointsById, districtsByKey });

  useEffect(() => {
    latest.current = { style, layers, palette, bounds, fitPadding, label: ariaLabel ?? t("mapLabel"), localeStrings: mapLibreLocale(t) };
    handlers.current = { onViewportChange, onPointClick, onPointShiftClick, onDistrictClick, onUserPan, pointsById, districtsByKey };
  });

  const ready = status === "ready" && layers !== null;

  useEffect(() => {
    const element = container.current;
    const initial = latest.current;
    if (!ready || !element || !initial.style || !initial.layers) return;
    let created: MapLibreMap;
    try {
      ensureMapLibreWorker();
      created = new MapLibreMap({
        container: element,
        style: initial.style,
        bounds: lngLatBounds(openingBounds(initial.bounds)),
        fitBoundsOptions: { padding: paddingFor(element, initial.fitPadding), maxZoom: FIT_MAX_ZOOM },
        maxZoom: MAX_ZOOM,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        attributionControl: { compact: true },
        locale: { ...initial.localeStrings, "Map.Title": initial.label },
      });
    } catch (error: unknown) {
      let cancelledFailure = false;
      Promise.resolve().then(() => {
        if (!cancelledFailure) setStartFailure({ code: "create_failed", cause: error });
      });
      return () => {
        cancelledFailure = true;
      };
    }
    const emitter = createViewportEmitter((viewport) => handlers.current.onViewportChange?.(viewport));
    const pushViewport = () => {
      const visible = created.getBounds();
      emitter.push({
        bbox: { south: visible.getSouth(), west: visible.getWest(), north: visible.getNorth(), east: visible.getEast() },
        zoom: created.getZoom(),
      });
    };

    let loaded = false;
    let failed = false;
    const giveUp = (code: MapStartFailureCode, why: unknown) => {
      if (loaded || failed) return;
      failed = true;
      stopLoadTimer();
      document.removeEventListener("visibilitychange", watchLoad);
      emitter.cancel();
      created.remove();
      setStartFailure({ code, cause: why });
    };
    let loadTimer: ReturnType<typeof setTimeout> | undefined;
    const stopLoadTimer = () => {
      clearTimeout(loadTimer);
      loadTimer = undefined;
    };
    const watchLoad = () => {
      stopLoadTimer();
      if (loaded || failed || document.visibilityState === "hidden") return;
      loadTimer = setTimeout(() => giveUp("load_timeout", new Error(`no load event within ${MAP_LOAD_TIMEOUT_MS} ms of a visible tab`)), MAP_LOAD_TIMEOUT_MS);
    };
    watchLoad();
    document.addEventListener("visibilitychange", watchLoad);
    created.on("error", (event) => {
      if (isFatalMapStartError(event)) giveUp("start_error", event.error ?? event);
    });

    const openPoint = (point: MapPoint, shiftKey: boolean, at: MapPointerPosition) => {
      if (shiftKey) handlers.current.onPointShiftClick?.(point);
      else handlers.current.onPointClick?.(point, at);
    };

    created.on("load", () => {
      loaded = true;
      stopLoadTimer();
      document.removeEventListener("visibilitychange", watchLoad);
      const empty = { type: "FeatureCollection" as const, features: [] };
      created.addSource(LEAD_MAP_SOURCES.points, { ...clusteredSourceOptions(), data: empty });
      created.addSource(LEAD_MAP_SOURCES.approximate, { ...clusteredSourceOptions(), data: empty });
      created.addSource(LEAD_MAP_SOURCES.heat, { type: "geojson", data: empty });
      created.addSource(LEAD_MAP_SOURCES.districts, { type: "geojson", data: empty });
      created.addSource(LEAD_MAP_SOURCES.place, { type: "geojson", data: empty });
      created.addSource(LEAD_MAP_SOURCES.area, { type: "geojson", data: empty });
      created.addSource(LEAD_MAP_SOURCES.areaHandles, { type: "geojson", data: empty });
      const startPalette = latest.current.palette;
      if (startPalette) created.addImage(AREA_HANDLE_IMAGE, handleImageFor(startPalette), { pixelRatio: screenPixelRatio() });
      const firstLabel = created.getStyle().layers.find((spec) => spec.type === "symbol")?.id;
      for (const spec of latest.current.layers ?? []) {
        created.addLayer(spec, BELOW_LABELS.has(spec.id) ? firstLabel : undefined);
      }
      setMap(created);
      pushViewport();
    });
    created.on("moveend", pushViewport);
    created.on("dragstart", () => handlers.current.onUserPan?.());

    for (const id of POINT_LAYERS) {
      created.on("click", id, (event) => {
        if (drawing.current) return;
        if (id === LEAD_MAP_LAYERS.approximate && created.queryRenderedFeatures(event.point, { layers: [LEAD_MAP_LAYERS.dots] }).length > 0) return;
        const point = handlers.current.pointsById.get(String(firstFeatureProperty(event, "id")));
        if (!point) return;
        openPoint(point, event.originalEvent.shiftKey, { x: event.point.x, y: event.point.y });
      });
    }
    for (const { layer: bubbleLayer, source: bubbleSource } of BUBBLE_LAYERS) {
      created.on("click", bubbleLayer, (event) => {
        if (drawing.current) return;
        const feature = event.features?.[0];
        if (!feature || feature.geometry.type !== "Point") return;
        const [lng, lat] = feature.geometry.coordinates;
        const clusterId = Number(feature.properties?.cluster_id);
        if (feature.properties?.cluster_id !== undefined && Number.isFinite(clusterId)) {
          created
            .getSource<GeoJSONSource>(bubbleSource)
            ?.getClusterExpansionZoom(clusterId)
            .then((zoom) => created.easeTo({ center: [lng, lat], zoom }))
            .catch(() => undefined);
          return;
        }
        if (feature.properties?.group === true) {
          created.easeTo({ center: [lng, lat], zoom: created.getZoom() + BUBBLE_ZOOM_STEP });
          return;
        }
        const point = handlers.current.pointsById.get(String(feature.properties?.id));
        if (!point) return;
        openPoint(point, event.originalEvent.shiftKey, { x: event.point.x, y: event.point.y });
      });
    }
    created.on("click", LEAD_MAP_LAYERS.districts, (event) => {
      if (drawing.current) return;
      const district = handlers.current.districtsByKey.get(String(firstFeatureProperty(event, "key")));
      if (district) handlers.current.onDistrictClick?.(district);
    });
    for (const id of CLICKABLE) {
      created.on("mouseenter", id, () => {
        created.getCanvas().style.cursor = "pointer";
      });
      created.on("mouseleave", id, () => {
        created.getCanvas().style.cursor = "";
      });
    }

    return () => {
      stopLoadTimer();
      document.removeEventListener("visibilitychange", watchLoad);
      emitter.cancel();
      setMap(null);
      if (!failed) created.remove();
    };
  }, [ready]);

  useEffect(() => {
    if (!map) return;
    applyPatchesToMap(map, basemapPatches);
  }, [map, basemapPatches]);

  useEffect(() => {
    if (!map || !layers) return;
    applyPatchesToMap(map, layerPaintPatches(layers));
  }, [map, layers]);

  useEffect(() => {
    if (!map || !palette) return;
    const image = handleImageFor(palette);
    if (map.hasImage(AREA_HANDLE_IMAGE)) map.updateImage(AREA_HANDLE_IMAGE, image);
    else map.addImage(AREA_HANDLE_IMAGE, image, { pixelRatio: screenPixelRatio() });
  }, [map, palette]);

  useEffect(() => {
    if (!map) return;
    const zoom = map.getZoom();
    map.getSource<GeoJSONSource>(LEAD_MAP_SOURCES.points)?.setData(pointsFeatureCollection(layer, zoom));
    map.getSource<GeoJSONSource>(LEAD_MAP_SOURCES.approximate)?.setData(approximateFeatureCollection(layer, zoom));
    map.getSource<GeoJSONSource>(LEAD_MAP_SOURCES.heat)?.setData(heatFeatureCollection(layer));
  }, [map, layer]);

  useEffect(() => {
    if (!map) return;
    map.getSource<GeoJSONSource>(LEAD_MAP_SOURCES.districts)?.setData(districtsFeatureCollection(districts ?? []));
  }, [map, districts]);

  useEffect(() => {
    if (!map) return;
    map.getSource<GeoJSONSource>(LEAD_MAP_SOURCES.area)?.setData(areaFeatureCollection(areas));
    map.getSource<GeoJSONSource>(LEAD_MAP_SOURCES.areaHandles)?.setData(areaHandleFeatureCollection(areas));
  }, [map, areas]);

  useEffect(() => {
    if (!map) return;
    map.getSource<GeoJSONSource>(LEAD_MAP_SOURCES.place)?.setData(placeFeatureCollection(placeMarker));
  }, [map, placeMarker]);

  const goToKey = goTo?.key ?? null;
  const latestGoTo = useRef(goTo);
  useEffect(() => {
    latestGoTo.current = goTo;
  });
  useEffect(() => {
    const target = latestGoTo.current;
    if (!map || !target) return;
    if ("bounds" in target) map.fitBounds(lngLatBounds(target.bounds), { padding: paddingFor(container.current, latest.current.fitPadding), maxZoom: FIT_MAX_ZOOM });
    else map.flyTo({ center: [target.center.lng, target.center.lat], zoom: target.zoom });
  }, [map, goToKey]);

  useEffect(() => {
    if (!map) return;
    const selection: MapSelection = { ids: selectedPointIds, all: allSelected };
    const dots = dotFilter(mode, selection);
    map.setFilter(LEAD_MAP_LAYERS.dotHalo, dots);
    map.setFilter(LEAD_MAP_LAYERS.dots, dots);
    map.setFilter(LEAD_MAP_LAYERS.selected, selectedFilter(selection, mode));
    map.setFilter(LEAD_MAP_LAYERS.approximateSelected, selectedApproximateFilter(selectedPointIds));
  }, [map, selectedPointIds, allSelected, mode]);

  useEffect(() => {
    if (!map) return;
    for (const [id, visibility] of Object.entries(layerVisibility(mode))) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visibility);
    }
  }, [map, mode]);

  const fitKey = boundsKey(bounds);
  useEffect(() => {
    const target = latest.current.bounds;
    if (!map || !target) return;
    map.fitBounds(lngLatBounds(openingBounds(target)), { padding: paddingFor(container.current, latest.current.fitPadding), maxZoom: FIT_MAX_ZOOM, duration: 0 });
  }, [map, fitKey]);

  const contextValue = useMemo(() => ({ map, palette, setDrawing }), [map, palette, setDrawing]);

  const failureCode = startFailure?.code ?? (status === "error" ? styleFailureCode(failure) : null);
  const failureCause = startFailure ? startFailure.cause : cause;
  useEffect(() => {
    if (failureCode) reportMapFailure(failureCode, failureCause);
  }, [failureCode, failureCause]);

  if (failureCode) {
    const view = mapStyleFailureView(startFailure ? "render" : failure);
    return <MapFailure className={className} message={t(view.messageKey)} onRetry={view.retry ? retry : undefined} diagnostic={failureCode} />;
  }

  return (
    <LeadMapContext.Provider value={contextValue}>
      <div className={cn("vz-map relative h-full min-h-64 w-full overflow-hidden", className)}>
        <div ref={container} className={MAPLIBRE_CONTAINER} />
        {!map ? <MapScreenLoader className="absolute inset-0 bg-muted" /> : null}
        {map ? (
          <div className={cn("pointer-events-none absolute inset-x-3 z-10 flex items-start gap-2", MAP_TOOLS_TOP, toolsBesidePanel && BESIDE_MAP_PANEL)}>
            <div className={cn("pointer-events-auto", MAP_CONTROL_COLUMN)}>
              {onAreaDrawn ? (
                <>
                  <AreaDrawControl onAreaDrawn={onAreaDrawn} />
                  <hr aria-hidden="true" className="mx-0.5 my-0.5 border-0 border-t border-border" />
                </>
              ) : null}
              <MapZoomButtons />
            </div>
            {tools ? <div className="pointer-events-auto flex min-w-0 flex-wrap items-start gap-2">{tools}</div> : null}
          </div>
        ) : null}
        {map ? children : null}
      </div>
    </LeadMapContext.Provider>
  );
}
