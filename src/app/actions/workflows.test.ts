/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiClient } = vi.hoisted(() => ({
  apiClient: vi.fn(),
}));

vi.mock("@/lib/api/browser-client", () => ({ apiClient }));

import { analyzeNodeAction, testNodeAction } from "@/app/actions/workflows";

const analysis = {
  node_id: "node-1",
  node_type: "action_set_variable",
  node_label: "Definir Variavel",
  test_mode: "mock",
  mock_fields: [
    {
      key: "_last_body",
      display_name: "last.body",
      source: "previous_node",
    },
  ],
  can_run_direct: false,
  has_ai_deps: false,
  message: "Precisa de mocks",
} as const;

const testResult = {
  node_id: "node-1",
  node_type: "action_set_variable",
  success: true,
  interpolated_config: { value: "ok" },
  execution_output: { value: "ok" },
  execution_duration_ms: 12,
} as const;

describe("workflow test-node server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("propagates auth errors for analyzeNodeAction", async () => {
    apiClient.mockResolvedValue({ error: { message: "Auth required", status: 401 } });

    await expect(analyzeNodeAction("wf-1", "node-1")).resolves.toEqual({
      analysis: null,
      error: "Auth required",
    });
  });

  it("returns analyze payload on success", async () => {
    apiClient.mockResolvedValue({ data: analysis });

    await expect(analyzeNodeAction("wf-1", "node-1")).resolves.toEqual({
      analysis,
    });
    expect(apiClient).toHaveBeenCalledTimes(1);
  });

  it("returns execution errors for testNodeAction", async () => {
    apiClient.mockResolvedValue({ error: { message: "boom" } });

    await expect(
      testNodeAction("wf-1", "node-1", { mockedState: { _last_body: "x" } }),
    ).resolves.toEqual({
      result: null,
      error: "boom",
    });
  });

  it("returns test payload on success", async () => {
    apiClient.mockResolvedValue({ data: testResult });

    await expect(
      testNodeAction("wf-1", "node-1", {
        mockedState: { _last_body: "body" },
        triggerVars: { message: "oi" },
        skipExecution: false,
      }),
    ).resolves.toEqual({
      result: testResult,
    });
  });
});