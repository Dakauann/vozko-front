import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const carrierChannels = vi.hoisted(() => ({ launched: new Set<string>(["rcs", "sms"]) }));
vi.mock("@/lib/carrier-messaging/use-carrier-channels", () => ({
  useCarrierChannels: () => ({ status: "ready", launched: (channel: string) => carrierChannels.launched.has(channel) }),
}));

const actions = vi.hoisted(() => ({ getCarrierOverviewAction: vi.fn() }));

vi.mock("@/app/actions/carrier-messaging", () => actions);
vi.mock("@/hooks/use-exchange-rate", () => ({ useExchangeRate: () => 5 }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "ws-1" } }) }));
vi.mock("@/i18n/routing", () => ({
  usePathname: () => "/dashboard/rcs",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

import rawPt from "@/i18n/messages/pt.json";
import { overviewFixture } from "@/lib/carrier-messaging/test-fixtures";
import { brandedMessages } from "@/test/branded-messages";

import { CarrierOverview } from "./CarrierOverview";

const pt = brandedMessages(rawPt);
const copy = pt.carrierMessaging.pages.overview;

function renderOverview() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
        <CarrierOverview />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("CarrierOverview", () => {
  beforeEach(() => {
    actions.getCarrierOverviewAction.mockReset();
    actions.getCarrierOverviewAction.mockResolvedValue({ data: overviewFixture(), error: null });
  });

  it("marks the RCS view as coming soon and leaves RCS out of the cost comparison", async () => {
    carrierChannels.launched = new Set(["sms"]);
    renderOverview();
    await screen.findByText(copy.funnel.title);
    const rcsView = screen.getByRole("button", { name: pt.carrierMessaging.channels.rcs });
    expect(rcsView).toBeDisabled();
    expect(rcsView).toHaveTextContent(pt.carrierMessaging.comingSoon.chip);
    carrierChannels.launched = new Set(["rcs", "sms"]);
  });

  it("shows the KPI band with the rates the backend calculated", async () => {
    renderOverview();
    expect((await screen.findAllByText("1.180")).length).toBeGreaterThan(0);
    expect(actions.getCarrierOverviewAction).toHaveBeenCalledWith(30, "all", expect.anything());
    expect(screen.getAllByText("93%").length).toBeGreaterThan(0);
    expect(screen.getAllByText(copy.kpis.costPerConversion.short).length).toBeGreaterThan(0);
    expect(screen.getByText(copy.funnel.title)).toBeInTheDocument();
  });

  it("shows the cost per conversion of the chosen channel", async () => {
    renderOverview();
    await screen.findByText(copy.funnel.title);
    fireEvent.click(screen.getByRole("button", { name: pt.carrierMessaging.channels.rcs }));
    await waitFor(() => expect(actions.getCarrierOverviewAction).toHaveBeenLastCalledWith(30, "rcs", expect.anything()));
    expect(screen.getByText(copy.kpis.costPerConversion.short)).toBeInTheDocument();
  });

  it("asks the backend again for another period", async () => {
    renderOverview();
    await screen.findByText(copy.funnel.title);
    fireEvent.click(screen.getByRole("button", { name: "7 dias" }));
    await waitFor(() => expect(actions.getCarrierOverviewAction).toHaveBeenLastCalledWith(7, "all", expect.anything()));
  });

  it("lists the fallback rate per carrier", async () => {
    renderOverview();
    expect(await screen.findByText("Claro")).toBeInTheDocument();
    expect(screen.getByText("12,5%")).toBeInTheDocument();
  });

  it("offers a retry when the overview fails", async () => {
    actions.getCarrierOverviewAction.mockResolvedValue({ data: null, error: { code: "carrier_request_failed", status: 422 } });
    renderOverview();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });


  it("shows one coming soon panel for RCS and SMS and asks nothing while no channel is launched", () => {
    carrierChannels.launched = new Set();
    renderOverview();
    expect(screen.getByText(pt.carrierMessaging.comingSoon.all.title)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: pt.carrierMessaging.comingSoon.rcs.toSms })).not.toBeInTheDocument();
    expect(actions.getCarrierOverviewAction).not.toHaveBeenCalled();
    carrierChannels.launched = new Set(["rcs", "sms"]);
  });
});
