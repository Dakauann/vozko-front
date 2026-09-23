import {
    apiClient,
    fetchWithRefresh,
    getApiBaseUrl,
    scopeHeaders,
} from "@/lib/api/browser-client";
import type {
    CreateReportRequest,
    ReportJob,
    ReportKind,
    ReportKindDescriptor,
    ReportStatus,
} from "@/lib/reports/types";

export interface ReportActionResult<T> {
    data: T | null;
    error: string | null;
}

export async function createReportAction(
    request: CreateReportRequest,
): Promise<ReportActionResult<ReportJob>> {
    const response = await apiClient<ReportJob>("/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
    });

    if (response.error) {
        return { data: null, error: response.error.message };
    }
    return { data: response.data ?? null, error: null };
}

export async function getReportAction(
    id: string,
): Promise<ReportActionResult<ReportJob>> {
    const response = await apiClient<ReportJob>(`/reports/${encodeURIComponent(id)}`, {
        method: "GET",
    });

    if (response.error) {
        return { data: null, error: response.error.message };
    }
    return { data: response.data ?? null, error: null };
}

export interface ReportListFilters {
    kinds?: ReportKind[];
    statuses?: ReportStatus[];
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
}

export interface ReportListPage {
    reports: ReportJob[];
    total: number;
}

export async function listReportsAction(
    filters: ReportListFilters = {},
): Promise<ReportActionResult<ReportListPage>> {
    const query = new URLSearchParams();
    if (filters.kinds?.length) query.set("kind", filters.kinds.join(","));
    if (filters.statuses?.length) query.set("status", filters.statuses.join(","));
    if (filters.from) query.set("from", filters.from);
    if (filters.to) query.set("to", filters.to);
    query.set("limit", String(filters.limit ?? 25));
    if (filters.offset) query.set("offset", String(filters.offset));

    const response = await apiClient<ReportListPage>(`/reports?${query.toString()}`, {
        method: "GET",
    });

    if (response.error) {
        return { data: null, error: response.error.message };
    }
    return {
        data: { reports: response.data?.reports ?? [], total: response.data?.total ?? 0 },
        error: null,
    };
}

export async function listReportKindsAction(): Promise<
    ReportActionResult<ReportKindDescriptor[]>
> {
    const response = await apiClient<{ kinds: ReportKindDescriptor[] }>(
        "/reports/kinds",
        { method: "GET" },
    );

    if (response.error) {
        return { data: null, error: response.error.message };
    }
    return { data: response.data?.kinds ?? [], error: null };
}

export interface ReportFile {
    blob: Blob;
    filename: string;
}

export async function fetchReportFileAction(
    id: string,
): Promise<ReportActionResult<ReportFile>> {
    const response = await fetchWithRefresh(() =>
        fetch(`${getApiBaseUrl()}/reports/${encodeURIComponent(id)}/file`, {
            method: "GET",
            credentials: "include",
            headers: scopeHeaders(),
        }),
    );

    if (!response.ok) {
        let message = `Download failed with status ${response.status}`;
        try {
            const body = (await response.json()) as { message?: string };
            if (body?.message) message = body.message;
        } catch {
            // the body is not JSON; the status line is all we have
        }
        return { data: null, error: message };
    }

    const filename =
        response.headers.get("X-Report-Filename") ??
        filenameFromDisposition(response.headers.get("Content-Disposition")) ??
        "report";

    return { data: { blob: await response.blob(), filename }, error: null };
}

function filenameFromDisposition(header: string | null): string | null {
    if (!header) return null;
    const match = header.match(/filename="?([^";]+)"?/i);
    return match?.[1] ?? null;
}
