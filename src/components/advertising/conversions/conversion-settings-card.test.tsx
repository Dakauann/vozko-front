import { render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";
import type { AdAccount } from "@/lib/advertising/types";

const getSettings = vi.fn();
vi.mock("@/app/actions/advertising-conversions", () => ({
  getConversionSettingsAction: () => getSettings(),
  saveConversionSettingsAction: vi.fn(),
  connectConversionDatasetAction: vi.fn(),
}));

const listPhones = vi.fn();
vi.mock("@/app/actions/whatsapp-business-phones", () => ({
  listBusinessPhonesAction: (...args: unknown[]) => listPhones(...args),
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { ConversionSettingsCard } from "./conversion-settings-card";

const account = { id: "acc-1", metaAccountId: "act_1", name: "Vozko CRM BRL", currency: "BRL" } as AdAccount;

function renderCard() {
  render(
    <NextIntlClientProvider locale="pt" messages={pt}>
      <ConversionSettingsCard account={account} accounts={[account]} pixels={[]} permissions={{ canUpdate: true } as never} />
    </NextIntlClientProvider>,
  );
}

const labels = pt.adsConversions.settings;

describe("ConversionSettingsCard", () => {
  beforeEach(() => {
    getSettings.mockReset();
    listPhones.mockReset();
    listPhones.mockResolvedValue({ phones: [] });
  });

  it("shows the event switches off and locked while sending is off", async () => {
    getSettings.mockResolvedValue({ data: { adAccountId: "acc-1", enabled: false, sendLeads: true, sendPurchases: true } });
    renderCard();
    const leads = await screen.findByRole("switch", { name: labels.sendLeads });
    const purchases = screen.getByRole("switch", { name: labels.sendPurchases });
    for (const event of [leads, purchases]) {
      expect(event).toBeDisabled();
      expect(event).toHaveAttribute("aria-checked", "false");
    }
  });

  it("keeps the saved event choices once sending is on", async () => {
    getSettings.mockResolvedValue({ data: { adAccountId: "acc-1", enabled: true, sendLeads: true, sendPurchases: false } });
    renderCard();
    const leads = await screen.findByRole("switch", { name: labels.sendLeads });
    expect(leads).not.toBeDisabled();
    expect(leads).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: labels.sendPurchases })).toHaveAttribute("aria-checked", "false");
  });

  it("offers only the numbers this workspace owns", async () => {
    getSettings.mockResolvedValue({ data: { adAccountId: "acc-1", enabled: true, sendLeads: true, sendPurchases: true } });
    renderCard();
    await waitFor(() => expect(listPhones).toHaveBeenCalled());
    expect(listPhones).toHaveBeenCalledWith(expect.objectContaining({ ownership: "owned" }));
  });
});
