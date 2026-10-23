"use client";

import { useQuery } from "@tanstack/react-query";

import { listApiKeysAction } from "@/app/actions/api-keys";
import { EMAIL_QUERY_OPTIONS, unwrapEmailResult, useEmailWorkspaceId } from "@/hooks/use-email-marketing";

export function useApiKeys(enabled = true) {
  const workspaceId = useEmailWorkspaceId();
  return useQuery({
    ...EMAIL_QUERY_OPTIONS,
    queryKey: ["api-keys", workspaceId] as const,
    queryFn: async ({ signal }) => unwrapEmailResult(await listApiKeysAction(signal)),
    enabled: enabled && workspaceId !== "",
    staleTime: 30_000,
  });
}
