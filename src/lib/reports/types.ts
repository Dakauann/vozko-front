export type ReportKind =
    | "attendance_overview"
    | "conversation_entries"
    | "balance_transactions"
    | "opportunities";

export type ReportFormat = "csv" | "xlsx" | "pdf";

export type ReportStatus = "queued" | "running" | "done" | "failed" | "expired";

export type ReportFailureCode =
    | "unknown_kind"
    | "unsupported_format"
    | "too_many_rows"
    | "render_failed"
    | "upload_failed"
    | "renderer_not_configured"
    | "source_unavailable"
    | "cancelled"
    | "workspace_required"
    | "empty_result";

export interface ReportJob {
    id: string;
    workspaceId: string;
    requestedBy: string;
    kind: ReportKind;
    format: ReportFormat;
    locale?: string;
    status: ReportStatus;
    progress: number;
    filename?: string;
    sizeBytes?: number;
    rowCount?: number;
    failureCode?: ReportFailureCode;
    createdAt: string;
    startedAt?: string;
    finishedAt?: string;
    expiresAt?: string;
}

export interface ReportKindDescriptor {
    kind: ReportKind;
    formats: ReportFormat[];
}

export interface CreateReportRequest {
    kind: ReportKind;
    format: ReportFormat;
    locale?: string;
    params?: Record<string, unknown>;
}

export const TERMINAL_REPORT_STATUSES: readonly ReportStatus[] = [
    "done",
    "failed",
    "expired",
];

export function isTerminalReportStatus(status: ReportStatus): boolean {
    return TERMINAL_REPORT_STATUSES.includes(status);
}

export interface AttendanceReportParams extends Record<string, unknown> {
    dateFrom: string;
    dateTo: string;
    departmentId?: string;
    memberId?: string;
    campaignId?: string;
    campaignType?: string;
    channel?: string;
    includeAi?: boolean;
    rankMetric?: string;
    trendBuckets?: number;
    workspaceName?: string;
    departmentLabel?: string;
    memberLabel?: string;
    channelLabel?: string;
}

export interface BalanceReportParams extends Record<string, unknown> {
    serviceType?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
}

export interface ConversationEntriesReportParams extends Record<string, unknown> {
    entryType: string;
    containerId?: string;
    containerType?: string;
    departmentIds?: string[];
    statuses?: string[];
    stageId?: string;
    number?: string;
    createdFrom?: string;
    createdTo?: string;
    label?: string;
}

export interface OpportunitiesReportParams extends Record<string, unknown> {
    pipelineId: string;
    departmentIds?: string[];
    restrict?: boolean;
    assigneeOverrideUserId?: string;
    label?: string;
}
