import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const carrierChannels = vi.hoisted(() => ({ launched: new Set<string>(["rcs", "sms"]) }));
vi.mock("@/lib/carrier-messaging/use-carrier-channels", () => ({
  useCarrierChannels: () => ({ status: "ready", launched: (channel: string) => carrierChannels.launched.has(channel) }),
}));

const nav = vi.hoisted(() => ({ tab: null as string | null, replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(nav.tab ? `tab=${nav.tab}` : "") }));
vi.mock("@/i18n/routing", () => ({ useRouter: () => ({ replace: nav.replace }), usePathname: () => "/dashboard/rcs-sms/settings", Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
vi.mock("./CarrierSettingsPage", () => ({ CarrierSettingsPage: ({ headerActions }: { headerActions?: React.ReactNode }) => <div>settings page{headerActions}</div> }));
vi.mock("../suppressions/CarrierSuppressionsPage", () => ({ CarrierSuppressionsPage: ({ headerActions }: { headerActions?: React.ReactNode }) => <div>suppressions page{headerActions}</div> }));

import rawPt from "@/i18n/messages/pt.json";
import { brandedMessages } from "@/test/branded-messages";

import { CarrierRulesScreen } from "./CarrierRulesScreen";

const pt = brandedMessages(rawPt);
const copy = pt.carrierMessaging.pages.campaignHost.rulesTabs;

function renderScreen() {
  render(
    <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
      <CarrierRulesScreen />
    </NextIntlClientProvider>,
  );
}

describe("CarrierRulesScreen", () => {
  beforeEach(() => {
    nav.tab = null;
    nav.replace.mockReset();
  });

  it("opens the sending rules by default and switches to the opt out list through the URL", () => {
    renderScreen();
    expect(screen.getByText("settings page")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: copy.suppressions }));
    expect(nav.replace).toHaveBeenCalledWith("/dashboard/rcs-sms/settings?tab=suppressions", { scroll: false });
  });

  it("opens the opt out list from the URL", () => {
    nav.tab = "suppressions";
    renderScreen();
    expect(screen.getByText("suppressions page")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: copy.rules }));
    expect(nav.replace).toHaveBeenCalledWith("/dashboard/rcs-sms/settings", { scroll: false });
  });


  it("shows one coming soon panel instead of the rules while no channel is launched", () => {
    carrierChannels.launched = new Set();
    renderScreen();
    expect(screen.getByText(pt.carrierMessaging.comingSoon.all.title)).toBeInTheDocument();
    expect(screen.queryByText("settings page")).not.toBeInTheDocument();
    carrierChannels.launched = new Set(["rcs", "sms"]);
  });
});
