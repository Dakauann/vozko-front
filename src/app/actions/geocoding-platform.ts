import { apiClient } from "@/lib/api/browser-client";
import { codedErrorOf, type CodedError } from "@/lib/api/coded-error";
import { readGeocodingPlatformPage, type GeocodingPlatformPage } from "@/lib/workspace/workspace-config/geocoding-platform";

export type GeocodingPlatformResult = { page: GeocodingPlatformPage; error: null } | { page: null; error: CodedError };

export interface GeocodingPlatformQuery {
  page: number;
  pageSize: number;
  search: string;
}

const MALFORMED_ANSWER: CodedError = { message: "Malformed geocoding usage" };

export async function adminListGeocodingUsageAction(query: GeocodingPlatformQuery, signal?: AbortSignal): Promise<GeocodingPlatformResult> {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
  const search = query.search.trim();
  if (search) params.set("search", search);
  const response = await apiClient<unknown>(`/admin/geocoding/workspaces?${params.toString()}`, { method: "GET", signal });
  if (response.error) return { page: null, error: codedErrorOf(response.error) };
  const page = readGeocodingPlatformPage(response.data);
  if (!page) return { page: null, error: MALFORMED_ANSWER };
  return { page, error: null };
}
