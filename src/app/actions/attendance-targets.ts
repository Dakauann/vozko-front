import type {
    AttendanceTarget,
    AttendanceTargetsResponse,
    UpsertAttendanceTargetInput,
} from '@/lib/attendance/targets/types';
import type { MetricSpec } from '@/lib/attendance/types';

import { apiClient } from '@/lib/api/browser-client';

const EMPTY_TARGETS: AttendanceTarget[] = [];
const EMPTY_METRICS: MetricSpec[] = [];

export async function listAttendanceTargetsAction(period?: string) {
    const url = period
        ? `/attendance/targets?period=${encodeURIComponent(period)}`
        : '/attendance/targets';

    const response = await apiClient<AttendanceTargetsResponse>(url, {
        method: 'GET',
    });

    if (response.error) {
        return { targets: EMPTY_TARGETS, error: response.error.message };
    }

    return { targets: response.data?.targets ?? EMPTY_TARGETS, error: null };
}

export async function listTargetableMetricsAction() {
    const response = await apiClient<{ metrics: MetricSpec[] }>(
        '/attendance/metrics',
        { method: 'GET' },
    );

    if (response.error) {
        return { metrics: EMPTY_METRICS, error: response.error.message };
    }

    return { metrics: response.data?.metrics ?? EMPTY_METRICS, error: null };
}

export async function upsertAttendanceTargetAction(
    input: UpsertAttendanceTargetInput,
) {
    const response = await apiClient<AttendanceTarget>('/attendance/targets', {
        method: 'PUT',
        body: JSON.stringify(input),
    });

    if (response.error) {
        return { target: null, error: response.error.message };
    }

    return { target: response.data ?? null, error: null };
}

export async function deleteAttendanceTargetAction(id: string) {
    const response = await apiClient<null>(
        `/attendance/targets/${encodeURIComponent(id)}`,
        { method: 'DELETE' },
    );

    if (response.error) {
        return { error: response.error.message };
    }

    return { error: null };
}
