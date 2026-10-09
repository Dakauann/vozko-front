"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { fetchPlaces } from "@/app/actions/places";
import { useWorkspace } from "@/contexts/workspace-context";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { CodedRefusal } from "@/lib/api/coded-error";
import { PLACE_DEBOUNCE_MS, coveredStatesOf, placeQueryKey, placeRequestReady, type Place, type PlaceRequest } from "@/lib/maps/places";

const PLACE_STALE_MS = 60 * 60 * 1000;

export interface PlaceSuggestions {
  places: Place[];
  coveredStates: string[];
  error: CodedRefusal | null;
  loading: boolean;
  settled: boolean;
}

export function usePlaceSuggestions(request: PlaceRequest, enabled = true): PlaceSuggestions {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const text = useDebouncedValue(request.text, PLACE_DEBOUNCE_MS);
  const settledRequest: PlaceRequest = { ...request, text };
  const ready = enabled && workspaceId !== "" && placeRequestReady(settledRequest);
  const result = useQuery({
    queryKey: placeQueryKey(workspaceId, settledRequest),
    queryFn: ({ signal }) => fetchPlaces(settledRequest, signal),
    enabled: ready,
    staleTime: PLACE_STALE_MS,
    gcTime: PLACE_STALE_MS,
    refetchOnWindowFocus: false,
    retry: false,
    placeholderData: keepPreviousData,
  });
  const data = ready ? result.data : undefined;
  const error = data?.error ?? null;
  return {
    places: data?.answer?.places ?? [],
    coveredStates: data?.answer?.coveredStates ?? coveredStatesOf(error),
    error,
    loading: ready && result.isFetching,
    settled: text === request.text,
  };
}
