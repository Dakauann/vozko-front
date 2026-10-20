import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { WebhookDeliveries } from "./webhook-deliveries";

const actions = vi.hoisted(() => ({ listWorkflowWebhookDeliveriesAction: vi.fn() }));
vi.mock("@/app/actions/workflows", () => actions);

function renderDeliveries() {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="UTC">
      <WebhookDeliveries workflowId="wf-1" />
    </NextIntlClientProvider>,
  );
}

describe("WebhookDeliveries", () => {
  it("says the viewer has no access to the workflow instead of a generic failure", async () => {
    actions.listWorkflowWebhookDeliveriesAction.mockResolvedValue({ deliveries: [], meta: {}, error: "You don't have access to this workflow", status: 403 });
    renderDeliveries();
    expect(await screen.findByText(ptMessages.workflowRuns.refusal.forbidden)).toBeInTheDocument();
    expect(screen.queryByText(ptMessages.workflowRuns.webhook.loadError)).toBeNull();
  });

  it("keeps its own message for any other failure", async () => {
    actions.listWorkflowWebhookDeliveriesAction.mockResolvedValue({ deliveries: [], meta: {}, error: "boom", status: 500 });
    renderDeliveries();
    expect(await screen.findByText(ptMessages.workflowRuns.webhook.loadError)).toBeInTheDocument();
  });
});
