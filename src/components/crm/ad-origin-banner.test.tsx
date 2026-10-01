import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import pt from "@/i18n/messages/pt.json";
import type { AdOrigin } from "@/lib/conversations/ad-origin";

import { AdOriginBanner } from "./ad-origin-banner";

function renderBanner(origin: AdOrigin) {
  return render(
    <NextIntlClientProvider locale="pt" messages={pt}>
      <AdOriginBanner origin={origin} />
    </NextIntlClientProvider>,
  );
}

describe("AdOriginBanner", () => {
  it("says which ad brought the contact, with its picture and a link", () => {
    const { container } = renderBanner({
      platform: "instagram",
      title: "Promoção de outubro",
      sourceUrl: "https://www.instagram.com/p/abc",
      imageUrl: "https://cdn/ad.jpg",
    });
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
});
