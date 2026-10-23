import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getCarrierSettingsAction: vi.fn(), saveCarrierSettingsAction: vi.fn() }));
const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));

vi.mock("@/app/actions/carrier-messaging", () => api);
vi.mock("@/hooks/use-exchange-rate", () => ({ useExchangeRate: () => 5 }));
vi.mock("sonner", () => ({ toast }));
vi.mock("framer-motion", () => import("@/test/framer-motion-stub"));
vi.mock("@/components/dashboard/DashboardPageHeader", () => ({
  DashboardPageHeader: ({ badge }: { badge: string; actions?: ReactNode }) => <h1>{badge}</h1>,
}));

import rawPt from "@/i18n/messages/pt.json";
import { settingsFixture } from "@/lib/carrier-messaging/test-fixtures";
import { brandedMessages } from "@/test/branded-messages";

import { CarrierSettingsPage } from "./CarrierSettingsPage";

const pt = brandedMessages(rawPt);
const copy = pt.carrierMessaging.pages.settings;

function renderPage() {
  return render(
    <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
      <CarrierSettingsPage />
    </NextIntlClientProvider>,
  );
}

describe("CarrierSettingsPage", () => {
  beforeEach(() => {
    api.getCarrierSettingsAction.mockReset();
    api.saveCarrierSettingsAction.mockReset();
    toast.success.mockReset();
    api.getCarrierSettingsAction.mockResolvedValue({ data: settingsFixture(), error: null });
  });

  it("loads the rules and keeps save off until something changes", async () => {
    renderPage();
    const perDay = await screen.findByLabelText(copy.frequencyCap.perDay);
    expect(perDay).toHaveValue(2);
    expect(screen.getByRole("button", { name: copy.save })).toBeDisabled();
  });

  it("saves the changed cap with PUT", async () => {
    const saved = { ...settingsFixture(), frequency_cap: { per_day: 3, per_week: 6 } };
    api.saveCarrierSettingsAction.mockResolvedValue({ data: saved, error: null });
    renderPage();
    fireEvent.change(await screen.findByLabelText(copy.frequencyCap.perDay), { target: { value: "3" } });
    expect(screen.getByText(copy.unsaved)).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: copy.save }));
    });
    expect(api.saveCarrierSettingsAction).toHaveBeenCalledWith(saved);
    expect(toast.success).toHaveBeenCalledWith(copy.saved);
    expect(screen.queryByText(copy.unsaved)).not.toBeInTheDocument();
  });

  it("shows the backend refusal", async () => {
    api.saveCarrierSettingsAction.mockResolvedValue({ data: null, error: { code: "carrier_settings_invalid", message: "x" } });
    renderPage();
    fireEvent.change(await screen.findByLabelText(copy.frequencyCap.perWeek), { target: { value: "1" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: copy.save }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent(pt.carrierMessaging.errors.carrier_settings_invalid);
  });

  it("offers a retry when loading fails", async () => {
    api.getCarrierSettingsAction.mockResolvedValueOnce({ data: null, error: { code: "carrier_request_failed", message: "x" } });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: copy.retry }));
    expect(await screen.findByLabelText(copy.frequencyCap.perDay)).toBeInTheDocument();
  });
});
