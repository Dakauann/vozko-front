"use client";

import { useCallback, useState } from "react";

import { exportWhatsAppCampaignEntriesAction } from "@/app/actions/whatsapp-campaigns";

type ExportCampaignType = "voice" | "whatsapp";

interface ExportFilters {
    status?: string;
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

export function useExportEntries(campaignType: ExportCampaignType) {
    const [exporting, setExporting] = useState(false);

    const exportEntries = useCallback(
        async (campaignId: string, filters?: ExportFilters) => {
            setExporting(true);
            try {
                const cleanFilters: Record<string, string> = {};
                if (filters) {
                    for (const [key, value] of Object.entries(filters)) {
                        if (value === undefined || value === null || value === "") {
                            continue;
                        }
                        cleanFilters[key] = String(value);
                    }
                }

                const result = await exportWhatsAppCampaignEntriesAction(
                    campaignId,
                    cleanFilters,
                );

                if (result.error) {
                    return { error: result.error };
                }

                if (!result.csvText) {
                    return { error: "noEntries" };
                }

                const blob = new Blob([result.csvText], {
                    type: "text/csv;charset=utf-8;",
                });
                const downloadUrl = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = downloadUrl;
                a.download = result.filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(downloadUrl);

                return { success: true };
            } catch {
                return { error: "Failed to export" };
            } finally {
                setExporting(false);
            }
        },
        [campaignType],
    );

    return { exporting, exportEntries };
}
