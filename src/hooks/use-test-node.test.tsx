
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

  it("fills mock fields with recorded run values and leaves unrecorded ones empty", async () => {
    analyzeNodeAction.mockResolvedValue({
      analysis: { ...analysis, mock_fields: [...analysis.mock_fields, { key: "_ai_reply", display_name: "ai.reply", source: "ai" }] },
    });
    const { result } = renderHook(() => useTestNode());
    const recorded: Record<string, unknown> = { _last_body: { ok: true } };

    await act(async () => {
      await result.current.analyze("wf-1", "node-1", (key) => recorded[key]);
    });

    expect(result.current.mockedState).toEqual({ _last_body: { ok: true }, _ai_reply: "" });
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

  it("asks for real calls only when the user ticked the confirmation", async () => {
    testNodeAction.mockResolvedValue({ result: testResult });
    const { result } = renderHook(() => useTestNode());

    await act(async () => {
      await result.current.test("wf-1", "node-1", false, true);
    });

    expect(testNodeAction).toHaveBeenLastCalledWith("wf-1", "node-1", expect.objectContaining({ confirmRealCalls: true }));
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

  it("keeps the code of a refused analysis or test so the section can translate it", async () => {
    analyzeNodeAction.mockResolvedValue({ analysis: null, error: "raw", status: 501, code: "node_test_unavailable" });
    testNodeAction.mockResolvedValue({ result: null, error: "raw", status: 404, code: "node_not_found" });
    const { result } = renderHook(() => useTestNode());

    await act(async () => {
      await result.current.analyze("wf-1", "node-1");
    });
    expect(result.current.errorCode).toBe("node_test_unavailable");

    await act(async () => {
      await result.current.test("wf-1", "node-1");
    });
    expect(result.current.errorCode).toBe("node_not_found");

    act(() => {
      result.current.reset();
    });
    expect(result.current.errorCode).toBeNull();
  });

  it("keeps the status of a refused analysis or test so the section can tell no access from not found", async () => {
    analyzeNodeAction.mockResolvedValue({ analysis: null, error: "You don't have access to this workflow", status: 403 });
    testNodeAction.mockResolvedValue({ result: null, error: "Nó não encontrado no rascunho", status: 404 });
    const { result } = renderHook(() => useTestNode());

    await act(async () => {
      await result.current.analyze("wf-1", "node-1");
    });
    expect(result.current.errorStatus).toBe(403);

    await act(async () => {
      await result.current.test("wf-1", "node-1");
    });
    expect(result.current.errorStatus).toBe(404);

    act(() => {
      result.current.reset();
    });
    expect(result.current.errorStatus).toBeNull();
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
