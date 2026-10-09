"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchReferencePoint } from "@/app/actions/lead-map";
import { useWorkspace } from "@/contexts/workspace-context";
import { referencePointKey, type ReferencePoint, type ReferencePointQuery } from "@/lib/maps/reference-point";

const REFERENCE_STALE_MS = 60 * 60 * 1000;

export function useReferencePoint(query: ReferencePointQuery | null) {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const result = useQuery({
    queryKey: referencePointKey(workspaceId, query ?? {}),
    queryFn: ({ signal }) => fetchReferencePoint(query ?? {}, signal),
    enabled: query !== null && workspaceId !== "",
    staleTime: REFERENCE_STALE_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const point: ReferencePoint | null = query !== null ? result.data?.point ?? null : null;
  return { point, loading: query !== null && workspaceId !== "" && result.isPending };
}
