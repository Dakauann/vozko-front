
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useWorkflowAIBuilder } from "./use-workflow-ai-builder";

const workspace = vi.hoisted(() => ({ id: "ws1" }));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: workspace.id } }),
}));

class FakeWS {
  static instances: FakeWS[] = [];
  static OPEN = 1;
  url: string;
  readyState = 1;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(url: string) {
    this.url = url;
    FakeWS.instances.push(this);
  }
  send(d: string) {
    this.sent.push(d);
  }
  closed = false;
  close() {
    this.closed = true;
    this.readyState = 3;
  }
  drop() {
    this.readyState = 3;
    this.onclose?.();
  }
  emit(obj: unknown) {
    this.onmessage?.({ data: JSON.stringify(obj) });
  }
}

beforeEach(() => {
  FakeWS.instances = [];
  workspace.id = "ws1";
  // @ts-expect-error override global for test
  global.WebSocket = FakeWS;
});

afterEach(() => {
  vi.useRealTimers();
});

async function mountConnected(onGraph?: (g: unknown) => void) {
  const hook = renderHook(() =>
    useWorkflowAIBuilder({ workflowId: "wf1", workflowType: "messages", onGraph: onGraph as never }),
  );
  await waitFor(() => expect(FakeWS.instances.length).toBe(1));
  return { hook, ws: FakeWS.instances[0] };
}

describe("useWorkflowAIBuilder", () => {
  it("connects to the edit route and pins workflow type on ready", async () => {
    const { hook, ws } = await mountConnected();
    expect(ws.url).toContain("/ws/workflows/wf1/ai-builder");
    expect(ws.url).not.toContain("token=");
    expect(ws.url).toContain("workspace_id=ws1");

    act(() => ws.emit({ type: "builder_ready", payload: { workflowType: "messages" } }));
    expect(hook.result.current.status).toBe("ready");
    const sentTypes = ws.sent.map((s) => JSON.parse(s).type);
    expect(sentTypes).toContain("set_workflow_type");
  });

  it("uses the create route when workflowId is empty", async () => {
    renderHook(() => useWorkflowAIBuilder({ workflowId: "", workflowType: "messages" }));
    await waitFor(() => expect(FakeWS.instances.length).toBe(1));
    expect(FakeWS.instances[0].url).toContain("/ws/workflows/ai-builder");
    expect(FakeWS.instances[0].url).not.toContain("/ws/workflows//ai-builder");
  });

  it("streams graph snapshots to onGraph and tracks issues + validity during a build", async () => {
    const onGraph = vi.fn();
    const { hook, ws } = await mountConnected(onGraph);
    act(() => ws.emit({ type: "builder_ready", payload: {} }));
    act(() => hook.result.current.sendPrompt("crie um fluxo"));
    const graph = { nodes: [{ id: "n1" }], edges: [] };
    act(() =>
      ws.emit({
        type: "graph_snapshot",
        payload: {
          graph,
          issues: [{ code: "GRAPH_NO_END", severity: "blocking", message: "sem fim" }],
          valid: false,
        },
      }),
    );
    expect(onGraph).toHaveBeenCalledWith(graph);
    expect(hook.result.current.issues).toHaveLength(1);
    expect(hook.result.current.valid).toBe(false);
  });

  it("does NOT apply graph snapshots outside an active build (canvas is the source of truth)", async () => {
    const onGraph = vi.fn();
    const { ws } = await mountConnected(onGraph);
    act(() => ws.emit({ type: "builder_ready", payload: {} }));
    act(() =>
      ws.emit({
        type: "graph_snapshot",
        payload: { graph: { nodes: [], edges: [] }, issues: [], valid: true },
      }),
    );
    expect(onGraph).not.toHaveBeenCalled();
  });

  it("stops applying snapshots once a build is done (a later re-sync can't wipe the canvas)", async () => {
    const onGraph = vi.fn();
    const { hook, ws } = await mountConnected(onGraph);
    act(() => ws.emit({ type: "builder_ready", payload: {} }));
    act(() => hook.result.current.sendPrompt("monte"));
    const built = { nodes: [{ id: "n1" }, { id: "n2" }], edges: [] };
    act(() => ws.emit({ type: "graph_snapshot", payload: { graph: built, valid: true } }));
    expect(onGraph).toHaveBeenCalledWith(built);
    act(() => ws.emit({ type: "done", payload: { valid: true, summary: "ok" } }));
    onGraph.mockClear();
    act(() =>
      ws.emit({
        type: "graph_snapshot",
        payload: { graph: { nodes: [], edges: [] }, valid: false },
      }),
    );
    expect(onGraph).not.toHaveBeenCalled();
  });

  it("re-hydrates the server with the canvas graph on builder_ready", async () => {
    const graph = { nodes: [{ id: "n1", type: "end", position: { x: 0, y: 0 }, config: {} }], edges: [] };
    const hook = renderHook(() =>
      useWorkflowAIBuilder({
        workflowId: "wf1",
        workflowType: "messages",
        getGraph: () => graph as never,
      }),
    );
    await waitFor(() => expect(FakeWS.instances.length).toBe(1));
    const ws = FakeWS.instances[0];
    act(() => ws.emit({ type: "builder_ready", payload: {} }));
    const hydrate = ws.sent.map((s) => JSON.parse(s)).find((m) => m.type === "hydrate_graph");
    expect(hydrate).toBeTruthy();
    expect(hydrate.data.graph).toEqual(graph);
    void hook;
  });

  it("does not send hydrate_graph when the canvas is empty", async () => {
    const hook = renderHook(() =>
      useWorkflowAIBuilder({
        workflowId: "",
        workflowType: "messages",
        getGraph: () => ({ nodes: [], edges: [] }) as never,
      }),
    );
    await waitFor(() => expect(FakeWS.instances.length).toBe(1));
    const ws = FakeWS.instances[0];
    act(() => ws.emit({ type: "builder_ready", payload: {} }));
    expect(ws.sent.map((s) => JSON.parse(s).type)).not.toContain("hydrate_graph");
    void hook;
  });

  it("sends user_prompt and records it in chat", async () => {
    const { hook, ws } = await mountConnected();
    act(() => ws.emit({ type: "builder_ready", payload: {} }));
    act(() => hook.result.current.sendPrompt("crie um fluxo"));
    const prompts = ws.sent
      .map((s) => JSON.parse(s))
      .filter((m) => m.type === "user_prompt");
    expect(prompts).toHaveLength(1);
    expect(prompts[0].data.text).toBe("crie um fluxo");
    expect(hook.result.current.chat.some((c) => c.role === "user")).toBe(true);
    expect(hook.result.current.status).toBe("building");
  });

  it("ignores empty prompts", async () => {
    const { hook, ws } = await mountConnected();
    act(() => hook.result.current.sendPrompt("   "));
    expect(ws.sent.filter((s) => JSON.parse(s).type === "user_prompt")).toHaveLength(0);
  });

  it("handles iteration, resource_resolved and done events", async () => {
    const { hook, ws } = await mountConnected();
    act(() => ws.emit({ type: "iteration", payload: { n: 2, max: 30, tokensUsed: 1500, tokenBudget: 400000 } }));
    expect(hook.result.current.iteration).toBe(2);
    expect(hook.result.current.tokensUsed).toBe(1500);

    act(() => ws.emit({ type: "resource_resolved", payload: { kind: "agents", query: "sup", matches: [{ id: "a1", name: "Suporte" }] } }));
    expect(hook.result.current.lastResources?.matches[0].id).toBe("a1");

    act(() => ws.emit({ type: "done", payload: { valid: true, summary: "pronto" } }));
    expect(hook.result.current.status).toBe("done");
    expect(hook.result.current.valid).toBe(true);
    expect(hook.result.current.chat.some((c) => c.role === "system")).toBe(true);
  });

  it("forwards meta events (name/description/type) to onMeta", async () => {
    const onMeta = vi.fn();
    const hook = renderHook(() =>
      useWorkflowAIBuilder({ workflowId: "", workflowType: "messages", onMeta }),
    );
    await waitFor(() => expect(FakeWS.instances.length).toBe(1));
    const ws = FakeWS.instances[0];
    act(() =>
      ws.emit({
        type: "meta",
        payload: { name: "Atendimento", description: "fluxo", workflowType: "messages" },
      }),
    );
    expect(onMeta).toHaveBeenCalledWith({
      name: "Atendimento",
      description: "fluxo",
      workflowType: "messages",
    });
    void hook;
  });

  it("streams assistant_delta tokens into a single live bubble, then finalizes", async () => {
    const { hook, ws } = await mountConnected();
    act(() => ws.emit({ type: "assistant_delta", payload: { text: "Vou " } }));
    act(() => ws.emit({ type: "assistant_delta", payload: { text: "criar o fluxo." } }));
    let assistants = hook.result.current.chat.filter((c) => c.role === "assistant");
    expect(assistants).toHaveLength(1);
    expect(assistants[0].text).toBe("Vou criar o fluxo.");
    expect(assistants[0].streaming).toBe(true);
    act(() => ws.emit({ type: "assistant_done", payload: { tools: 0 } }));
    assistants = hook.result.current.chat.filter((c) => c.role === "assistant");
    expect(assistants[0].streaming).toBe(false);
  });

  it("renders tool execution events in chat", async () => {
    const { hook, ws } = await mountConnected();
    act(() => ws.emit({ type: "tool", payload: { name: "add_node", summary: "trigger → n1", ok: true } }));
    act(() => ws.emit({ type: "tool", payload: { name: "connect", summary: "n1 não existe", ok: false } }));
    const tools = hook.result.current.chat.filter((c) => c.role === "tool");
    expect(tools).toHaveLength(2);
    expect(tools[0].text).toContain("add_node");
    expect(tools[1].ok).toBe(false);
  });

  it("pins the chosen model on builder_ready", async () => {
    const hook = renderHook(() =>
      useWorkflowAIBuilder({ workflowId: "wf1", workflowType: "messages", model: "anthropic/claude-opus-4" }),
    );
    await waitFor(() => expect(FakeWS.instances.length).toBe(1));
    const ws = FakeWS.instances[0];
    act(() => ws.emit({ type: "builder_ready", payload: {} }));
    const setModels = ws.sent.map((s) => JSON.parse(s)).filter((m) => m.type === "set_model");
    expect(setModels.length).toBeGreaterThanOrEqual(1);
    expect(
      setModels.every((m) => m.data.model === "anthropic/claude-opus-4"),
    ).toBe(true);
    void hook;
  });

  it("sends the reasoning level beside the model on builder_ready", async () => {
    renderHook(() => useWorkflowAIBuilder({ workflowId: "wf1", workflowType: "messages", model: "lab/thinker", reasoning: "high" }));
    await waitFor(() => expect(FakeWS.instances.length).toBe(1));
    const ws = FakeWS.instances[0];
    act(() => ws.emit({ type: "builder_ready", payload: {} }));
    const setModels = ws.sent.map((s) => JSON.parse(s)).filter((m) => m.type === "set_model");
    expect(setModels.at(-1).data).toEqual({ model: "lab/thinker", reasoning: "high" });
  });

  it("sends the model again when the reasoning level changes", async () => {
    const hook = renderHook(({ reasoning }) => useWorkflowAIBuilder({ workflowId: "wf1", workflowType: "messages", model: "lab/thinker", reasoning }), {
      initialProps: { reasoning: "" },
    });
    await waitFor(() => expect(FakeWS.instances.length).toBe(1));
    const ws = FakeWS.instances[0];
    hook.rerender({ reasoning: "low" });
    const setModels = ws.sent.map((s) => JSON.parse(s)).filter((m) => m.type === "set_model");
    expect(setModels.at(-1).data).toEqual({ model: "lab/thinker", reasoning: "low" });
  });

  it("surfaces error events", async () => {
    const { hook, ws } = await mountConnected();
    act(() => ws.emit({ type: "error", payload: { error: "falhou" } }));
    expect(hook.result.current.status).toBe("error");
  });

  it("sends cancel when requested", async () => {
    const { hook, ws } = await mountConnected();
    act(() => hook.result.current.cancel());
    expect(ws.sent.map((s) => JSON.parse(s).type)).toContain("cancel");
  });
});

describe("useWorkflowAIBuilder session identity", () => {
  type Props = { workflowId: string; model?: string; reasoning?: string };

  function mountEditor(initialProps: Props, onGraph?: (g: unknown) => void) {
    const hook = renderHook(
      (props: Props) =>
        useWorkflowAIBuilder({ workflowType: "messages", onGraph: onGraph as never, ...props }),
      { initialProps },
    );
    expect(FakeWS.instances).toHaveLength(1);
    return { hook, ws: FakeWS.instances[0] };
  }

  function seventeenNodes() {
    return { nodes: Array.from({ length: 17 }, (_, i) => ({ id: `n${i}` })), edges: [] };
  }

  it("keeps the socket and the running build when autosave gives the new workflow its id", () => {
    const onGraph = vi.fn();
    const { hook, ws } = mountEditor({ workflowId: "" }, onGraph);
    act(() => ws.emit({ type: "builder_ready", payload: {} }));
    act(() => hook.result.current.sendPrompt("crie um fluxo de atendimento"));
    act(() => ws.emit({ type: "graph_snapshot", payload: { graph: seventeenNodes(), valid: false } }));

    hook.rerender({ workflowId: "wf1" });

    expect(FakeWS.instances).toHaveLength(1);
    expect(ws.closed).toBe(false);
    const later = { nodes: [...seventeenNodes().nodes, { id: "n17" }], edges: [] };
    act(() => ws.emit({ type: "graph_snapshot", payload: { graph: later, valid: true } }));
    expect(onGraph).toHaveBeenLastCalledWith(later);
    act(() => ws.emit({ type: "done", payload: { valid: true, summary: "pronto" } }));
    expect(hook.result.current.status).toBe("done");
  });

  it("does not reconnect when an idle new workflow receives its id", () => {
    const { hook, ws } = mountEditor({ workflowId: "" });
    act(() => ws.emit({ type: "builder_ready", payload: {} }));
    hook.rerender({ workflowId: "wf1" });
    expect(FakeWS.instances).toHaveLength(1);
    expect(ws.closed).toBe(false);
  });

  it("reconnects to the other workflow's route when the editor moves to a different saved workflow", () => {
    const { hook, ws } = mountEditor({ workflowId: "wfA" });
    hook.rerender({ workflowId: "wfB" });
    expect(ws.closed).toBe(true);
    expect(FakeWS.instances).toHaveLength(2);
    expect(FakeWS.instances[1].url).toContain("/ws/workflows/wfB/ai-builder");
  });

  it("reconnects to the create route when a new workflow is opened from a saved one", () => {
    const { hook, ws } = mountEditor({ workflowId: "wf1" });
    hook.rerender({ workflowId: "" });
    expect(ws.closed).toBe(true);
    expect(FakeWS.instances).toHaveLength(2);
    expect(FakeWS.instances[1].url).toContain("/ws/workflows/ai-builder?");
  });

  it("reconnects in the new workspace when the workspace changes", () => {
    const { hook, ws } = mountEditor({ workflowId: "wf1" });
    workspace.id = "ws2";
    hook.rerender({ workflowId: "wf1" });
    expect(ws.closed).toBe(true);
    expect(FakeWS.instances).toHaveLength(2);
    expect(FakeWS.instances[1].url).toContain("workspace_id=ws2");
  });

  it("reconnects to the saved workflow's route after a drop that follows creation", () => {
    vi.useFakeTimers();
    const { hook, ws } = mountEditor({ workflowId: "" });
    hook.rerender({ workflowId: "wf1" });
    expect(FakeWS.instances).toHaveLength(1);
    act(() => ws.drop());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(FakeWS.instances).toHaveLength(2);
    expect(FakeWS.instances[1].url).toContain("/ws/workflows/wf1/ai-builder");
  });

  it("closes the socket on unmount during a build and never schedules a reconnect", () => {
    vi.useFakeTimers();
    const { hook, ws } = mountEditor({ workflowId: "" });
    act(() => ws.emit({ type: "builder_ready", payload: {} }));
    act(() => hook.result.current.sendPrompt("monte"));
    hook.unmount();
    expect(ws.closed).toBe(true);
    ws.drop();
    vi.advanceTimersByTime(60000);
    expect(FakeWS.instances).toHaveLength(1);
  });

  it("keeps one socket through a fast double change from no id to the created id", () => {
    const { hook, ws } = mountEditor({ workflowId: "" });
    act(() => {
      hook.rerender({ workflowId: "wf1" });
      hook.rerender({ workflowId: "wf1" });
    });
    expect(FakeWS.instances).toHaveLength(1);
    expect(ws.closed).toBe(false);
  });

  it("sends model and reasoning changes on the same socket after creation", () => {
    const { hook, ws } = mountEditor({ workflowId: "", model: "lab/a", reasoning: "" });
    hook.rerender({ workflowId: "wf1", model: "lab/a", reasoning: "" });
    hook.rerender({ workflowId: "wf1", model: "lab/b", reasoning: "high" });
    expect(FakeWS.instances).toHaveLength(1);
    const setModels = ws.sent.map((s) => JSON.parse(s)).filter((m) => m.type === "set_model");
    expect(setModels.at(-1).data).toEqual({ model: "lab/b", reasoning: "high" });
  });
});
