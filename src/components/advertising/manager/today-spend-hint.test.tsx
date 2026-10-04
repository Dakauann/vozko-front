import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { TodaySpendHint } from "./today-spend-hint";

const getAdsReportAction = vi.fn();

vi.mock("@/app/actions/advertising", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/actions/advertising")>()),
  getAdsReportAction: (...args: unknown[]) => getAdsReportAction(...args),
}));

function reportWith(spend: number) {
  return { data: { totals: { spend } } };
}

function renderHint(onShowToday = vi.fn(), accountId = "acc-1") {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <TodaySpendHint accountId={accountId} today="2026-10-04" currency="BRL" reloadToken={0} onShowToday={onShowToday} />
    </NextIntlClientProvider>,
  );
  return onShowToday;
}

describe("TodaySpendHint", () => {
  beforeEach(() => getAdsReportAction.mockReset());

  it("points out today's spend and switches to Hoje", async () => {
    getAdsReportAction.mockResolvedValue(reportWith(1_800_000));
    const onShowToday = renderHint();
    expect(await screen.findByText(/R\$\s1,80 gastos hoje não entram neste período/)).toBeTruthy();
    expect(getAdsReportAction).toHaveBeenCalledWith("acc-1", { level: "campaign", range: { since: "2026-10-04", until: "2026-10-04" } });
    fireEvent.click(screen.getByRole("button", { name: "Ver hoje" }));
    expect(onShowToday).toHaveBeenCalled();
  });

  it("stays out of the way when nothing was spent today", async () => {
    getAdsReportAction.mockResolvedValue(reportWith(0));
    renderHint(vi.fn(), "acc-2");
    await waitFor(() => expect(getAdsReportAction).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Ver hoje" })).toBeNull();
  });
});
