import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  createInvoiceAction: vi.fn(),
  getInvoiceAction: vi.fn(),
  listInvoicesAction: vi.fn(),
  renewInvoicePixAction: vi.fn(),
}));

vi.mock("@/app/actions/invoices", () => api);
vi.mock("@/app/actions/workspace-plan", () => ({ listPublicPlansAction: vi.fn() }));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "ws-1", planName: "Pro", subscriptionStatus: "active" } }),
}));
vi.mock("@/components/dashboard/plans/PlanCatalogRail", () => ({ PlanCatalogRail: () => null }));
vi.mock("framer-motion", () => import("@/test/framer-motion-stub"));
vi.mock("@/components/dashboard/DashboardPageHeader", () => ({
  DashboardPageHeader: ({ badge, actions }: { badge: string; actions?: ReactNode }) => (
    <header>
      <h1>{badge}</h1>
      {actions}
    </header>
  ),
}));

import ptMessages from "@/i18n/messages/pt.json";
import type { Invoice } from "@/lib/invoices/types";

import InvoicesPage from "./page";

const copy = ptMessages.invoicesPage;

function invoice(id: string, overrides: Partial<Invoice>): Invoice {
  return {
    id,
    workspaceId: "ws-1",
    userId: "u-1",
    purpose: "MONTHLY_BILLING",
    amountBRL: 210,
    amountUSD: 35_000_000,
    exchangeRate: 6,
    status: "PENDING",
    billingType: "PIX",
    externalId: "pay_" + id,
    dueDate: "2026-10-23T03:00:00Z",
    lineItems: [],
    pixQrCode: null,
    pixCopy: null,
    payment: { state: "CLOSED", canRenew: false },
    bankSlipUrl: null,
    invoiceUrl: null,
    paidAt: null,
    description: "Fatura " + id,
    createdAt: "2026-10-18T12:00:00Z",
    updatedAt: "2026-10-18T12:00:00Z",
    ...overrides,
  };
}

const pending = invoice("pending", {
  pixQrCode: "cXI=",
  pixCopy: "000201pending",
  payment: { state: "OPEN", canRenew: false, expiresAt: "2026-10-28T02:59:59Z" },
});
const overdue = invoice("overdue", {
  status: "OVERDUE",
  payment: { state: "RENEWABLE", canRenew: true, payableUntil: "2026-10-28T02:59:59Z" },
});
const paid = invoice("paid", { status: "PAID", paidAt: 1_793_000_000 });

function rowOf(description: string): HTMLElement {
  const row = screen.getByText(description).closest("tr");
  if (!row) throw new Error(`no row for ${description}`);
  return row;
}

function renderPage() {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
      <InvoicesPage />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.listInvoicesAction.mockResolvedValue({
    data: { invoices: [pending, overdue, paid], total: 3, page: 1, pageSize: 15 },
    error: null,
  });
  api.getInvoiceAction.mockResolvedValue({ data: null, error: null });
});

describe("InvoicesPage pay action", () => {
  it("puts a pay action on payable rows only", async () => {
    renderPage();
    await screen.findByText("Fatura pending");

    expect(within(rowOf("Fatura pending")).getByRole("button", { name: copy.payment.payInvoice })).toBeInTheDocument();
    expect(within(rowOf("Fatura overdue")).getByRole("button", { name: copy.payment.payInvoice })).toBeInTheDocument();
    expect(within(rowOf("Fatura paid")).queryByRole("button", { name: copy.payment.payInvoice })).not.toBeInTheDocument();
  });

  it("opens the payment view of the row", async () => {
    renderPage();
    await screen.findByText("Fatura overdue");

    fireEvent.click(within(rowOf("Fatura overdue")).getByRole("button", { name: copy.payment.payInvoice }));

    expect(await screen.findByText(copy.payment.expiredTitle)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.payment.renew })).toBeInTheDocument();
  });

  it("refetches the list when the window regains focus so a paid invoice shows as paid", async () => {
    renderPage();
    await screen.findByText("Fatura pending");
    api.listInvoicesAction.mockResolvedValue({
      data: { invoices: [{ ...pending, status: "PAID", pixCopy: null, pixQrCode: null, payment: { state: "CLOSED", canRenew: false } }, overdue, paid], total: 3, page: 1, pageSize: 15 },
      error: null,
    });

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(within(rowOf("Fatura pending")).queryByRole("button", { name: copy.payment.payInvoice })).not.toBeInTheDocument();
    expect(within(rowOf("Fatura pending")).getByText(copy.status.paid)).toBeInTheDocument();
  });
});
