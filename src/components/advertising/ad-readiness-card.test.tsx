import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { AdAccount, AdReadiness } from "@/lib/advertising/types";

import { AdReadinessCard } from "./ad-readiness-card";

const state = vi.hoisted(() => ({ canRead: true, accounts: [] as AdAccount[], readiness: null as AdReadiness | null }));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ can: () => state.canRead, permissionsLoading: false, currentWorkspace: { id: "ws-1" } }),
}));
vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/hooks/use-ad-accounts", () => ({
  useAdAccounts: () => ({ accounts: state.accounts, loading: false, replace: vi.fn() }),
}));
vi.mock("./use-ad-readiness", () => ({
  useAdReadiness: () => ({
    readiness: state.readiness,
    error: null,
    actionError: null,
    loading: false,
    checking: false,
    awaiting: false,
    recheck: vi.fn(),
    refresh: vi.fn(),
    openPortal: vi.fn(() => true),
    runInApp: vi.fn(),
  }),
}));

const account = { id: "acc-1", name: "Dakauann Cavalcante", metaAccountId: "111" } as AdAccount;

const unfunded: AdReadiness = {
  account,
  ready: false,
  blocking: ["payment_method"],
  items: [{ key: "payment_method", state: "missing", required: true, action: { kind: "portal", url: "https://business.facebook.com/latest/billing_hub" } }],
};

function renderCard(adAccountId = "acc-1") {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <AdReadinessCard adAccountId={adAccountId} />
    </NextIntlClientProvider>,
  );
}

describe("AdReadinessCard", () => {
  beforeEach(() => {
    state.canRead = true;
    state.accounts = [account];
    state.readiness = unfunded;
  });

  it("shows what is missing with the Meta screen that solves it, from the readiness check and not from the chat text", () => {
    renderCard();
    expect(screen.getByText("Adicione a forma de pagamento")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Abrir na Meta/ }).getAttribute("href")).toBe("https://business.facebook.com/latest/billing_hub");
  });

  it("says the account is ready when nothing blocks the publish", () => {
    state.readiness = { ...unfunded, ready: true, blocking: [] };
    renderCard();
    expect(screen.getByText("A conta Dakauann Cavalcante está pronta para publicar.")).toBeTruthy();
  });

  it("never shows another account when the card's account is gone", () => {
    renderCard("acc-gone");
    expect(screen.getByText("Essa conta de anúncios não está mais conectada a este workspace.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Abrir na Meta/ })).toBeNull();
  });

  it("shows nothing without permission to read ads", () => {
    state.canRead = false;
    renderCard();
    expect(screen.queryByText("Adicione a forma de pagamento")).toBeNull();
  });
});
