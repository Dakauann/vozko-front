import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const getWorkflowWebhookAction = vi.fn();

vi.mock("@/app/actions/workflows", () => ({
  getWorkflowWebhookAction: (...a: unknown[]) => getWorkflowWebhookAction(...a),
  createWorkflowWebhookAction: vi.fn(),
  updateWorkflowWebhookAction: vi.fn(),
  rotateWorkflowWebhookAction: vi.fn(),
  deleteWorkflowWebhookAction: vi.fn(),
}));

import { WebhookTriggerConfig } from "./webhook-trigger-config";

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

describe("WebhookTriggerConfig reference", () => {
  beforeEach(() => vi.clearAllMocks());

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
