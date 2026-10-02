import { render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";
import type { AdOrigin } from "@/lib/conversations/ad-origin";

import { AdOriginBanner } from "./ad-origin-banner";

const workspace = vi.hoisted(() => ({
  permissionsLoading: false,
  granted: [] as string[],
}));

const originLookup = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({
    permissionsLoading: workspace.permissionsLoading,
    can: (resource: string, action: string) => workspace.granted.includes(`${resource}:${action}`),
  }),
}));

vi.mock("@/app/actions/advertising", () => ({
  getConversationAdOriginAction: originLookup,
  isAdsError: (result: object) => "error" in result,
}));

function renderBanner(origin: AdOrigin, entry?: { entryType: string; entryId: string }) {
  return render(
    <NextIntlClientProvider locale="pt" messages={pt}>
      <AdOriginBanner origin={origin} entryType={entry?.entryType} entryId={entry?.entryId} />
    </NextIntlClientProvider>,
  );
}

const instagramAd: AdOrigin = {
  platform: "instagram",
  title: "Promoção de outubro",
  sourceUrl: "https://www.instagram.com/p/abc",
  imageUrl: "https://cdn/ad.jpg",
};

beforeEach(() => {
  workspace.permissionsLoading = false;
  workspace.granted = [];
  originLookup.mockReset();
});

describe("AdOriginBanner", () => {
  it("says which ad brought the contact, with its picture and a link", () => {
    const { container } = renderBanner(instagramAd);
    expect(screen.getByText("Veio de um anúncio no Instagram")).toBeTruthy();
    expect(screen.getByText("Promoção de outubro")).toBeTruthy();
    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://cdn/ad.jpg");
    const link = screen.getByRole("link", { name: /Ver anúncio/ });
    expect(link.getAttribute("href")).toBe("https://www.instagram.com/p/abc");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("still shows the origin when the ad has no title, picture or link", () => {
    const { container } = renderBanner({ platform: null, title: null, sourceUrl: null, imageUrl: null });
    expect(screen.getByText("Veio de um anúncio")).toBeTruthy();
    expect(screen.getByText("Anúncio sem título")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("names the campaign and the estimated lead cost for people who may read ads", async () => {
    workspace.granted = ["ads:read"];
    originLookup.mockResolvedValue({
      data: {
        adId: "ad-1",
        adName: "Anúncio A",
        adSetName: "Conjunto SP",
        campaignName: "Outubro",
        accountName: "Loja",
        currency: "BRL",
        day: "2026-10-01",
        daySpend: 30_000_000,
        dayConversations: 4,
        estimatedLeadCost: 7_500_000,
      },
    });
    renderBanner(instagramAd, { entryType: "whatsapp", entryId: "e1" });
    await waitFor(() => expect(screen.getByText("Outubro › Conjunto SP › Anúncio A")).toBeTruthy());
    expect(screen.getByText(/Custo estimado do lead: R\$\s7,50/)).toBeTruthy();
    expect(originLookup).toHaveBeenCalledWith("whatsapp", "e1");
  });

  it("renders exactly what it did before when the ad is not in a connected account", async () => {
    workspace.granted = ["ads:read"];
    originLookup.mockResolvedValue({ error: "not found", status: 404 });
    const { container } = renderBanner(instagramAd, { entryType: "whatsapp", entryId: "e1" });
    await waitFor(() => expect(originLookup).toHaveBeenCalled());
    expect(screen.queryByText(/Custo estimado/)).toBeNull();
    expect(container.firstElementChild?.className).toContain("h-14");
  });

  it("never asks for ad data without ads:read or while permissions load", () => {
    renderBanner(instagramAd, { entryType: "whatsapp", entryId: "e1" });
    workspace.permissionsLoading = true;
    workspace.granted = ["ads:read"];
    renderBanner(instagramAd, { entryType: "whatsapp", entryId: "e2" });
    expect(originLookup).not.toHaveBeenCalled();
  });
});
