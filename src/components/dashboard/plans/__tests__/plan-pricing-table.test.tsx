import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { describe, expect, it } from "vitest";

import pt from "@/i18n/messages/pt.json";

import { PlanEstimatesPanel, PlanPricingTable } from "../UserPlansCatalog";

const item = (category: string, service: string, metric: string, priceMicros: number, markupPct?: number) => ({
  category,
  service,
  metric,
  priceMicros,
  markupPct,
  currency: "USD",
});

const items = [
  item("whatsapp", "marketing", "per_message", 66_667),
  item("whatsapp", "service", "per_message", 0),
  item("telephony", "sip_calls", "per_minute", 0),
  item("telephony", "whatsapp_calls", "per_minute", 13_333),
  item("llm", "default_markup", "percentage", 0, 0),
  item("exchange_rate", "usd_to_brl", "per_unit", 6_000_000),
];

function Table() {
  const t = useTranslations("plansPage");
  return <PlanPricingTable items={items} exchangeRate={6} locale="pt" t={t} />;
}

function Estimates() {
  const t = useTranslations("plansPage");
  return <PlanEstimatesPanel basePriceBRLCents={10_000} items={items} exchangeRate={6} locale="pt" t={t} />;
}

function renderWithMessages(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="pt" messages={pt}>
      {node}
    </NextIntlClientProvider>,
  );
}

describe("PlanPricingTable", () => {
  it("shows prices in reais only, with free uses and the model cost said plainly", () => {
    renderWithMessages(<Table />);
    expect(screen.queryByRole("columnheader", { name: "USD" })).toBeNull();
    expect(screen.getByRole("columnheader", { name: "Preço" })).toBeTruthy();

    const marketing = screen.getByRole("row", { name: /Marketing \(ofertas e novidades\)/ });
    expect(within(marketing).getByText(/R\$\s?0,40/)).toBeTruthy();
    const service = screen.getByRole("row", { name: /Atendimento \(respostas ao cliente\)/ });
    expect(within(service).getByText("Grátis")).toBeTruthy();
    const ai = screen.getByRole("row", { name: /Modelos de IA/ });
    expect(within(ai).getByText("Preço de custo do modelo")).toBeTruthy();

    expect(screen.queryByText(/usd_to_brl/)).toBeNull();
    expect(screen.getByText(/US\$ 1 = R\$\s?6,00/)).toBeTruthy();
  });
});

describe("PlanEstimatesPanel", () => {
  it("says what the monthly amount buys in round numbers, skipping free uses", () => {
    renderWithMessages(<Estimates />);
    expect(screen.getByRole("heading", { name: /O que R\$\s?100,00 rendem por mês/ })).toBeTruthy();
    expect(screen.getByText("≈ 1.250")).toBeTruthy();
    expect(screen.getByText("Ligações pelo WhatsApp")).toBeTruthy();
    expect(screen.queryByText("Ligações pela linha telefônica")).toBeNull();
  });
});
