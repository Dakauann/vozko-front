import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { ActionCard } from "@/lib/aichat/types";

const permissions = vi.hoisted(() => ({ allowed: true }));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ can: () => permissions.allowed, currentWorkspace: { id: "ws-1" } }),
}));
vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));
vi.mock("@/hooks/use-whatsapp-capacity", () => ({
  useWhatsAppCapacity: () => ({ ready: true, used: 1, total: 1, canAdd: false }),
}));

import { ActionCardView } from "./action-card";

const actions = ptMessages.aiChatPage.actions;

function renderCard(card: ActionCard) {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ActionCardView card={card} />
    </NextIntlClientProvider>,
  );
}

describe("ActionCardView", () => {
  it("links to the right flow when the user can act", () => {
    permissions.allowed = true;
    renderCard({
      kind: "connect_telegram",
      balanceMicros: 0,
      subscriptionActive: true,
      status: { capability: "telegram", count: 0, canAdd: true },
    });
    expect(screen.getByText(actions.kinds.connect_telegram.title)).toBeTruthy();
    expect(screen.getByRole("link", { name: actions.kinds.connect_telegram.cta }).getAttribute("href")).toBe(
      "/dashboard/telegram-accounts/connect",
    );
  });

  it("never offers the action without permission", () => {
    permissions.allowed = false;
    renderCard({
      kind: "connect_telegram",
      balanceMicros: 0,
      subscriptionActive: true,
      status: { capability: "telegram", count: 0, canAdd: true },
    });
    expect(screen.queryByRole("link", { name: actions.kinds.connect_telegram.cta })).toBeNull();
    expect(screen.getByText(actions.blocker.no_permission)).toBeTruthy();
  });

  it("uses the live capacity for official numbers and points to add-ons at the limit", () => {
    permissions.allowed = true;
    renderCard({
      kind: "connect_whatsapp_business",
      balanceMicros: 0,
      subscriptionActive: true,
      status: { capability: "official_whatsapp", count: 0, usage: { used: 0, total: 1 }, canAdd: true },
    });
    expect(screen.queryByRole("button", { name: actions.kinds.connect_whatsapp_business.cta })).toBeNull();
    expect(screen.getByText(actions.blocker.at_limit)).toBeTruthy();
    expect(screen.getByRole("link", { name: actions.addMore }).getAttribute("href")).toBe("/dashboard/addons");
    expect(screen.getByText("1 de 1 do seu plano")).toBeTruthy();
  });

  it("shows the current balance on the top-up card", () => {
    permissions.allowed = true;
    renderCard({ kind: "top_up_balance", balanceMicros: 2_500_000, subscriptionActive: true });
    expect(screen.getByText(/Saldo atual:/)).toBeTruthy();
    expect(screen.getByRole("link", { name: actions.kinds.top_up_balance.cta }).getAttribute("href")).toBe("/dashboard/balance");
  });
});
