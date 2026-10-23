import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import messages from "@/i18n/messages/pt.json";
import { readWorkflowChoiceStats } from "@/lib/choice-stats/stats";

import { ChoiceStatsSection } from "./choice-stats-section";
import { ChoiceStatsContext, createChoiceStatsStore, settleChoiceStats, type CanvasChoiceStatsResult } from "./choice-stats-store";

const MENU = {
  nodeId: "menu",
  sends: 1742,
  clickedPrompts: 1394,
  clickRate: 8003,
  freeText: { count: 87, rate: 499 },
  options: [
    { optionId: "sim", shown: 1742, clicks: 244, ctr: 1400 },
    { optionId: "velho", shown: 0, clicks: 0, ctr: 0 },
  ],
};

function ready(nodes: unknown[]): CanvasChoiceStatsResult {
  return { status: "ready", stats: readWorkflowChoiceStats({ from: "2026-09-23", to: "2026-10-22", timezone: "America/Sao_Paulo", version: null, nodes })! };
}

function renderSection(result: CanvasChoiceStatsResult | null, saved = true) {
  const store = createChoiceStatsStore();
  if (result) store.set(settleChoiceStats(store.get(), result));
  return render(
    <NextIntlClientProvider locale="pt" messages={messages} timeZone="America/Sao_Paulo">
      <ChoiceStatsContext.Provider value={store}>
        <ChoiceStatsSection nodeId="menu" saved={saved} optionLabel={(id) => (id === "sim" ? "Sim, quero" : null)} />
      </ChoiceStatsContext.Provider>
    </NextIntlClientProvider>,
  );
}

describe("ChoiceStatsSection", () => {
  it("lists every option with shown, clicks and CTR, plus free text", () => {
    renderSection(ready([MENU]));
    const section = screen.getByRole("region", { name: "Desempenho" });
    expect(within(section).getByText("Envios").nextElementSibling).toHaveTextContent("1.742");
    expect(within(section).getByText("80,0%")).toBeInTheDocument();
    expect(within(section).getByText("5,0%")).toBeInTheDocument();
    const row = screen.getByRole("row", { name: /Sim, quero/ });
    expect(row).toHaveTextContent("244");
    expect(row).toHaveTextContent("CTR 14,0%");
    expect(screen.getByRole("row", { name: /Opção velho/ })).toHaveTextContent("CTR n/d");
  });

  it("shows n/d when the node had no sends in the period", () => {
    renderSection(ready([]));
    expect(screen.getByText("Nenhum envio deste nó no período.")).toBeInTheDocument();
    expect(screen.getAllByText("n/d").length).toBeGreaterThan(0);
  });

  it("says the numbers are unreadable instead of showing zeros", () => {
    renderSection({ status: "unreadable" });
    expect(screen.getByText(/não são mostrados/)).toBeInTheDocument();
    expect(screen.queryByText("0")).toBeNull();
  });

  it("translates a refusal by its code", () => {
    renderSection({ status: "failed", message: "raw", code: "choice_stats_unavailable" });
    expect(screen.getByText(/indisponíveis agora/)).toBeInTheDocument();
  });

  it("asks to save an unsaved workflow first", () => {
    renderSection(null, false);
    expect(screen.getByText("Salve o fluxo para ver o desempenho deste nó.")).toBeInTheDocument();
  });
});
