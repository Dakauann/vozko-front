import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { hasProposalPreview, ProposalPreview } from "./proposal-preview";

const exchangeRate = vi.hoisted(() => ({ priceMicros: 5_000_000 as number | null }));

vi.mock("@/app/actions/pricing", () => ({
  getExchangeRateAction: () =>
    Promise.resolve({ item: exchangeRate.priceMicros === null ? null : { priceMicros: exchangeRate.priceMicros } }),
}));

function renderPreview(kind: string, data: unknown) {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ProposalPreview preview={{ kind, data }} />
    </NextIntlClientProvider>,
  );
}

describe("ProposalPreview", () => {
  it("renders the template bubble with the real values", () => {
    renderPreview("whatsapp_template", {
      name: "pedido_saiu",
      language: "pt_BR",
      components: [{ type: "BODY", text: "Olá {{1}}, pedido {{2}} saiu.", example: { body_text: [["Maria", "123"]] } }],
    });
    expect(screen.getByText("Olá Maria, pedido 123 saiu.")).toBeTruthy();
  });

  it("renders the exact message text and when it will go", () => {
    renderPreview("message", { text: "Bom dia, Maria!", channel: "instagram", scheduledAt: "2026-09-26T09:00:00-03:00" });
    expect(screen.getByText("Bom dia, Maria!")).toBeTruthy();
    expect(screen.getByText(/Agendada para/)).toBeTruthy();
    expect(screen.getByText("Instagram")).toBeTruthy();
  });

  it("renders the ad creative with budget and fee", async () => {
    renderPreview("ad_creative", {
      pageName: "Loja da Ana",
      format: "VIDEO",
      mediaUrl: "https://cdn/inverno.mp4",
      mediaKind: "video",
      callToAction: "WHATSAPP_MESSAGE",
      primaryText: "Promoção de inverno",
      headline: "Até 30% off",
      destination: "WHATSAPP",
      greeting: "Oi! Quero saber mais",
      iceBreakers: ["Quanto custa?"],
      dailyBudget: 5000,
      currency: "BRL",
      fee: 500000,
      feeCurrency: "USD",
      accountName: "Conta principal",
    });
    expect(screen.getAllByText("Promoção de inverno").length).toBeGreaterThan(0);
    expect(document.querySelector('video[src="https://cdn/inverno.mp4"]')).toBeTruthy();
    expect(screen.getAllByText("Enviar mensagem pelo WhatsApp").length).toBeGreaterThan(0);
    expect(screen.getByText(/50,00/)).toBeTruthy();
    const destination = screen.getByRole("tab", { name: "Destino" });
    fireEvent.mouseDown(destination);
    expect(await screen.findByText("Quanto custa?")).toBeTruthy();
    expect(screen.getByText("Oi! Quero saber mais")).toBeTruthy();
    expect(await screen.findByText(/R\$\s*2,50/)).toBeTruthy();
    expect(screen.queryByText(/US\$/)).toBeNull();
    expect(hasProposalPreview({ kind: "ad_creative", data: {} })).toBe(true);
  });

  it("shows the fee as pending while the exchange rate is unknown", async () => {
    exchangeRate.priceMicros = null;
    renderPreview("ad_creative", { pageName: "Loja da Ana", primaryText: "Oferta", fee: 500000, feeCurrency: "USD" });
    expect(await screen.findByText("…")).toBeTruthy();
    exchangeRate.priceMicros = 5_000_000;
  });

  it("shows the reference images of an image generation as thumbnails", () => {
    renderPreview("image_references", {
      references: [
        { mediaId: "m-1", url: "https://cdn/m-1.png" },
        { mediaId: "m-2", url: "https://cdn/m-2.jpg" },
      ],
    });
    expect(screen.getByText(ptMessages.aiChatPage.previews.references)).toBeTruthy();
    const thumbs = Array.from(document.querySelectorAll("img"));
    expect(thumbs.map((img) => img.getAttribute("src"))).toEqual(["https://cdn/m-1.png", "https://cdn/m-2.jpg"]);
  });

  it("only claims kinds it can draw", () => {
    expect(hasProposalPreview({ kind: "image_references", data: {} })).toBe(true);
    expect(hasProposalPreview({ kind: "message", data: {} })).toBe(true);
    expect(hasProposalPreview({ kind: "deal", data: {} })).toBe(false);
    expect(hasProposalPreview(undefined)).toBe(false);
  });

  it("shows the WhatsApp opening screen and whether Meta may change the creative", () => {
    renderPreview("ad_creative", {
      pageName: "Loja da Ana",
      format: "IMAGE",
      mediaUrl: "https://cdn/a.png",
      mediaKind: "image",
      primaryText: "Todos os canais",
      destination: "WHATSAPP",
      greeting: "Quero ver funcionando",
      iceBreakers: ["Quanto custa?"],
      enhancements: false,
    });
    expect(screen.getByText(ptMessages.aiChatPage.previews.ad.enhancementsOff)).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole("tab", { name: ptMessages.adsEditor.preview.destination }));
    fireEvent.click(screen.getByRole("tab", { name: ptMessages.adsEditor.preview.destination }));
    expect(screen.getByText("Quero ver funcionando")).toBeTruthy();
    expect(screen.getByText("Quanto custa?")).toBeTruthy();
  });
});
