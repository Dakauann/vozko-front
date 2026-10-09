import { apiClient } from "@/lib/api/browser-client";
import { codedErrorOf, type CodedError } from "@/lib/api/coded-error";
import { readGeocodingSettings, type GeocodingChange, type GeocodingSettings } from "@/lib/workspace/workspace-config/geocoding";

export type GeocodingSettingsResult = { settings: GeocodingSettings; error: null } | { settings: null; error: CodedError };

const MALFORMED_ANSWER: CodedError = { message: "Malformed geocoding settings" };

function geocodingPath(workspaceId: string): string {
  return `/workspaces/${encodeURIComponent(workspaceId)}/geocoding`;
}

async function geocodingRequest(
  workspaceId: string,
  init: { method: "GET" | "PUT"; body?: string; signal?: AbortSignal },
): Promise<GeocodingSettingsResult> {
  const response = await apiClient<unknown>(geocodingPath(workspaceId), init);
  if (response.error) return { settings: null, error: codedErrorOf(response.error) };
  const settings = readGeocodingSettings(response.data);
  if (!settings) return { settings: null, error: MALFORMED_ANSWER };
  return { settings, error: null };
}

export async function getGeocodingSettingsAction(workspaceId: string, signal?: AbortSignal): Promise<GeocodingSettingsResult> {
  return geocodingRequest(workspaceId, { method: "GET", signal });
}

export async function updateGeocodingSettingsAction(workspaceId: string, change: GeocodingChange): Promise<GeocodingSettingsResult> {
  return geocodingRequest(workspaceId, { method: "PUT", body: JSON.stringify(change) });
}
