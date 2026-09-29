import { apiClient } from "@/lib/api/browser-client";
import type { LiveDecisionSummary } from "@/lib/live-decisions/types";

export async function adminLiveDecisionSummaryAction(days: number): Promise<{
    summaries: LiveDecisionSummary[];
    error?: { message: string; status?: number };
}> {
    const response = await apiClient<LiveDecisionSummary[]>(`/admin/live-decisions/summary?days=${days}`, {
        method: "GET",
    });
    if (response.error) {
        return { summaries: [], error: { message: response.error.message, status: response.error.status } };
    }
    return { summaries: response.data ?? [] };
}
