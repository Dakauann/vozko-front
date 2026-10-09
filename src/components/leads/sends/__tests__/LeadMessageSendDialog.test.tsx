import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

const previewLeadActionAction = vi.fn();
const startLeadActionAction = vi.fn();
const cancelLeadSendAction = vi.fn();
const listInstancesAction = vi.fn();

vi.mock("@/app/actions/lead-actions", () => ({
  previewLeadActionAction: (...args: unknown[]) => previewLeadActionAction(...args),
  getLeadActionPreviewAction: vi.fn(),
  startLeadActionAction: (...args: unknown[]) => startLeadActionAction(...args),
}));
vi.mock("@/app/actions/lead-sends", () => ({
  startLeadSendAction: vi.fn(),
  cancelLeadSendAction: (...args: unknown[]) => cancelLeadSendAction(...args),
  reviewLeadSendAction: vi.fn(),
}));
vi.mock("@/app/actions/unofficial-whatsapp", () => ({
  listInstancesAction: (...args: unknown[]) => listInstancesAction(...args),
}));
vi.mock("@/app/actions/medias", () => ({ uploadMediaAction: vi.fn() }));
vi.mock("@/hooks/use-lead-field-definitions", () => ({ useLeadFieldDefinitions: () => ({ definitions: [] }) }));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "ws-1" }, can: () => true }),
}));
vi.mock("@/contexts/department-context", () => ({
  useDepartment: () => ({ departments: [], currentDepartment: null, isResolved: true, loadFailed: false, refreshDepartments: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { LeadMessageSendDialog } from "../LeadMessageSendDialog";

const t = ptMessages.leadSends;
const form = ptMessages.unofficialWhatsappCampaigns.form;

const QUOTE = {
  count: 30,
  parts: 1,
  splitRequired: false,
  maxPerCampaign: 150000,
  unitPriceMicros: 0,
  costMicros: 0,
  balanceMicros: 0,
  affordable: true,
  fits: 30,
  dailyCap: 20,
  estimatedDays: 2,
};

const REVIEW = {
  channel: "unofficial",
  parts: [{ campaignId: "u-1", name: "Aviso", status: "STOPPED", entries: 30, eligible: 28 }],
  entries: 30,
  eligible: 28,
  skipped: { opted_out: 2 },
  counted: {},
  quote: { ...QUOTE, count: 28, fits: 28 },
  started: false,
};

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
        <LeadMessageSendDialog selection={{ mode: "all_matching", filter: { groups: [] } }} size={0} onClose={vi.fn()} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("LeadMessageSendDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listInstancesAction.mockResolvedValue({
      instances: [{ id: "in-1", displayName: "Loja Centro", sessionLive: true, status: "CONNECTED", dailySendCap: 20, sendDelayMinMs: 3000 }],
      meta: { totalPages: 1 },
    });
    previewLeadActionAction.mockResolvedValue({
      data: {
        id: "p-1",
        action: "send_unofficial",
        status: "done",
        result: { matched: 30, expectedCount: 30, fingerprint: "fp-30", selected: 30, eligible: 30, skipped: {} },
        send: QUOTE,
      },
      error: null,
    });
    startLeadActionAction.mockResolvedValue({ data: { action: "send_unofficial", send: REVIEW }, error: null });
    cancelLeadSendAction.mockResolvedValue({ data: { cancelled: true }, error: null });
  });

  it("shows that the unofficial numbers did not load and lets the person try again", async () => {
    listInstancesAction.mockResolvedValue({ instances: [], meta: { totalPages: 1 }, error: "boom" });
    renderDialog();
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: new RegExp(`^${t.message.instance}`) }));
    expect(await screen.findByText(t.message.instancesFailed)).toBeInTheDocument();
    listInstancesAction.mockResolvedValue({
      instances: [{ id: "in-1", displayName: "Loja Centro", sessionLive: true, status: "CONNECTED" }],
      meta: { totalPages: 1 },
    });
    fireEvent.click(screen.getByRole("button", { name: ptMessages.leadsPage.bulk.dialog.retry }));
    await waitFor(() => expect(screen.queryByText(t.message.instancesFailed)).not.toBeInTheDocument());
    expect(listInstancesAction).toHaveBeenCalledTimes(2);
  });

  it("prepares the unofficial send with the message, the pacing and the bindings, and shows the daily estimate", async () => {
    renderDialog();

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: new RegExp(`^${t.message.instance}`) }));
    fireEvent.click(await screen.findByRole("option", { name: /Loja Centro/ }));
    fireEvent.change(screen.getByPlaceholderText(new RegExp(`^${form.bodyPlaceholder.split(".")[0]}`)), { target: { value: "Oi {{1}}, temos novidades." } });
    await waitFor(() => expect(screen.getByRole("button", { name: t.actions.next })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: t.actions.next }));

    expect(await screen.findByText(/Até 20 por dia/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: t.actions.review })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: t.actions.review }));
    await screen.findByText(t.review.stopped);

    const [request] = startLeadActionAction.mock.calls[0];
    expect(request.action).toBe("send_unofficial");
    expect(request.params.send).toMatchObject({
      instanceId: "in-1",
      message: { kind: "text", bodies: ["Oi {{1}}, temos novidades."] },
      sendDelayMinMs: 3000,
      sendDelayMaxMs: 12000,
      bindings: [{ source: "lead.first_name" }],
    });
    expect(request.selection).toEqual({ mode: "all_matching", filter: { groups: [] }, expectedCount: 30, fingerprint: "fp-30" });
    expect(screen.getByText(t.review.skipped.opted_out)).toBeInTheDocument();
    expect(screen.getByText(t.review.pace)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Enviar para 28 leads/ })).toBeEnabled();
  });
});
