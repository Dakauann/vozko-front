"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { listCustomFieldsAction } from "@/app/actions/custom-fields";
import { useWorkspace } from "@/contexts/workspace-context";
import type { CustomFieldDefinition, CustomFieldObjectType } from "@/lib/crm/custom-fields";

const DEFINITIONS_STALE_MS = 60_000;

export function customFieldDefinitionsKey(objectType: CustomFieldObjectType, workspaceId: string) {
  return ["custom-fields", objectType, workspaceId] as const;
}

export function useCustomFieldDefinitions(objectType: CustomFieldObjectType, enabled = true) {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const client = useQueryClient();
  const queryKey = customFieldDefinitionsKey(objectType, workspaceId);
  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<CustomFieldDefinition[]> => {
      const result = await listCustomFieldsAction(objectType);
      if (result.error) throw new Error(result.error);
      return [...result.fields].sort((a, b) => a.position - b.position);
    },
    enabled: enabled && workspaceId !== "",
    staleTime: DEFINITIONS_STALE_MS,
    refetchOnWindowFocus: false,
  });
  const definitions = useMemo(() => query.data ?? [], [query.data]);
  const reload = useCallback(
    () => client.invalidateQueries({ queryKey: customFieldDefinitionsKey(objectType, workspaceId) }),
    [client, objectType, workspaceId],
  );
  return {
    definitions,
    loading: query.isPending,
    loaded: query.isSuccess,
    failed: query.isError,
    retrying: query.isFetching,
    reload,
  };
}
