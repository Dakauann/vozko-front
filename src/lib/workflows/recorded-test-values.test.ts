import { describe, expect, it } from "vitest";

import type { RunDetail, WorkflowRunLog } from "./types";
import { recordedStepValues } from "./recorded-test-values";

function step(nodeId: string, output?: Record<string, unknown>): WorkflowRunLog {
  return { id: `${nodeId}-step`, runId: "r1", nodeId, nodeType: "action_code", status: "executed", executedAt: "2026-10-19T10:00:00Z", attempt: 1, durationMs: 1, output };
}

function detail(steps: WorkflowRunLog[], state: Record<string, unknown> = {}): RunDetail {
  return {
    run: {
      id: "r1",
      workflowId: "w1",
      workspaceId: "ws",
      entryId: "e1",
      entryType: "whatsapp",
      status: "completed",
      state,
      retryCount: 0,
      startedAt: "2026-10-19T10:00:00Z",
      updatedAt: "2026-10-19T10:00:00Z",
    },
    logs: steps,
  };
}

describe("recordedStepValues", () => {
  it("reads last.<campo> from the step right before, not from the end of the run", () => {
    const run = detail([step("login", { status_code: 200 }), step("check", { status_code: 404 }), step("send")], { _last_status_code: 500 });

    const valueFor = recordedStepValues(run, 2);

    expect(valueFor("_last_status_code")).toBe(404);
  });

  it("skips earlier steps that produced no such field", () => {
    const run = detail([step("login", { token: "••••" }), step("wait", {}), step("send")]);

    expect(recordedStepValues(run, 2)("_last_token")).toBe("••••");
  });

  it("reads node.<id>.<campo> from that node's latest step before this one", () => {
    const run = detail([step("n55", { status_code: 201 }), step("loop"), step("n55", { status_code: 503 }), step("send"), step("n55", { status_code: 999 })]);

    expect(recordedStepValues(run, 3)("_node_n55_status_code")).toBe(503);
  });

  it("tells node ids that share a prefix apart", () => {
    const run = detail([step("n5", { x_status: "short" }), step("n5_x", { status: "long" }), step("send")]);

    const valueFor = recordedStepValues(run, 2);

    expect(valueFor("_node_n5_x_status")).toBe("long");
  });

  it("returns a node's whole output for node.<id>", () => {
    const run = detail([step("n1", { a: 1 }), step("send")]);

    expect(recordedStepValues(run, 1)("_node_n1")).toEqual({ a: 1 });
  });

  it("falls back to the recorded run state for variables and AI captures", () => {
    const run = detail([step("send")], { nome: "Ana", _ai_resposta: "ok", campvars: { curso: "ADS" } });

    const valueFor = recordedStepValues(run, 0);

    expect(valueFor("nome")).toBe("Ana");
    expect(valueFor("_ai_resposta")).toBe("ok");
    expect(valueFor("campvars.curso")).toBe("ADS");
  });

  it("returns undefined for values the run never recorded, so the field stays empty", () => {
    const run = detail([step("send")]);

    expect(recordedStepValues(run, 0)("_last_body")).toBeUndefined();
    expect(recordedStepValues(run, 0)("campvars.curso")).toBeUndefined();
  });
});
