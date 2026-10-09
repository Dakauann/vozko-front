"use client";

import {
  fetchLeadMapDistricts,
  fetchLeadMapLeftOut,
  fetchLeadMapLayer,
  fetchLeadMapPoint,
  fetchLeadMapSummary,
  fetchLeadMapViewport,
  listLeadAreas,
} from "@/app/actions/lead-map";
import { useWorkspace } from "@/contexts/workspace-context";
import { useSectionQuery } from "@/hooks/use-section-query";
import {
  isSameLeadMapSection,
  leadMapKey,
  leadMapsKey,
  type LeadMapLayerRequest,
  type LeadMapParams,
  type MapLeftOut,
  type MapPeek,
} from "@/lib/leads/map-view";
import type { DistrictCount, DrawnArea, GeoSummary, MapLayerResponse, MapSpot, MapViewport } from "@/lib/maps/types";

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

export function useLeadMapLayer(params: LeadMapParams, request: LeadMapLayerRequest | null, options: { enabled: boolean }) {
  const workspaceId = useWorkspaceId();
  const queryKey = leadMapKey(workspaceId, "layer", params, request?.viewport.key ?? "", request?.colorBy ?? "");
  return useSectionQuery<MapLayerResponse>({
    queryKey,
    queryFn: (signal) => {
      if (!request) throw new Error("lead map layer needs a viewport");
      return fetchLeadMapLayer(params, request, signal);
    },
    enabled: options.enabled && request !== null && workspaceId !== "",
    keepPreviousWhen: (previous) => isSameLeadMapSection(previous, queryKey),
  });
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
