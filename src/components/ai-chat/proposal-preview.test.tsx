import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { hasProposalPreview, ProposalPreview } from "./proposal-preview";

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

  it("renders the ad creative with budget and fee", () => {
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
      fee: 2500000,
      feeCurrency: "BRL",
      accountName: "Conta principal",
    });
    expect(screen.getByText("Promoção de inverno")).toBeTruthy();
    expect(document.querySelector('video[src="https://cdn/inverno.mp4"]')).toBeTruthy();
    expect(screen.getByText("Enviar mensagem no WhatsApp")).toBeTruthy();
    expect(screen.getByText("Quanto custa?")).toBeTruthy();
    expect(screen.getByText(/50,00/)).toBeTruthy();
    expect(screen.getByText(/2,50/)).toBeTruthy();
    expect(hasProposalPreview({ kind: "ad_creative", data: {} })).toBe(true);
  });

  it("only claims kinds it can draw", () => {
    expect(hasProposalPreview({ kind: "message", data: {} })).toBe(true);
    expect(hasProposalPreview({ kind: "deal", data: {} })).toBe(false);
    expect(hasProposalPreview(undefined)).toBe(false);
  });
});
