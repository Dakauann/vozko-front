"use client";

import { useState } from "react";
import { useQueries, type UseQueryResult } from "@tanstack/react-query";

import {
  fetchLeadMapDistricts,
  fetchLeadMapLeftOut,
  fetchLeadMapPoint,
  fetchLeadMapSummary,
  fetchLeadMapTile,
  fetchLeadMapViewport,
  listLeadAreas,
} from "@/app/actions/lead-map";
import { useWorkspace } from "@/contexts/workspace-context";
import { useSectionQuery } from "@/hooks/use-section-query";
import { SECTION_STALE_MS, sectionRetryDelay, shouldRetrySection } from "@/lib/analytics/section-query";
import {
  leadMapKey,
  leadMapsKey,
  type LeadMapLayerRequest,
  type LeadMapParams,
  type MapLeftOut,
  type MapPeek,
} from "@/lib/leads/map-view";
import { createTileLimiter, mergeTileLayers, tileId, visibleTiles, type MapTile } from "@/lib/maps/tiles";
import type { DistrictCount, DrawnArea, GeoSummary, MapLayerResponse, MapSpot, MapViewport } from "@/lib/maps/types";

export const TILE_GC_MS = 30 * 60_000;

const tileLimiter = createTileLimiter();

const NO_TILES: readonly MapTile[] = [];

function useWorkspaceId(): string {
  const { currentWorkspace } = useWorkspace();
  return currentWorkspace?.id ?? "";
}

export function useLeadMapSummary(params: LeadMapParams, options: { enabled: boolean }) {
  const workspaceId = useWorkspaceId();
  return useSectionQuery<GeoSummary>({
    queryKey: leadMapKey(workspaceId, "summary", params),
    queryFn: (signal) => fetchLeadMapSummary(params, signal),
    enabled: options.enabled && workspaceId !== "",
  });
}

export function useLeadMapViewport(params: LeadMapParams, options: { enabled: boolean }) {
  const workspaceId = useWorkspaceId();
  return useSectionQuery<MapViewport>({
    queryKey: leadMapKey(workspaceId, "viewport", params),
    queryFn: (signal) => fetchLeadMapViewport(params, signal),
    enabled: options.enabled && workspaceId !== "",
  });
}

export function useLeadMapDistricts(params: LeadMapParams, options: { enabled: boolean }) {
  const workspaceId = useWorkspaceId();
  return useSectionQuery<DistrictCount[]>({
    queryKey: leadMapKey(workspaceId, "districts", params),
    queryFn: (signal) => fetchLeadMapDistricts(params, signal),
    enabled: options.enabled && workspaceId !== "",
  });
}

export function useLeadMapLeftOut(params: LeadMapParams, options: { enabled: boolean }) {
  const workspaceId = useWorkspaceId();
  return useSectionQuery<MapLeftOut>({
    queryKey: leadMapKey(workspaceId, "left-out", params),
    queryFn: (signal) => fetchLeadMapLeftOut(params, signal),
    enabled: options.enabled && workspaceId !== "",
  });
}

interface TileAnswers {
  layer: MapLayerResponse | null;
  settled: boolean;
  error: Error | null;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
}

function combineTiles(results: UseQueryResult<MapLayerResponse, Error>[]): TileAnswers {
  const failed = results.filter((result) => result.isError);
  return {
    layer: mergeTileLayers(results.flatMap((result) => (result.data ? [result.data] : []))),
    settled: results.length > 0 && results.every((result) => result.data !== undefined || result.isError),
    error: failed[0]?.error ?? null,
    isFetching: results.some((result) => result.isFetching),
    refetch: () => Promise.all((failed.length > 0 ? failed : results).map((result) => result.refetch())),
  };
}

interface HeldLayer {
  identity: string;
  drawKey: string;
  layer: MapLayerResponse;
}

export function useLeadMapTiles(params: LeadMapParams, request: LeadMapLayerRequest | null, options: { enabled: boolean }) {
  const workspaceId = useWorkspaceId();
  const colorBy = request?.colorBy;
  const base = leadMapKey(workspaceId, "tile", params);
  const tiles = request ? visibleTiles(request.viewport) : NO_TILES;
  const enabled = options.enabled && request !== null && workspaceId !== "";
  const answers = useQueries({
    queries: tiles.map((tile) => ({
      queryKey: [...base, tileId(tile), colorBy ?? ""],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        tileLimiter.run(signal, () => fetchLeadMapTile(params, colorBy ? { tile, colorBy } : { tile }, signal)),
      enabled,
      staleTime: SECTION_STALE_MS,
      gcTime: TILE_GC_MS,
      refetchOnWindowFocus: false,
      retry: shouldRetrySection,
      retryDelay: sectionRetryDelay,
    })),
    combine: combineTiles,
  });

  const identity = JSON.stringify(base);
  const drawKey = `${request?.viewport.zoom ?? ""}|${colorBy ?? ""}`;
  const [held, setHeld] = useState<HeldLayer | null>(null);
  if (answers.settled && answers.layer && (held?.layer !== answers.layer || held.identity !== identity || held.drawKey !== drawKey)) {
    setHeld({ identity, drawKey, layer: answers.layer });
  }
  const holding = !answers.settled && held !== null && held.identity === identity && held.drawKey !== drawKey;

  return {
    data: (holding ? held.layer : answers.layer) ?? undefined,
    error: answers.error,
    isError: answers.error !== null,
    isFetching: answers.isFetching,
    refetch: answers.refetch,
  };
}

export function useLeadMapPoint(params: LeadMapParams, at: MapSpot | null) {
  const workspaceId = useWorkspaceId();
  return useSectionQuery<MapPeek>({
    queryKey: leadMapKey(workspaceId, "point", params, at ? `${at.placement}:${at.lat},${at.lng}` : ""),
    queryFn: (signal) => {
      if (!at) throw new Error("lead map point needs a position");
      return fetchLeadMapPoint(params, at, signal);
    },
    enabled: at !== null && workspaceId !== "",
  });
}

export function leadAreasKey(workspaceId: string) {
  return [...leadMapsKey(workspaceId), "areas"] as const;
}

export function useLeadAreas(options: { enabled: boolean }) {
  const workspaceId = useWorkspaceId();
  return useSectionQuery<DrawnArea[]>({
    queryKey: leadAreasKey(workspaceId),
    queryFn: (signal) => listLeadAreas(signal),
    enabled: options.enabled && workspaceId !== "",
  });
}
