import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const carrierChannels = vi.hoisted(() => ({ launched: new Set<string>(["rcs", "sms"]) }));
vi.mock("@/lib/carrier-messaging/use-carrier-channels", () => ({
  useCarrierChannels: () => ({ status: "ready", launched: (channel: string) => carrierChannels.launched.has(channel) }),
}));

const actions = vi.hoisted(() => ({
  getCarrierCampaignAction: vi.fn(),
  getCampaignFunnelAction: vi.fn(),
  getCampaignTimelineAction: vi.fn(),
  getCampaignButtonsAction: vi.fn(),
  getCampaignVariantsAction: vi.fn(),
  getCampaignCarriersAction: vi.fn(),
  listCampaignRecipientsAction: vi.fn(),
  transitionCarrierCampaignAction: vi.fn(),
}));

vi.mock("@/app/actions/carrier-messaging", () => actions);
vi.mock("@/hooks/use-exchange-rate", () => ({ useExchangeRate: () => 5 }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "ws-1" } }) }));
vi.mock("@/i18n/routing", () => ({
  usePathname: () => "/dashboard/rcs/campaigns/cmp-1",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

import rawPt from "@/i18n/messages/pt.json";
import type { Campaign } from "@/lib/carrier-messaging/campaigns";
import { campaignFixture, campaignFunnelFixture, overviewFixture, runFunnelFixture } from "@/lib/carrier-messaging/test-fixtures";
import { brandedMessages } from "@/test/branded-messages";

import { CarrierCampaignDetail } from "./CarrierCampaignDetail";

const pt = brandedMessages(rawPt);
const copy = pt.carrierMessaging.pages.campaignDetail;

const RUNNING: Campaign = campaignFixture({
  status: "running",
  variants: [
    { name: "Foto", content: { text: "A" }, bindings: [] },
    { name: "Carrossel", content: { text: "B" }, bindings: [] },
  ],
});

function ok<T>(data: T) {
  return { data, error: null };
}

function renderDetail(props: Partial<Parameters<typeof CarrierCampaignDetail>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
        <CarrierCampaignDetail campaignId="cmp-1" {...props} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("CarrierCampaignDetail", () => {
  beforeEach(() => {
    Object.values(actions).forEach((mock) => mock.mockReset());
    actions.getCarrierCampaignAction.mockResolvedValue(ok(RUNNING));
    actions.getCampaignFunnelAction.mockResolvedValue(ok(campaignFunnelFixture()));
    actions.getCampaignTimelineAction.mockResolvedValue(ok({ bucket: "hour", points: [{ at: "2026-10-20T12:00:00Z", sent: 10, delivered: 9, read: 5, failed: 1 }] }));
    actions.getCampaignButtonsAction.mockResolvedValue(ok([{ card: 0, index: 0, label: "Ver cardápio", kind: "open_url", taps: 30, clicks: 28 }]));
    actions.getCampaignVariantsAction.mockResolvedValue(
      ok([
        { variant: 0, name: "Foto", funnel: runFunnelFixture(), rates: { ...campaignFunnelFixture().rates, read: 0.7 } },
        { variant: 1, name: "Carrossel", funnel: runFunnelFixture(), rates: { ...campaignFunnelFixture().rates, read: 0.6 } },
      ]),
    );
    actions.getCampaignCarriersAction.mockResolvedValue(ok(overviewFixture().carriers));
    actions.listCampaignRecipientsAction.mockResolvedValue(
      ok({ items: [{ phone: "+5511999990000", lead_id: "l1", lead_name: "Ana", variant: 1, status: "skipped", skip_reason: "frequency_cap", message_status: "", updated_at: "2026-10-20T12:00:00Z" }], total: 1 }),
    );
  });

  it("shows a running campaign with its live sections", async () => {
    renderDetail();
    expect(await screen.findByRole("heading", { name: RUNNING.name })).toBeInTheDocument();
    expect(screen.getByText(pt.carrierMessaging.campaignStatus.running)).toBeInTheDocument();
    expect(await screen.findByText("Ver cardápio")).toBeInTheDocument();
    expect(screen.getByText(copy.buttons.inCard.replace("{card}", "1"))).toBeInTheDocument();
    expect(await screen.findByText(pt.carrierMessaging.skipReasons.frequency_cap)).toBeInTheDocument();
    expect(screen.getAllByText("Carrossel").length).toBeGreaterThan(0);
    expect(screen.getByText("Claro")).toBeInTheDocument();
  });

  it("pauses the campaign and explains a refusal from the backend", async () => {
    actions.transitionCarrierCampaignAction.mockResolvedValue({ data: null, error: { code: "carrier_insufficient_balance", details: { missing_micros: 2_000_000 } } });
    renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: copy.actions.pause }));
    await waitFor(() => expect(actions.transitionCarrierCampaignAction).toHaveBeenCalledWith("cmp-1", "pause"));
    expect(await screen.findByText(copy.actions.refusedTitle)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(pt.carrierMessaging.errors.carrier_insufficient_balance.slice(0, 20)))).toBeInTheDocument();
  });

  it("filters recipients by status", async () => {
    renderDetail();
    await screen.findByText(pt.carrierMessaging.skipReasons.frequency_cap);
    fireEvent.click(screen.getByRole("button", { name: pt.carrierMessaging.recipientStatus.failed }));
    await waitFor(() => expect(actions.listCampaignRecipientsAction).toHaveBeenLastCalledWith("cmp-1", { page: 1, status: "failed" }, expect.anything()));
  });

  it("waits for the launch before showing results on a draft", async () => {
    actions.getCarrierCampaignAction.mockResolvedValue(ok(campaignFixture()));
    const onEdit = vi.fn();
    renderDetail({ onEdit });
    expect(await screen.findByText(copy.notLaunched.title)).toBeInTheDocument();
    expect(actions.getCampaignFunnelAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: copy.actions.edit }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: "cmp-1" }));
  });

  it("hands the duplicate to the caller", async () => {
    const onDuplicated = vi.fn();
    actions.transitionCarrierCampaignAction.mockResolvedValue(ok(campaignFixture({ id: "cmp-2" })));
    renderDetail({ onDuplicated });
    fireEvent.click(await screen.findByRole("button", { name: copy.actions.duplicate }));
    await waitFor(() => expect(onDuplicated).toHaveBeenCalledWith(expect.objectContaining({ id: "cmp-2" })));
  });


  it("shows one coming soon panel and asks nothing while no channel is launched", () => {
    carrierChannels.launched = new Set();
    renderDetail();
    expect(screen.getByText(pt.carrierMessaging.comingSoon.all.title)).toBeInTheDocument();
    expect(actions.getCarrierCampaignAction).not.toHaveBeenCalled();
    carrierChannels.launched = new Set(["rcs", "sms"]);
  });
});
