import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { Campaign, Metrics, Review } from "@/lib/email-campaigns/types";

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
  usePathname: () => "/dashboard/email/campaigns/c1",
}));

const access = vi.hoisted(() => ({ allowed: true }));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "ws1" }, can: () => access.allowed }),
}));

const actions = vi.hoisted(() => ({
  fetchEmailCampaign: vi.fn(),
  fetchEmailCampaignMetrics: vi.fn(),
  fetchEmailCampaignTimeline: vi.fn(),
  fetchEmailCampaignLinks: vi.fn(),
  fetchEmailCampaignDomains: vi.fn(),
  fetchEmailCampaignRecipients: vi.fn(),
  fetchEmailSenders: vi.fn(),
  createEmailCampaignAction: vi.fn(),
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

vi.mock("@/components/explainers/ExplainerHint", () => ({ ExplainerHint: () => null }));
vi.mock("../detail/EmailTimelinePanel", () => ({ EmailTimelinePanel: () => <div data-testid="timeline" /> }));

import { EmailCampaignDetail } from "../detail/EmailCampaignDetail";

const CAMPAIGN: Campaign = {
  id: "c1",
  name: "Black Friday",
  status: "held",
  hold_reason: "daily_cap",
  hold: { reason: "daily_cap", resume_at: "2026-10-22T03:00:00Z" },
  actions: ["resume", "pause", "stop"],
  billing: {
    batch_size: 1000,
    current_batch: 1,
    charged_units: 1000,
    charged_micros: 600_000,
    sent_units: 700,
    refunded_units: 0,
    refunded_micros: 0,
    final_micros: 600_000,
    settled_at: null,
    refund_pending_micros: 180_000,
    exchange_rate: 5,
    charged_brl: 3,
    refunded_brl: 0,
    final_brl: 3,
    refund_pending_brl: 0.9,
  },
  time_zone: "America/Sao_Paulo",
  sender_id: "s1",
  subject: "Oferta para você",
  document: { version: 1, settings: {}, blocks: [] },
  ab_test: { variant_b_subject: "Só hoje: 30% off", test_percent: 20, winner_metric: "opens", decide_after_minutes: 120, winner: "b" },
  started_at: "2026-10-21T10:00:00Z",
  created_at: "2026-10-21T09:00:00Z",
  updated_at: "2026-10-21T10:00:00Z",
};

const METRICS: Metrics = {
  recipients: 1100,
  pending: 300,
  sent: 700,
  failed: 0,
  skipped: { no_email: 100 },
  delivered: 680,
  opens: 272,
  clicks: 68,
  hard_bounces: 10,
  soft_bounces: 4,
  complaints: 1,
  unsubscribes: 3,
  skipped_total: 100,
  delivery_rate: 9714,
  open_rate: 4000,
  click_rate: 1000,
  click_to_open_rate: 2500,
  bounce_rate: 200,
  complaint_rate: 15,
  unsubscribe_rate: 44,
  status: "held",
  hold_reason: "daily_cap",
  variants: { a: { delivered: 70, opens: 21, clicks: 5 }, b: { delivered: 68, opens: 30, clicks: 9 }, winner: { delivered: 542, opens: 221, clicks: 54 } },
  winner: "b",
  refresh_after_seconds: 15,
};

const IDLE_METRICS: Metrics = {
  recipients: 0,
  pending: 0,
  sent: 0,
  failed: 0,
  skipped: null,
  delivered: 0,
  opens: 0,
  clicks: 0,
  hard_bounces: 0,
  soft_bounces: 0,
  complaints: 0,
  unsubscribes: 0,
  skipped_total: 0,
  delivery_rate: 0,
  open_rate: 0,
  click_rate: 0,
  click_to_open_rate: 0,
  bounce_rate: 0,
  complaint_rate: 0,
  unsubscribe_rate: 0,
  status: "ready",
  hold_reason: "",
  refresh_after_seconds: 0,
};

const READY_REVIEW: Review = {
  audience: { matched: 1200, with_email: 1100, sendable: 990, never_mailed: 0, skipped: { no_email: 100, unsubscribed: 60, suppressed: 50 } },
  send: { units: 990, unit_micros: 583, unit_cost_micros: 165, total_micros: 577_170, unit_brl: 0.003498, total_brl: 3.46302 },
  first_batch: { units: 990, unit_micros: 583, unit_cost_micros: 165, total_micros: 577_170, unit_brl: 0.003498, total_brl: 3.46302 },
  batch_size: 1000,
  balance_micros: 10_000_000,
  missing_micros: 0,
  exchange_rate: 6,
  balance_brl: 60,
  missing_brl: 0,
  after_first_batch_micros: 9_422_830,
  after_first_batch_brl: 56.53698,
  test_batch: 0,
  time_zone: "America/Sao_Paulo",
  check: { blocking: [], hints: [] },
};

const READY: Campaign = { ...CAMPAIGN, status: "ready", hold_reason: undefined, hold: undefined, ab_test: undefined, started_at: undefined, billing: { ...CAMPAIGN.billing, current_batch: 0, charged_units: 0, charged_micros: 0, sent_units: 0, final_micros: 0, refund_pending_micros: 0, charged_brl: 0, final_brl: 0, refund_pending_brl: 0 }, actions: ["edit", "delete", "schedule", "launch", "start"] };

function renderDetail() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
        <EmailCampaignDetail campaignId="c1" />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return { ...view, client };
}

beforeEach(() => {
  for (const mock of Object.values(actions)) mock.mockReset();
  navigation.push.mockReset();
  navigation.replace.mockReset();
  access.allowed = true;
  actions.fetchEmailCampaign.mockResolvedValue(CAMPAIGN);
  actions.fetchEmailCampaignMetrics.mockResolvedValue(METRICS);
  actions.fetchEmailCampaignTimeline.mockResolvedValue({ bucket: "hour", points: [], refresh_after_seconds: 15, time_zone: "America/Sao_Paulo" });
  actions.fetchEmailCampaignLinks.mockResolvedValue({ items: [{ url: "https://loja.com/oferta?utm_source=email", clicks: 40, unique_clickers: 30 }] });
  actions.fetchEmailCampaignDomains.mockResolvedValue({ items: [{ family: "gmail", sent: 500, delivered: 490, opens: 200, bounces: 10, open_rate: 4082, bounce_rate: 200 }] });
  actions.fetchEmailCampaignRecipients.mockResolvedValue({ items: [{ id: "r1", lead_name: "Ana Souza", address: "ana@loja.com", status: "sent", variant: "b", sent_at: "2026-10-21T10:01:00Z", delivered_at: "2026-10-21T10:01:05Z", opened_at: "2026-10-21T10:30:00Z" }], total: 1, page: 1, page_size: 25 });
  actions.fetchEmailSenders.mockResolvedValue([{ id: "s1", domain_id: "d1", address: "ola@loja.com", local_part: "ola", display_name: "Loja", reply_forward_to: "", is_default: true }]);
});

describe("EmailCampaignDetail", () => {
  it("shows the live readout with rates from the backend", async () => {
    renderDetail();

    expect(await screen.findByRole("heading", { name: /Black Friday/ })).toBeInTheDocument();
    const live = await screen.findByRole("region", { name: "Andamento do envio" });
    expect(within(live).getAllByText("700").length).toBeGreaterThan(0);
    expect(within(live).getByText("97,1%")).toBeInTheDocument();
    expect(within(live).getByText("40,0%")).toBeInTheDocument();
    expect(within(live).getByText("25,0%")).toBeInTheDocument();
    expect(within(live).getByText("Em espera: limite diário")).toBeInTheDocument();
    expect(screen.getByText("Loja <ola@loja.com>")).toBeInTheDocument();
    expect(screen.getAllByText("Só hoje: 30% off").length).toBe(2);
  });

  it("keeps the running view with tiles, panels and recipients", async () => {
    renderDetail();

    const live = await screen.findByRole("region", { name: "Andamento do envio" });
    expect(within(live).getByRole("button", { name: /Na fila/ })).toBeInTheDocument();
    expect(within(live).getByText("Reclamações")).toBeInTheDocument();
    expect(within(live).getByText("Descadastros")).toBeInTheDocument();
    expect(await screen.findByText("Funil de entrega")).toBeInTheDocument();
    expect(screen.getByTestId("timeline")).toBeInTheDocument();
    expect(screen.getByText("Cobrado até agora")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Fora do envio" })).toBeInTheDocument();
    expect(await screen.findByText("ana@loja.com")).toBeInTheDocument();
    expect(screen.queryByText("Quem vai receber")).toBeNull();
    expect(screen.queryByText("Custo do envio")).toBeNull();
    expect(actions.fetchEmailCampaignReview).not.toHaveBeenCalled();
  });

  it("filters the recipients by the tile the person picks", async () => {
    renderDetail();

    const live = await screen.findByRole("region", { name: "Andamento do envio" });
    await screen.findByText("ana@loja.com");
    fireEvent.click(within(live).getByRole("button", { name: /Enviados/ }));

    await waitFor(() => expect(actions.fetchEmailCampaignRecipients).toHaveBeenLastCalledWith("c1", expect.objectContaining({ status: "sent", page: 1 }), expect.anything()));
    expect(within(live).getByRole("button", { name: /Enviados/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows a ready campaign's audience, estimated cost and zeroed tiles before it starts", async () => {
    actions.fetchEmailCampaign.mockResolvedValue(READY);
    actions.fetchEmailCampaignMetrics.mockResolvedValue(IDLE_METRICS);
    actions.fetchEmailCampaignReview.mockResolvedValue(READY_REVIEW);
    renderDetail();

    const live = await screen.findByRole("region", { name: "Andamento do envio" });
    expect(await within(live).findByText("enviados de 990")).toBeInTheDocument();
    expect(within(live).getByText("O envio ainda não começou")).toBeInTheDocument();
    expect(within(live).getAllByText("n/d").length).toBe(4);
    for (const tile of ["Na fila", "Enviados", "Entregues", "Abriram", "Clicaram", "Rejeições", "Reclamações", "Descadastros"]) {
      expect(within(live).getAllByText(tile).length).toBeGreaterThan(0);
    }
    expect(within(live).queryByRole("button")).toBeNull();

    expect(screen.getByText("Quem vai receber")).toBeInTheDocument();
    expect(screen.getByText("1.200")).toBeInTheDocument();
    expect(screen.getByText("descadastrados")).toBeInTheDocument();
    expect(screen.getByText("Custo do envio")).toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s3,46/).length).toBeGreaterThan(0);
    expect(screen.getByText("Saldo depois do primeiro lote")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s56,54/)).toBeInTheDocument();
    expect(screen.getByText("Loja <ola@loja.com>")).toBeInTheDocument();
    expect(screen.getByText("Quando alguém iniciar")).toBeInTheDocument();
    expect(screen.queryByTestId("timeline")).toBeNull();
    expect(actions.fetchEmailCampaignRecipients).not.toHaveBeenCalled();
  });

  it("shows when a scheduled campaign starts", async () => {
    actions.fetchEmailCampaign.mockResolvedValue({ ...READY, status: "scheduled", scheduled_at: "2026-10-25T12:00:00Z", actions: ["edit", "unschedule"] });
    actions.fetchEmailCampaignMetrics.mockResolvedValue({ ...IDLE_METRICS, status: "scheduled" });
    actions.fetchEmailCampaignReview.mockResolvedValue(READY_REVIEW);
    renderDetail();

    const live = await screen.findByRole("region", { name: "Andamento do envio" });
    expect(await within(live).findByText(/^Começa em 25 de out.* 09:00$/)).toBeInTheDocument();
    expect(screen.getAllByText(/^Agendada para 25 de out.* 09:00$/).length).toBeGreaterThan(0);
    expect(await screen.findByText("Quem vai receber")).toBeInTheDocument();
  });

  it("reads the estimate again when the person comes back to the window", async () => {
    actions.fetchEmailCampaign.mockResolvedValue(READY);
    actions.fetchEmailCampaignMetrics.mockResolvedValue(IDLE_METRICS);
    actions.fetchEmailCampaignReview.mockResolvedValue(READY_REVIEW);
    renderDetail();

    await screen.findByText("Quem vai receber");
    const reviewed = actions.fetchEmailCampaignReview.mock.calls.length;
    focusManager.setFocused(false);
    focusManager.setFocused(true);

    await waitFor(() => expect(actions.fetchEmailCampaignReview.mock.calls.length).toBeGreaterThan(reviewed));
    focusManager.setFocused(undefined);
  });

  it("reads the estimate again when the audience is recounted or a lead is saved", async () => {
    actions.fetchEmailCampaign.mockResolvedValue(READY);
    actions.fetchEmailCampaignMetrics.mockResolvedValue(IDLE_METRICS);
    actions.fetchEmailCampaignReview.mockResolvedValue(READY_REVIEW);
    const client = renderDetail().client;

    await screen.findByText("Quem vai receber");
    const reviewed = actions.fetchEmailCampaignReview.mock.calls.length;
    client.setQueryData(["lead", "ws1", "l1"], { id: "l1" });
    await client.invalidateQueries({ queryKey: ["lead", "ws1", "l1"] });
    await waitFor(() => expect(actions.fetchEmailCampaignReview.mock.calls.length).toBeGreaterThan(reviewed));

    const afterLead = actions.fetchEmailCampaignReview.mock.calls.length;
    client.setQueryData(["campaign-audience", "ws1", "email", "count", null], { matched: 1 });
    await client.invalidateQueries({ queryKey: ["campaign-audience", "ws1", "email", "count"] });
    await waitFor(() => expect(actions.fetchEmailCampaignReview.mock.calls.length).toBeGreaterThan(afterLead));
  });

  it("keeps the estimate from a member who cannot review it", async () => {
    access.allowed = false;
    actions.fetchEmailCampaign.mockResolvedValue(READY);
    actions.fetchEmailCampaignMetrics.mockResolvedValue(IDLE_METRICS);
    renderDetail();

    expect(await screen.findByText("Ainda sem resultados")).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Andamento do envio" })).toBeInTheDocument();
    expect(actions.fetchEmailCampaignReview).not.toHaveBeenCalled();
  });

  it("explains the daily cap hold with the resume time the backend gives", async () => {
    renderDetail();

    expect(await screen.findByText("Limite diário de envios atingido")).toBeInTheDocument();
    expect(await screen.findByText(/^O envio volta sozinho em 22 de out.* 00:00\.$/)).toBeInTheDocument();
  });

  it("explains an account pause with the reason the backend gives", async () => {
    actions.fetchEmailCampaign.mockResolvedValue({ ...CAMPAIGN, hold_reason: "account_paused", hold: { reason: "account_paused", account_status_reason: "Taxa de reclamação alta" } });
    renderDetail();

    expect(await screen.findByText("Envio da conta pausado")).toBeInTheDocument();
    expect(await screen.findByText("Motivo: Taxa de reclamação alta")).toBeInTheDocument();
  });

  it("shows a campaign waiting for the wallet with the top up action", async () => {
    actions.fetchEmailCampaign.mockResolvedValue({ ...CAMPAIGN, hold_reason: "balance_insufficient", hold: { reason: "balance_insufficient" } });
    renderDetail();

    expect(await screen.findAllByText("Aguardando saldo")).not.toHaveLength(0);
    expect(screen.getByText(/não cobre o próximo lote de 1.000 e-mails/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Recarregar carteira" })).toHaveAttribute("href", expect.stringContaining("/dashboard/balance"));
  });

  it("shows the a/b winner, links, providers, recipients and billing", async () => {
    renderDetail();

    expect(await screen.findByText("Variante B venceu")).toBeInTheDocument();
    expect(screen.getAllByText("Vencedora").length).toBeGreaterThan(0);
    expect(await screen.findByText("loja.com")).toBeInTheDocument();
    expect(await screen.findByText("Gmail")).toBeInTheDocument();
    expect(await screen.findByText("ana@loja.com")).toBeInTheDocument();
    expect(screen.getByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getByText("Cobrado até agora")).toBeInTheDocument();
    expect(screen.getByText("1.000 e-mails pagos em 1 lote")).toBeInTheDocument();
    expect(screen.getByText(/cobrada em lotes de 1.000 e-mails, cada lote antes de sair/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s3,00/)).toBeInTheDocument();
    expect(screen.getByText("A devolver no fim")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s0,90/)).toBeInTheDocument();
  });

  it("shows the settled refund and final cost from the backend", async () => {
    actions.fetchEmailCampaign.mockResolvedValue({
      ...CAMPAIGN,
      status: "completed",
      hold_reason: undefined,
      hold: undefined,
      actions: [],
      billing: { ...CAMPAIGN.billing, refunded_units: 100, refunded_micros: 60_000, final_micros: 540_000, settled_at: "2026-10-21T12:00:00Z", refund_pending_micros: 0, refunded_brl: 0.3, final_brl: 2.7, refund_pending_brl: 0 },
    });
    renderDetail();

    expect(await screen.findByText("Devolvido ao saldo")).toBeInTheDocument();
    expect(screen.getByText("100 e-mails não enviados")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s2,70/)).toBeInTheDocument();
    expect(screen.queryByText("A devolver no fim")).toBeNull();
  });

  it("offers resume, pause and stop for a held campaign and confirms the stop", async () => {
    actions.stopEmailCampaignAction.mockResolvedValue({ data: { ...CAMPAIGN, status: "stopped" } });
    renderDetail();

    expect(await screen.findByRole("button", { name: "Retomar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pausar" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Parar" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Parar" }));

    await waitFor(() => expect(actions.stopEmailCampaignAction).toHaveBeenCalledWith("c1"));
  });

  it("offers only the commands the backend lists", async () => {
    actions.fetchEmailCampaign.mockResolvedValue({ ...CAMPAIGN, actions: ["stop"] });
    renderDetail();

    expect(await screen.findByRole("button", { name: "Parar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retomar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Pausar" })).toBeNull();
  });

  it("hides the commands the member cannot run", async () => {
    access.allowed = false;
    renderDetail();

    expect(await screen.findByRole("heading", { name: /Black Friday/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retomar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Parar" })).toBeNull();
  });

  it("sends a draft back to the wizard", async () => {
    actions.fetchEmailCampaign.mockResolvedValue({ ...CAMPAIGN, status: "draft", hold_reason: undefined });
    renderDetail();

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/dashboard/email/campaigns/new?campaign=c1"));
  });

  it("starts a ready campaign from the header after confirming the cost", async () => {
    const ready: Campaign = { ...CAMPAIGN, status: "ready", hold_reason: undefined, hold: undefined, started_at: undefined, actions: ["edit", "delete", "schedule", "launch", "start"] };
    actions.fetchEmailCampaign.mockResolvedValue(ready);
    actions.fetchEmailCampaignMetrics.mockResolvedValue(IDLE_METRICS);
    actions.fetchEmailCampaignReview.mockResolvedValue({
      audience: { matched: 2, with_email: 2, sendable: 2, skipped: {} },
      send: { units: 2, unit_micros: 1000, unit_cost_micros: 1000, total_micros: 2000, unit_brl: 0.005, total_brl: 0.01 },
      first_batch: { units: 2, unit_micros: 1000, unit_cost_micros: 1000, total_micros: 2000, unit_brl: 0.005, total_brl: 0.01 },
      batch_size: 1000, balance_micros: 10_000_000, missing_micros: 0, exchange_rate: 5, balance_brl: 50, missing_brl: 0,
      after_first_batch_micros: 9_998_000, after_first_batch_brl: 49.99,
      time_zone: "America/Sao_Paulo", check: { blocking: [], hints: [] },
    });
    actions.launchEmailCampaignAction.mockResolvedValue({ data: { ...ready, status: "running" } });
    renderDetail();

    expect(await screen.findAllByText("Pronta")).not.toHaveLength(0);
    fireEvent.click(await screen.findByRole("button", { name: "Iniciar" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(await within(dialog).findByText(/O envio completo está estimado em/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Iniciar" }));
    await waitFor(() => expect(actions.launchEmailCampaignAction).toHaveBeenCalledWith("c1"));
  });
});
