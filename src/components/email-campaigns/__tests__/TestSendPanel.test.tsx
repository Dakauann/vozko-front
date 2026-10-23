import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "ws1" }, can: () => true }),
}));

const actions = vi.hoisted(() => ({
  testSendEmailCampaignAction: vi.fn(),
}));
vi.mock("@/app/actions/email-campaigns", () => ({
  ...actions,
  isEmailActionError: (result: object) => "error" in result,
}));

const pricing = vi.hoisted(() => ({ getEmailPricingAction: vi.fn() }));
vi.mock("@/app/actions/email-marketing", () => pricing);

import { TestSendPanel } from "../wizard/TestSendPanel";

const PRICES = {
  data: {
    exchangeRate: 5.5,
    exchangeRateUpdatedAt: "2026-10-21T09:00:00Z",
    send: { service: "send", metric: "per_message", unitMicros: 700, unitBRL: 0.0035, thousandBRL: 3.5 },
  },
};

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
        <TestSendPanel campaignId="c1" prepare={async () => true} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

function open() {
  fireEvent.click(screen.getByRole("button", { name: "Enviar teste" }));
}

function type(value: string) {
  fireEvent.change(screen.getByLabelText("Endereços"), { target: { value } });
}

function submit() {
  fireEvent.click(screen.getAllByRole("button", { name: "Enviar teste" }).at(-1)!);
}

beforeEach(() => {
  actions.testSendEmailCampaignAction.mockReset();
  pricing.getEmailPricingAction.mockReset();
  pricing.getEmailPricingAction.mockResolvedValue(PRICES);
});

describe("TestSendPanel", () => {
  it("shows what each test email costs from the backend price and no daily counter", async () => {
    renderPanel();
    open();

    expect(await screen.findByText(/Cada e-mail de teste custa R\$\s?0,0035, cobrado do saldo/)).toBeInTheDocument();
    expect(screen.queryByText(/restantes/)).not.toBeInTheDocument();
  });

  it("shows one result chip per recipient", async () => {
    actions.testSendEmailCampaignAction.mockResolvedValue({
      data: {
        results: [
          { address: "eu@loja.com", outcome: "sent", message_id: "m1" },
          { address: "fora@loja.com", outcome: "suppressed" },
        ],
      },
    });
    renderPanel();
    open();
    type("eu@loja.com, fora@loja.com");
    submit();

    await waitFor(() => expect(actions.testSendEmailCampaignAction).toHaveBeenCalledWith("c1", ["eu@loja.com", "fora@loja.com"]));
    const list = await screen.findByRole("list", { name: ptMessages.emailCampaigns.test.results });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText(ptMessages.emailCampaigns.test.outcome.sent)).toBeInTheDocument();
    expect(within(items[1]).getByText(ptMessages.emailCampaigns.test.outcome.suppressed)).toBeInTheDocument();
  });

  it("explains a short wallet with the translated balance message", async () => {
    actions.testSendEmailCampaignAction.mockResolvedValue({ error: "short", code: "email_balance_insufficient", status: 402, details: { missing_micros: 700 } });
    renderPanel();
    open();
    type("eu@loja.com");
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(ptMessages.emailCampaigns.errors.email_balance_insufficient);
  });
});
