"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { validateGraphAction } from "@/app/actions/workflows";
import type { LintIssue, WorkflowGraph } from "@/lib/workflows/types";

import { lintSignature } from "./workflow-lint-signature";

export { lintSignature } from "./workflow-lint-signature";

const DEBOUNCE_MS = 600;

const LINT_CACHE_MAX = 100;
const lintCache = new Map<string, { valid: boolean; issues: LintIssue[] }>();
function cacheLintResult(
  signature: string,
  value: { valid: boolean; issues: LintIssue[] },
) {
  lintCache.set(signature, value);
  if (lintCache.size > LINT_CACHE_MAX) {
    const oldest = lintCache.keys().next().value;
    if (oldest !== undefined) lintCache.delete(oldest);
  }
}

export interface WorkflowLintState {
  valid: boolean;
  issues: LintIssue[];
  linting: boolean;
}

export function useWorkflowLint(params: {
  workflowType: string;
  graph: WorkflowGraph;
  enabled?: boolean;
}): WorkflowLintState {
  const { workflowType, graph, enabled = true } = params;

  const signature = useMemo(
    () => lintSignature(workflowType, graph),
    [workflowType, graph],
  );

  const [state, setState] = useState<WorkflowLintState>({
    valid: true,
    issues: [],
    linting: false,
  });

  const graphRef = useRef(graph);
  graphRef.current = graph;
  const seqRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    if ((graphRef.current.nodes?.length ?? 0) === 0) {
      seqRef.current += 1;
      setState({ valid: true, issues: [], linting: false });
      return;
    }

    const cached = lintCache.get(signature);
    if (cached) {
      seqRef.current += 1;
      setState({ valid: cached.valid, issues: cached.issues, linting: false });
      return;
    }

    const seq = ++seqRef.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((prev) => ({ ...prev, linting: true }));

    const handle = setTimeout(async () => {
      const result = await validateGraphAction(workflowType, graphRef.current);
      if (seq !== seqRef.current) return;
      const next = { valid: result.valid, issues: result.issues ?? [] };
      const hadError = "error" in result && Boolean(result.error);
      if (!hadError) cacheLintResult(signature, next);
      setState({ ...next, linting: false });
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, enabled, workflowType]);

  return state;
}
