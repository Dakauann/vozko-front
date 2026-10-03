import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { AdAccount, AdReadiness } from "@/lib/advertising/types";

import { ManagerReadinessBanner, ReadinessCard, useManagerReadinessEmptyState } from "./readiness";
import type { AdReadinessState } from "./use-ad-readiness";

vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const account = { id: "acc-1", name: "Loja", metaAccountId: "111" } as AdAccount;

const notReady: AdReadiness = {
  account,
  ready: false,
  blocking: ["payment_method"],
  items: [
    { key: "payment_method", state: "missing", required: true, action: { kind: "portal", url: "https://business.facebook.com/latest/billing_hub" } },
    { key: "phone_verification", state: "unknown", required: false, action: { kind: "portal", url: "https://business.facebook.com/latest/settings/authorizations_verifications" } },
    { key: "pixel", state: "missing", required: false, action: { kind: "in_app", key: "create_pixel" } },
    { key: "page", state: "ready", required: true },
  ],
};

function stateWith(overrides: Partial<AdReadinessState> = {}): AdReadinessState {
  return {
    readiness: notReady,
    error: null,
    actionError: null,
    loading: false,
    checking: false,
    awaiting: false,
    recheck: vi.fn(),
    refresh: vi.fn(),
    openPortal: vi.fn(() => true),
    runInApp: vi.fn(),
    ...overrides,
  };
}

function renderWith(node: React.ReactNode) {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      {node}
    </NextIntlClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe("ReadinessCard", () => {
  it("lists every item, opens portals in a popup and runs in-app actions here", () => {
    const state = stateWith();
    renderWith(<ReadinessCard account={account} state={state} canCreate />);

    expect(screen.getByText("Prepare-se para veicular anúncios")).toBeTruthy();
    expect(screen.getByText("Adicione a forma de pagamento")).toBeTruthy();
    expect(screen.getByText("Verificar telefone")).toBeTruthy();
    expect(screen.getByText(/A Meta não informa isso pela API/)).toBeTruthy();

    const portals = screen.getAllByRole("link", { name: /Abrir na Meta/ });
    act(() => {
      fireEvent.click(portals[0]);
    });
    expect(state.openPortal).toHaveBeenCalledWith("https://business.facebook.com/latest/billing_hub");

    fireEvent.click(screen.getByRole("button", { name: /Criar pixel/ }));
    expect(state.runInApp).toHaveBeenCalledWith("create_pixel", "Pixel Loja");
  });

  it("keeps creating actions off without the create permission", () => {
    renderWith(<ReadinessCard account={account} state={stateWith()} canCreate={false} />);
    expect(screen.getByRole("button", { name: /Criar pixel/ })).toHaveProperty("disabled", true);
  });
});

describe("ManagerReadinessBanner", () => {
  it("points to the account overview while the account is not ready", () => {
    renderWith(<ManagerReadinessBanner account={account} state={stateWith()} />);
    expect(screen.getByRole("link", { name: "Ir para a Visão geral da conta" }).getAttribute("href")).toBe("/dashboard/advertising/overview?account=acc-1");
  });

  it("shows when readiness could not be loaded", () => {
    renderWith(<ManagerReadinessBanner account={account} state={stateWith({ readiness: null, error: "falhou" })} />);
    expect(screen.getByText("Prepare-se para veicular anúncios")).toBeTruthy();
  });

  it("stays hidden for a ready account", () => {
    renderWith(<ManagerReadinessBanner account={account} state={stateWith({ readiness: { ...notReady, ready: true, blocking: [] } })} />);
    expect(screen.queryByText("Prepare-se para veicular anúncios")).toBeNull();
  });
});

function EmptyStateProbe({ state }: { state: AdReadinessState }) {
  const empty = useManagerReadinessEmptyState(account, state);
  return empty ? (
    <div>
      <p>{empty.title}</p>
      <p>{empty.description}</p>
      {empty.action}
    </div>
  ) : (
    <p>ready</p>
  );
}

describe("useManagerReadinessEmptyState", () => {
  it("turns the empty campaign table into Meta's get ready message while the account is not ready", () => {
    renderWith(<EmptyStateProbe state={stateWith()} />);
    expect(screen.getByText("Prepare-se para veicular anúncios")).toBeTruthy();
    expect(screen.getByText(/para publicar sua primeira campanha de anúncios/)).toBeTruthy();
    expect(screen.getByText("Ir para a Visão geral da conta")).toBeTruthy();
  });

  it("leaves the normal empty state for a ready account", () => {
    renderWith(<EmptyStateProbe state={stateWith({ readiness: { ...notReady, ready: true, blocking: [] } })} />);
    expect(screen.getByText("ready")).toBeTruthy();
  });
});
