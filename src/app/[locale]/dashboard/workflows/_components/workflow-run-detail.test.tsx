import type { ComponentProps } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { RunDetail, WorkflowRun, WorkflowRunLog } from "@/lib/workflows/types";

import { WorkflowRunDetail } from "./workflow-run-detail";

const actions = vi.hoisted(() => ({ getWorkflowRunAction: vi.fn(), cancelWorkflowRunAction: vi.fn(), downloadWorkflowRunAction: vi.fn() }));
vi.mock("@/app/actions/workflows", () => actions);
vi.mock("@/hooks/use-settled-permission", () => ({ useSettledPermission: () => false }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

function run(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    id: "r1",
    workflowId: "wf-1",
    workspaceId: "ws",
    entryId: "e1",
    entryType: "whatsapp",
    status: "completed",
    state: {},
    retryCount: 0,
    startedAt: "2026-10-20T10:00:00.000Z",
    updatedAt: "2026-10-20T10:00:04.000Z",
    completedAt: "2026-10-20T10:00:04.000Z",
    ...overrides,
  };
}

function step(id: string, nodeId: string): WorkflowRunLog {
  return { id, runId: "r1", nodeId, nodeType: "action_code", status: "executed", executedAt: "2026-10-20T10:00:01.000Z", attempt: 1, durationMs: 5 };
}

function renderDetail(props: Partial<ComponentProps<typeof WorkflowRunDetail>> = {}) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="UTC">
      <WorkflowRunDetail
        runId="r1"
        refreshToken={0}
        canCancel={false}
        triggerLabel={() => undefined}
        nodeLabel={(nodeId) => `Nó ${nodeId}`}
        nodeExists={() => false}
        onFocusNode={vi.fn()}
        onTestStep={vi.fn()}
        onDetail={vi.fn()}
        onCancelled={vi.fn()}
        runDiffersFromCanvas={() => false}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}

describe("WorkflowRunDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads more steps on request and hands the whole trace to the canvas", async () => {
    actions.getWorkflowRunAction.mockImplementation(async (_runId: string, page = 1) => ({
      detail:
        page === 1
          ? { run: run(), logs: [step("s1", "a")], steps: { offset: 0, limit: 500, total: 2, hasMore: true } }
          : { run: run(), logs: [step("s2", "b")], steps: { offset: 500, limit: 500, total: 2, hasMore: false } },
    }));
    const onDetail = vi.fn();
    renderDetail({ onDetail });

    fireEvent.click(await screen.findByRole("button", { name: "Carregar mais passos" }));

    await screen.findByText("Nó b");
    expect(screen.getByText("Nó a")).toBeInTheDocument();
    expect(actions.getWorkflowRunAction).toHaveBeenLastCalledWith("r1", 2);
    await vi.waitFor(() => {
      const shown = onDetail.mock.calls[onDetail.mock.calls.length - 1][0] as RunDetail;
      expect(shown.logs.map((log) => log.id)).toEqual(["s1", "s2"]);
    });
    expect(screen.queryByRole("button", { name: "Carregar mais passos" })).toBeNull();
  });

  it("keeps the loaded steps and says why when a later page is refused", async () => {
    actions.getWorkflowRunAction.mockImplementation(async (_runId: string, page = 1) =>
      page === 1
        ? { detail: { run: run(), logs: [step("s1", "a")], steps: { offset: 0, limit: 500, total: 2, hasMore: true } } }
        : { detail: null, error: "You don't have access to this workflow", status: 403 },
    );
    renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: "Carregar mais passos" }));
    expect(await screen.findByText("Sem acesso a este fluxo")).toBeInTheDocument();
    expect(screen.getByText("Nó a")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });

  it("says when the viewer has no access to the workflow, apart from a run that does not exist", async () => {
    actions.getWorkflowRunAction.mockResolvedValue({ detail: null, error: "You don't have access to this workflow", status: 403 });
    const { unmount } = renderDetail();
    expect(await screen.findByText("Sem acesso a este fluxo")).toBeInTheDocument();
    unmount();

    actions.getWorkflowRunAction.mockResolvedValue({ detail: null, error: "Execução do workflow não encontrada", status: 404 });
    renderDetail();
    expect(await screen.findByText("Não encontrado")).toBeInTheDocument();
  });

  it("says why a cancel was refused when the run is out of reach", async () => {
    actions.getWorkflowRunAction.mockResolvedValue({ detail: { run: run({ status: "running", completedAt: undefined }), logs: [] } });
    actions.cancelWorkflowRunAction.mockResolvedValue({ error: "Execução do workflow não encontrada", status: 404 });
    renderDetail({ canCancel: true });
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar execução" }));
    const confirm = await screen.findAllByRole("button", { name: "Cancelar execução" });
    fireEvent.click(confirm[confirm.length - 1]);
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não encontrado"));
  });

  it("names an operator cancel instead of showing its code, on the run and on its cancelled step", async () => {
    const cancelledStep = { ...step("s1", "a"), status: "cancelled", errorKind: "cancelled", error: "cancelled_by_operator" };
    actions.getWorkflowRunAction.mockResolvedValue({ detail: { run: run({ status: "cancelled", error: "cancelled_by_operator" }), logs: [cancelledStep] } });
    renderDetail();
    expect(await screen.findByText("Cancelada por um operador")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Nó a"));
    fireEvent.click(await screen.findByRole("tab", { name: "Erro" }));
    expect(screen.getAllByText("Cancelada por um operador")).toHaveLength(2);
    expect(screen.queryByText("cancelled_by_operator")).toBeNull();
  });

  it("downloads the run as JSON and shows a refusal in the workflow error copy", async () => {
    actions.getWorkflowRunAction.mockResolvedValue({ detail: { run: run(), logs: [] } });
    actions.downloadWorkflowRunAction.mockResolvedValue({ error: null });
    renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: "Baixar JSON" }));
    await vi.waitFor(() => expect(actions.downloadWorkflowRunAction).toHaveBeenCalledWith("r1"));
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Baixar JSON" })).toBeEnabled());
    expect(toast.error).not.toHaveBeenCalled();

    actions.downloadWorkflowRunAction.mockResolvedValue({ error: { status: 404, code: "run_not_found", message: "Execução do workflow não encontrada" } });
    fireEvent.click(screen.getByRole("button", { name: "Baixar JSON" }));
    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith(ptMessages.workflowsPage.errors.run_not_found));
  });

  it("copies a step's parameters and output as they were loaded", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const recorded = { ...step("s1", "a"), input: { url: "https://api", token: "••••" }, output: { status: 200 } };
    actions.getWorkflowRunAction.mockResolvedValue({ detail: { run: run(), logs: [recorded] } });
    renderDetail();
    fireEvent.click(await screen.findByText("Nó a"));
    fireEvent.click(await screen.findByRole("button", { name: "Copiar JSON" }));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(JSON.parse(writeText.mock.calls[0][0])).toEqual({ input: recorded.input, output: recorded.output });
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("JSON copiado."));
  });

  it("labels a step's sent message with the step's node name, as the chat does, never the generic workflow sender", async () => {
    const message = { id: "m1", entryType: "whatsapp", channel: "whatsapp", messageType: "ai_response", direction: "OUTBOUND", text: "Bom dia", sentBy: { kind: "workflow", id: "wf" }, createdAt: "2026-10-20T10:00:01Z" };
    const sent = { ...step("s1", "a"), nodeType: "action_send_message", output: { sent_messages: [message] } };
    actions.getWorkflowRunAction.mockResolvedValue({ detail: { run: run(), logs: [sent] } });
    renderDetail();
    fireEvent.click(await screen.findByText("Nó a"));
    const detail = await screen.findByTestId("step-detail");
    expect(within(detail).getByText("Bom dia")).toBeInTheDocument();
    expect(within(detail).getByText("Nó a")).toBeInTheDocument();
    expect(within(detail).queryByText(ptMessages.crm.messageSender.workflow)).toBeNull();
  });
});
