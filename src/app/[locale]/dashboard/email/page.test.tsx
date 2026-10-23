import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getEmailSetupAction: vi.fn(),
  getEmailPricingAction: vi.fn(),
  getEmailOverviewAction: vi.fn(),
  provisionEmailAction: vi.fn(),
  checkEmailSubdomainAction: vi.fn(),
  listEmailSuppressionsAction: vi.fn(),
}));
const perms = vi.hoisted(() => ({ granted: new Set<string>() }));

vi.mock("@/app/actions/email-marketing", () => api);
vi.mock("@/app/actions/balance", () => ({ getMyBalanceAction: vi.fn(), listMyTransactionsAction: vi.fn() }));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({
    currentWorkspace: { id: "ws-1" },
    permissionsLoading: false,
    can: (resource: string, action: string) => perms.granted.has(`${resource}:${action}`),
  }),
}));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: { id: "u-1" } }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("framer-motion", () => import("@/test/framer-motion-stub"));
vi.mock("@/components/dashboard/DashboardPageHeader", () => ({
  DashboardPageHeader: ({ badge, actions }: { badge: string; actions?: ReactNode }) => (
    <header>
      <h1>{badge}</h1>
      {actions}
    </header>
  ),
}));
vi.mock("@/components/email-marketing/daily-series-chart", () => ({ DailySeriesChart: () => <div data-testid="daily-chart" /> }));
vi.mock("@/components/explainers/ExplainerHint", () => ({ ExplainerHint: () => null }));
vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import ptMessages from "@/i18n/messages/pt.json";

import EmailOverviewPage from "./page";

const copy = ptMessages.emailMarketing;

const PRICING = {
  exchangeRate: 5,
  send: { service: "send", metric: "per_message", unitMicros: 700, unitBRL: 0.0035, thousandBRL: 3.5 },
  sendAttachments: {
    perChunk: { service: "send", metric: "per_chunk", unitMicros: 102, unitBRL: 0.0005, thousandBRL: 0.51 },
    chunkBytes: 262144,
  },
  receive: {
    perMessage: { service: "receive", metric: "per_message", unitMicros: 583, unitBRL: 0.0029, thousandBRL: 2.9 },
    perChunk: { service: "receive", metric: "per_chunk", unitMicros: 380, unitBRL: 0.0019, thousandBRL: 1.9 },
    chunkBytes: 262144,
  },
};

const ACCOUNT = {
  id: "acc-1",
  workspace_id: "ws-1",
  provider: "ses",
  tenant_name: "acme",
  mode: "probation",
  status: "active",
  status_reason: "",
  slug: "acme",
  probation_started_at: "2026-10-15T00:00:00Z",
  promoted_at: null,
};

const ACTIVE_SETUP = {
  provisioned: true,
  account: ACCOUNT,
  probation: {
    days: 6,
    required_days: 14,
    delivered: 140,
    hard_bounces: 1,
    complaints: 0,
    outcome: "too_soon",
    targets: { days: 14, min_delivered: 200, max_bounce_per_mil: 20, max_complaint_per_10k: 8 },
  },
  domains: [
    {
      id: "d-1",
      domain: "acme.envios.example",
      kind: "shared_probation",
      status: "verified",
      connect_method: "automatic",
      mail_from_domain: "bounce.acme.envios.example",
      reply_domain: "acme.envios.example",
      records: [],
      failure_reason: "",
      verified_at: "2026-10-15T00:10:00Z",
      last_checked_at: null,
      retired: false,
      sendable: true,
      lifecycle: "active",
      actions: { recheck: true, remove: false },
      setup: { state: "done" },
      used_today: 120,
      cap_today: 500,
      daily_limit: "capped",
    },
  ],
  senders: [],
  setup: { state: "done" },
  subdomain: { slug: "acme", address: "contato@acme.envios.example", locked: false },
  activation: { allowed: true },
};

const NOT_PROVISIONED = {
  provisioned: false,
  account: null,
  probation: null,
  domains: [],
  senders: [],
  setup: { state: "done" },
  subdomain: { slug: "acme", address: "contato@acme.envios.example", locked: false },
  activation: { allowed: true },
};

function checkAnswer(slug: string) {
  if (slug === "outra") return { data: { slug, available: false, error_code: "email_subdomain_taken", address: "contato@outra.envios.example" } };
  if (slug === "Outra Loja") return { data: { slug, available: false, error_code: "email_subdomain_invalid" } };
  return { data: { slug, available: true, address: `contato@${slug}.envios.example` } };
}

async function activateButton() {
  await waitFor(() => expect(screen.getByRole("button", { name: copy.onboarding.activate })).toBeEnabled(), { timeout: 3000 });
  return screen.getByRole("button", { name: copy.onboarding.activate });
}

const SETTING_UP = {
  ...ACTIVE_SETUP,
  domains: [{ ...ACTIVE_SETUP.domains[0], status: "pending", sendable: false, verified_at: null, records: [], setup: { state: "in_progress" } }],
  setup: { state: "in_progress" },
};

const SETUP_FAILED = {
  ...SETTING_UP,
  domains: [{ ...SETTING_UP.domains[0], failure_reason: "tenant: ThrottlingException raw", setup: { state: "failed", error_code: "email_reply_capacity_reached" } }],
  setup: { state: "failed", error_code: "email_reply_capacity_reached" },
};

const OVERVIEW = {
  days: 30,
  time_zone: "America/Sao_Paulo",
  totals: {
    recipients: 1000, pending: 0, sent: 1000, failed: 0, skipped: {}, delivered: 980, opens: 400, clicks: 90,
    hard_bounces: 4, soft_bounces: 6, complaints: 0, unsubscribes: 3, skipped_total: 0,
    delivery_rate: 9800, open_rate: 4082, click_rate: 918, click_to_open_rate: 2250, bounce_rate: 100, complaint_rate: 0, unsubscribe_rate: 31,
  },
  daily: [],
  top: [{ id: "c-1", name: "Black Friday", sent: 1000, delivered: 980, opens: 400, clicks: 90, open_rate: 4082, click_rate: 918 }],
  reputation: {
    bounce_rate: 600,
    bounce_warning: 200,
    bounce_limit: 500,
    bounce_level: "over",
    bounce_over_limit: true,
    complaint_rate: 15,
    complaint_warning: 10,
    complaint_limit: 30,
    complaint_level: "warning",
    complaint_over_limit: false,
  },
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="UTC">
        <EmailOverviewPage />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  perms.granted = new Set(["email_marketing:read", "email_marketing:configure", "email_marketing:create"]);
  api.getEmailPricingAction.mockResolvedValue({ data: PRICING });
  api.getEmailOverviewAction.mockResolvedValue({ data: OVERVIEW });
  api.checkEmailSubdomainAction.mockImplementation(async (slug: string) => checkAnswer(slug));
});

describe("email overview onboarding", () => {
  it("explains how email works, shows the live price and activates on request", async () => {
    api.getEmailSetupAction.mockResolvedValueOnce({ data: NOT_PROVISIONED });
    api.getEmailSetupAction.mockResolvedValue({ data: ACTIVE_SETUP });
    api.provisionEmailAction.mockResolvedValue({ data: ACTIVE_SETUP });
    renderPage();

    expect(await screen.findByRole("heading", { name: copy.onboarding.title })).toBeInTheDocument();
    expect(screen.getByText(copy.onboarding.steps.start.title)).toBeInTheDocument();
    expect(screen.getByText(copy.onboarding.steps.grow.title)).toBeInTheDocument();
    expect(screen.getByText(copy.onboarding.steps.replies.title)).toBeInTheDocument();
    expect(await screen.findByText(/0,0035/)).toBeInTheDocument();
    expect(screen.getByText(copy.onboarding.perEmail)).toBeInTheDocument();
    expect(screen.getByText(/3,50/)).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.tagName === "P" && (node.textContent ?? "").replace(/\s/g, " ") === "Respostas: R$ 0,0029 por resposta recebida, mais R$ 0,0019 a cada 256 KB")).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.tagName === "P" && (node.textContent ?? "").replace(/\s/g, " ") === "Anexos enviados: R$ 0,0005 a cada 256 KB")).toBeInTheDocument();

    fireEvent.click(await activateButton());
    await waitFor(() => expect(api.provisionEmailAction).toHaveBeenCalledWith("acme"));
    expect(await screen.findByText(copy.overview.kpis.openRate)).toBeInTheDocument();
    expect(api.getEmailOverviewAction).toHaveBeenCalledWith(30, expect.anything());
  });

  it("tells a member without the configure permission exactly what is missing", async () => {
    perms.granted = new Set(["email_marketing:read"]);
    api.getEmailSetupAction.mockResolvedValue({ data: NOT_PROVISIONED });
    renderPage();

    expect(await screen.findByText(copy.onboarding.noPermissionTitle)).toBeInTheDocument();
    expect(screen.getByText(copy.onboarding.noPermissionText)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.onboarding.activate })).toBeNull();
  });

  it("answers the activation right away with the domain being set up and polls until it is ready", async () => {
    api.getEmailSetupAction.mockResolvedValueOnce({ data: NOT_PROVISIONED });
    api.getEmailSetupAction.mockResolvedValueOnce({ data: SETTING_UP });
    api.getEmailSetupAction.mockResolvedValue({ data: ACTIVE_SETUP });
    api.provisionEmailAction.mockResolvedValue({ data: SETTING_UP });
    renderPage();

    fireEvent.click(await activateButton());
    expect(await screen.findByText(copy.setup.inProgressTitle)).toBeInTheDocument();
    expect(screen.queryByText(copy.onboarding.activationFailed)).toBeNull();
    await waitFor(() => expect(screen.queryByText(copy.setup.inProgressTitle)).toBeNull(), { timeout: 8000 });
    expect(screen.getByText("120 de 500 hoje")).toBeInTheDocument();
  }, 12000);

  it("shows a failed setup with its coded reason and retries through the activation", async () => {
    api.getEmailSetupAction.mockResolvedValue({ data: SETUP_FAILED });
    api.provisionEmailAction.mockResolvedValue({ data: SETTING_UP });
    renderPage();

    const notice = (await screen.findByText("Não foi possível configurar acme.envios.example")).closest(".notice") as HTMLElement;
    expect(notice).not.toBeNull();
    expect(screen.getByText(copy.errors.email_reply_capacity_reached)).toBeInTheDocument();
    expect(screen.queryByText(/ThrottlingException/)).toBeNull();
    api.getEmailSetupAction.mockResolvedValue({ data: SETTING_UP });
    fireEvent.click(screen.getByRole("button", { name: copy.setup.retry }));
    await waitFor(() => expect(api.provisionEmailAction).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(copy.setup.inProgressTitle)).toBeInTheDocument();
  });

  it("shows an activation refusal in the catalog's words", async () => {
    api.getEmailSetupAction.mockResolvedValue({ data: NOT_PROVISIONED });
    api.provisionEmailAction.mockResolvedValue({ error: "raw", code: "email_provider_unavailable", status: 503 });
    renderPage();

    fireEvent.click(await activateButton());
    expect(await screen.findByText(copy.errors.email_provider_unavailable)).toBeInTheDocument();
    expect(screen.queryByText("raw")).toBeNull();
  });
});

describe("email overview paid plan verdict", () => {
  it("explains before the click that activation needs a paid plan and links to the plans", async () => {
    api.getEmailSetupAction.mockResolvedValue({ data: { ...NOT_PROVISIONED, activation: { allowed: false, error_code: "email_plan_required" } } });
    renderPage();

    expect(await screen.findByText(copy.onboarding.planRequiredTitle)).toBeInTheDocument();
    expect(screen.getByText(copy.errors.email_plan_required)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: copy.onboarding.seePlans })).toHaveAttribute("href", "/dashboard/plans");
    expect(screen.getByRole("button", { name: copy.onboarding.activate })).toBeDisabled();
    expect(api.provisionEmailAction).not.toHaveBeenCalled();
  });

  it("refuses without a plans link while the plan cannot be read", async () => {
    api.getEmailSetupAction.mockResolvedValue({ data: { ...NOT_PROVISIONED, activation: { allowed: false, error_code: "email_plan_unavailable" } } });
    renderPage();

    expect(await screen.findByText(copy.errors.email_plan_unavailable)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: copy.onboarding.seePlans })).toBeNull();
    expect(screen.getByRole("button", { name: copy.onboarding.activate })).toBeDisabled();
  });

  it("turns a plan refusal answered at the click into the same plans notice", async () => {
    api.getEmailSetupAction.mockResolvedValue({ data: NOT_PROVISIONED });
    api.provisionEmailAction.mockResolvedValue({ error: "raw", code: "email_plan_required", status: 402 });
    renderPage();

    fireEvent.click(await activateButton());
    expect(await screen.findByText(copy.onboarding.planRequiredTitle)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: copy.onboarding.seePlans })).toHaveAttribute("href", "/dashboard/plans");
    expect(screen.queryByText(copy.onboarding.activationFailed)).toBeNull();
  });
});

describe("email overview subdomain choice", () => {
  it("prefills the suggested address, follows the server verdict while typing and activates with the chosen name", async () => {
    api.getEmailSetupAction.mockResolvedValueOnce({ data: NOT_PROVISIONED });
    api.getEmailSetupAction.mockResolvedValue({ data: ACTIVE_SETUP });
    api.provisionEmailAction.mockResolvedValue({ data: ACTIVE_SETUP });
    renderPage();

    const field = await screen.findByLabelText(copy.subdomain.label);
    expect(field).toHaveValue("acme");
    expect(await screen.findByText("Seus e-mails saem de contato@acme.envios.example")).toBeInTheDocument();
    expect(screen.getByText(copy.subdomain.available)).toBeInTheDocument();

    fireEvent.change(field, { target: { value: "outra" } });
    expect(await screen.findByText(copy.errors.email_subdomain_taken)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.onboarding.activate })).toBeDisabled();

    fireEvent.change(field, { target: { value: "Outra Loja" } });
    expect(await screen.findByText(copy.errors.email_subdomain_invalid)).toBeInTheDocument();
    expect(api.checkEmailSubdomainAction).toHaveBeenCalledWith("Outra Loja", expect.anything());

    fireEvent.change(field, { target: { value: "cartaodetodososasco" } });
    expect(await screen.findByText("Seus e-mails saem de contato@cartaodetodososasco.envios.example")).toBeInTheDocument();
    fireEvent.click(await activateButton());
    await waitFor(() => expect(api.provisionEmailAction).toHaveBeenCalledWith("cartaodetodososasco"));
  });
});

describe("email overview once active", () => {
  it("shows the readout, reputation against the backend limits, the ladder and the top campaigns", async () => {
    api.getEmailSetupAction.mockResolvedValue({ data: ACTIVE_SETUP });
    renderPage();

    expect(await screen.findByText("Black Friday")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Black Friday" })).toHaveAttribute("href", "/dashboard/email/campaigns/c-1");
    expect(screen.getByText(copy.overview.reputation.bounce)).toBeInTheDocument();
    expect(screen.getByText(copy.reputation.over)).toBeInTheDocument();
    expect(screen.getByText(copy.reputation.near)).toBeInTheDocument();
    expect(screen.getByText("atenção 2,0%")).toBeInTheDocument();
    expect(screen.getByText("Dia 6 de 14")).toBeInTheDocument();
    expect(screen.getByText("140 de 200")).toBeInTheDocument();
    expect(screen.getByText("120 de 500 hoje")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: copy.onboarding.title })).toBeNull();
  });

  it("shows a verified own domain without a daily limit and with the gradual volume guidance", async () => {
    const own = {
      ...ACTIVE_SETUP.domains[0],
      id: "d-own",
      domain: "acme.com.br",
      kind: "own",
      connect_method: "manual",
      used_today: 8000,
      cap_today: undefined,
      daily_limit: "unlimited",
    };
    api.getEmailSetupAction.mockResolvedValue({ data: { ...ACTIVE_SETUP, probation: null, account: { ...ACCOUNT, mode: "own_domain" }, domains: [own] } });
    renderPage();

    expect(await screen.findByText("Black Friday")).toBeInTheDocument();
    expect(screen.getByText("Sem limite diário. 8.000 enviados hoje.")).toBeInTheDocument();
    expect(screen.getByText(copy.overview.usage.newDomainGuidance)).toBeInTheDocument();
    expect(screen.queryByText(/de 500 hoje/)).toBeNull();
    expect(screen.queryByText(/Dia \d+ de/)).toBeNull();
    expect(screen.getByText(copy.ladder.steps.own_domain.text)).toBeInTheDocument();
  });

  it("switches the window through the day selector", async () => {
    api.getEmailSetupAction.mockResolvedValue({ data: ACTIVE_SETUP });
    renderPage();
    await screen.findByText("Black Friday");
    fireEvent.click(screen.getByRole("button", { name: "7 dias" }));
    await waitFor(() => expect(api.getEmailOverviewAction).toHaveBeenCalledWith(7, expect.anything()));
  });

  it("explains a paused account with the backend reason", async () => {
    api.getEmailSetupAction.mockResolvedValue({
      data: { ...ACTIVE_SETUP, probation: null, account: { ...ACCOUNT, status: "paused_by_provider", status_reason: "Taxa de reclamação acima do limite" } },
    });
    renderPage();
    expect(await screen.findByText(copy.account.pausedTitle.paused_by_provider)).toBeInTheDocument();
    expect(screen.getByText("Taxa de reclamação acima do limite")).toBeInTheDocument();
  });

  it("shows a dormant account plainly, without the paused notice", async () => {
    api.getEmailSetupAction.mockResolvedValue({ data: { ...ACTIVE_SETUP, probation: null, account: { ...ACCOUNT, status: "dormant" } } });
    renderPage();
    expect(await screen.findByText(copy.accountStatus.dormant)).toBeInTheDocument();
    expect(screen.queryByText(copy.account.pausedTitle.paused_by_provider)).not.toBeInTheDocument();
    expect(screen.queryByText(copy.account.pausedTitle.paused_by_platform)).not.toBeInTheDocument();
  });

  it("warns that replies are paused because the wallet is negative, with a top up link", async () => {
    api.getEmailSetupAction.mockResolvedValue({ data: { ...ACTIVE_SETUP, replies_paused: true } });
    renderPage();
    expect(await screen.findByText(copy.replies.pausedTitle)).toBeInTheDocument();
    expect(screen.getByText(copy.replies.pausedText)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: copy.replies.topUp })).toHaveAttribute("href", "/dashboard/invoices");
  });

  it("shows no paused replies notice while replies flow", async () => {
    api.getEmailSetupAction.mockResolvedValue({ data: { ...ACTIVE_SETUP, replies_paused: false } });
    renderPage();
    await screen.findByText("Black Friday");
    expect(screen.queryByText(copy.replies.pausedTitle)).toBeNull();
  });
});
