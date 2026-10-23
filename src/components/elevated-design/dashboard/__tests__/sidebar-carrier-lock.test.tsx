import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const carrierChannels = vi.hoisted(() => ({ launched: new Set<string>() }));
vi.mock("@/lib/carrier-messaging/use-carrier-channels", () => ({
  useCarrierChannels: () => ({ status: "ready", launched: (channel: string) => carrierChannels.launched.has(channel) }),
}));
vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => "/dashboard",
}));
vi.mock("framer-motion", () => import("@/test/framer-motion-stub"));

import rawPt from "@/i18n/messages/pt.json";
import { brandedMessages } from "@/test/branded-messages";
import type { useTranslations } from "next-intl";

import { adminNavItems, campanhasNavItems, NavItemComponent, type NavItem } from "../sidebar";

const pt = brandedMessages(rawPt);
const label = ((key: string) => key) as unknown as ReturnType<typeof useTranslations>;

function item(labelKey: string): NavItem {
  const found = [...campanhasNavItems, ...adminNavItems].find((entry) => entry.labelKey === labelKey);
  if (!found) throw new Error(labelKey);
  return found;
}

function renderItem(entry: NavItem) {
  return render(
    <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
      <NavItemComponent item={entry} isExpanded onToggle={() => undefined} openItems={new Set()} motionEnabled={false} t={label} canOpen={() => true} />
    </NextIntlClientProvider>,
  );
}

function row(labelKey: string) {
  return screen.getByText(labelKey).closest("[role=link], a") as HTMLElement;
}

describe("carrier items in the sidebar", () => {
  beforeEach(() => {
    carrierChannels.launched = new Set();
  });

  it("renders a locked item as a disabled row that never navigates", () => {
    renderItem(item("nav.carrierOverview"));
    const locked = row("nav.carrierOverview");
    expect(locked.tagName).toBe("DIV");
    expect(locked).toHaveAttribute("aria-disabled", "true");
    expect(locked).not.toHaveAttribute("href");
    expect(locked).not.toHaveAttribute("tabindex");
    expect(locked).toHaveAttribute("title", pt.carrierMessaging.comingSoon.navHint);
    expect(locked.className).not.toMatch(/hover:/);
    expect(screen.queryByRole("link", { name: /nav\.carrierOverview/ })).toHaveAttribute("aria-disabled", "true");
  });

  it("locks the admin RCS e SMS entry while nothing is launched", () => {
    renderItem(item("nav.adminCarrier"));
    expect(row("nav.adminCarrier")).toHaveAttribute("aria-disabled", "true");
  });

  it("keeps the launched channel and shared items working while the parked channel shows its chip", () => {
    carrierChannels.launched = new Set(["sms"]);
    renderItem(item("nav.carrierSmsSenders"));
    expect(row("nav.carrierSmsSenders")).toHaveAttribute("href", "/dashboard/rcs-sms/sms-senders");
    renderItem(item("nav.carrierSettings"));
    expect(row("nav.carrierSettings")).toHaveAttribute("href", "/dashboard/rcs-sms/settings");
    renderItem(item("nav.carrierRcsSenders"));
    const rcs = row("nav.carrierRcsSenders");
    expect(rcs).toHaveAttribute("aria-disabled", "true");
    expect(rcs).toHaveTextContent(pt.carrierMessaging.comingSoon.chip);
  });

  it("leaves items outside the carrier family untouched", () => {
    renderItem(item("nav.emailSenders"));
    expect(row("nav.emailSenders")).toHaveAttribute("href", "/dashboard/email/senders");
  });
});
