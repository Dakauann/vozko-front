import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";
import type { ConversationWorkflowRun } from "@/lib/workflows/types";

const api = vi.hoisted(() => ({
  listConversationWorkflowRunsAction: vi.fn(),
  canRead: true,
}));

vi.mock("@/app/actions/workflows", () => ({
  listConversationWorkflowRunsAction: api.listConversationWorkflowRunsAction,
}));

vi.mock("@/app/actions/agents", () => ({
  getAgentByIdAction: vi.fn(async () => ({ agent: { name: "Bia" } })),
}));

vi.mock("@/hooks/use-settled-permission", () => ({
  useSettledPermission: () => api.canRead,
}));

import { ConversationWorkflowRuns } from "../ConversationWorkflowRuns";

const t = ptMessages.workflowRuns;

function run(overrides: Partial<ConversationWorkflowRun> = {}): ConversationWorkflowRun {
  return {
    id: "run-1",
    workflowId: "wf-1",
    entryId: "e1",
    entryType: "whatsapp",
    status: "completed",
    startedAt: "2026-10-19T10:00:00Z",
    completedAt: "2026-10-19T10:00:03Z",
    durationMs: 3000,
    startedBy: "webhook:d1",
    workflowVersion: 4,
    workflowName: "Matrícula",
    ...overrides,
  };
}

function renderRuns() {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="UTC">
      <ConversationWorkflowRuns entryType="whatsapp" entryId="e1" active />
    </NextIntlClientProvider>,
  );
}

describe("runs of this conversation", () => {
  beforeEach(() => {
    api.canRead = true;
    api.listConversationWorkflowRunsAction.mockReset();
  });

  it("lists each run with its workflow and version, opening the run detail in the editor", async () => {
    api.listConversationWorkflowRunsAction.mockResolvedValue({
      runs: [run(), run({ id: "run-2", workflowId: "wf-2", workflowName: "", status: "error", startedBy: "manual:u1" })],
      meta: { page: 1, pageSize: 10, totalPages: 1, totalItems: 2 },
    });
    renderRuns();

    const links = await screen.findAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/dashboard/workflows/wf-1?run=run-1");
    expect(links[0]).toHaveTextContent("Matrícula");
    expect(links[0]).toHaveTextContent("v4");
    expect(links[0]).toHaveTextContent(t.status.completed);
    expect(links[0]).toHaveTextContent(t.startedBy.webhook);
    expect(links[1]).toHaveTextContent(t.conversation.unnamedWorkflow);
    expect(links[1]).toHaveTextContent(t.status.error);
    expect(api.listConversationWorkflowRunsAction).toHaveBeenCalledWith("whatsapp", "e1", { page: 1, pageSize: 10 });
  });

  it("names the step a live run is on", async () => {
    api.listConversationWorkflowRunsAction.mockResolvedValue({
      runs: [run({ status: "waiting", completedAt: undefined, durationMs: undefined, currentNodeName: "Aguardar resposta" })],
      meta: { page: 1, pageSize: 10, totalPages: 1, totalItems: 1 },
    });
    renderRuns();
    expect(await screen.findByText(t.conversation.currentStep.replace("{step}", "Aguardar resposta"))).toBeInTheDocument();
  });

  it("says so when no workflow ran here", async () => {
    api.listConversationWorkflowRunsAction.mockResolvedValue({ runs: [], meta: { page: 1, pageSize: 10, totalPages: 1, totalItems: 0 } });
    renderRuns();
    expect(await screen.findByText(t.conversation.empty)).toBeInTheDocument();
  });

  it("shows the error with a retry that reads again", async () => {
    api.listConversationWorkflowRunsAction.mockResolvedValueOnce({ runs: [], meta: {}, error: "boom" });
    api.listConversationWorkflowRunsAction.mockResolvedValueOnce({ runs: [run()], meta: { page: 1, pageSize: 10, totalPages: 1, totalItems: 1 } });
    renderRuns();
    fireEvent.click(await screen.findByRole("button", { name: t.panel.retry }));
    expect(await screen.findByRole("link")).toHaveAttribute("href", "/dashboard/workflows/wf-1?run=run-1");
  });

  it("says the conversation was not found when the server hides it", async () => {
    api.listConversationWorkflowRunsAction.mockResolvedValue({ runs: [], meta: {}, error: "Conversa não encontrada", status: 404 });
    renderRuns();
    expect(await screen.findByText(t.refusal.notFound)).toBeInTheDocument();
    expect(screen.queryByText(t.conversation.loadError)).toBeNull();
  });

  it("pages through older runs", async () => {
    api.listConversationWorkflowRunsAction.mockResolvedValue({ runs: [run()], meta: { page: 1, pageSize: 10, totalPages: 2, totalItems: 11 } });
    renderRuns();
    fireEvent.click(await screen.findByRole("button", { name: t.panel.next }));
    await waitFor(() => expect(api.listConversationWorkflowRunsAction).toHaveBeenLastCalledWith("whatsapp", "e1", { page: 2, pageSize: 10 }));
  });

  it("shows nothing and reads nothing without access to workflows", () => {
    api.canRead = false;
    const { container } = renderRuns();
    expect(container).toBeEmptyDOMElement();
    expect(api.listConversationWorkflowRunsAction).not.toHaveBeenCalled();
  });
});
