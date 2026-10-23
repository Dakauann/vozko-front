import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const carrierChannels = vi.hoisted(() => ({ launched: new Set<string>(["rcs", "sms"]) }));
vi.mock("@/lib/carrier-messaging/use-carrier-channels", () => ({
  useCarrierChannels: () => ({ status: "ready", launched: (channel: string) => carrierChannels.launched.has(channel) }),
}));

const actions = vi.hoisted(() => ({
  listCarrierCampaignsAction: vi.fn(),
  transitionCarrierCampaignAction: vi.fn(),
  deleteCarrierCampaignAction: vi.fn(),
}));
const toast = vi.hoisted(() => Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }));

vi.mock("@/app/actions/carrier-messaging", () => actions);
vi.mock("@/hooks/use-exchange-rate", () => ({ useExchangeRate: () => 5 }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/i18n/routing", () => ({
  usePathname: () => "/dashboard/rcs/campaigns",
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

import rawPt from "@/i18n/messages/pt.json";
import { campaignFixture, summaryFixture } from "@/lib/carrier-messaging/test-fixtures";
import { brandedMessages } from "@/test/branded-messages";

import { CarrierCampaignsList } from "./CarrierCampaignsList";

const pt = brandedMessages(rawPt);
const copy = pt.carrierMessaging.pages.campaigns;

function renderList(onOpen = vi.fn(), onCreate = vi.fn()) {
  render(
    <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
      <CarrierCampaignsList onOpen={onOpen} onCreate={onCreate} />
    </NextIntlClientProvider>,
  );
  return { onOpen, onCreate };
}

describe("CarrierCampaignsList", () => {
  beforeEach(() => {
    for (const action of Object.values(actions)) action.mockReset();
    toast.success.mockReset();
    toast.error.mockReset();
  });

  it("lists campaigns with channel, status, schedule and backend counts", async () => {
    actions.listCarrierCampaignsAction.mockResolvedValue({
      data: {
        items: [
          summaryFixture(),
          summaryFixture({ id: "cmp-2", name: "Lembrete mensal", channel: "sms", status: "scheduled", recurrence: { frequency: "monthly", day_of_month: 5, time: "09:00", timezone: "America/Sao_Paulo" } }),
        ],
        total: 2,
      },
      error: null,
    });
    renderList();
    expect(await screen.findByText("Pão quentinho de sexta")).toBeInTheDocument();
    expect(screen.getByText("Todo mês no dia 5, às 09:00")).toBeInTheDocument();
    expect(screen.getAllByText(pt.carrierMessaging.campaignStatus.scheduled).length).toBeGreaterThan(0);
    expect(screen.getAllByText("1.180").length).toBeGreaterThan(0);
    expect(actions.listCarrierCampaignsAction.mock.calls[0][0]).toEqual({ channel: undefined, status: undefined, page: 1, limit: 20 });
  });

  it("marks the RCS filter as coming soon", async () => {
    carrierChannels.launched = new Set(["sms"]);
    actions.listCarrierCampaignsAction.mockResolvedValue({ data: { items: [], total: 0 }, error: null });
    renderList();
    const rcsFilter = await screen.findByRole("button", { name: pt.carrierMessaging.channels.rcs });
    expect(rcsFilter).toBeDisabled();
    expect(rcsFilter).toHaveTextContent(pt.carrierMessaging.comingSoon.chip);
    carrierChannels.launched = new Set(["rcs", "sms"]);
  });

  it("filters by channel and status through the backend", async () => {
    actions.listCarrierCampaignsAction.mockResolvedValue({ data: { items: [], total: 0 }, error: null });
    renderList();
    await screen.findByText(copy.empty.title);
    fireEvent.click(screen.getByRole("button", { name: "SMS" }));
    fireEvent.click(screen.getByRole("button", { name: pt.carrierMessaging.campaignStatus.running }));
    await waitFor(() => expect(actions.listCarrierCampaignsAction.mock.calls.at(-1)?.[0]).toEqual({ channel: "sms", status: "running", page: 1, limit: 20 }));
    expect(await screen.findByText(copy.empty.filteredTitle)).toBeInTheDocument();
  });

  it("shows the coded refusal and retries", async () => {
    actions.listCarrierCampaignsAction.mockResolvedValueOnce({ data: null, error: { code: "carrier_provider_unavailable", message: "x" } });
    renderList();
    expect(await screen.findByText(copy.error.title)).toBeInTheDocument();
    expect(screen.getByText(pt.carrierMessaging.errors.carrier_provider_unavailable)).toBeInTheDocument();
    actions.listCarrierCampaignsAction.mockResolvedValueOnce({ data: { items: [summaryFixture()], total: 1 }, error: null });
    fireEvent.click(screen.getByRole("button", { name: copy.error.retry }));
    expect(await screen.findByText("Pão quentinho de sexta")).toBeInTheDocument();
  });

  it("duplicates a campaign and opens the copy", async () => {
    actions.listCarrierCampaignsAction.mockResolvedValue({ data: { items: [summaryFixture()], total: 1 }, error: null });
    actions.transitionCarrierCampaignAction.mockResolvedValue({ data: campaignFixture({ id: "cmp-9" }), error: null });
    const { onOpen } = renderList();
    await screen.findByText("Pão quentinho de sexta");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Duplicar Pão quentinho de sexta" }));
    });
    expect(actions.transitionCarrierCampaignAction).toHaveBeenCalledWith("cmp-1", "duplicate");
    expect(onOpen).toHaveBeenCalledWith("cmp-9");
  });

  it("deletes only drafts after a confirmation", async () => {
    actions.listCarrierCampaignsAction.mockResolvedValue({ data: { items: [summaryFixture(), summaryFixture({ id: "cmp-3", name: "Rascunho", status: "draft" })], total: 2 }, error: null });
    actions.deleteCarrierCampaignAction.mockResolvedValue({ data: true, error: null });
    renderList();
    const remove = await screen.findByRole("button", { name: "Excluir Rascunho" });
    expect(screen.queryByRole("button", { name: "Excluir Pão quentinho de sexta" })).not.toBeInTheDocument();
    fireEvent.click(remove);
    const dialog = await screen.findByRole("alertdialog");
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: copy.confirmDelete.confirm }));
    });
    expect(actions.deleteCarrierCampaignAction).toHaveBeenCalledWith("cmp-3");
  });

  it("starts a new campaign from the header", async () => {
    actions.listCarrierCampaignsAction.mockResolvedValue({ data: { items: [summaryFixture()], total: 1 }, error: null });
    const { onCreate } = renderList();
    await screen.findByText("Pão quentinho de sexta");
    fireEvent.click(screen.getAllByRole("button", { name: copy.create })[0]);
    expect(onCreate).toHaveBeenCalled();
  });


  it("lists nothing and shows one coming soon panel while no channel is launched", () => {
    carrierChannels.launched = new Set();
    renderList();
    expect(screen.getByText(pt.carrierMessaging.comingSoon.all.title)).toBeInTheDocument();
    expect(actions.listCarrierCampaignsAction).not.toHaveBeenCalled();
    carrierChannels.launched = new Set(["rcs", "sms"]);
  });

  it("marks the SMS filter as coming soon while only RCS is launched", async () => {
    carrierChannels.launched = new Set(["rcs"]);
    actions.listCarrierCampaignsAction.mockResolvedValue({ data: { items: [], total: 0 }, error: null });
    renderList();
    const smsFilter = await screen.findByRole("button", { name: pt.carrierMessaging.channels.sms });
    expect(smsFilter).toBeDisabled();
    expect(smsFilter).toHaveTextContent(pt.carrierMessaging.comingSoon.chip);
    carrierChannels.launched = new Set(["rcs", "sms"]);
  });
});
