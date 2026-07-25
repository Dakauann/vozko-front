"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { validateGraphAction } from "@/app/actions/workflows";
import type { LintIssue, WorkflowGraph } from "@/lib/workflows/types";

import { lintSignature } from "./workflow-lint-signature";

export { lintSignature } from "./workflow-lint-signature";

// How long we wait after the last meaningful edit before asking the backend to
// re-lint. Long enough to coalesce a burst of edits (typing a config, dragging
// several connections), short enough to feel live.
const DEBOUNCE_MS = 600;

// Memoize verdicts by graph signature so an identical graph never hits the
// backend twice. Undo/redo, A→B→A edits, and repeated copilot snapshots of the
// same graph all resolve instantly from here, which keeps the validate endpoint
// from being hammered. Bounded so a long editing session can't leak memory.
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
  /** The graph passes every activation rule (no blocking issues). */
  valid: boolean;
  /** Structured issues, exactly what the activation gate would report. */
  issues: LintIssue[];
  /** A re-lint is in flight (a debounced request is pending or running). */
  linting: boolean;
}

/**
 * Runs the full backend lint (the SAME rules `activate` enforces) over the live
 * canvas graph, debounced, and keeps the result in sync as the user edits. The
 * editor surfaces this via the alerts dropdown so validity is always visible,
 * not just at activation time.
 */
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

  // Read the latest graph inside the debounced callback without making the
  // effect depend on the graph's object identity (which changes every render).
  const graphRef = useRef(graph);
  graphRef.current = graph;
  // Guards against a stale in-flight response overwriting a newer one.
  const seqRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    // Nothing on the canvas is trivially valid — skip the round trip entirely.
    if ((graphRef.current.nodes?.length ?? 0) === 0) {
      seqRef.current += 1;
      setState({ valid: true, issues: [], linting: false });
      return;
    }

    // Already know the verdict for this exact graph — serve it instantly, no
    // debounce and no network call.
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
      if (seq !== seqRef.current) return; // superseded by a newer edit
      const next = { valid: result.valid, issues: result.issues ?? [] };
      // Only memoize authoritative verdicts — never a transport error (which
      // reports invalid with no issues and should be retried, not cached).
      const hadError = "error" in result && Boolean(result.error);
      if (!hadError) cacheLintResult(signature, next);
      setState({ ...next, linting: false });
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
    // Re-run only when the meaningful signature changes, not on every render or
    // on pure position moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, enabled, workflowType]);

  return state;
}
