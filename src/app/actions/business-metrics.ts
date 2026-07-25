import type {
    MetricsListParams,
    MetricsListResponse,
    MetricsStatsParams,
    MetricsStatsResponse,
    MetricsTimeSeriesParams,
    MetricsTimeSeriesResponse,
} from "@/lib/business-metrics/types";

import { apiClient } from "@/lib/api/browser-client";

export type {
    BusinessMetric,
    MetricsListParams,
    MetricsListResponse,
    MetricsStatsParams,
    MetricsStatsResponse,
    MetricsTimeSeriesParams,
    MetricsTimeSeriesResponse,
    TimeSeriesDataPoint,
} from "@/lib/business-metrics/types";


function buildQueryString(params: MetricsListParams | MetricsStatsParams | MetricsTimeSeriesParams): string {
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) continue;

        if (Array.isArray(value)) {
            searchParams.set(key, JSON.stringify(value));
        } else {
            searchParams.set(key, String(value));
        }
    }

    return searchParams.toString();
}


export async function getBusinessMetricsAction(
    params: MetricsListParams = {}
): Promise<{ data?: MetricsListResponse; error?: string }> {
    const queryString = buildQueryString(params);
    const url = `/admin/business-metrics${queryString ? `?${queryString}` : ""}`;

    const response = await apiClient<MetricsListResponse>(url, {
        method: "GET",
        cache: "no-store",
    });

    if (response.error) {
        return { error: response.error.message };
    }

    return { data: response.data };
}


export async function getBusinessMetricsStatsAction(
    params: MetricsStatsParams = {}
): Promise<{ data?: MetricsStatsResponse; error?: string }> {
    const queryString = buildQueryString(params);
    const url = `/admin/business-metrics/stats${queryString ? `?${queryString}` : ""}`;

    const response = await apiClient<MetricsStatsResponse>(url, {
        method: "GET",
        cache: "no-store",
    });

    if (response.error) {
        return { error: response.error.message };
    }

    return { data: response.data };
}


export async function getBusinessMetricsTimeSeriesAction(
    params: MetricsTimeSeriesParams = {}
): Promise<{ data?: MetricsTimeSeriesResponse; error?: string }> {
    const queryString = buildQueryString(params);
    const url = `/admin/business-metrics/timeseries${queryString ? `?${queryString}` : ""}`;

    const response = await apiClient<MetricsTimeSeriesResponse>(url, {
        method: "GET",
        cache: "no-store",
    });

    if (response.error) {
        return { error: response.error.message };
    }

    return { data: response.data };
}
