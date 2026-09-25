import type {
    AttendanceOverviewParams,
    AttendanceStatsParams,
    AttendanceStatsResponse,
    AttendantStats,
    ResponseTimeDistributionResponse,
    WindowStatsResponse,
} from '@/lib/attendance/types';

import { apiClient } from "@/lib/api/browser-client";
import {
    AttendanceSectionError,
    sectionQueryParams,
    type AttendanceSection,
    type AttendanceSectionPayloads,
} from "@/lib/attendance/sections";


const EMPTY_ATTENDANTS: AttendantStats[] = [];


function buildQueryString(params: Record<string, string | undefined>): string {
    const qs = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
            qs.set(key, String(value));
        }
    }

    const str = qs.toString();
    return str ? `?${str}` : '';
}


export async function getAttendanceStatsAction(params: AttendanceStatsParams = {}) {
    const queryString = buildQueryString({
        date_from: params.dateFrom,
        date_to: params.dateTo,
        campaign_id: params.campaignId,
        campaign_type: params.campaignType,
    });

    const url = `/attendance/stats${queryString}`;

    const response = await apiClient<AttendanceStatsResponse>(url, {
        method: 'GET',
    });

    if (response.error) {
        return {
            attendants: EMPTY_ATTENDANTS,
            error: response.error.message,
        };
    }

    return {
        attendants: response.data?.attendants ?? EMPTY_ATTENDANTS,
        error: null,
    };
}

export async function getWindowStatsAction(params: AttendanceStatsParams = {}) {
    const queryString = buildQueryString({
        campaign_id: params.campaignId,
        campaign_type: params.campaignType,
    });

    const url = `/attendance/windows${queryString}`;

    const response = await apiClient<WindowStatsResponse>(url, {
        method: 'GET',
    });

    if (response.error) {
        return {
            stats: null as WindowStatsResponse | null,
            error: response.error.message,
        };
    }

    return {
        stats: response.data ?? null,
        error: null,
    };
}

export async function getResponseTimeDistributionAction(params: AttendanceStatsParams = {}) {
    const queryString = buildQueryString({
        date_from: params.dateFrom,
        date_to: params.dateTo,
        campaign_id: params.campaignId,
        campaign_type: params.campaignType,
    });

    const url = `/attendance/response-times${queryString}`;

    const response = await apiClient<ResponseTimeDistributionResponse>(url, {
        method: 'GET',
    });

    if (response.error) {
        return {
            distribution: null as ResponseTimeDistributionResponse | null,
            error: response.error.message,
        };
    }

    return {
        distribution: response.data ?? null,
        error: null,
    };
}

export async function fetchAttendanceSection<S extends AttendanceSection>(
    section: S,
    params: AttendanceOverviewParams,
    signal?: AbortSignal,
): Promise<AttendanceSectionPayloads[S]> {
    const query = new URLSearchParams(sectionQueryParams(section, params)).toString();
    const url = `/attendance/overview/${section}${query ? `?${query}` : ''}`;

    const response = await apiClient<AttendanceSectionPayloads[S]>(url, { method: 'GET', signal });

    if (response.error) {
        throw new AttendanceSectionError(response.error.message, response.error.status);
    }
    if (!response.data) {
        throw new AttendanceSectionError(`attendance section ${section} came back empty`);
    }
    return response.data;
}
