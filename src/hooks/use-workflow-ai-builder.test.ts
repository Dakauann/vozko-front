/**
 * @vitest-environment happy-dom
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useWorkflowAIBuilder } from "./use-workflow-ai-builder";

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "ws1" } }),
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
  close() {
    this.readyState = 3;
  }
  emit(obj: unknown) {
    this.onmessage?.({ data: JSON.stringify(obj) });
  }
}

beforeEach(() => {
  FakeWS.instances = [];
  // @ts-expect-error override global for test
  global.WebSocket = FakeWS;
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
    // Auth rides the httpOnly cookie now; no token in the URL.
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
    // A build must be active for the server's snapshot to reach the canvas.
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
    // The server re-sends a snapshot on connect; with no build running it must not
    // touch the canvas (this is what used to erase the workflow on reconnect).
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
    // Simulates the snapshot a reconnected/fresh session emits after the build.
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
