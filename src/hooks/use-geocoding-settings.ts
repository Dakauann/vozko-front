"use client";

import { useCallback, useMemo } from "react";

import { getGeocodingSettingsAction, updateGeocodingSettingsAction } from "@/app/actions/geocoding-settings";
import { useChangeWorkspaceSetting, useWorkspaceSetting } from "@/hooks/use-workspace-setting";
import type { GeocodingChange, GeocodingSettings } from "@/lib/workspace/workspace-config/geocoding";

export const geocodingSettingsQueryKey = (workspaceId: string) => ["geocoding-settings", workspaceId] as const;

export function useGeocodingSettings(workspaceId: string, enabled = true) {
  return useWorkspaceSetting<GeocodingSettings>({
    queryKey: geocodingSettingsQueryKey(workspaceId),
    read: async (signal) => {
      const result = await getGeocodingSettingsAction(workspaceId, signal);
      return result.error ? { value: null, error: result.error } : { value: result.settings, error: null };
    },
    enabled: enabled && workspaceId !== "",
    failure: "geocoding settings failed",
  });
}

export function useChangeGeocodingSettings(workspaceId: string) {
  const queryKey = useMemo(() => geocodingSettingsQueryKey(workspaceId), [workspaceId]);
  const write = useCallback(
    async (change: GeocodingChange) => {
      const result = await updateGeocodingSettingsAction(workspaceId, change);
      return result.error ? { value: null, error: result.error } : { value: result.settings, error: null };
    },
    [workspaceId],
  );
  return useChangeWorkspaceSetting<GeocodingSettings, GeocodingChange>(queryKey, write);
}
