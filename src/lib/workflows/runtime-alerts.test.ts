import { describe, expect, it } from "vitest";

import { openRuntimeAlertCount, runtimeAlertView, sortedRuntimeAlerts } from "./runtime-alerts";
import type { RuntimeAlert } from "./types";

function alert(overrides: Partial<RuntimeAlert>): RuntimeAlert {
  return {
    id: "a1",
    kind: "node_failing",
    severity: "high",
    fixAction: "open_run",
    status: "open",
    workflowId: "wf-1",
    count: 3,
    firstSeen: "2026-10-19T10:00:00Z",
    lastSeen: "2026-10-19T11:00:00Z",
    ...overrides,
  };
}

const describeWith = {
  webhookReason: (reason: string) => (reason === "unauthorized" ? "Autenticação inválida" : null),
  nodeLabel: (nodeId: string) => (nodeId === "n55" ? "Login UniFECAF" : undefined),
};

describe("runtimeAlertView", () => {
  it("asks to publish a workflow that was called while inactive", () => {
    const view = runtimeAlertView(alert({ kind: "workflow_called_inactive", fixAction: "publish", count: 2 }), describeWith);
    expect(view.title).toBe("Fluxo chamado mas inativo");
    expect(view.description).toContain("2 chamadas");
    expect(view.actionLabel).toBe("Publicar");
    expect(view.fix).toEqual({ kind: "publish" });
  });

  it("opens the failing run and names the node by its label", () => {
    const view = runtimeAlertView(alert({ nodeId: "n55", runId: "run-9" }), describeWith);
    expect(view.title).toBe("Nó falhando");
    expect(view.description).toContain("Login UniFECAF");
    expect(view.fix).toEqual({ kind: "open_run", runId: "run-9" });
    expect(view.actionLabel).toBe("Abrir execução");
  });

  it("names the node by its id when the canvas has no label for it", () => {
    expect(runtimeAlertView(alert({ nodeId: "n99", runId: "r" }), describeWith).description).toContain("n99");
  });

  it("offers no fix when the run it should open is missing", () => {
    const view = runtimeAlertView(alert({ kind: "run_stuck", runId: undefined }), describeWith);
    expect(view.fix).toBeNull();
    expect(view.actionLabel).toBeNull();
  });

  it("says how many runs got stuck", () => {
    expect(runtimeAlertView(alert({ kind: "run_stuck", count: 1, runId: "r" }), describeWith).description).toContain("Uma execução");
    expect(runtimeAlertView(alert({ kind: "run_stuck", count: 4, runId: "r" }), describeWith).description).toContain("4 execuções");
  });

  it("shows the webhook rejection reason and opens the latest calls", () => {
    const view = runtimeAlertView(
      alert({ kind: "webhook_rejecting", severity: "medium", fixAction: "view_deliveries", subject: "unauthorized", count: 7 }),
      describeWith,
    );
    expect(view.title).toBe("Webhook recusando chamadas");
    expect(view.description).toContain("7 chamadas");
    expect(view.description).toContain("Autenticação inválida");
    expect(view.fix).toEqual({ kind: "view_deliveries" });
    expect(view.actionLabel).toBe("Ver chamadas");
  });

  it("keeps an unknown webhook reason as sent", () => {
    const view = runtimeAlertView(alert({ kind: "webhook_rejecting", fixAction: "view_deliveries", subject: "new_reason" }), describeWith);
    expect(view.description).toContain("new_reason");
  });

  it("links to the agent whose tool keeps failing, naming Executar fluxo for a bound workflow tool", () => {
    const view = runtimeAlertView(
      alert({ kind: "agent_tool_failing", fixAction: "open_agent", agentId: "ag 1", subject: "run_workflow_wf-1" }),
      describeWith,
    );
    expect(view.title).toBe("Ferramenta de agente falhando");
    expect(view.description).toContain("Executar fluxo");
    expect(view.fix).toEqual({ kind: "link", href: "/dashboard/agents/ag%201" });
    expect(view.actionLabel).toBe("Abrir agente");
  });

  it("names the HTTP tool in Portuguese", () => {
    const view = runtimeAlertView(alert({ kind: "agent_tool_failing", fixAction: "open_agent", agentId: "a", subject: "http_request" }), describeWith);
    expect(view.description).toContain("Requisição HTTP");
  });

  it("opens the conversation left without an automatic reply", () => {
    const view = runtimeAlertView(
      alert({ kind: "inbound_lookup_failed", severity: "medium", fixAction: "open_conversation", entryId: "e1", entryType: "whatsapp", workflowId: undefined }),
      describeWith,
    );
    expect(view.title).toBe("Mensagens sem resposta automática");
    expect(view.fix).toEqual({ kind: "link", href: "/dashboard/live-chat?entry=e1&type=whatsapp" });
    expect(view.actionLabel).toBe("Abrir conversa");
  });

  it("offers no conversation link for an entry it cannot open", () => {
    const view = runtimeAlertView(alert({ kind: "inbound_lookup_failed", fixAction: "open_conversation", entryId: "e1", entryType: "sip_call" }), describeWith);
    expect(view.fix).toBeNull();
  });

  it("selects the node for open_node", () => {
    const view = runtimeAlertView(alert({ fixAction: "open_node", nodeId: "n55" }), describeWith);
    expect(view.fix).toEqual({ kind: "open_node", nodeId: "n55" });
    expect(view.actionLabel).toBe("Ver no fluxo");
  });

  it("fails closed on a kind or fix it does not know", () => {
    const view = runtimeAlertView(alert({ kind: "brand_new" as RuntimeAlert["kind"], fixAction: "teleport" as RuntimeAlert["fixAction"] }), describeWith);
    expect(view.title).toBe("Alerta de execução");
    expect(view.fix).toBeNull();
  });
});

describe("sortedRuntimeAlerts", () => {
  it("puts high open alerts first, newest first, and resolved ones apart, latest resolution first", () => {
    const sorted = sortedRuntimeAlerts([
      alert({ id: "m-old", severity: "medium", lastSeen: "2026-10-19T09:00:00Z" }),
      alert({ id: "r1", status: "resolved", resolvedAt: "2026-10-19T08:00:00Z" }),
      alert({ id: "h-old", severity: "high", lastSeen: "2026-10-19T09:00:00Z" }),
      alert({ id: "h-new", severity: "high", lastSeen: "2026-10-19T12:00:00Z" }),
      alert({ id: "r2", status: "resolved", resolvedAt: "2026-10-19T09:30:00Z" }),
    ]);
    expect(sorted.open.map((a) => a.id)).toEqual(["h-new", "h-old", "m-old"]);
    expect(sorted.resolved.map((a) => a.id)).toEqual(["r2", "r1"]);
  });
});

describe("openRuntimeAlertCount", () => {
  it("counts open alerts only, so a resolved one leaves the header count", () => {
    expect(openRuntimeAlertCount([alert({ id: "1" }), alert({ id: "2", status: "resolved" })])).toBe(1);
  });
});
