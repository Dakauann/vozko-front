"use client";

import { useCallback, useRef, useState } from "react";

import { analyzeNodeAction, testNodeAction } from "@/app/actions/workflows";
import type { NodeAnalysis, TestNodePayload, TestNodeResult } from "@/lib/workflows/types";


type TestStatus = "idle" | "analyzing" | "ready" | "testing" | "success" | "error";

interface UseTestNodeReturn {
    status: TestStatus;
    analysis: NodeAnalysis | null;
    result: TestNodeResult | null;
    error: string | null;
    errorStatus: number | null;
    errorCode: string | null;
    mockedState: Record<string, unknown>;
    triggerVars: Record<string, unknown>;
    analyze: (workflowId: string, nodeId: string, recordedValue?: (key: string) => unknown) => Promise<void>;
    test: (workflowId: string, nodeId: string, skipExecution?: boolean, confirmRealCalls?: boolean) => Promise<void>;
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
    const [errorStatus, setErrorStatus] = useState<number | null>(null);
    const [errorCode, setErrorCode] = useState<string | null>(null);
    const [mockedState, setMockedState] = useState<Record<string, unknown>>({});
    const [triggerVars, setTriggerVars] = useState<Record<string, unknown>>({});

    const analyze = useCallback(async (workflowId: string, nodeId: string, recordedValue?: (key: string) => unknown) => {
        const requestId = ++requestIdRef.current;
        setStatus("analyzing");
        setError(null);
        setErrorStatus(null);
        setErrorCode(null);
        setAnalysis(null);
        setResult(null);

        try {
            const { analysis: analysisResult, error: analysisError, status: analysisStatus, code: analysisCode } = await analyzeNodeAction(workflowId, nodeId);

            if (requestId !== requestIdRef.current) {
                return;
            }

            if (analysisError) {
                setStatus("error");
                setError(analysisError);
                setErrorStatus(analysisStatus ?? null);
                setErrorCode(analysisCode ?? null);
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
                initialMocks[field.key] = recordedValue?.(field.key) ?? "";
            }
            setMockedState(initialMocks);

            setStatus("ready");
        } catch (err) {
            setStatus("error");
            setError(err instanceof Error ? err.message : "Unknown error");
        }
    }, []);

    const test = useCallback(async (workflowId: string, nodeId: string, skipExecution = false, confirmRealCalls = false) => {
        const requestId = ++requestIdRef.current;
        setStatus("testing");
        setError(null);
        setErrorStatus(null);
        setErrorCode(null);
        setResult(null);

        try {
            const payload: TestNodePayload = {
                mockedState,
                triggerVars,
                skipExecution,
                ...(confirmRealCalls ? { confirmRealCalls: true } : {}),
            };

            const { result: testResult, error: testError, status: testStatus, code: testCode } = await testNodeAction(workflowId, nodeId, payload);

            if (requestId !== requestIdRef.current) {
                return;
            }

            if (testError) {
                setStatus("error");
                setError(testError);
                setErrorStatus(testStatus ?? null);
                setErrorCode(testCode ?? null);
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
        setErrorStatus(null);
        setErrorCode(null);
        setMockedState({});
        setTriggerVars({});
    }, []);

    return {
        status,
        analysis,
        result,
        error,
        errorStatus,
        errorCode,
        mockedState,
        triggerVars,
        analyze,
        test,
        setMockedValue,
        setTriggerVar,
        reset,
    };
}
