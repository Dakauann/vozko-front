import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getInvoiceAction: vi.fn(),
  renewInvoicePixAction: vi.fn(),
}));

vi.mock("@/app/actions/invoices", () => api);
vi.mock("framer-motion", () => import("@/test/framer-motion-stub"));

import deMessages from "@/i18n/messages/de.json";
import enMessages from "@/i18n/messages/en.json";
import esMessages from "@/i18n/messages/es.json";
import ptMessages from "@/i18n/messages/pt.json";
import type { Invoice } from "@/lib/invoices/types";

import { InvoiceDetailDialog } from "./InvoiceDetailDialog";
import { INVOICE_PAYMENT_POLL_MS } from "./use-invoice-payment";

const copy = ptMessages.invoicesPage;

const DASHES = new RegExp("[\u2013\u2014]");

const RENEW_PIX_CODES = [
  "invoice_not_found",
  "invoice_already_paid",
  "invoice_not_payable",
  "invoice_pix_renew_in_progress",
  "customer_document_required",
  "invoice_pix_unavailable",
];

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-1",
    workspaceId: "ws-1",
    userId: "u-1",
    purpose: "MONTHLY_BILLING",
    amountBRL: 210,
    amountUSD: 35_000_000,
    exchangeRate: 6,
    status: "PENDING",
    billingType: "PIX",
    externalId: "pay_1",
    dueDate: "2026-10-23T03:00:00Z",
    lineItems: [],
    pixQrCode: "cXItaW1hZ2U=",
    pixCopy: "000201pixcode",
    payment: {
      state: "OPEN",
      canRenew: false,
      expiresAt: "2026-10-28T02:59:59Z",
      payableUntil: "2026-10-28T02:59:59Z",
    },
    bankSlipUrl: null,
    invoiceUrl: null,
    paidAt: null,
    description: "Fatura mensal",
    createdAt: "2026-10-18T12:00:00Z",
    updatedAt: "2026-10-18T12:00:00Z",
    ...overrides,
  };
}

const renewable = (): Invoice =>
  invoice({
    status: "OVERDUE",
    pixQrCode: null,
    pixCopy: null,
    payment: { state: "RENEWABLE", canRenew: true, payableUntil: "2026-10-28T02:59:59Z" },
  });

function Harness({ initial, onChange }: { initial: Invoice; onChange?: (inv: Invoice) => void }) {
  const [current, setCurrent] = useState<Invoice>(initial);
  return (
    <InvoiceDetailDialog
      invoice={current}
      open
      onClose={() => {}}
      onInvoiceChange={(next) => {
        onChange?.(next);
        setCurrent(next);
      }}
    />
  );
}

function renderDialog(initial: Invoice, onChange?: (inv: Invoice) => void) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
      <Harness initial={initial} onChange={onChange} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  api.getInvoiceAction.mockReset();
  api.renewInvoicePixAction.mockReset();
  api.getInvoiceAction.mockResolvedValue({ data: null, error: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("InvoiceDetailDialog payment", () => {
  it("shows the QR code, the copy and paste code and the expiry of a payable invoice", () => {
    renderDialog(invoice());

    const qr = screen.getByRole("img", { name: copy.payment.qrAlt });
    expect(qr).toHaveAttribute("src", "data:image/png;base64,cXItaW1hZ2U=");
    expect(screen.getByText("000201pixcode")).toBeInTheDocument();
    expect(screen.getByText(copy.payment.expiresAt)).toBeInTheDocument();
    expect(screen.getByText(copy.payment.payableUntil)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.payment.renew })).not.toBeInTheDocument();
  });

  it("copies the PIX code and confirms it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderDialog(invoice());

    fireEvent.click(screen.getByRole("button", { name: copy.payment.copy }));

    await waitFor(() => expect(screen.getByRole("button", { name: copy.payment.copied })).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledWith("000201pixcode");
  });

  it("shows a muted placeholder when the expiry is unknown", () => {
    renderDialog(invoice({ payment: { state: "OPEN", canRenew: false } }));

    expect(screen.getByText("n/d")).toBeInTheDocument();
  });

  it("offers a new PIX when the backend says the charge can be renewed", async () => {
    const renewed = invoice({ status: "OVERDUE", pixCopy: "000201renewed" });
    api.renewInvoicePixAction.mockResolvedValue({ data: renewed, error: null });
    const onChange = vi.fn();
    renderDialog(renewable(), onChange);

    expect(screen.getByText(copy.payment.expiredTitle)).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: copy.payment.qrAlt })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: copy.payment.renew }));

    await waitFor(() => expect(screen.getByText("000201renewed")).toBeInTheDocument());
    expect(api.renewInvoicePixAction).toHaveBeenCalledWith("inv-1");
    expect(onChange).toHaveBeenCalledWith(renewed);
  });

  it("explains a refused renewal with the translated code", async () => {
    api.renewInvoicePixAction.mockResolvedValue({
      data: null,
      error: { code: "invoice_pix_unavailable", message: "Não foi possível", status: 502 },
    });
    renderDialog(renewable());

    fireEvent.click(screen.getByRole("button", { name: copy.payment.renew }));

    expect(await screen.findByText(copy.errors.invoice_pix_unavailable)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.payment.renew })).toBeEnabled();
  });

  it("reloads the invoice when a refusal means its state changed", async () => {
    api.renewInvoicePixAction.mockResolvedValue({
      data: null,
      error: { code: "invoice_already_paid", message: "pago", status: 409 },
    });
    api.getInvoiceAction.mockResolvedValue({ data: invoice({ status: "PAID", payment: { state: "CLOSED", canRenew: false } }), error: null });
    renderDialog(renewable());

    fireEvent.click(screen.getByRole("button", { name: copy.payment.renew }));

    expect(await screen.findByText(copy.payment.paidTitle)).toBeInTheDocument();
    expect(api.getInvoiceAction).toHaveBeenCalledWith("inv-1");
  });

  it("never shows a payable code for a settled invoice", () => {
    renderDialog(invoice({ status: "PAID", pixQrCode: null, pixCopy: null, payment: { state: "CLOSED", canRenew: false }, paidAt: 1_793_000_000 }));

    expect(screen.getByText(copy.payment.paidTitle)).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: copy.payment.qrAlt })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.payment.copy })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.payment.renew })).not.toBeInTheDocument();
  });

  it("polls a payable invoice until it flips to paid", async () => {
    vi.useFakeTimers();
    api.getInvoiceAction.mockResolvedValue({ data: invoice({ status: "PAID", pixQrCode: null, pixCopy: null, payment: { state: "CLOSED", canRenew: false } }), error: null });
    renderDialog(invoice());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(INVOICE_PAYMENT_POLL_MS);
    });

    expect(api.getInvoiceAction).toHaveBeenCalledWith("inv-1");
    expect(screen.getByText(copy.payment.paidTitle)).toBeInTheDocument();

    api.getInvoiceAction.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INVOICE_PAYMENT_POLL_MS * 2);
    });
    expect(api.getInvoiceAction).not.toHaveBeenCalled();
  });

  it("refreshes a payable invoice when the window regains focus", async () => {
    renderDialog(invoice());

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(api.getInvoiceAction).toHaveBeenCalledWith("inv-1");
  });
});

describe("invoice payment copy", () => {
  it.each([
    ["pt", ptMessages],
    ["en", enMessages],
    ["es", esMessages],
    ["de", deMessages],
  ])("translates every renewal code and the payment view in %s", (_locale, messages) => {
    const page = messages.invoicesPage as unknown as { errors: Record<string, string>; payment: Record<string, string>; status: Record<string, string> };
    for (const code of [...RENEW_PIX_CODES, "default"]) {
      expect(page.errors[code], code).toBeTruthy();
    }
    for (const key of Object.keys(ptMessages.invoicesPage.payment)) {
      expect(page.payment[key], key).toBeTruthy();
    }
    expect(page.status.reversed).toBeTruthy();
    for (const text of [...Object.values(page.errors), ...Object.values(page.payment)]) {
      expect(text).not.toMatch(DASHES);
    }
  });
});
