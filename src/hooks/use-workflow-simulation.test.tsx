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

function startedSimulation() {
  const view = renderHook(() => useWorkflowSimulation({ workflowId: "wf-1" }));
  act(() => {
    void view.result.current.start();
  });
  const socket = FakeWebSocket.instances[0];
  act(() => socket.simulateOpen());
  return { ...view, socket };
}

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
