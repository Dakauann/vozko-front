"use client";

import { useCallback, useState } from "react";

import { analyzeNodeAction } from "@/app/actions/workflows";
import type { NodeAnalysis } from "@/lib/workflows/types";


export type AnalysisStatus = "idle" | "loading" | "success" | "error";

export interface UseNodeAnalysisReturn {
    analysis: NodeAnalysis | null;
    status: AnalysisStatus;
    error: string | null;
    analyze: (workflowId: string, nodeId: string) => Promise<void>;
    reset: () => void;
}


export function useNodeAnalysis(): UseNodeAnalysisReturn {
    const [analysis, setAnalysis] = useState<NodeAnalysis | null>(null);
    const [status, setStatus] = useState<AnalysisStatus>("idle");
    const [error, setError] = useState<string | null>(null);

    const analyze = useCallback(async (workflowId: string, nodeId: string) => {
        setStatus("loading");
        setError(null);
        setAnalysis(null);

        try {
            const result = await analyzeNodeAction(workflowId, nodeId);

            if (result.error) {
                setStatus("error");
                setError(result.error);
                return;
            }

            if (!result.analysis) {
                setStatus("error");
                setError("No analysis data returned");
                return;
            }

            setAnalysis(result.analysis);
            setStatus("success");
        } catch (err) {
            setStatus("error");
            setError(err instanceof Error ? err.message : "Unknown error");
        }
    }, []);

    const reset = useCallback(() => {
        setAnalysis(null);
        setStatus("idle");
        setError(null);
    }, []);

    return {
        analysis,
        status,
        error,
        analyze,
        reset,
    };
}
