"use client";

import { useCallback, useState } from "react";

import {
    exportWhatsAppCampaignEntriesAction,
    exportWhatsAppWorkspaceEntriesAction,
    type CsvExportResult,
} from "@/app/actions/whatsapp-campaigns";
import { downloadCsv } from "@/lib/browser/download";

interface ExportFilters {
    /** One or more send statuses. Empty means every status. */
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

/**
 * Which conversations to export: one campaign, or every campaign in the
 * disparos recorte.
 */
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

/**
 * Download a CSV export, for one campaign or for the whole disparos recorte.
 *
 * It used to take a `campaignType` of "voice" | "whatsapp" that nothing read —
 * a caller asking for "voice" got a WhatsApp export and no warning. The scope
 * argument on exportEntries is the real discriminator.
 */
export function useExportEntries() {
    const [exporting, setExporting] = useState(false);

    const exportEntries = useCallback(
        async (scope: ExportScope, filters?: ExportFilters): Promise<ExportOutcome> => {
            setExporting(true);
            try {
                const queryFilters = toQueryFilters(filters);

                let result: CsvExportResult;
                if (scope.kind === "campaign") {
                    result = await exportWhatsAppCampaignEntriesAction(
                        scope.campaignId,
                        queryFilters,
                    );
                } else {
                    result = await exportWhatsAppWorkspaceEntriesAction({
                        statuses: queryFilters.status as string[] | undefined,
                        type: scope.type,
                        from: scope.from,
                        to: scope.to,
                        search: queryFilters.search as string | undefined,
                    });
                }

                if (result.error) {
                    return { error: result.error };
                }
                if (!result.csvText) {
                    return { error: "noEntries" };
                }

                downloadCsv(result.csvText, result.filename);
                return { success: true };
            } catch {
                return { error: "Failed to export" };
            } finally {
                setExporting(false);
            }
        },
        [],
    );

    return { exporting, exportEntries };
}
