import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { AdAccount, AdFunds } from "@/lib/advertising/types";

import { FundsBanner } from "./funds-banner";
import type { AdReadinessState } from "./use-ad-readiness";

vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const PORTAL = "https://business.facebook.com/billing_hub/payment_settings?asset_id=111";

function account(funds: Partial<AdFunds>): AdAccount {
  return {
    id: "acc-1", name: "Loja", metaAccountId: "111", currency: "BRL", canManage: true,
    funds: { kind: "prepaid", level: "ok", limit: 2635, spent: 125, room: 2510, dailySpend: 0, daysLeft: null, portalUrl: PORTAL, ...funds },
  } as AdAccount;
}

function state(): AdReadinessState {
  return {
    readiness: null, error: null, actionError: null, loading: false, checking: false, awaiting: false,
    recheck: vi.fn(), refresh: vi.fn(), openPortal: vi.fn(() => true), runInApp: vi.fn(),
  };
}

function renderBanner(a: AdAccount, s = state()) {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <FundsBanner account={a} state={s} />
    </NextIntlClientProvider>,
  );
  return s;
}

describe("FundsBanner", () => {
  it("says how much and how long the prepaid funds last, and adds funds at Meta in a popup", () => {
    const s = renderBanner(account({ level: "low", reason: "funds_low", room: 135, daysLeft: 0.4 }));
    expect(screen.getByText("Os fundos desta conta de anúncios estão acabando")).toBeTruthy();
    expect(screen.getByText(/pagam só mais R\$\s1,35 em anúncios, cerca de 1 dia no ritmo atual/)).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: /Adicionar fundos na Meta/ }));
    expect(s.openPortal).toHaveBeenCalledWith(PORTAL);
    fireEvent.click(screen.getByRole("button", { name: /Verificar novamente/ }));
    expect(s.recheck).toHaveBeenCalled();
  });

  it("explains that stopped ads still show as Ativo", () => {
    renderBanner(account({ level: "out", reason: "funds_out", room: 0 }));
    expect(screen.getByText("Os anúncios desta conta pararam: os fundos na Meta acabaram")).toBeTruthy();
    expect(screen.getByText(/seguem como Ativo/)).toBeTruthy();
  });

  it("sends a reached spending limit to the limit control in Vozko", () => {
    renderBanner(account({ kind: "postpaid", level: "out", reason: "spend_limit_reached" }));
    expect(screen.getByRole("link", { name: "Ajustar o limite" }).getAttribute("href")).toContain("account=acc-1");
  });

  it("renders nothing while the account is funded", () => {
    renderBanner(account({}));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/fundos/i)).toBeNull();
  });
});
