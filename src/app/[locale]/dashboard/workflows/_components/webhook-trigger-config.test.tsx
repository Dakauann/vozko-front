import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";

import ptMessages from "@/i18n/messages/pt.json";

const getWorkflowWebhookAction = vi.fn();
const listWorkflowWebhookDeliveriesAction = vi.fn();

vi.mock("@/app/actions/workflows", () => ({
  getWorkflowWebhookAction: (...a: unknown[]) => getWorkflowWebhookAction(...a),
  listWorkflowWebhookDeliveriesAction: (...a: unknown[]) => listWorkflowWebhookDeliveriesAction(...a),
  createWorkflowWebhookAction: vi.fn(),
  updateWorkflowWebhookAction: vi.fn(),
  rotateWorkflowWebhookAction: vi.fn(),
  deleteWorkflowWebhookAction: vi.fn(),
}));

import { OpenRunContext } from "./run-bits";
import { WebhookTriggerConfig } from "./webhook-trigger-config";

function IntlWrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
      {children}
    </NextIntlClientProvider>
  );
}

function render(ui: ReactElement) {
  return rtlRender(ui, { wrapper: IntlWrapper });
}

const NO_DELIVERIES = { deliveries: [], meta: { page: 1, pageSize: 10, totalPages: 1, totalItems: 0 } };

const BASE = {
  id: "wh1",
  workflow_id: "wf1",
  url: "http://localhost:4000/webhooks/workflow/tok_abc",
  header_name: "X-Webhook-Token",
  method: "POST",
  active: true,
};

function openTab(name: string) {
  fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0 });
}

describe("WebhookTriggerConfig latest calls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWorkflowWebhookAction.mockResolvedValue({ webhook: { ...BASE, auth_mode: "none", secret: "" } });
  });

  it("lists each call with its outcome, the reason in Portuguese and a link to the run it started", async () => {
    listWorkflowWebhookDeliveriesAction.mockResolvedValue({
      deliveries: [
        { id: "d1", webhookId: "wh1", workflowId: "wf1", workspaceId: "ws", receivedAt: "2026-10-19T10:00:00Z", outcome: "rejected", reason: "workflow_not_active", httpStatus: 409, latencyMs: 3 },
        { id: "d2", webhookId: "wh1", workflowId: "wf1", workspaceId: "ws", receivedAt: "2026-10-19T10:01:00Z", outcome: "accepted", httpStatus: 202, entryId: "e1", entryType: "whatsapp", entryResolution: "phone", runId: "r1", latencyMs: 9 },
      ],
      meta: { page: 1, pageSize: 10, totalPages: 1, totalItems: 2 },
    });

    render(<WebhookTriggerConfig workflowId="wf1" />);

    const list = await screen.findByRole("region", { name: "Últimas chamadas" });
    expect(await within(list).findByText("Fluxo inativo")).toBeInTheDocument();
    expect(within(list).getByText("Recusada")).toBeInTheDocument();
    expect(within(list).getByText("409")).toBeInTheDocument();
    expect(within(list).getByText("Aceita")).toBeInTheDocument();
    expect(within(list).getByRole("link", { name: /Ver execução/ })).toHaveAttribute("href", "/dashboard/workflows/wf1?run=r1");
    expect(within(list).getByRole("link", { name: /Abrir conversa/ })).toHaveAttribute("href", "/dashboard/live-chat?entry=e1&type=whatsapp");
    expect(listWorkflowWebhookDeliveriesAction).toHaveBeenCalledWith("wf1", { page: 1, pageSize: 10 });
  });

  it("opens the run inside the editor instead of reloading the page", async () => {
    listWorkflowWebhookDeliveriesAction.mockResolvedValue({
      deliveries: [{ id: "d2", webhookId: "wh1", workflowId: "wf1", workspaceId: "ws", receivedAt: "2026-10-19T10:01:00Z", outcome: "accepted", httpStatus: 202, runId: "r1", latencyMs: 9 }],
      meta: { page: 1, pageSize: 10, totalPages: 1, totalItems: 1 },
    });
    const openRun = vi.fn();

    render(
      <OpenRunContext.Provider value={openRun}>
        <WebhookTriggerConfig workflowId="wf1" />
      </OpenRunContext.Provider>,
    );

    fireEvent.click(await screen.findByRole("link", { name: /Ver execução/ }));
    expect(openRun).toHaveBeenCalledWith("r1");
  });

  it("says when nothing called the webhook yet", async () => {
    listWorkflowWebhookDeliveriesAction.mockResolvedValue(NO_DELIVERIES);
    render(<WebhookTriggerConfig workflowId="wf1" />);
    expect(await screen.findByText("Nenhuma chamada recebida nos últimos 30 dias.")).toBeInTheDocument();
  });

  it("brings the latest calls into view when a webhook alert opened the node", async () => {
    listWorkflowWebhookDeliveriesAction.mockResolvedValue(NO_DELIVERIES);
    const scrolled: Element[] = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element) {
      scrolled.push(this);
    };
    try {
      render(<WebhookTriggerConfig workflowId="wf1" focusDeliveries />);
      const section = await screen.findByRole("region", { name: "Últimas chamadas" });
      await waitFor(() => expect(scrolled).toContain(section));
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });
});

describe("WebhookTriggerConfig reference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listWorkflowWebhookDeliveriesAction.mockResolvedValue(NO_DELIVERIES);
  });

  it("renders a header-token curl with the real url and header", async () => {
    getWorkflowWebhookAction.mockResolvedValue({
      webhook: { ...BASE, auth_mode: "header_token", secret: "s3cr3t" },
    });
    render(<WebhookTriggerConfig workflowId="wf1" />);

    const pre = await screen.findByText(/curl -X POST/);
    expect(pre.textContent).toContain(
      "http://localhost:4000/webhooks/workflow/tok_abc",
    );
    expect(pre.textContent).toContain("X-Webhook-Token: SEU_TOKEN");
    expect(pre.textContent).toContain('"entry_type":"whatsapp"');
    expect(pre.textContent).not.toContain("s3cr3t");
  });

  it("swaps the example body when phone is picked", async () => {
    getWorkflowWebhookAction.mockResolvedValue({
      webhook: { ...BASE, auth_mode: "header_token", secret: "s3cr3t" },
    });
    render(<WebhookTriggerConfig workflowId="wf1" />);
    await screen.findByText(/curl -X POST/);

    fireEvent.click(screen.getByRole("button", { name: "phone" }));
    await waitFor(() =>
      expect(screen.getByText(/curl -X POST/).textContent).toContain(
        '{"phone":"+5511998887777"}',
      ),
    );
  });

  it("inlines the secret only after Incluir segredo", async () => {
    getWorkflowWebhookAction.mockResolvedValue({
      webhook: { ...BASE, auth_mode: "header_token", secret: "s3cr3t" },
    });
    render(<WebhookTriggerConfig workflowId="wf1" />);
    await screen.findByText(/curl -X POST/);

    fireEvent.click(screen.getByText("Incluir segredo"));
    await waitFor(() =>
      expect(screen.getByText(/curl -X POST/).textContent).toContain(
        "X-Webhook-Token: s3cr3t",
      ),
    );
  });

  it("emits the prefixed hmac signing snippet in hmac mode", async () => {
    getWorkflowWebhookAction.mockResolvedValue({
      webhook: {
        ...BASE,
        auth_mode: "hmac",
        header_name: "X-Signature-256",
        secret: "hs3cr3t",
      },
    });
    render(<WebhookTriggerConfig workflowId="wf1" />);

    const pre = await screen.findByText(/openssl dgst/);
    expect(pre.textContent).toContain("openssl dgst -sha256 -hmac 'SEU_SEGREDO'");
    expect(pre.textContent).toContain("X-Signature-256: sha256=");
    expect(pre.textContent).toContain("--data-raw");
  });

  it("warns when the saved method is one the receiver rejects", async () => {
    getWorkflowWebhookAction.mockResolvedValue({
      webhook: { ...BASE, auth_mode: "none", secret: "", method: "PUT" },
    });
    render(<WebhookTriggerConfig workflowId="wf1" />);

    expect(
      await screen.findByText(/O receptor público aceita somente/),
    ).toBeInTheDocument();
  });

  it("shows the body, response and flow panes", async () => {
    getWorkflowWebhookAction.mockResolvedValue({
      webhook: { ...BASE, auth_mode: "none", secret: "" },
    });
    render(<WebhookTriggerConfig workflowId="wf1" />);
    await screen.findByText(/curl -X POST/);

    openTab("Corpo");
    expect(await screen.findByText("entry_id + entry_type")).toBeInTheDocument();
    expect(screen.getByText("unofficial_whatsapp")).toBeInTheDocument();

    openTab("Respostas");
    expect(await screen.findByText("202")).toBeInTheDocument();
    expect(screen.getByText(/Reenvios\./)).toBeInTheDocument();

    openTab("No fluxo");
    expect(
      await screen.findByText("{{var.webhook.method}}"),
    ).toBeInTheDocument();
  });
});

describe("WebhookTriggerConfig refusals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listWorkflowWebhookDeliveriesAction.mockResolvedValue(NO_DELIVERIES);
  });

  it("explains a refused read with the catalog copy of its code, not the backend sentence", async () => {
    getWorkflowWebhookAction.mockResolvedValue({ webhook: null, error: "raw refusal", code: "workflow_access_denied", status: 403 });
    render(<WebhookTriggerConfig workflowId="wf1" />);
    expect(await screen.findByText(ptMessages.workflowsPage.errors.workflow_access_denied)).toBeInTheDocument();
    expect(screen.queryByText("raw refusal")).toBeNull();
  });
});
