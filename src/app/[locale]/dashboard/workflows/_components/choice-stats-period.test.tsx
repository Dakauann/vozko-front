import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import messages from "@/i18n/messages/pt.json";

import { ChoiceStatsPeriodChip } from "./choice-stats-period";
import { ChoiceStatsContext, createChoiceStatsStore, settleChoiceStats, type CanvasChoiceStatsResult } from "./choice-stats-store";

function renderChip(result: CanvasChoiceStatsResult | null, onChange = vi.fn(), onRetry = vi.fn()) {
  const store = createChoiceStatsStore();
  if (result) store.set(settleChoiceStats(store.get(), result));
  const wrap = (children: ReactNode) => (
    <NextIntlClientProvider locale="pt" messages={messages} timeZone="America/Sao_Paulo">
      <ChoiceStatsContext.Provider value={store}>{children}</ChoiceStatsContext.Provider>
    </NextIntlClientProvider>
  );
  render(wrap(<ChoiceStatsPeriodChip period="30d" onChange={onChange} onRetry={onRetry} />));
  return { onChange, onRetry };
}

describe("ChoiceStatsPeriodChip", () => {
  it("offers 7, 30 and 90 days with the current one pressed", () => {
    const { onChange } = renderChip(null);
    expect(screen.getByRole("button", { name: "30 dias" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "7 dias" }));
    expect(onChange).toHaveBeenCalledWith("7d");
  });

  it("says when the numbers could not be read", () => {
    renderChip({ status: "unreadable" });
    expect(screen.getByRole("status")).toHaveAccessibleName("Não foi possível ler o desempenho; os números ficam ocultos.");
  });

  it("translates a refusal by its code and offers a retry", () => {
    const { onRetry } = renderChip({ status: "failed", message: "raw", code: "invalid_period" });
    const mark = screen.getByRole("button", { name: /Período inválido/ });
    fireEvent.click(mark);
    expect(onRetry).toHaveBeenCalled();
  });
});
