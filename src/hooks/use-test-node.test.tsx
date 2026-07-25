/**
 * @vitest-environment happy-dom
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { analyzeNodeAction, testNodeAction } = vi.hoisted(() => ({
  analyzeNodeAction: vi.fn(),
  testNodeAction: vi.fn(),
}));

vi.mock("@/app/actions/workflows", () => ({
  analyzeNodeAction,
  testNodeAction,
}));

import { useTestNode } from "@/hooks/use-test-node";

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
  interpolated_config: { value: "Response was: ok" },
  execution_output: { value: "Response was: ok" },
  execution_duration_ms: 8,
} as const;

describe("useTestNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
      resolve = res;
    });
    return { promise, resolve };
  }

  it("analyzes nodes and pre-populates mock fields", async () => {
    analyzeNodeAction.mockResolvedValue({ analysis });
    const { result } = renderHook(() => useTestNode());

    await act(async () => {
      await result.current.analyze("wf-1", "node-1");
    });

    expect(result.current.status).toBe("ready");
    expect(result.current.analysis).toEqual(analysis);
    expect(result.current.mockedState).toEqual({ _last_body: "" });
  });

  it("executes tests with the current mock and trigger payload", async () => {
    analyzeNodeAction.mockResolvedValue({ analysis });
    testNodeAction.mockResolvedValue({ result: testResult });
    const { result } = renderHook(() => useTestNode());

    await act(async () => {
      await result.current.analyze("wf-1", "node-1");
    });

    act(() => {
      result.current.setMockedValue("_last_body", "ok");
      result.current.setTriggerVar("message", "oi");
    });

    await act(async () => {
      await result.current.test("wf-1", "node-1");
    });

    expect(testNodeAction).toHaveBeenCalledWith("wf-1", "node-1", {
      mockedState: { _last_body: "ok" },
      triggerVars: { message: "oi" },
      skipExecution: false,
    });
    expect(result.current.status).toBe("success");
    expect(result.current.result).toEqual(testResult);
  });

  it("surfaces execution failures and resets state", async () => {
    testNodeAction.mockResolvedValue({ result: null, error: "broken" });
    const { result } = renderHook(() => useTestNode());

    await act(async () => {
      await result.current.test("wf-1", "node-1");
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("broken");

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.analysis).toBeNull();
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("ignores stale analyze responses when a newer request wins", async () => {
    const first = deferred<{ analysis: typeof analysis }>();
    const newerAnalysis = {
      ...analysis,
      node_id: "node-2",
      node_label: "Outro no",
    } as const;

    analyzeNodeAction.mockReturnValueOnce(first.promise);
    analyzeNodeAction.mockResolvedValueOnce({ analysis: newerAnalysis });

    const { result } = renderHook(() => useTestNode());

    await act(async () => {
      void result.current.analyze("wf-1", "node-1");
    });

    await act(async () => {
      await result.current.analyze("wf-1", "node-2");
    });

    expect(result.current.analysis).toEqual(newerAnalysis);
    expect(result.current.status).toBe("ready");

    await act(async () => {
      first.resolve({ analysis });
      await first.promise;
    });

    expect(result.current.analysis).toEqual(newerAnalysis);
    expect(result.current.status).toBe("ready");
  });
});
