import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";
import type { PlanDefinition, PlanPricingItem } from "@/lib/workspace-plan/types";

import { PlanCard } from "../plan-card";

const pricing = (category: string, service: string, metric: string, priceMicros: number) =>
  ({ id: service, planDefinitionId: "p1", category, service, metric, priceMicros, currency: "USD", createdAt: "", updatedAt: "" }) as PlanPricingItem;

const plan = {
  id: "p1",
  name: "Plano Professional",
  description: "",
  basePriceBRLCents: 10_000,
  maxCallChannels: 0,
  includedWhatsAppBusinessPhones: 1,
  isGloballyVisible: true,
  createdAt: "",
  updatedAt: "",
  pricingItems: [
    pricing("whatsapp", "marketing", "per_message", 66_667),
    pricing("telephony", "whatsapp_calls", "per_minute", 13_333),
    pricing("llm", "default_markup", "percentage", 0),
    pricing("exchange_rate", "usd_to_brl", "per_unit", 6_000_000),
  ],
} as PlanDefinition;

function renderCard(props: Partial<Parameters<typeof PlanCard>[0]> = {}) {
  return render(
    <NextIntlClientProvider locale="pt" messages={pt}>
      <PlanCard plan={plan} locale="pt" {...props} />
    </NextIntlClientProvider>,
  );
}

describe("PlanCard", () => {
  it("says what the plan includes without listing per-service prices", () => {
    renderCard();
    expect(screen.getByRole("heading", { name: "Plano Professional" })).toBeTruthy();
    expect(screen.getByText(/R\$\s?100,00 de saldo por mês/)).toBeTruthy();
    expect(screen.getByText("1 número de WhatsApp incluído")).toBeTruthy();
    expect(screen.getByText("Mensagens pela API oficial do WhatsApp")).toBeTruthy();
    expect(screen.getByText("Ligações pelo WhatsApp e pelas suas linhas telefônicas")).toBeTruthy();
    expect(screen.getByText("IA para agentes e análises das conversas")).toBeTruthy();
    expect(screen.queryByText("Sem descrição cadastrada.")).toBeNull();
    expect(screen.queryByText(/por mensagem|por minuto|R\$\s?0,40/)).toBeNull();
  });

  it("marks the featured and the current plan", () => {
    renderCard({ featured: "popular", current: true });
    expect(screen.getByText("Mais popular")).toBeTruthy();
    expect(screen.getByText("Seu plano")).toBeTruthy();
  });

  it("offers the detailed prices only where a details view exists", () => {
    const { unmount } = renderCard();
    expect(screen.queryByRole("button", { name: "Ver preço de cada uso" })).toBeNull();
    unmount();
    const onShowDetails = vi.fn();
    renderCard({ onShowDetails });
    fireEvent.click(screen.getByRole("button", { name: "Ver preço de cada uso" }));
    expect(onShowDetails).toHaveBeenCalled();
  });
});
