import { apiClient } from "@/lib/api/browser-client";
import type {
  Click,
  CreateShortLinkPayload,
  LinkAnalytics,
  PaginatedResponse,
  PaginationMeta,
  ShortLink,
  UpdateShortLinkPayload,
  WorkspaceLinkStats,
} from "@/lib/links/types";

const DEFAULT_META: PaginationMeta = {
  page: 1,
  pageSize: 20,
  totalPages: 1,
  totalItems: 0,
};

export interface ListLinksParams {
  page?: number;
  pageSize?: number;
  departmentId?: string;
}

function apiBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.API_BASE_URL ||
    "http://localhost:3001"
  );
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      sp.set(key, String(value));
    }
  }
  const query = sp.toString();
  return query ? `?${query}` : "";
}

export async function listLinks(
  params: ListLinksParams = {},
): Promise<{ items: ShortLink[]; meta: PaginationMeta; error?: string }> {
  const query = buildQuery({
    page: params.page,
    pageSize: params.pageSize,
    departmentId: params.departmentId,
  });
  const { data, error } = await apiClient<PaginatedResponse<ShortLink>>(
    `/short-links${query}`,
  );
  if (error) {
    return { items: [], meta: DEFAULT_META, error: error.message };
  }
  return { items: data?.data ?? [], meta: data?.meta ?? DEFAULT_META };
}

export async function getLink(
  id: string,
): Promise<{ link?: ShortLink; error?: string }> {
  const { data, error } = await apiClient<ShortLink>(`/short-links/${id}`);
  if (error) return { error: error.message };
  return { link: data };
}

export async function createLink(
  payload: CreateShortLinkPayload,
): Promise<{ link?: ShortLink; error?: string }> {
  const { data, error } = await apiClient<ShortLink>("/short-links", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (error) return { error: error.message };
  return { link: data };
}

export async function updateLink(
  id: string,
  payload: UpdateShortLinkPayload,
): Promise<{ link?: ShortLink; error?: string }> {
  const { data, error } = await apiClient<ShortLink>(`/short-links/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (error) return { error: error.message };
  return { link: data };
}

export async function deleteLink(id: string): Promise<{ error?: string }> {
  const { error } = await apiClient(`/short-links/${id}`, { method: "DELETE" });
  if (error) return { error: error.message };
  return {};
}

export async function getLinkStats(): Promise<{
  stats?: WorkspaceLinkStats;
  error?: string;
}> {
  const { data, error } = await apiClient<WorkspaceLinkStats>(
    "/short-links/stats",
  );
  if (error) return { error: error.message };
  return { stats: data };
}

export async function getLinkAnalytics(
  id: string,
  from?: string,
  to?: string,
): Promise<{ analytics?: LinkAnalytics; error?: string }> {
  const query = buildQuery({ from, to });
  const { data, error } = await apiClient<LinkAnalytics>(
    `/short-links/${id}/analytics${query}`,
  );
  if (error) return { error: error.message };
  return { analytics: data };
}

export async function getLinkClicks(
  id: string,
  page = 1,
  pageSize = 20,
): Promise<{ items: Click[]; meta: PaginationMeta; error?: string }> {
  const query = buildQuery({ page, pageSize });
  const { data, error } = await apiClient<PaginatedResponse<Click>>(
    `/short-links/${id}/clicks${query}`,
  );
  if (error) return { items: [], meta: DEFAULT_META, error: error.message };
  return { items: data?.data ?? [], meta: data?.meta ?? DEFAULT_META };
}

export function qrImageUrl(id: string, workspaceId: string, size = 256): string {
  return `${apiBaseUrl()}/short-links/${id}/qr${buildQuery({
    workspace_id: workspaceId,
    size,
  })}`;
}

export async function downloadQr(
  id: string,
  workspaceId: string,
  code: string,
): Promise<void> {
  const response = await fetch(qrImageUrl(id, workspaceId, 512), {
    credentials: "include",
    headers: { "X-Workspace-ID": workspaceId },
  });
  if (!response.ok) {
    throw new Error("Failed to download QR code");
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `qr-${code}.png`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
