export type TargetScope = "workspace" | "department" | "member";

export interface AttendanceTarget {
    id: string;
    workspaceId: string;
    scope: TargetScope;
    scopeId?: string;
    metricKey: string;
    periodStart: string;
    value: number;
    currency?: string;
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
}

export interface UpsertAttendanceTargetInput {
    scope: TargetScope;
    scopeId?: string;
    metricKey: string;
    period: string;
    value: number;
    currency?: string;
}

export interface AttendanceTargetsResponse {
    targets: AttendanceTarget[];
}
