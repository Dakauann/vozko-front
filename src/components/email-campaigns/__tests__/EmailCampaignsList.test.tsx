import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { CampaignSummary } from "@/lib/email-campaigns/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/dashboard/email/campaigns",
}));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "ws1" }, can: () => true }),
}));

const actions = vi.hoisted(() => ({
  fetchEmailCampaigns: vi.fn(),
  fetchEmailCampaignMetrics: vi.fn(),
  getEmailCampaignAction: vi.fn(),
  createEmailCampaignAction: vi.fn(),
  deleteEmailCampaignAction: vi.fn(),
  pauseEmailCampaignAction: vi.fn(),
  resumeEmailCampaignAction: vi.fn(),
  stopEmailCampaignAction: vi.fn(),
  unscheduleEmailCampaignAction: vi.fn(),
  launchEmailCampaignAction: vi.fn(),
  fetchEmailCampaignReview: vi.fn(),
}));
vi.mock("@/app/actions/email-campaigns", () => ({
  ...actions,
  isEmailActionError: (result: object) => "error" in result,
}));

vi.mock("@/components/dashboard/ScopeBreadcrumb", () => ({ ScopeBreadcrumb: () => null }));

import { EmailCampaignsList } from "../list/EmailCampaignsList";

const NO_METRICS = { sent: 0, delivered: 0, delivery_rate: 0, open_rate: 0, click_rate: 0 };

const ROWS: CampaignSummary[] = [
  {
    id: "c1",
    name: "Black Friday",
    status: "completed",
    subject: "Oferta",
    ab_test: true,
    started_at: "2026-10-20T10:00:00Z",
    completed_at: "2026-10-20T12:00:00Z",
    created_at: "2026-10-19T10:00:00Z",
    metrics: { sent: 900, delivered: 882, delivery_rate: 9800, open_rate: 3550, click_rate: 420 },
    actions: [],
  },
  { id: "c2", name: "Natal", status: "scheduled", subject: "Feliz Natal", ab_test: false, scheduled_at: "2026-12-20T12:00:00Z", created_at: "2026-10-19T10:00:00Z", metrics: NO_METRICS, actions: ["edit", "unschedule", "stop"] },
  { id: "c3", name: "Rascunho", status: "draft", subject: "", ab_test: false, created_at: "2026-10-19T10:00:00Z", metrics: NO_METRICS, actions: ["edit", "delete", "launch"] },
];

function renderList() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
        <EmailCampaignsList />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  for (const mock of Object.values(actions)) mock.mockReset();
});

describe("EmailCampaignsList", () => {
  it("leads an empty workspace to create the first campaign", async () => {
    actions.fetchEmailCampaigns.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20 });
    renderList();

    expect(await screen.findByText("Sua primeira campanha de e-mail")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Criar campanha/ }).length).toBeGreaterThan(0);
  });

  it("lists campaigns with status and the rates the list returns, without a metrics request per row", async () => {
    actions.fetchEmailCampaigns.mockResolvedValue({ items: ROWS, total: 3, page: 1, page_size: 20 });
    renderList();

    expect(await screen.findByText("Black Friday")).toBeInTheDocument();
    expect(screen.getByText("Concluída")).toBeInTheDocument();
    expect(screen.getByText(/^Agendada para/)).toBeInTheDocument();
    expect(screen.getByText("Rascunho", { selector: "span.text-xs" })).toBeInTheDocument();
    expect(await screen.findByText("98,0%")).toBeInTheDocument();
    expect(screen.getByText("35,5%")).toBeInTheDocument();
    expect(screen.getByText("4,2%")).toBeInTheDocument();
    expect(screen.getByText("882 entregues")).toBeInTheDocument();
    expect(actions.fetchEmailCampaignMetrics).not.toHaveBeenCalled();
  });

  it("marks a campaign waiting for the wallet", async () => {
    const waiting: CampaignSummary = { ...ROWS[0], id: "c4", name: "Lotes", status: "held", hold_reason: "balance_insufficient", completed_at: undefined, actions: ["resume", "pause", "stop"] };
    actions.fetchEmailCampaigns.mockResolvedValue({ items: [waiting], total: 1, page: 1, page_size: 20 });
    renderList();

    expect(await screen.findByText("Aguardando saldo")).toBeInTheDocument();
  });

  it("offers only the commands the backend lists for each row", async () => {
    actions.fetchEmailCampaigns.mockResolvedValue({ items: ROWS, total: 3, page: 1, page_size: 20 });
    renderList();

    fireEvent.pointerDown(await screen.findByRole("button", { name: "Ações de Natal" }), { button: 0, ctrlKey: false });
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("Cancelar agendamento")).toBeInTheDocument();
    expect(within(menu).queryByText("Pausar")).toBeNull();
    expect(within(menu).queryByText("Excluir rascunho")).toBeNull();
  });

  it("starts a ready campaign after confirming the cost of the send", async () => {
    const ready: CampaignSummary = { ...ROWS[2], id: "c5", name: "Pronta", status: "ready", actions: ["edit", "delete", "schedule", "launch", "start"] };
    actions.fetchEmailCampaigns.mockResolvedValue({ items: [ready], total: 1, page: 1, page_size: 20 });
    actions.fetchEmailCampaignReview.mockResolvedValue(START_REVIEW);
    actions.launchEmailCampaignAction.mockResolvedValue({ data: { ...ready, status: "running" } });
    renderList();

    expect(await screen.findByText("Pronta", { selector: "span.text-xs" })).toBeInTheDocument();
    fireEvent.pointerDown(await screen.findByRole("button", { name: "Ações de Pronta" }), { button: 0, ctrlKey: false });
    fireEvent.click(within(await screen.findByRole("menu")).getByText("Iniciar"));
    const dialog = await screen.findByRole("alertdialog");
    expect(await within(dialog).findByText(/O envio completo está estimado em/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Iniciar" }));
    await waitFor(() => expect(actions.launchEmailCampaignAction).toHaveBeenCalledWith("c5"));
  });

  it("filters by the ready status", async () => {
    actions.fetchEmailCampaigns.mockResolvedValue({ items: ROWS, total: 3, page: 1, page_size: 20 });
    renderList();

    expect(await screen.findByText("Black Friday")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("combobox", { name: "Filtrar por status" }));
    expect(await screen.findByRole("option", { name: "Pronta" })).toBeInTheDocument();
  });
});

const START_REVIEW = {
  audience: { matched: 2, with_email: 2, sendable: 2, skipped: {} },
  send: { units: 2, unit_micros: 1000, unit_cost_micros: 1000, total_micros: 2000, unit_brl: 0.005, total_brl: 0.01 },
  first_batch: { units: 2, unit_micros: 1000, unit_cost_micros: 1000, total_micros: 2000, unit_brl: 0.005, total_brl: 0.01 },
  batch_size: 1000,
  balance_micros: 10_000_000,
  missing_micros: 0,
  exchange_rate: 5,
  balance_brl: 50,
  missing_brl: 0,
  time_zone: "America/Sao_Paulo",
  check: { blocking: [], hints: [] },
};
