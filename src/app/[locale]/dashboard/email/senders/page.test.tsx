import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getEmailSetupAction: vi.fn(),
  listEmailSuppressionsAction: vi.fn(),
  recheckEmailDomainAction: vi.fn(),
  removeEmailDomainAction: vi.fn(),
  removeEmailSuppressionAction: vi.fn(),
  addEmailSuppressionAction: vi.fn(),
  updateEmailSenderAction: vi.fn(),
  deleteEmailSenderAction: vi.fn(),
  createEmailSenderAction: vi.fn(),
  connectEmailDomainAction: vi.fn(),
  checkEmailSubdomainAction: vi.fn(),
  changeEmailSubdomainAction: vi.fn(),
  getEmailPricingAction: vi.fn(),
  getEmailOverviewAction: vi.fn(),
  provisionEmailAction: vi.fn(),
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock("@/app/actions/email-marketing", () => api);
vi.mock("@/app/actions/balance", () => ({ getMyBalanceAction: vi.fn(), listMyTransactionsAction: vi.fn() }));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "ws-1" }, permissionsLoading: false, can: () => true }),
}));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: { id: "u-1" } }) }));
vi.mock("sonner", () => ({ toast }));
vi.mock("framer-motion", () => import("@/test/framer-motion-stub"));
vi.mock("@/components/dashboard/DashboardPageHeader", () => ({
  DashboardPageHeader: ({ badge, actions }: { badge: string; actions?: ReactNode }) => (
    <header>
      <h1>{badge}</h1>
      {actions}
    </header>
  ),
}));
vi.mock("@/components/explainers/ExplainerHint", () => ({ ExplainerHint: () => null }));
vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import ptMessages from "@/i18n/messages/pt.json";

import EmailSendersPage from "./page";

const copy = ptMessages.emailMarketing;

const OWN_DOMAIN = {
  id: "d-own",
  domain: "acme.com.br",
  kind: "own",
  status: "verifying",
  connect_method: "manual",
  mail_from_domain: "bounce.acme.com.br",
  reply_domain: "reply.acme.com.br",
  records: [
    { purpose: "dkim", type: "CNAME", name: "k1._domainkey.acme.com.br", host: "k1._domainkey", status: "verified", value: "k1.dkim.amazonses.example", priority: 0, ttl: 0 },
    { purpose: "reply_mx", type: "MX", name: "reply.acme.com.br", host: "reply", status: "pending", value: "inbound-smtp.example.com", priority: 10, ttl: 0 },
  ],
  failure_reason: "",
  verified_at: null,
  last_checked_at: null,
  retired: false,
  sendable: false,
  lifecycle: "active",
  actions: { recheck: true, remove: true },
  setup: { state: "done" },
  used_today: 0,
  daily_limit: "blocked",
};

const SETUP = {
  provisioned: true,
  account: {
    id: "acc-1", workspace_id: "ws-1", provider: "ses", tenant_name: "acme", mode: "trusted", status: "active",
    status_reason: "", slug: "acme", probation_started_at: null, promoted_at: "2026-10-10T00:00:00Z",
  },
  probation: null,
  domains: [OWN_DOMAIN],
  senders: [],
  setup: { state: "done" },
  subdomain: { slug: "acme", address: "contato@acme.mail.example", locked: false },
  activation: { allowed: true },
};

const SHARED_DOMAIN = {
  ...OWN_DOMAIN,
  id: "d-shared",
  domain: "acme.mail.example",
  kind: "shared_trusted",
  status: "verified",
  connect_method: "automatic",
  mail_from_domain: "bounce.acme.mail.example",
  reply_domain: "acme.mail.example",
  records: [],
  sendable: true,
  actions: { recheck: true, remove: false },
};

const RELEASING_DOMAIN = {
  ...SHARED_DOMAIN,
  id: "d-old",
  domain: "antiga.mail.example",
  reply_domain: "antiga.mail.example",
  retired: true,
  sendable: false,
  lifecycle: "releasing",
  actions: { recheck: false, remove: false },
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

const PRICING = {
  exchangeRate: 5,
  send: { service: "send", metric: "per_message", unitMicros: 700, unitBRL: 0.0035, thousandBRL: 3.5 },
  sendAttachments: { perChunk: { service: "send", metric: "per_chunk", unitMicros: 102, unitBRL: 0.0005, thousandBRL: 0.51 }, chunkBytes: 262144 },
  receive: {
    perMessage: { service: "receive", metric: "per_message", unitMicros: 580, unitBRL: 0.0029, thousandBRL: 2.9 },
    perChunk: { service: "receive", metric: "per_chunk", unitMicros: 380, unitBRL: 0.0019, thousandBRL: 1.9 },
    chunkBytes: 262144,
  },
};

function sender(id: string, domainId: string, address: string, domainLifecycle: string, isDefault = false) {
  return { id, domain_id: domainId, address, local_part: address.split("@")[0], display_name: "Acme", reply_forward_to: "", is_default: isDefault, domain_lifecycle: domainLifecycle };
}

const SETTING_UP_DOMAIN = { ...OWN_DOMAIN, status: "pending", records: [], setup: { state: "in_progress" } };
const FAILED_DOMAIN = { ...OWN_DOMAIN, status: "pending", records: [], failure_reason: "identity: AccessDenied raw text", setup: { state: "failed", error_code: "email_provider_unavailable" } };

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="UTC">
        <EmailSendersPage />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  toast.error.mockReset();
  toast.success.mockReset();
  api.getEmailSetupAction.mockResolvedValue({ data: SETUP });
  api.listEmailSuppressionsAction.mockResolvedValue({
    data: {
      data: [{ address: "spam@cliente.com", reason: "complaint", source_message_id: "m-1", suppressed_at: "2026-10-20T10:00:00Z", removable: false }],
      meta: { page: 1, pageSize: 20, totalPages: 1, totalItems: 1 },
    },
  });
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

describe("email senders page", () => {
  it("changes the shared address while nothing was sent from it", async () => {
    api.getEmailSetupAction.mockResolvedValue({ data: { ...SETUP, domains: [SHARED_DOMAIN] } });
    api.checkEmailSubdomainAction.mockImplementation(async (slug: string) => ({ data: { slug, available: true, address: `contato@${slug}.mail.example` } }));
    api.changeEmailSubdomainAction.mockResolvedValue({ data: { ...SETUP, subdomain: { slug: "nova", address: "contato@nova.mail.example", locked: false } } });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: copy.subdomain.change }));
    const dialog = await screen.findByRole("dialog");
    const save = () => within(dialog).getByRole("button", { name: copy.subdomain.save });
    expect(save()).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(copy.subdomain.label), { target: { value: "nova" } });
    expect(await within(dialog).findByText("Seus e-mails saem de contato@nova.mail.example")).toBeInTheDocument();
    await waitFor(() => expect(save()).toBeEnabled(), { timeout: 3000 });
    fireEvent.click(save());
    await waitFor(() => expect(api.changeEmailSubdomainAction).toHaveBeenCalledWith("nova"));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Endereço alterado para contato@nova.mail.example"));
  });

  it("explains why the shared address can no longer change after the first send", async () => {
    api.getEmailSetupAction.mockResolvedValue({ data: { ...SETUP, domains: [SHARED_DOMAIN], subdomain: { ...SETUP.subdomain, locked: true } } });
    renderPage();
    expect(await screen.findByText(copy.subdomain.locked)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.subdomain.change })).toBeNull();
  });

  it("shows a refused change in the catalog's words", async () => {
    api.getEmailSetupAction.mockResolvedValue({ data: { ...SETUP, domains: [SHARED_DOMAIN] } });
    api.checkEmailSubdomainAction.mockImplementation(async (slug: string) => ({ data: { slug, available: true, address: `contato@${slug}.mail.example` } }));
    api.changeEmailSubdomainAction.mockResolvedValue({ error: "raw", code: "email_subdomain_locked", status: 409 });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: copy.subdomain.change }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(copy.subdomain.label), { target: { value: "nova" } });
    const save = () => within(dialog).getByRole("button", { name: copy.subdomain.save });
    await waitFor(() => expect(save()).toBeEnabled(), { timeout: 3000 });
    fireEvent.click(save());
    expect(await within(dialog).findByText(copy.errors.email_subdomain_locked)).toBeInTheDocument();
  });

  it("shows a domain still being set up and polls until the backend finishes it", async () => {
    api.getEmailSetupAction.mockResolvedValueOnce({ data: { ...SETUP, domains: [SETTING_UP_DOMAIN], setup: { state: "in_progress" } } });
    api.getEmailSetupAction.mockResolvedValue({ data: SETUP });
    renderPage();
    expect(await screen.findByText(copy.setup.inProgressTitle)).toBeInTheDocument();
    expect(screen.getByText(copy.setup.sendersWaiting)).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Registros DNS de acme.com.br" })).toBeNull();
    expect(await screen.findByRole("table", { name: "Registros DNS de acme.com.br" }, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByText(copy.setup.inProgressTitle)).toBeNull();
    expect(api.getEmailSetupAction.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("shows a failed setup in the catalog's words and retries it on the backend", async () => {
    api.getEmailSetupAction.mockResolvedValue({ data: { ...SETUP, domains: [FAILED_DOMAIN], setup: { state: "failed", error_code: "email_provider_unavailable" } } });
    api.recheckEmailDomainAction.mockResolvedValue({ data: SETTING_UP_DOMAIN });
    renderPage();
    const notice = (await screen.findByText("Não foi possível configurar acme.com.br")).closest(".notice") as HTMLElement;
    expect(within(notice).getByText(copy.errors.email_provider_unavailable)).toBeInTheDocument();
    expect(screen.queryByText(/AccessDenied/)).toBeNull();
    fireEvent.click(within(notice).getByRole("button", { name: copy.setup.retry }));
    await waitFor(() => expect(api.recheckEmailDomainAction).toHaveBeenCalledWith("d-own"));
  });

  it("follows a newly connected domain while the backend sets it up, then shows its records", async () => {
    const created = { ...SETTING_UP_DOMAIN, id: "d-new", domain: "loja.com.br" };
    api.connectEmailDomainAction.mockResolvedValue({ data: created });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: copy.sendersPage.connectDomain }));
    const dialog = await screen.findByRole("dialog");
    api.getEmailSetupAction.mockResolvedValueOnce({ data: { ...SETUP, domains: [OWN_DOMAIN, created], setup: { state: "in_progress" } } });
    api.getEmailSetupAction.mockResolvedValue({ data: { ...SETUP, domains: [OWN_DOMAIN, { ...OWN_DOMAIN, id: "d-new", domain: "loja.com.br" }] } });
    fireEvent.change(within(dialog).getByLabelText(copy.connect.domainLabel), { target: { value: "loja.com.br" } });
    fireEvent.click(within(dialog).getByRole("button", { name: copy.connect.submit }));

    expect(await within(dialog).findByText(copy.setup.inProgressTitle)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: copy.connect.checkNow })).toBeDisabled();
    expect(await within(dialog).findByRole("table", { name: "Registros DNS de loja.com.br" }, { timeout: 5000 })).toBeInTheDocument();
    expect(within(dialog).getByText(copy.connect.afterConnect)).toBeInTheDocument();
  });

  it("lists the own domain records with the backend hosts and statuses and copies a value in one click", async () => {
    renderPage();
    const table = await screen.findByRole("table", { name: "Registros DNS de acme.com.br" });
    expect(within(table).getByText("k1._domainkey")).toBeInTheDocument();
    expect(within(table).getByText("k1._domainkey.acme.com.br")).toBeInTheDocument();
    expect(within(table).getByText("reply")).toBeInTheDocument();
    expect(within(table).getByText(copy.records.purposes.reply_mx.caption)).toBeInTheDocument();
    expect(within(table).getByText("10")).toBeInTheDocument();
    expect(within(table).getByText(copy.records.statuses.verified)).toBeInTheDocument();
    expect(within(table).getByText(copy.records.statuses.pending)).toBeInTheDocument();
    expect(screen.getByText("1 de 2 registros confirmados")).toBeInTheDocument();

    fireEvent.click(within(table).getByRole("button", { name: "Copiar o valor do registro Respostas (MX)" }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("inbound-smtp.example.com"));
  });

  it("rechecks the domain and reports the new status", async () => {
    api.recheckEmailDomainAction.mockResolvedValue({ data: { ...OWN_DOMAIN, status: "verified", sendable: true } });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: copy.domains.recheck }));
    await waitFor(() => expect(api.recheckEmailDomainAction).toHaveBeenCalledWith("d-own"));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("acme.com.br: Verificado"));
    expect(screen.queryByRole("button", { name: /automaticamente/i })).toBeNull();
  });

  it("connects an own domain by hand: shows the returned records and rechecks them", async () => {
    const created = { ...OWN_DOMAIN, id: "d-new", domain: "loja.com.br" };
    api.connectEmailDomainAction.mockResolvedValue({ data: created });
    api.recheckEmailDomainAction.mockResolvedValue({ data: { ...created, status: "verifying" } });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: copy.sendersPage.connectDomain }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(copy.connect.mailbox.title)).toBeInTheDocument();
    expect(within(dialog).queryByRole("radio")).toBeNull();
    fireEvent.change(within(dialog).getByLabelText(copy.connect.domainLabel), { target: { value: " loja.com.br " } });
    fireEvent.click(within(dialog).getByRole("button", { name: copy.connect.submit }));

    await waitFor(() => expect(api.connectEmailDomainAction).toHaveBeenCalledWith("loja.com.br"));
    const table = await within(dialog).findByRole("table", { name: "Registros DNS de loja.com.br" });
    expect(within(table).getByText("k1._domainkey")).toBeInTheDocument();
    expect(within(table).getByText(copy.records.statuses.pending)).toBeInTheDocument();
    expect(within(dialog).getByText(copy.connect.afterConnect)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: copy.connect.checkNow }));
    await waitFor(() => expect(api.recheckEmailDomainAction).toHaveBeenCalledWith("d-new"));
    expect(await within(dialog).findByText(copy.domainStatus.verifying)).toBeInTheDocument();
  });

  it("never offers to unblock a complaint and says it stays blocked", async () => {
    renderPage();
    expect(await screen.findByText("spam@cliente.com")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Desbloquear spam@cliente.com" })).not.toBeInTheDocument();
    expect(screen.getByText(copy.suppressions.locked)).toBeInTheDocument();
  });

  it("shows the backend refusal when an unblock is refused", async () => {
    api.listEmailSuppressionsAction.mockResolvedValue({
      data: {
        data: [{ address: "spam@cliente.com", reason: "soft_bounce", source_message_id: "m-1", suppressed_at: "2026-10-20T10:00:00Z", removable: true }],
        meta: { page: 1, pageSize: 20, totalPages: 1, totalItems: 1 },
      },
    });
    api.removeEmailSuppressionAction.mockResolvedValue({ error: "raw", code: "email_suppression_locked", status: 409 });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Desbloquear spam@cliente.com" }));
    fireEvent.click(await screen.findByRole("button", { name: copy.suppressions.removeConfirm }));
    await waitFor(() => expect(api.removeEmailSuppressionAction).toHaveBeenCalledWith("spam@cliente.com"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(copy.errors.email_suppression_locked));
  });

  it("searches the block list on the backend with the typed address", async () => {
    renderPage();
    expect(await screen.findByText("spam@cliente.com")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(copy.suppressions.search), { target: { value: "Spam@" } });
    await waitFor(() => expect(api.listEmailSuppressionsAction).toHaveBeenCalledWith(1, 20, "Spam@", expect.anything()));
  });

  it("warns that replies are paused with a top up link and marks the paused domain", async () => {
    api.getEmailSetupAction.mockResolvedValue({
      data: { ...SETUP, replies_paused: true, domains: [{ ...OWN_DOMAIN, replies_paused: true, replies_paused_at: "2026-10-21T10:00:00Z" }] },
    });
    renderPage();
    const notice = (await screen.findByText(copy.replies.pausedTitle)).closest(".notice") as HTMLElement;
    expect(within(notice).getByText(copy.replies.pausedText)).toBeInTheDocument();
    expect(within(notice).getByRole("link", { name: copy.replies.topUp })).toHaveAttribute("href", "/dashboard/invoices");
    expect(screen.getByText(copy.replies.pausedChip)).toBeInTheDocument();
  });

  it("shows no paused replies notice while the backend says replies flow", async () => {
    api.getEmailSetupAction.mockResolvedValue({ data: { ...SETUP, replies_paused: false, domains: [{ ...OWN_DOMAIN, replies_paused: false, replies_paused_at: null }] } });
    renderPage();
    expect(await screen.findByText(copy.sendersPage.domainsTitle)).toBeInTheDocument();
    expect(screen.queryByText(copy.replies.pausedTitle)).toBeNull();
    expect(screen.queryByText(copy.replies.pausedChip)).toBeNull();
  });

  it("activates email right on the page with the shared activation card, then shows the senders and domains", async () => {
    api.getEmailSetupAction.mockResolvedValueOnce({ data: NOT_PROVISIONED });
    api.getEmailSetupAction.mockResolvedValue({ data: { ...SETUP, domains: [SHARED_DOMAIN] } });
    api.getEmailPricingAction.mockResolvedValue({ data: PRICING });
    api.checkEmailSubdomainAction.mockImplementation(async (slug: string) => ({ data: { slug, available: true, address: `contato@${slug}.envios.example` } }));
    api.provisionEmailAction.mockResolvedValue({ data: { ...SETUP, domains: [SHARED_DOMAIN] } });
    renderPage();

    expect(await screen.findByRole("heading", { name: copy.onboarding.title })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: copy.sendersPage.title })).toBeInTheDocument();
    expect(screen.queryByText(copy.sendersPage.domainsTitle)).toBeNull();
    const activate = () => screen.getByRole("button", { name: copy.onboarding.activate });
    await waitFor(() => expect(activate()).toBeEnabled(), { timeout: 3000 });
    fireEvent.click(activate());

    await waitFor(() => expect(api.provisionEmailAction).toHaveBeenCalledWith("acme"));
    expect(await screen.findByText(copy.sendersPage.domainsTitle)).toBeInTheDocument();
    expect(screen.getByText("acme.mail.example")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: copy.onboarding.title })).toBeNull();
  });

  it("keeps a domain being released on the list as removing, with no actions", async () => {
    api.getEmailSetupAction.mockResolvedValue({ data: { ...SETUP, domains: [SHARED_DOMAIN, RELEASING_DOMAIN] } });
    renderPage();
    const name = await screen.findByText("antiga.mail.example");
    const row = name.closest("li") as HTMLElement;
    expect(within(row).getByText(copy.domains.releasingChip)).toBeInTheDocument();
    expect(within(row).getByText(copy.domains.releasingText)).toBeInTheDocument();
    expect(within(row).queryByRole("button")).toBeNull();
    expect(screen.getAllByRole("button", { name: copy.domains.recheck })).toHaveLength(1);
    expect(screen.queryByText(copy.domains.none)).toBeNull();
  });

  it("offers only the actions the backend allows on each domain", async () => {
    api.getEmailSetupAction.mockResolvedValue({ data: { ...SETUP, domains: [SHARED_DOMAIN, OWN_DOMAIN] } });
    renderPage();
    expect(await screen.findAllByRole("button", { name: copy.domains.recheck })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /^Remover / })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Remover acme.com.br" })).toBeInTheDocument();
  });

  it("warns about a sender whose domain is being removed and leaves only its removal", async () => {
    api.getEmailSetupAction.mockResolvedValue({
      data: {
        ...SETUP,
        domains: [SHARED_DOMAIN, RELEASING_DOMAIN],
        senders: [sender("s-ok", "d-shared", "contato@acme.mail.example", "active", true), sender("s-old", "d-old", "vendas@antiga.mail.example", "releasing")],
      },
    });
    renderPage();
    const notice = (await screen.findByText(copy.senders.domainReleasingTitle)).closest(".notice") as HTMLElement;
    expect(within(notice).getByText(copy.senders.domainReleasingText)).toBeInTheDocument();
    const row = screen.getByText("vendas@antiga.mail.example").closest("tr") as HTMLElement;
    expect(within(row).getByText(copy.senders.domainReleasingChip)).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "Editar vendas@antiga.mail.example" })).toBeNull();
    expect(within(row).queryByRole("button", { name: copy.senders.makeDefault })).toBeNull();
    expect(within(row).getByRole("button", { name: "Excluir vendas@antiga.mail.example" })).toBeInTheDocument();
    const healthy = screen.getByText("contato@acme.mail.example").closest("tr") as HTMLElement;
    expect(within(healthy).queryByText(copy.senders.domainReleasingChip)).toBeNull();
    expect(screen.queryByText(copy.senders.domainRetiredTitle)).toBeNull();
  });
});
