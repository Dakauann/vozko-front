"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Map as MapLibreMap, Marker } from "maplibre-gl";

import { applyPatchesToMap } from "@/lib/maps/basemap";
import { isValidPosition, offsetMeters } from "@/lib/maps/geometry";
import { ensureMapLibreWorker } from "@/lib/maps/maplibre-worker";
import { zoomForPrecision } from "@/lib/maps/precision";
import type { LatLng } from "@/lib/maps/types";
import { cn } from "@/lib/utils";

import type { MiniMapProps } from "./lead-map-types";
import { MAPLIBRE_CONTAINER } from "./map-layout";
import { mapLibreLocale } from "./maplibre-locale";
import { mapStyleFailureView } from "./map-style-failure";
import { MapFailure, MapScreenLoader } from "./MapStatus";
import { useMapStyle } from "./use-map-style";

const NUDGE_M = 5;
const NUDGE_FAR_M = 25;
const NUDGES: Record<string, [number, number]> = {
  ArrowUp: [1, 0],
  ArrowDown: [-1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

type PinAnnouncement = "pinNudged" | "pinConfirmed" | "pinReverted";

function pinElement(label: string): HTMLElement {
  const element = document.createElement("div");
  element.setAttribute("aria-label", label);
  return element;
}

function applyPinMode(element: HTMLElement, draggable: boolean, hintId: string) {
  element.className = cn(
    "size-4 rounded-full border-2 border-card shadow-md",
    draggable
      ? "cursor-grab bg-primary outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card active:cursor-grabbing"
      : "bg-foreground",
  );
  if (draggable) {
    element.setAttribute("role", "button");
    element.setAttribute("tabindex", "0");
    element.setAttribute("aria-describedby", hintId);
  } else {
    element.setAttribute("role", "img");
    element.removeAttribute("tabindex");
    element.removeAttribute("aria-describedby");
  }
}

function lngLatOf(marker: Marker): LatLng {
  const { lng, lat } = marker.getLngLat();
  return { lat, lng };
}

export function MiniMapCanvas({
  position,
  precision = null,
  zoom,
  interactive = false,
  draggable = false,
  ariaLabel,
  className,
  onPinMoved,
}: MiniMapProps) {
  const t = useTranslations("leadMap");
  const { status, failure, style, basemapPatches, retry } = useMapStyle();
  const hintId = useId();
  const container = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [renderFailed, setRenderFailed] = useState(false);
  const [announcement, setAnnouncement] = useState<PinAnnouncement | null>(null);
  const marker = useRef<Marker | null>(null);
  const pinNodeRef = useRef<HTMLElement | null>(null);
  const framingZoom = zoom ?? zoomForPrecision(precision);
  const latest = useRef({ style, position, framingZoom, interactive, draggable, hintId, label: ariaLabel ?? t("miniMap.label"), onPinMoved, t });

  useEffect(() => {
    latest.current = { style, position, framingZoom, interactive, draggable, hintId, label: ariaLabel ?? t("miniMap.label"), onPinMoved, t };
  });

  const located = position !== null && isValidPosition(position);
  const ready = status === "ready" && located;

  useEffect(() => {
    const element = container.current;
    const initial = latest.current;
    if (!ready || !element || !initial.style || !initial.position) return;
    let created: MapLibreMap;
    try {
      ensureMapLibreWorker();
      created = new MapLibreMap({
        container: element,
        style: initial.style,
        center: [initial.position.lng, initial.position.lat],
        zoom: initial.framingZoom,
        interactive: initial.interactive,
        ...(initial.interactive ? { cooperativeGestures: true } : {}),
        attributionControl: { compact: true },
        locale: { ...mapLibreLocale(initial.t), "Map.Title": initial.label },
      });
    } catch {
      let cancelledFailure = false;
      Promise.resolve().then(() => {
        if (!cancelledFailure) setRenderFailed(true);
      });
      return () => {
        cancelledFailure = true;
      };
    }
    const pinNode = pinElement(initial.t("miniMap.pin"));
    applyPinMode(pinNode, initial.draggable, initial.hintId);
    const pin = new Marker({ element: pinNode, draggable: initial.draggable })
      .setLngLat([initial.position.lng, initial.position.lat])
      .addTo(created);
    let confirmed = lngLatOf(pin);
    let pending = false;
    const report = (moved: LatLng) => {
      if (!isValidPosition(moved)) return false;
      confirmed = moved;
      pending = false;
      latest.current.onPinMoved?.(moved);
      return true;
    };
    pin.on("dragend", () => {
      report(lngLatOf(pin));
    });
    if (initial.interactive) {
      created.on("click", (event: { lngLat: { lng: number; lat: number } }) => {
        if (!latest.current.draggable) return;
        const tapped = { lat: event.lngLat.lat, lng: event.lngLat.lng };
        if (!isValidPosition(tapped)) return;
        pin.setLngLat([tapped.lng, tapped.lat]);
        report(tapped);
      });
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (!latest.current.draggable) return;
      const nudge = NUDGES[event.key];
      if (nudge) {
        event.preventDefault();
        const step = event.shiftKey ? NUDGE_FAR_M : NUDGE_M;
        const moved = offsetMeters(lngLatOf(pin), nudge[0] * step, nudge[1] * step);
        if (!isValidPosition(moved)) return;
        pin.setLngLat([moved.lng, moved.lat]);
        pending = true;
        setAnnouncement("pinNudged");
        return;
      }
      if (event.key === "Enter" && pending) {
        event.preventDefault();
        if (report(lngLatOf(pin))) setAnnouncement("pinConfirmed");
        return;
      }
      if (event.key === "Escape" && pending) {
        event.preventDefault();
        pin.setLngLat([confirmed.lng, confirmed.lat]);
        pending = false;
        setAnnouncement("pinReverted");
      }
    };
    pinNode.addEventListener("keydown", onKeyDown);
    marker.current = pin;
    pinNodeRef.current = pinNode;
    created.on("load", () => setMap(created));
    return () => {
      pinNode.removeEventListener("keydown", onKeyDown);
      marker.current = null;
      pinNodeRef.current = null;
      setMap(null);
      created.remove();
    };
  }, [ready]);

  useEffect(() => {
    if (!map) return;
    applyPatchesToMap(map, basemapPatches);
  }, [map, basemapPatches]);

  const lat = position?.lat;
  const lng = position?.lng;
  useEffect(() => {
    if (!map || lat === undefined || lng === undefined) return;
    marker.current?.setLngLat([lng, lat]);
    map.jumpTo({ center: [lng, lat], zoom: latest.current.framingZoom });
  }, [map, lat, lng]);

  useEffect(() => {
    const pin = marker.current;
    const node = pinNodeRef.current;
    if (!pin || !node) return;
    pin.setDraggable(draggable);
    applyPinMode(node, draggable, hintId);
  }, [draggable, map, hintId]);

  const frame = cn("vz-map relative h-40 w-full overflow-hidden rounded-lg border border-border", className);

  if (!located) {
    return (
      <div className={cn(frame, "flex items-center justify-center bg-muted px-4 text-center text-sm text-muted-foreground")}>
        {t("miniMap.noPosition")}
      </div>
    );
  }
  if (status === "error" || renderFailed) {
    const view = mapStyleFailureView(renderFailed ? "render" : failure);
    return <MapFailure className={frame} message={t(view.messageKey)} onRetry={view.retry ? retry : undefined} />;
  }
  return (
    <div className={frame}>
      <div ref={container} className={MAPLIBRE_CONTAINER} />
      {!map ? <MapScreenLoader className="absolute inset-0 min-h-0 bg-muted" /> : null}
      {draggable && map ? (
        <p className="pointer-events-none absolute inset-x-2 top-2 w-fit rounded-md bg-card px-2 py-1 text-2xs text-muted-foreground shadow-sm">
          {t("miniMap.dragHint")}
          <span id={hintId} className="sr-only">
            {" "}
            {t("miniMap.keyboardHint")}
          </span>
        </p>
      ) : null}
      <p aria-live="polite" className="sr-only">
        {announcement ? t(`miniMap.${announcement}`) : null}
      </p>
    </div>
  );
}
