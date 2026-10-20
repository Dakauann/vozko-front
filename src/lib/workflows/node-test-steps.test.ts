import { describe, expect, it } from "vitest";

import { nodeTestSteps } from "./node-test-steps";
import type { TestNodeResult } from "./types";

function result(overrides: Partial<TestNodeResult> = {}): TestNodeResult {
  return {
    node_id: "n5",
    node_type: "action_http_request",
    success: true,
    interpolated_config: { url: "https://api.test/{{secret.token}}" },
    execution_output: { status_code: 200 },
    execution_duration_ms: 42,
    ...overrides,
  };
}

describe("nodeTestSteps", () => {
  it("reads the node test as one step record, so the run viewer's step detail renders it", () => {
    const { target, upstream } = nodeTestSteps(result());
    expect(target).toMatchObject({
      nodeId: "n5",
      nodeType: "action_http_request",
      status: "executed",
      input: { url: "https://api.test/{{secret.token}}" },
      output: { status_code: 200 },
      durationMs: 42,
      attempt: 1,
    });
    expect(upstream).toEqual([]);
  });

  it("marks a failed test as a failed step with its error", () => {
    const { target } = nodeTestSteps(result({ success: false, error: "status 500", execution_output: undefined }));
    expect(target.status).toBe("failed");
    expect(target.error).toBe("status 500");
    expect(target.output).toBeUndefined();
  });

  it("uses the full step record and the upstream steps when the backend sends them", () => {
    const step = {
      id: "t1",
      runId: "test",
      nodeId: "n5",
      nodeType: "action_http_request",
      status: "failed",
      executedAt: "2026-10-20T12:00:00Z",
      attempt: 1,
      durationMs: 15,
      errorKind: "http_status",
      http: [{ method: "POST", url: "https://api.test", latencyMs: 15 }],
    };
    const upstreamStep = { ...step, id: "t0", nodeId: "n4", nodeType: "action_code", status: "executed", http: undefined };
    const read = nodeTestSteps(result({ step, upstream_steps: [upstreamStep] }));
    expect(read.target).toEqual(step);
    expect(read.upstream).toEqual([upstreamStep]);
  });

  it("flags a test served from a pinned output", () => {
    expect(nodeTestSteps(result({ pinned: true })).target.pinned).toBe(true);
  });
});
