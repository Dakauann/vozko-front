import type {
    AdminOverview,
    CallAnalyticsReport,
    GetAdminOverviewParams,
    GetCallAnalyticsParams,
    GetPlanContractionsParams,
    GetProfitReportParams,
    PlanContractionsReport,
    ProfitReport,
} from "@/lib/analytics/types";

import { apiClient } from "@/lib/api/browser-client";

export type {
    AdminOverview,
    AnalyticsGranularity,
    CallAnalyticsReport,
    GetAdminOverviewParams,
    GetCallAnalyticsParams,
    GetPlanContractionsParams,
    GetProfitReportParams,
    PlanContraction,
    PlanContractionsReport,
    ProfitReport,
    RecentSpending,
    WorkspaceFinancialSnapshot,
} from "@/lib/analytics/types";

function buildQueryString(params: Record<string, unknown>): string {
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === "") continue;

        if (Array.isArray(value)) {
            if (value.length === 0) continue;
            searchParams.set(key, value.join(","));
            continue;
        }

        searchParams.set(key, String(value));
    }

    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : "";
}

export type AnalyticsActionResult<T> = {
    data?: T;
    error?: string;
    expired?: boolean;
};

async function fetchAnalytics<T>(path: string): Promise<AnalyticsActionResult<T>> {
    const response = await apiClient<T>(path, { method: "GET" });

    if (response.error) {
        return {
            error: response.error.message,
            expired: response.error.code === 'SESSION_EXPIRED',
        };
    }

    return { data: response.data };
}

export async function getProfitReportAction(
    params: GetProfitReportParams,
): Promise<AnalyticsActionResult<ProfitReport>> {
    return fetchAnalytics<ProfitReport>(
        `/admin/analytics/profit${buildQueryString(params as unknown as Record<string, unknown>)}`,
    );
}

export async function getCallAnalyticsAction(
    params: GetCallAnalyticsParams,
): Promise<AnalyticsActionResult<CallAnalyticsReport>> {
    return fetchAnalytics<CallAnalyticsReport>(
        `/admin/analytics/profit/calls${buildQueryString(params as unknown as Record<string, unknown>)}`,
    );
}

export async function getAdminOverviewAction(
    params: GetAdminOverviewParams,
): Promise<AnalyticsActionResult<AdminOverview>> {
    return fetchAnalytics<AdminOverview>(
        `/admin/analytics/overview${buildQueryString(params as unknown as Record<string, unknown>)}`,
    );
}

export async function getPlanContractionsAction(
    params: GetPlanContractionsParams,
): Promise<AnalyticsActionResult<PlanContractionsReport>> {
    return fetchAnalytics<PlanContractionsReport>(
        `/admin/analytics/contractions${buildQueryString(params as unknown as Record<string, unknown>)}`,
    );
}