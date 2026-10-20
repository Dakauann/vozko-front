import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeWebSocket } from "@/test/fake-websocket";

vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "ws-1" } }) }));

import { useWorkflowSimulation } from "@/hooks/use-workflow-simulation";

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
});

afterEach(() => vi.unstubAllGlobals());

const runNow = (flush: () => void) => flush();

function sentTypes(socket: FakeWebSocket): string[] {
  return socket.sent.map((raw) => (JSON.parse(raw) as { type: string }).type);
}

function sentOf(socket: FakeWebSocket, type: string) {
  return socket.sent.map((raw) => JSON.parse(raw) as { type: string; data?: unknown }).filter((msg) => msg.type === type);
}

function openSimulation(start?: Parameters<ReturnType<typeof useWorkflowSimulation>["start"]>[0]) {
  const view = renderHook(() => useWorkflowSimulation({ workflowId: "wf-1", schedule: runNow }));
  act(() => view.result.current.start(start));
  const socket = FakeWebSocket.instances[0];
  act(() => socket.simulateOpen());
  return { ...view, socket };
}

function startedSimulation() {
  const opened = openSimulation();
  act(() => opened.socket.receive("sim_ready", { workflowId: "wf-1", triggerType: "trigger_call_received", realCallNodes: [] }));
  return opened;
}

describe("useWorkflowSimulation handshake", () => {
  it("connects with await_start and starts only after sim_ready, with the breakpoints already set", () => {
    const view = renderHook(() => useWorkflowSimulation({ workflowId: "wf-1", schedule: runNow }));
    act(() => view.result.current.setBreakpoints(["n2"]));
    act(() => view.result.current.start());
    const socket = FakeWebSocket.instances[0];
    expect(new URL(socket.url).searchParams.get("await_start")).toBe("1");
    act(() => socket.simulateOpen());
    expect(socket.sent).toEqual([]);

    act(() => socket.receive("sim_ready", { workflowId: "wf-1", triggerType: "trigger_webhook", realCallNodes: [] }));
    expect(sentTypes(socket)).toEqual(["set_breakpoints", "start"]);
    expect(sentOf(socket, "set_breakpoints")[0].data).toEqual({ nodeIds: ["n2"] });
  });

  it("sends a run until before the start, so the first pause lands on that node", () => {
    const { socket } = openSimulation({ runUntil: "n7" });
    act(() => socket.receive("sim_ready", { realCallNodes: [] }));
    expect(sentTypes(socket)).toEqual(["set_breakpoints", "run_until", "start"]);
  });

  it("reproduces a run instead of starting a fresh one", () => {
    const { socket, result } = openSimulation({ reproduceRunId: "r-9" });
    act(() => socket.receive("sim_ready", { realCallNodes: ["n1"] }));
    expect(sentTypes(socket)).toEqual(["set_breakpoints", "reproduce_run"]);
    expect(sentOf(socket, "reproduce_run")[0].data).toEqual({ runId: "r-9" });
    act(() => socket.receive("sim_started", { runId: "s1", realCallNodes: [], reproducing: { runId: "r-9", workflowVersion: 2, pinnedNodes: ["n1"] } }));
    expect(result.current.reproducing).toEqual({ runId: "r-9", workflowVersion: 2, pinnedNodes: ["n1"] });
  });
});

describe("useWorkflowSimulation real calls", () => {
  it("asks before starting a test that would call out, then confirms for the session and starts", () => {
    const { socket, result } = openSimulation();
    act(() => socket.receive("sim_ready", { realCallNodes: ["n1", "n2"] }));
    expect(result.current.status).toBe("confirming");
    expect(result.current.pendingRealCalls).toEqual(["n1", "n2"]);
    expect(sentTypes(socket)).toEqual(["set_breakpoints"]);

    act(() => result.current.confirmRealCalls());
    expect(sentTypes(socket)).toEqual(["set_breakpoints", "confirm_real_calls", "start"]);
    expect(result.current.pendingRealCalls).toEqual([]);
  });

  it("does not ask again on the next test of the same session", () => {
    const { socket, result } = openSimulation();
    act(() => socket.receive("sim_ready", { realCallNodes: ["n1"] }));
    act(() => result.current.confirmRealCalls());
    act(() => socket.receive("run_completed", { vars: {} }));

    act(() => result.current.start());
    const next = FakeWebSocket.instances[1];
    act(() => next.simulateOpen());
    act(() => next.receive("sim_ready", { realCallNodes: ["n1"] }));
    expect(sentTypes(next)).toEqual(["set_breakpoints", "confirm_real_calls", "start"]);
  });

  it("starts without confirming when the user prefers no real calls", () => {
    const { socket, result } = openSimulation();
    act(() => socket.receive("sim_ready", { realCallNodes: ["n1"] }));
    act(() => result.current.skipRealCalls());
    expect(sentTypes(socket)).toEqual(["set_breakpoints", "start"]);
  });

  it("restarts with the confirmation after a refused real call", () => {
    const { socket, result } = openSimulation();
    act(() => socket.receive("sim_ready", { realCallNodes: ["n1"] }));
    act(() => result.current.skipRealCalls());
    act(() => socket.receive("run_error", { error: "chamada real" }));

    act(() => result.current.retryWithRealCalls("n1"));
    const next = FakeWebSocket.instances[1];
    act(() => next.simulateOpen());
    act(() => next.receive("sim_ready", { realCallNodes: ["n1"] }));
    expect(sentTypes(next)).toEqual(["set_breakpoints", "confirm_real_calls", "start"]);
  });
});

describe("useWorkflowSimulation debugging", () => {
  it("steps and continues from a pause, leaving the paused state at once", () => {
    const { socket, result } = startedSimulation();
    act(() => socket.receive("sim_started", { runId: "s1", realCallNodes: [] }));
    act(() => socket.receive("paused", { nodeId: "n3", nodeType: "action_code", stepIndex: 1, reason: "breakpoint", state: { a: 1 } }));
    expect(result.current.status).toBe("paused");
    expect(result.current.stateVars).toEqual({ a: 1 });

    act(() => result.current.step());
    expect(sentTypes(socket).at(-1)).toBe("step");
    expect(result.current.status).toBe("running");

    act(() => socket.receive("paused", { nodeId: "n4", nodeType: "end", stepIndex: 2, reason: "step", state: {} }));
    act(() => result.current.resume());
    expect(sentTypes(socket).at(-1)).toBe("continue");
  });

  it("sends a new breakpoint list to a live session", () => {
    const { socket, result } = startedSimulation();
    act(() => result.current.setBreakpoints(["a", "b"]));
    expect(sentOf(socket, "set_breakpoints").at(-1)?.data).toEqual({ nodeIds: ["a", "b"] });
  });

  it("runs until a node in the live session instead of starting over", () => {
    const { socket, result } = startedSimulation();
    act(() => socket.receive("sim_started", { runId: "s1", realCallNodes: [] }));
    act(() => result.current.runUntil("n9"));
    expect(sentOf(socket, "run_until").at(-1)?.data).toEqual({ nodeId: "n9" });
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("applies a burst of steps in one update when the frame comes", () => {
    let pending: (() => void) | null = null;
    const view = renderHook(() => useWorkflowSimulation({ workflowId: "wf-1", schedule: (flush) => (pending = flush) }));
    act(() => view.result.current.start());
    const socket = FakeWebSocket.instances[0];
    act(() => socket.simulateOpen());
    act(() => {
      socket.receive("node_executed", { id: "s1", nodeId: "a", nodeType: "x", status: "executed", stepIndex: 0 });
      socket.receive("node_executed", { id: "s2", nodeId: "b", nodeType: "x", status: "executed", stepIndex: 1 });
    });
    expect(view.result.current.steps).toHaveLength(0);
    act(() => pending?.());
    expect(view.result.current.steps.map((step) => step.nodeId)).toEqual(["a", "b"]);
  });
});

describe("useWorkflowSimulation customer replies", () => {
  function waitingSimulation() {
    const opened = startedSimulation();
    act(() => opened.socket.receive("sim_started", { runId: "r1", workflowId: "wf-1" }));
    act(() => opened.socket.receive("waiting_reply", { nodeId: "n2", timeoutSeconds: 30 }));
    return opened;
  }

  it("sends a tapped button as the selection the webhook would deliver, and shows the reply only when the server echoes it", () => {
    const { result, socket } = waitingSimulation();
    const eventsBefore = result.current.events.length;

    act(() => result.current.sendReply({ kind: "selection", choice: { kind: "button", id: "sim", title: "Sim" } }));

    expect(sentOf(socket, "reply_selection")).toEqual([{ type: "reply_selection", data: { kind: "button", id: "sim", title: "Sim" } }]);
    expect(result.current.status).toBe("running");
    expect(result.current.events).toHaveLength(eventsBefore);

    act(() => socket.receive("message_received", { direction: "inbound", message: { id: "in-1", direction: "INBOUND", messageType: "user_message", text: "Sim" } }));
    expect(result.current.events.at(-1)).toMatchObject({ type: "message", direction: "inbound", text: "Sim" });
  });

  it("sends typed text, a location and a media reply through the same path", () => {
    const { result, socket } = waitingSimulation();
    act(() => result.current.sendReply({ kind: "text", text: "oi" }));
    act(() => result.current.sendReply({ kind: "location", latitude: -23.5, longitude: -46.6, name: "Campus" }));
    act(() => result.current.sendReply({ kind: "media", media: "image", url: "https://cdn.test/a.png" }));
    expect(socket.sent.map((raw) => JSON.parse(raw)).slice(-3)).toEqual([
      { type: "reply", data: { text: "oi" } },
      { type: "reply_location", data: { latitude: -23.5, longitude: -46.6, name: "Campus" } },
      { type: "reply_media", data: { kind: "image", url: "https://cdn.test/a.png" } },
    ]);
  });
});

describe("useWorkflowSimulation for voice workflows", () => {
  it("waits for a key and sends the pressed key back to the run", () => {
    const { result, socket } = startedSimulation();
    act(() => socket.receive("sim_started", { runId: "r1", workflowId: "wf-1" }));
    act(() => socket.receive("message_sent", { direction: "outbound", text: "Menu principal", msgType: "audio", messageId: "a1", audioUrl: "https://files/menu.mp3" }));
    act(() => socket.receive("waiting_key", { timeoutSeconds: 8 }));

    expect(result.current.status).toBe("waiting_key");
    expect(result.current.events).toContainEqual(expect.objectContaining({ type: "message", audioUrl: "https://files/menu.mp3" }));

    act(() => result.current.sendKey("1"));

    expect(socket.sent.map((raw) => JSON.parse(raw))).toContainEqual({ type: "key", data: { key: "1" } });
    expect(result.current.status).toBe("running");
    expect(result.current.events.at(-1)).toMatchObject({ direction: "inbound", text: "1", msgType: "key" });
  });

  it("marks a dropped connection during a key wait as an error, not a success", () => {
    const { result, socket } = startedSimulation();
    act(() => socket.receive("waiting_key", { timeoutSeconds: 8 }));
    act(() => socket.onclose?.({}));
    expect(result.current.status).toBe("error");
  });
});

describe("useWorkflowSimulation identity", () => {
  it("returns the same value across renders while nothing changed, so a memoised test panel skips canvas frames", () => {
    const view = renderHook(() => useWorkflowSimulation({ workflowId: "wf-1", schedule: runNow }));
    const first = view.result.current;
    view.rerender();
    expect(view.result.current).toBe(first);
  });
});
