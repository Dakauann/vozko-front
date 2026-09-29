export type LiveDecisionEffect =
    | "stage_moved"
    | "stage_uncertain"
    | "memory_review_skipped"
    | "deal_review_skipped";

export const LIVE_DECISION_EFFECTS: LiveDecisionEffect[] = [
    "stage_moved",
    "stage_uncertain",
    "memory_review_skipped",
    "deal_review_skipped",
];

export interface LiveDecisionSummary {
    workspaceId: string;
    workspaceName: string;
    decisions: number;
    failures: number;
    costMicros: number;
    avgLatencyMs: number;
    effects: Partial<Record<LiveDecisionEffect, number>>;
}

export interface LiveRead {
    interest?: string;
    disposition?: string;
    sentiment?: string;
    qualification?: string;
    nextAction?: string;
    language?: string;
    attendanceQuality: number;
    certainty?: Record<string, number>;
    decidedAt: string;
}

export function failureRate(summary: LiveDecisionSummary): number {
    const attempts = summary.decisions + summary.failures;
    return attempts === 0 ? 0 : summary.failures / attempts;
}
