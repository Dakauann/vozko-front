"use client";

import { useCallback, useSyncExternalStore } from "react";

import { useHostWindow } from "@/contexts/host-document-context";

export const DESKTOP_QUERY = "(min-width: 1024px)";
export const FINE_POINTER_QUERY = "(pointer: fine)";

export function useMediaQuery(query: string): boolean {
  const hostWindow = useHostWindow();
  const media = useCallback(() => {
    const target = hostWindow ?? (typeof window === "undefined" ? undefined : window);
    return target?.matchMedia?.(query) ?? null;
  }, [hostWindow, query]);

  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = media();
      list?.addEventListener?.("change", onChange);
      return () => list?.removeEventListener?.("change", onChange);
    },
    [media],
  );

  return useSyncExternalStore(subscribe, () => media()?.matches ?? false, () => false);
}
