import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";
import type { AgentToolCall } from "@/lib/conversations/agent-tool-calls";

import { AgentToolCallNamesProvider, AgentToolCallRow, AgentToolCallsLoadError } from "../AgentToolCallRow";

const t = ptMessages.crmConversation.thread.agentToolCall;

function call(overrides: Partial<AgentToolCall> = {}): AgentToolCall {
  return {
    id: "c1",
    entryId: "e1",
    entryType: "whatsapp",
    agentId: "ag1",
    toolName: "run_workflow_wf-1",
    outcome: "ok",
    durationMs: 50,
    createdAt: "2026-10-19T10:00:00Z",
    ...overrides,
  };
}

function renderRow(value: AgentToolCall, agentName?: string) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="UTC">
      <AgentToolCallNamesProvider
        value={{ agentName: () => agentName, toolName: (name) => (name.startsWith("run_workflow") ? "Executar fluxo" : name) }}
      >
        <AgentToolCallRow row={{ kind: "agent-tool-call", key: value.id, call: value }} />
      </AgentToolCallNamesProvider>
    </NextIntlClientProvider>,
  );
}

describe("agent tool call line", () => {
  it("says which agent called which tool, that a run started, and links to the run", () => {
    renderRow(call({ runId: "run-9", workflowId: "wf-1" }), "Bia");
    expect(screen.getByText(t.line.replace("{agent}", "Bia").replace("{tool}", "Executar fluxo"))).toBeInTheDocument();
    expect(screen.getByText(t.outcomes.runStarted)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t.openRun })).toHaveAttribute("href", "/dashboard/workflows/wf-1?run=run-9");
  });

  it("offers no run link when the backend did not say which workflow ran", () => {
    renderRow(call({ runId: "run-9" }), "Bia");
    expect(screen.getByText(t.outcomes.runStarted)).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("names the agent generically when its name cannot be read", () => {
    renderRow(call());
    expect(screen.getByText(t.line.replace("{agent}", t.agentFallback).replace("{tool}", "Executar fluxo"))).toBeInTheDocument();
    expect(screen.getByText(t.outcomes.ok)).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows a failure with its reason on hover and no run link", () => {
    const { container } = renderRow(call({ outcome: "error", error: "fluxo inativo", toolName: "http_request" }), "Bia");
    expect(screen.getByText(t.outcomes.error)).toBeInTheDocument();
    expect(container.querySelector("[title='fluxo inativo']")).not.toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("agent tool call read failure line", () => {
  function renderFailure(failure: { code?: string; message?: string }, onRetry = vi.fn()) {
    render(
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="UTC">
        <AgentToolCallsLoadError failure={failure} onRetry={onRetry} />
      </NextIntlClientProvider>,
    );
    return onRetry;
  }

  it("names the refusal by its code, in muted text, and retries on Tentar de novo", () => {
    const onRetry = renderFailure({ code: "tool_calls_unavailable", message: "backend text" });
    const line = screen.getByRole("status");
    expect(line).toHaveTextContent(ptMessages.workflowsPage.errors.tool_calls_unavailable);
    expect(line).not.toHaveTextContent("backend text");
    expect(line.className).toContain("text-muted-foreground");
    fireEvent.click(screen.getByRole("button", { name: t.retry }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("falls back to its own sentence for a failure without a known code", () => {
    renderFailure({});
    expect(screen.getByRole("status")).toHaveTextContent(t.loadFailed);
  });
});
