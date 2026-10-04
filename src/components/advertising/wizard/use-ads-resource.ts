"use client";

import { useCallback, useEffect, useRef } from "react";

import { isAdsError, type AdsResult } from "@/app/actions/advertising";
import { useKeyedLoad } from "@/hooks/use-keyed-load";

export type Resource<T> = { status: "idle" } | { status: "loading" } | { status: "error"; message: string; code?: string } | { status: "ready"; data: T };

export function useAdsResource<T>(key: string | null, load: () => Promise<AdsResult<T>>): Resource<T> & { reload: () => void } {
  const loader = useRef(load);

  useEffect(() => {
    loader.current = load;
  });

  const stableLoad = useCallback(() => loader.current(), []);
  const { value, loading, reload } = useKeyedLoad(key, stableLoad);

  if (key === null) return { status: "idle", reload };
  if (loading || value === null) return { status: "loading", reload };
  if (isAdsError(value)) return { status: "error", message: value.error, code: value.code, reload };
  return { status: "ready", data: value.data, reload };
}

export function readyData<T>(resource: Resource<T>): T | undefined {
  return resource.status === "ready" ? resource.data : undefined;
}
