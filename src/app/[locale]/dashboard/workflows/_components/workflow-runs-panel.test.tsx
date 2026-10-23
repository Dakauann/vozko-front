import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { WorkflowRunsPanel } from "./workflow-runs-panel";

const actions = vi.hoisted(() => ({ listWorkflowRunsAction: vi.fn(), downloadWorkflowRunsAction: vi.fn(), getWorkflowRunAction: vi.fn(), cancelWorkflowRunAction: vi.fn(), downloadWorkflowRunAction: vi.fn() }));
vi.mock("@/app/actions/workflows", () => actions);
vi.mock("@/app/actions/agents", () => ({ getAgentByIdAction: vi.fn() }));
vi.mock("@/hooks/use-settled-permission", () => ({ useSettledPermission: () => false }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

function renderPanel() {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="UTC">
      <WorkflowRunsPanel
        workflowId="wf-1"
        selectedRunId={null}
        onSelectRun={vi.fn()}
        onRunDetail={vi.fn()}
        triggerLabel={() => undefined}
        nodeLabel={() => undefined}
        nodeExists={() => false}
        onFocusNode={vi.fn()}
        onTestStep={vi.fn()}
        runDiffersFromCanvas={() => false}
        onClose={vi.fn()}
      />
    </NextIntlClientProvider>,
  );
}

function choosePeriod(from: string, to: string) {
  fireEvent.change(screen.getByLabelText("De"), { target: { value: from } });
  fireEvent.change(screen.getByLabelText("Até"), { target: { value: to } });
}

describe("WorkflowRunsPanel export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actions.listWorkflowRunsAction.mockResolvedValue({ runs: [], meta: { page: 1, pageSize: 20, totalPages: 1, totalItems: 0 } });
  });

  it("exports the chosen period with the conversation the list is filtered by", async () => {
    actions.downloadWorkflowRunsAction.mockResolvedValue({ error: null });
    renderPanel();
    const conversation = await screen.findByLabelText("Conversa (ID)");
    fireEvent.change(conversation, { target: { value: " e-1 " } });
    fireEvent.keyDown(conversation, { key: "Enter" });
    fireEvent.click(await screen.findByRole("button", { name: "Exportar execuções" }));
    choosePeriod("2026-10-01", "2026-10-07");
    fireEvent.click(screen.getByRole("button", { name: "Baixar" }));

    await vi.waitFor(() => expect(actions.downloadWorkflowRunsAction).toHaveBeenCalledTimes(1));
    expect(actions.downloadWorkflowRunsAction).toHaveBeenCalledWith("wf-1", {
      from: new Date(2026, 9, 1).toISOString(),
      to: new Date(2026, 9, 8).toISOString(),
      entryId: "e-1",
    });
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("Exportação baixada."));
  });

  it("says how to narrow an export the backend refuses as too large", async () => {
    actions.downloadWorkflowRunsAction.mockResolvedValue({ error: { status: 422, code: "export_too_large", message: "too large" } });
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "Exportar execuções" }));
    choosePeriod("2026-08-01", "2026-10-07");
    fireEvent.click(screen.getByRole("button", { name: "Baixar" }));

    expect(await screen.findByText(ptMessages.workflowsPage.errors.export_too_large)).toBeInTheDocument();
  });

  it("cannot export a period whose day cannot be read", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "Exportar execuções" }));
    choosePeriod("", "2026-10-07");
    expect(screen.getByRole("button", { name: "Baixar" })).toBeDisabled();
  });
});
