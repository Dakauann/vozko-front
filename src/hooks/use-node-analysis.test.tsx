/**
 * @vitest-environment happy-dom
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { analyzeNodeAction } = vi.hoisted(() => ({
  analyzeNodeAction: vi.fn(),
}));

vi.mock("@/app/actions/workflows", () => ({
  analyzeNodeAction,
}));

import { useNodeAnalysis } from "@/hooks/use-node-analysis";

const analysis = {
  node_id: "node-1",
  node_type: "action_set_variable",
  node_label: "Definir Variavel",
  test_mode: "direct",
  mock_fields: [],
  can_run_direct: true,
  has_ai_deps: false,
  message: "Pode testar diretamente",
} as const;

describe("useNodeAnalysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads analysis successfully", async () => {
    analyzeNodeAction.mockResolvedValue({ analysis });
    const { result } = renderHook(() => useNodeAnalysis());

    await act(async () => {
      await result.current.analyze("wf-1", "node-1");
    });

    expect(result.current.status).toBe("success");
    expect(result.current.analysis).toEqual(analysis);
    expect(result.current.error).toBeNull();
  });

  it("stores action errors and resets cleanly", async () => {
    analyzeNodeAction.mockResolvedValue({ analysis: null, error: "failure" });
    const { result } = renderHook(() => useNodeAnalysis());

    await act(async () => {
      await result.current.analyze("wf-1", "node-1");
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("failure");

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.analysis).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
