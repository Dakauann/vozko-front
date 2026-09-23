"use client";

import { useCallback } from "react";

import {
    exportWhatsAppCampaignEntriesAction,
    exportWhatsAppWorkspaceEntriesAction,
    type ExportQueueResult,
} from "@/app/actions/whatsapp-campaigns";
import { useReportJob } from "@/hooks/use-report-job";

interface ExportFilters {
    statuses?: string[];
    search?: string;
    stageId?: string;
    interest?: string;
    disposition?: string;
    sentiment?: string;
    qualification?: string;
    nextAction?: string;
    hasAnalysis?: boolean;
    attendanceQualityMin?: number;
    attendanceQualityMax?: number;
}

export type ExportScope =
    | { kind: "campaign"; campaignId: string }
    | { kind: "workspace"; type?: string; from?: string; to?: string };

type ExportOutcome = { success: true } | { error: string };

function toQueryFilters(filters?: ExportFilters): Record<string, string | string[] | undefined> {
    const clean: Record<string, string | string[] | undefined> = {};
    for (const [key, value] of Object.entries(filters ?? {})) {
        if (value === undefined || value === null || value === "") continue;
        if (Array.isArray(value)) {
            if (value.length > 0) clean[key === "statuses" ? "status" : key] = value;
            continue;
        }
        clean[key] = String(value);
    }
    return clean;
}

export function useExportEntries() {
    const { running: exporting, track } = useReportJob();

    const exportEntries = useCallback(
        async (scope: ExportScope, filters?: ExportFilters): Promise<ExportOutcome> => {
            const queryFilters = toQueryFilters(filters);

            let queued: ExportQueueResult;
            try {
                if (scope.kind === "campaign") {
                    queued = await exportWhatsAppCampaignEntriesAction(
                        scope.campaignId,
                        queryFilters,
                    );
                } else {
                    queued = await exportWhatsAppWorkspaceEntriesAction({
                        statuses: queryFilters.status as string[] | undefined,
                        type: scope.type,
                        from: scope.from,
                        to: scope.to,
                        search: queryFilters.search as string | undefined,
                    });
                }
            } catch {
                return { error: "Failed to export" };
            }

            if (queued.error || !queued.job) {
                return { error: queued.error ?? "Failed to export" };
            }

            const settled = await track(queued.job);
            if (settled.status === "error") {
                return { error: settled.error };
            }
            if (settled.status === "failed") {
                return {
                    error:
                        settled.job.failureCode === "empty_result"
                            ? "noEntries"
                            : settled.job.failureCode === "too_many_rows"
                              ? "tooLarge"
                              : (settled.job.failureCode ?? "Failed to export"),
                };
            }
            return { success: true };
        },
        [track],
    );

    return { exporting, exportEntries };
}
