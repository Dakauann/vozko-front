"use client";

import { useCallback, useRef, useState } from "react";

import { analyzeNodeAction, testNodeAction } from "@/app/actions/workflows";
import type { NodeAnalysis, TestNodePayload, TestNodeResult } from "@/lib/workflows/types";


export type TestStatus = "idle" | "analyzing" | "ready" | "testing" | "success" | "error";

export interface UseTestNodeReturn {
    status: TestStatus;
    analysis: NodeAnalysis | null;
    result: TestNodeResult | null;
    error: string | null;
    mockedState: Record<string, unknown>;
    triggerVars: Record<string, unknown>;
    analyze: (workflowId: string, nodeId: string) => Promise<void>;
    test: (workflowId: string, nodeId: string, skipExecution?: boolean) => Promise<void>;
    setMockedValue: (key: string, value: unknown) => void;
    setTriggerVar: (key: string, value: unknown) => void;
    reset: () => void;
}


export function useTestNode(): UseTestNodeReturn {
    const requestIdRef = useRef(0);
    const [status, setStatus] = useState<TestStatus>("idle");
    const [analysis, setAnalysis] = useState<NodeAnalysis | null>(null);
    const [result, setResult] = useState<TestNodeResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [mockedState, setMockedState] = useState<Record<string, unknown>>({});
    const [triggerVars, setTriggerVars] = useState<Record<string, unknown>>({});

    const analyze = useCallback(async (workflowId: string, nodeId: string) => {
        const requestId = ++requestIdRef.current;
        setStatus("analyzing");
        setError(null);
        setAnalysis(null);
        setResult(null);

        try {
            const { analysis: analysisResult, error: analysisError } = await analyzeNodeAction(workflowId, nodeId);

            if (requestId !== requestIdRef.current) {
                return;
            }

            if (analysisError) {
                setStatus("error");
                setError(analysisError);
                return;
            }

            if (!analysisResult) {
                setStatus("error");
                setError("No analysis data returned");
                return;
            }

            setAnalysis(analysisResult);

            const initialMocks: Record<string, unknown> = {};
            for (const field of analysisResult.mock_fields) {
                initialMocks[field.key] = "";
            }
            setMockedState(initialMocks);

            setStatus("ready");
        } catch (err) {
            setStatus("error");
            setError(err instanceof Error ? err.message : "Unknown error");
        }
    }, []);

    const test = useCallback(async (workflowId: string, nodeId: string, skipExecution = false) => {
        const requestId = ++requestIdRef.current;
        setStatus("testing");
        setError(null);
        setResult(null);

        try {
            const payload: TestNodePayload = {
                mockedState,
                triggerVars,
                skipExecution,
            };

            const { result: testResult, error: testError } = await testNodeAction(workflowId, nodeId, payload);

            if (requestId !== requestIdRef.current) {
                return;
            }

            if (testError) {
                setStatus("error");
                setError(testError);
                return;
            }

            if (!testResult) {
                setStatus("error");
                setError("No test result returned");
                return;
            }

            setResult(testResult);
            setStatus(testResult.success ? "success" : "error");

            if (!testResult.success && testResult.error) {
                setError(testResult.error);
            }
        } catch (err) {
            setStatus("error");
            setError(err instanceof Error ? err.message : "Unknown error");
        }
    }, [mockedState, triggerVars]);

    const setMockedValue = useCallback((key: string, value: unknown) => {
        setMockedState((prev) => ({ ...prev, [key]: value }));
    }, []);

    const setTriggerVar = useCallback((key: string, value: unknown) => {
        setTriggerVars((prev) => ({ ...prev, [key]: value }));
    }, []);

    const reset = useCallback(() => {
        requestIdRef.current += 1;
        setStatus("idle");
        setAnalysis(null);
        setResult(null);
        setError(null);
        setMockedState({});
        setTriggerVars({});
    }, []);

    return {
        status,
        analysis,
        result,
        error,
        mockedState,
        triggerVars,
        analyze,
        test,
        setMockedValue,
        setTriggerVar,
        reset,
    };
}
