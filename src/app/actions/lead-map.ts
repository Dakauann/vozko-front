import { apiClient, type ApiResult } from "@/lib/api/browser-client";
import { requireSectionData } from "@/lib/analytics/section-query";
import { codedErrorOf, type CodedError } from "@/lib/api/coded-error";
import {
  leadMapLayerPath,
  leadMapPointPath,
  leadMapSectionPath,
  parseMapLeftOut,
  parseMapPeek,
  type LeadMapLayerRequest,
  type MapLeftOut,
  type LeadMapParams,
  type MapPeek,
} from "@/lib/leads/map-view";
import {
  parseDistrictCounts,
  parseDrawnArea,
  parseDrawnAreas,
  parseGeoSummary,
  parseMapLayer,
  parseMapViewport,
} from "@/lib/maps/contracts";
import {
  hasReferenceQuery,
  parseReferencePoint,
  referencePointPath,
  type ReferencePoint,
  type ReferencePointQuery,
} from "@/lib/maps/reference-point";
import type {
  AreaShape,
  AreaVisibility,
  DistrictCount,
  DrawnArea,
  GeoSummary,
  MapSpot,
  MapLayerResponse,
  MapViewport,
} from "@/lib/maps/types";

async function section<T>(path: string, what: string, signal?: AbortSignal): Promise<T> {
  return requireSectionData(await apiClient<T>(path, { method: "GET", signal }), what);
}

export async function fetchLeadMapSummary(params: LeadMapParams, signal?: AbortSignal): Promise<GeoSummary> {
  return parseGeoSummary(await section<unknown>(leadMapSectionPath("summary", params), "lead map summary", signal));
}

export async function fetchLeadMapViewport(params: LeadMapParams, signal?: AbortSignal): Promise<MapViewport> {
  return parseMapViewport(await section<unknown>(leadMapSectionPath("viewport", params), "lead map viewport", signal));
}

export async function fetchLeadMapDistricts(params: LeadMapParams, signal?: AbortSignal): Promise<DistrictCount[]> {
  return parseDistrictCounts(await section<unknown>(leadMapSectionPath("districts", params), "lead map districts", signal));
}

export async function fetchLeadMapLayer(
  params: LeadMapParams,
  request: LeadMapLayerRequest,
  signal?: AbortSignal,
): Promise<MapLayerResponse> {
  return parseMapLayer(await section<unknown>(leadMapLayerPath(params, request), "lead map layer", signal));
}

export async function fetchLeadMapLeftOut(params: LeadMapParams, signal?: AbortSignal): Promise<MapLeftOut> {
  return parseMapLeftOut(await section<unknown>(leadMapSectionPath("left-out", params), "lead map left out", signal));
}

export async function fetchLeadMapPoint(params: LeadMapParams, at: MapSpot, signal?: AbortSignal): Promise<MapPeek> {
  return parseMapPeek(await section<unknown>(leadMapPointPath(params, at), "lead map point", signal));
}

export async function listLeadAreas(signal?: AbortSignal): Promise<DrawnArea[]> {
  return parseDrawnAreas(await section<unknown>("/lead-areas", "lead areas", signal));
}

export interface DrawnAreaDraft {
  name: string;
  visibility: AreaVisibility;
  shape: AreaShape;
}

export type DrawnAreaResult = { area: DrawnArea; error: null } | { area: null; error: CodedError };

const EMPTY_AREA_ANSWER: CodedError = { message: "lead area came back empty" };

function areaResult(response: ApiResult<unknown>): DrawnAreaResult {
  if (response.error) return { area: null, error: codedErrorOf(response.error) };
  try {
    return { area: parseDrawnArea(response.data), error: null };
  } catch {
    return { area: null, error: EMPTY_AREA_ANSWER };
  }
}

export async function createLeadAreaAction(draft: DrawnAreaDraft): Promise<DrawnAreaResult> {
  return areaResult(await apiClient<unknown>("/lead-areas", { method: "POST", body: JSON.stringify(draft) }));
}

export interface DrawnAreaPatch {
  name?: string;
  visibility?: AreaVisibility;
}

function areaPath(id: string): string {
  return `/lead-areas/${encodeURIComponent(id)}`;
}

export async function updateLeadAreaAction(id: string, patch: DrawnAreaPatch): Promise<DrawnAreaResult> {
  return areaResult(await apiClient<unknown>(areaPath(id), { method: "PATCH", body: JSON.stringify(patch) }));
}

export interface AreaDeleteResult {
  error: CodedError | null;
}

export async function deleteLeadAreaAction(id: string): Promise<AreaDeleteResult> {
  const response = await apiClient<null>(areaPath(id), { method: "DELETE" });
  return { error: response.error ? codedErrorOf(response.error) : null };
}

export type ReferencePointResult = { point: ReferencePoint; error: null } | { point: null; error: CodedError };

const EMPTY_REFERENCE_QUERY: CodedError = { message: "reference point needs a query" };

const UNREADABLE_REFERENCE_POINT: CodedError = { message: "reference point came back outside the contract" };

export async function fetchReferencePoint(query: ReferencePointQuery, signal?: AbortSignal): Promise<ReferencePointResult> {
  if (!hasReferenceQuery(query)) return { point: null, error: EMPTY_REFERENCE_QUERY };
  const response = await apiClient<unknown>(referencePointPath(query), { method: "GET", signal });
  if (response.error) return { point: null, error: codedErrorOf(response.error) };
  try {
    return { point: parseReferencePoint(response.data), error: null };
  } catch {
    return { point: null, error: UNREADABLE_REFERENCE_POINT };
  }
}
