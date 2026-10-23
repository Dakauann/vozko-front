import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ listSuppressionsAction: vi.fn(), addSuppressionAction: vi.fn(), removeSuppressionAction: vi.fn() }));
const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));

vi.mock("@/app/actions/carrier-messaging", () => api);
vi.mock("@/hooks/use-exchange-rate", () => ({ useExchangeRate: () => 5 }));
vi.mock("sonner", () => ({ toast }));
vi.mock("framer-motion", () => import("@/test/framer-motion-stub"));
vi.mock("@/components/dashboard/DashboardPageHeader", () => ({
  DashboardPageHeader: ({ badge }: { badge: string; actions?: ReactNode }) => <h1>{badge}</h1>,
}));

import rawPt from "@/i18n/messages/pt.json";
import { brandedMessages } from "@/test/branded-messages";

import { CarrierSuppressionsPage, SUPPRESSIONS_PAGE_SIZE } from "./CarrierSuppressionsPage";

const pt = brandedMessages(rawPt);
const copy = pt.carrierMessaging.pages.suppressions;
const item = { phone: "+5511999990000", source: "keyword", created_at: "2026-10-20T12:00:00Z" };

function renderPage() {
  return render(
    <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
      <CarrierSuppressionsPage />
    </NextIntlClientProvider>,
  );
}

describe("CarrierSuppressionsPage", () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
    toast.success.mockReset();
    api.listSuppressionsAction.mockResolvedValue({ data: { items: [item], total: 1 }, error: null });
  });

  it("lists who left marketing with the source in words", async () => {
    renderPage();
    expect(await screen.findByText(item.phone)).toBeInTheDocument();
    expect(screen.getByText(copy.sources.keyword)).toBeInTheDocument();
    expect(api.listSuppressionsAction).toHaveBeenCalledWith(SUPPRESSIONS_PAGE_SIZE, 0, expect.anything());
  });

  it("adds a phone and reloads", async () => {
    api.addSuppressionAction.mockResolvedValue({ data: true, error: null });
    renderPage();
    await screen.findByText(item.phone);
    fireEvent.change(screen.getByLabelText(copy.add.phone), { target: { value: "+5511988887777" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: copy.add.submit }));
    });
    expect(api.addSuppressionAction).toHaveBeenCalledWith("+5511988887777");
    await waitFor(() => expect(api.listSuppressionsAction).toHaveBeenCalledTimes(2));
  });

  it("shows a refused phone under the field", async () => {
    api.addSuppressionAction.mockResolvedValue({ data: null, error: { code: "carrier_phone_invalid", message: "x" } });
    renderPage();
    await screen.findByText(item.phone);
    fireEvent.change(screen.getByLabelText(copy.add.phone), { target: { value: "123" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: copy.add.submit }));
    });
    expect(screen.getByText(pt.carrierMessaging.errors.carrier_phone_invalid)).toBeInTheDocument();
  });

  it("restores a contact after confirming", async () => {
    api.removeSuppressionAction.mockResolvedValue({ data: true, error: null });
    renderPage();
    await screen.findByText(item.phone);
    fireEvent.click(screen.getByRole("button", { name: copy.remove }));
    const dialog = await screen.findByRole("alertdialog");
    await act(async () => {
      fireEvent.click(dialog.querySelector("button:last-of-type") as HTMLButtonElement);
    });
    expect(api.removeSuppressionAction).toHaveBeenCalledWith(item.phone);
  });
});
