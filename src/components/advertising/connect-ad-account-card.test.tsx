import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { MetaAdsConnectResult } from "@/lib/advertising/types";

import { ConnectAdAccountCard } from "./connect-ad-account-card";

const state = vi.hoisted(() => ({ canCreate: true, connect: vi.fn(), onResult: null as ((result: MetaAdsConnectResult) => void) | null }));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ can: () => state.canCreate, permissionsLoading: false }),
}));
vi.mock("@/hooks/use-meta-ads-connect", () => ({
  useMetaAdsConnect: (onResult: (result: MetaAdsConnectResult) => void) => {
    state.onResult = onResult;
    return { connect: state.connect, isConnecting: false };
  },
}));

function renderCard() {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ConnectAdAccountCard />
    </NextIntlClientProvider>,
  );
}

describe("ConnectAdAccountCard", () => {
  beforeEach(() => {
    state.canCreate = true;
    state.connect.mockReset();
  });

  it("starts the same Meta login as the Campanhas screen and tells how it went", () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Entrar com o Facebook" }));
    expect(state.connect).toHaveBeenCalledWith("/dashboard/advertising");
    act(() => state.onResult?.({ status: "connected", count: 2 }));
    expect(screen.getByRole("status").textContent).toContain(ptMessages.adsManager.connect.successTitle);
  });

  it("offers no login without permission to connect", () => {
    state.canCreate = false;
    renderCard();
    expect(screen.queryByRole("button", { name: "Entrar com o Facebook" })).toBeNull();
  });
});
