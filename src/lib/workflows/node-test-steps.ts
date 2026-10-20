import type { TestNodeResult, WorkflowRunLog } from "./types";

export interface NodeTestSteps {
  target: WorkflowRunLog;
  upstream: WorkflowRunLog[];
}

function legacyStep(result: TestNodeResult): WorkflowRunLog {
  return {
    id: `test:${result.node_id}`,
    runId: "",
    nodeId: result.node_id,
    nodeType: result.node_type,
    status: result.success ? "executed" : "failed",
    input: result.interpolated_config,
    output: result.execution_output,
    error: result.error,
    executedAt: "",
    attempt: 1,
    durationMs: result.execution_duration_ms,
    ...(result.pinned ? { pinned: true } : {}),
  };
}

export function nodeTestSteps(result: TestNodeResult): NodeTestSteps {
  const target = result.step ?? legacyStep(result);
  return {
    target: result.pinned && !target.pinned ? { ...target, pinned: true } : target,
    upstream: result.upstream_steps ?? [],
  };
}
