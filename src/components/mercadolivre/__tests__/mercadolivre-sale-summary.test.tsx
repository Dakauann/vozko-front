import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import { PACK_PENDING_RETRY_MS } from "@/lib/mercadolivre/pack";
import type { MercadoLivrePackSummary } from "@/lib/mercadolivre/types";

const actions = vi.hoisted(() => ({ getPack: vi.fn() }));

vi.mock("@/app/actions/mercadolivre", () => ({ getMercadoLivrePackSummaryAction: actions.getPack }));

import { MercadoLivreSaleSummary } from "@/components/mercadolivre/mercadolivre-sale-summary";

const copy = ptMessages.mercadolivre.pack;

const pack: MercadoLivrePackSummary = {
  items: [
    {
      itemId: "MLB1",
      title: "Caneca térmica",
      quantity: 2,
      unitPrice: 39.9,
      thumbnailUrl: "https://files.vozko.test/caneca.jpg",
      permalink: "https://produto.mercadolivre.com.br/MLB1",
    },
    { itemId: "MLB2", title: "Tampa extra", quantity: 1, unitPrice: 9.5 },
  ],
  orderStatus: "paid",
  shippingStatus: "shipped",
  shippingSubstatus: "out_for_delivery",
  total: 89.3,
  currency: "BRL",
  refreshedAt: "2026-10-19T10:00:00Z",
};

function normalized(text: string | null | undefined): string {
  return (text ?? "").replace(/\s/g, " ");
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function renderSummary(entryId = "entry-1") {
  const view = render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
      <MercadoLivreSaleSummary entryId={entryId} />
    </NextIntlClientProvider>,
  );
  await flush();
  return view;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-19T10:05:00Z"));
  actions.getPack.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Mercado Livre sale summary", () => {
  it("shows the first item, its quantity and price, the total and both statuses", async () => {
    actions.getPack.mockResolvedValue({ pack });
    const { container } = await renderSummary();

    expect(actions.getPack).toHaveBeenCalledWith("entry-1");
    const link = screen.getByRole("link", { name: "Caneca térmica" });
    expect(link).toHaveAttribute("href", "https://produto.mercadolivre.com.br/MLB1");
    expect(container.querySelector('img[src="https://files.vozko.test/caneca.jpg"]')).not.toBeNull();
    expect(normalized(container.textContent)).toContain("2 × R$ 39,90");
    expect(normalized(container.textContent)).toContain("Total R$ 89,30");
    expect(screen.getByText(copy.orderStatus.paid)).toBeInTheDocument();
    expect(screen.getByText(copy.shippingStatus.shipped)).toBeInTheDocument();
    expect(screen.getByText(copy.shippingSubstatus.out_for_delivery)).toBeInTheDocument();
    expect(screen.getByText(/Atualizado há 5 minutos/)).toBeInTheDocument();
  });

  it("lists every item on demand", async () => {
    actions.getPack.mockResolvedValue({ pack });
    const { container } = await renderSummary();

    expect(normalized(container.textContent)).toContain("mais 1 item");
    expect(screen.queryByText("Tampa extra")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver os 2 itens" }));
    expect(screen.getByText("Tampa extra")).toBeInTheDocument();
    expect(normalized(container.textContent)).toContain("1 × R$ 9,50");
    fireEvent.click(screen.getByRole("button", { name: copy.hideItems }));
    expect(screen.queryByText("Tampa extra")).not.toBeInTheDocument();
  });

  it("shows statuses it does not know as the raw value, and a missing one as empty", async () => {
    actions.getPack.mockResolvedValue({
      pack: { ...pack, orderStatus: "on_hold", shippingStatus: "", shippingSubstatus: "beamed_up" },
    });
    await renderSummary();

    expect(screen.getByText("on_hold")).toBeInTheDocument();
    expect(screen.getByText("beamed_up")).toBeInTheDocument();
    expect(screen.getByText("n/d")).toBeInTheDocument();
  });

  it("waits quietly for a summary not stored yet and asks again once", async () => {
    actions.getPack.mockResolvedValueOnce({ error: "loading", code: "pack_summary_pending", status: 404 }).mockResolvedValueOnce({ pack });
    await renderSummary();

    expect(screen.getByText(copy.pending)).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PACK_PENDING_RETRY_MS);
    });
    expect(actions.getPack).toHaveBeenCalledTimes(2);
    expect(screen.getByText(copy.orderStatus.paid)).toBeInTheDocument();
  });

  it("stops after the one retry when the summary is still on its way", async () => {
    actions.getPack.mockResolvedValue({ error: "loading", code: "pack_summary_pending", status: 404 });
    await renderSummary();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PACK_PENDING_RETRY_MS * 5);
    });
    expect(actions.getPack).toHaveBeenCalledTimes(2);
    expect(screen.getByText(copy.stillPending)).toBeInTheDocument();
  });

  it("shows nothing to someone who cannot read the conversation", async () => {
    actions.getPack.mockResolvedValue({ error: "no", code: "forbidden", status: 403 });
    const { container } = await renderSummary();
    expect(container).toBeEmptyDOMElement();
  });

  it("says when the summary could not be loaded", async () => {
    actions.getPack.mockResolvedValue({ error: "boom", status: 500 });
    await renderSummary();
    expect(screen.getByText(copy.failed)).toBeInTheDocument();
  });

  it("drops a retry that belongs to a conversation no longer shown", async () => {
    actions.getPack.mockResolvedValue({ error: "loading", code: "pack_summary_pending", status: 404 });
    const view = await renderSummary("entry-1");
    view.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PACK_PENDING_RETRY_MS);
    });
    expect(actions.getPack).toHaveBeenCalledTimes(1);
  });
});
