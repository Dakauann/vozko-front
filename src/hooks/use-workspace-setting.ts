"use client";

import { useCallback } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

import { useSectionQuery } from "@/hooks/use-section-query";
import { SectionError } from "@/lib/analytics/section-query";
import type { CodedError } from "@/lib/api/coded-error";

export type SettingOutcome<T> = { value: T; error: null } | { value: null; error: CodedError };

export function useWorkspaceSetting<T>({
  queryKey,
  read,
  enabled,
  failure,
}: {
  queryKey: QueryKey;
  read: (signal: AbortSignal) => Promise<SettingOutcome<T>>;
  enabled: boolean;
  failure: string;
}) {
  return useSectionQuery<T>({
    queryKey,
    queryFn: async (signal) => {
      const result = await read(signal);
      if (result.error) throw new SectionError(result.error.code ?? result.error.message ?? failure, result.error.status);
      return result.value;
    },
    enabled,
  });
}

export function useChangeWorkspaceSetting<T, C>(queryKey: QueryKey, write: (change: C) => Promise<SettingOutcome<T>>) {
  const client = useQueryClient();
  return useCallback(
    async (change: C): Promise<CodedError | null> => {
      const result = await write(change);
      if (result.error) return result.error;
      client.setQueryData<T>(queryKey, result.value);
      return null;
    },
    [client, queryKey, write],
  );
}
