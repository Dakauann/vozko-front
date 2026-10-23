import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/carrier-messaging/use-carrier-channels", () => ({
  useCarrierChannels: () => ({ status: "ready", launched: () => false }),
}));

const actions = vi.hoisted(() => ({ getCarrierCampaignAction: vi.fn() }));
vi.mock("@/app/actions/carrier-messaging", () => actions);
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("id=cmp-1") }));
vi.mock("@/i18n/routing", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/dashboard/rcs-sms/campaigns/new" }));
vi.mock("framer-motion", () => import("@/test/framer-motion-stub"));
vi.mock("@/components/dashboard/DashboardPageHeader", () => ({
  DashboardPageHeader: ({ badge, meta }: { badge: string; meta?: ReactNode }) => (
    <header>
      <h1>{badge}</h1>
      {meta}
    </header>
  ),
}));

import rawPt from "@/i18n/messages/pt.json";
import { brandedMessages } from "@/test/branded-messages";

import { CarrierCampaignEditorScreen } from "./CarrierCampaignEditorScreen";

const pt = brandedMessages(rawPt);

describe("CarrierCampaignEditorScreen", () => {
  it("shows one coming soon panel inside the page header and loads no campaign while no channel is launched", () => {
    render(
      <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
        <CarrierCampaignEditorScreen />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("heading", { level: 1, name: pt.carrierMessaging.pages.campaignHost.header.newBadge })).toBeInTheDocument();
    expect(screen.getByText(pt.carrierMessaging.comingSoon.all.title)).toBeInTheDocument();
    expect(actions.getCarrierCampaignAction).not.toHaveBeenCalled();
  });
});
