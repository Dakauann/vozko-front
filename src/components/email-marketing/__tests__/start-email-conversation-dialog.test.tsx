import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";
import type { EmailSetup } from "@/lib/email-marketing/types";

const outreach = vi.hoisted(() => ({ startEmailConversationAction: vi.fn(), quoteEmailOutreachAction: vi.fn() }));
const marketing = vi.hoisted(() => ({ getEmailSetupAction: vi.fn() }));
const campaigns = vi.hoisted(() => ({ fetchEmailDesigns: vi.fn() }));

vi.mock("@/app/actions/email-outreach", () => outreach);
vi.mock("@/app/actions/email-marketing", () => ({
  getEmailSetupAction: marketing.getEmailSetupAction,
  getEmailOverviewAction: vi.fn(),
  getEmailPricingAction: vi.fn(),
  listEmailSuppressionsAction: vi.fn(),
}));
vi.mock("@/app/actions/email-campaigns", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/actions/email-campaigns")>()),
  fetchEmailDesigns: campaigns.fetchEmailDesigns,
}));
vi.mock("@/app/actions/custom-fields", () => ({ listCustomFieldsAction: () => Promise.resolve({ fields: [], error: null }) }));
vi.mock("@/components/elevated-design/elevated-command-select", () => ({
  ElevatedCommandSelect: ({
    label,
    value,
    options,
    onValueChange,
  }: {
    label: string;
    value: string;
    options: { value: string; label: string }[];
    onValueChange: (value: string) => void;
  }) => (
    <select aria-label={label} value={value} onChange={(event) => onValueChange(event.target.value)}>
      <option value="" />
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ can: () => true, currentWorkspace: { id: "ws-1" } }),
}));

import { StartEmailConversationDialog, type EmailOutreachTarget } from "../start-email-conversation-dialog";

const t = ptMessages.emailMarketing;

function domain(id: string, sendable: boolean) {
  return {
    id,
    domain: `${id}.com.br`,
    kind: "own" as const,
    status: "verified" as const,
    connect_method: "manual" as const,
    mail_from_domain: "",
    reply_domain: "",
    records: [],
    failure_reason: "",
    verified_at: null,
    last_checked_at: null,
    retired: false,
    sendable,
    lifecycle: "active" as const,
    actions: { recheck: true, remove: true },
    replies_paused: false,
    replies_paused_at: null,
    setup: { state: "done" as const },
  };
}

function sender(id: string, domainId: string, isDefault: boolean) {
  return { id, domain_id: domainId, address: `${id}@${domainId}.com.br`, local_part: id, display_name: id, reply_forward_to: "", is_default: isDefault, domain_lifecycle: "active" as const };
}

const SETUP: EmailSetup = {
  provisioned: true,
  account: null,
  probation: null,
  replies_paused: false,
  setup: { state: "done" },
  subdomain: { slug: "loja", address: "contato@loja.envios.example", locked: false },
  activation: { allowed: true },
  domains: [domain("loja", true), domain("velha", false)],
  senders: [sender("vendas", "loja", false), sender("contato", "loja", true), sender("antigo", "velha", false)],
};

const QUOTE = { unit_micros: 700, unit_brl: 0.0035, exchange_rate: 5, exchange_rate_updated_at: "2026-10-21T10:00:00Z" };

const STARTED = { conversation_id: "conv-9", entry_type: "email", message_id: "m-1", lead_id: "lead-1", repeated: false, recorded: true };

function renderDialog(target: EmailOutreachTarget, onStarted = vi.fn(), onOpenChange = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <StartEmailConversationDialog open onOpenChange={onOpenChange} target={target} onStarted={onStarted} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return { onStarted, onOpenChange };
}

const LEAD: EmailOutreachTarget = { kind: "lead", leadId: "lead-1", name: "Ana Souza", email: "ana@cliente.com" };

function submitButton() {
  return screen.getByRole("button", { name: t.outreach.submit });
}

function fillSubject(value: string) {
  fireEvent.change(screen.getByLabelText(t.outreach.subjectLabel), { target: { value } });
}

function fillText(value: string) {
  fireEvent.change(screen.getByLabelText(t.outreach.textLabel), { target: { value } });
}

beforeEach(() => {
  vi.clearAllMocks();
  marketing.getEmailSetupAction.mockResolvedValue({ data: SETUP });
  outreach.quoteEmailOutreachAction.mockResolvedValue({ quote: QUOTE, error: null });
  outreach.startEmailConversationAction.mockResolvedValue({ conversation: STARTED, error: null });
  campaigns.fetchEmailDesigns.mockResolvedValue({ items: [{ id: "d-1", name: "Boas-vindas", kind: "template", document: {}, created_at: "", updated_at: "" }], total: 1, page: 1, page_size: 100 });
});

describe("StartEmailConversationDialog", () => {
  it("names the lead it writes to and keeps Enviar off until subject and text are filled", async () => {
    renderDialog(LEAD);
    expect(await screen.findByText("ana@cliente.com")).toBeInTheDocument();
    expect(screen.getByText("Ana Souza")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: t.outreach.submit })).toBeDisabled();
    fillSubject("Seu pedido");
    expect(submitButton()).toBeDisabled();
    fillText("Olá {{first_name}}");
    await waitFor(() => expect(submitButton()).toBeEnabled());
  });

  it("shows the price of one email from the quote", async () => {
    renderDialog(LEAD);
    expect(await screen.findByText(/R\$\s?0,0035/)).toBeInTheDocument();
  });

  it("shows the coded pricing refusal and no price", async () => {
    outreach.quoteEmailOutreachAction.mockResolvedValue({ quote: null, error: { code: "email_exchange_rate_unavailable", message: "no rate", status: 503 } });
    renderDialog(LEAD);
    expect(await screen.findByText(t.errors.email_exchange_rate_unavailable)).toBeInTheDocument();
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();
  });

  it("sends a text email to the lead from the default sender and opens the new conversation", async () => {
    const { onStarted, onOpenChange } = renderDialog(LEAD);
    await screen.findByText("ana@cliente.com");
    fillSubject("Seu pedido");
    fillText("Olá {{first_name}}");
    await waitFor(() => expect(submitButton()).toBeEnabled());
    fireEvent.click(submitButton());

    await waitFor(() => expect(onStarted).toHaveBeenCalledWith("conv-9", "email"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    const payload = outreach.startEmailConversationAction.mock.calls[0][0];
    expect(payload).toMatchObject({ lead_id: "lead-1", sender_id: "contato", subject: "Seu pedido", text: "Olá {{first_name}}" });
    expect(payload).not.toHaveProperty("design_id");
    expect(payload).not.toHaveProperty("address");
    expect(typeof payload.idempotency_key).toBe("string");
    expect(payload.idempotency_key).not.toBe("");
  });

  it("keeps the same idempotency key when the send is retried", async () => {
    outreach.startEmailConversationAction.mockResolvedValueOnce({ conversation: null, error: { code: "email_send_failed", message: "x" } });
    renderDialog(LEAD);
    await screen.findByText("ana@cliente.com");
    fillSubject("Oi");
    fillText("Olá");
    await waitFor(() => expect(submitButton()).toBeEnabled());
    fireEvent.click(submitButton());
    expect(await screen.findByText(t.errors.email_send_failed)).toBeInTheDocument();
    fireEvent.click(submitButton());
    await waitFor(() => expect(outreach.startEmailConversationAction).toHaveBeenCalledTimes(2));
    const [first, second] = outreach.startEmailConversationAction.mock.calls.map((call) => call[0].idempotency_key);
    expect(second).toBe(first);
  });

  it("sends a saved template to a typed address", async () => {
    const { onStarted } = renderDialog({ kind: "address" });
    fireEvent.change(await screen.findByLabelText(t.outreach.addressLabel), { target: { value: " novo@cliente.com " } });
    fillSubject("Novidades");
    fireEvent.click(screen.getByRole("button", { name: t.outreach.modes.design }));
    expect(screen.queryByLabelText(t.outreach.textLabel)).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: t.outreach.submit })).toBeDisabled();

    const designs = await screen.findByLabelText(t.outreach.designLabel);
    await waitFor(() => expect(within(designs).getByRole("option", { name: "Boas-vindas" })).toBeInTheDocument());
    fireEvent.change(designs, { target: { value: "d-1" } });
    await waitFor(() => expect(submitButton()).toBeEnabled());
    fireEvent.click(submitButton());

    await waitFor(() => expect(onStarted).toHaveBeenCalledWith("conv-9", "email"));
    const payload = outreach.startEmailConversationAction.mock.calls[0][0];
    expect(payload).toMatchObject({ address: "novo@cliente.com", subject: "Novidades", design_id: "d-1" });
    expect(payload).not.toHaveProperty("text");
    expect(payload).not.toHaveProperty("lead_id");
  });

  it("explains a short balance with the coded message and the missing amount", async () => {
    outreach.startEmailConversationAction.mockResolvedValue({
      conversation: null,
      error: { code: "email_balance_insufficient", message: "short", status: 402, details: { missing_micros: 2_000_000 } },
    });
    const { onStarted } = renderDialog(LEAD);
    await screen.findByText(/R\$\s?0,0035/);
    fillSubject("Oi");
    fillText("Olá");
    await waitFor(() => expect(submitButton()).toBeEnabled());
    fireEvent.click(submitButton());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(t.errors.email_balance_insufficient);
    expect(alert).toHaveTextContent(/R\$\s?10,00/);
    expect(onStarted).not.toHaveBeenCalled();
  });

  it("says the email went out without opening a conversation when the transcript was not recorded", async () => {
    outreach.startEmailConversationAction.mockResolvedValue({ conversation: { ...STARTED, conversation_id: "", recorded: false }, error: null });
    const { onStarted, onOpenChange } = renderDialog(LEAD);
    await screen.findByText("ana@cliente.com");
    fillSubject("Oi");
    fillText("Olá");
    await waitFor(() => expect(submitButton()).toBeEnabled());
    fireEvent.click(submitButton());

    expect(await screen.findByText(t.outreach.sentNotRecorded)).toBeInTheDocument();
    expect(onStarted).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: t.outreach.submit })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.outreach.close })).toBeInTheDocument();
  });

  it("offers only the senders whose domain can send", async () => {
    renderDialog(LEAD);
    const senders = await screen.findByLabelText(t.outreach.fromLabel);
    await waitFor(() => expect((senders as HTMLSelectElement).value).toBe("contato"));
    expect(within(senders).getAllByRole("option").map((option) => option.textContent).filter(Boolean)).toEqual(["vendas", "contato"]);
  });
});
