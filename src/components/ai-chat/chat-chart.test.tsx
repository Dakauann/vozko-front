import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { ChatChart, ChatChartType } from "@/lib/aichat/types";

import { ChatChartView } from "./chat-chart";

function renderChart(chart: ChatChart) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ChatChartView chart={chart} />
    </NextIntlClientProvider>,
  );
}

const base: ChatChart = {
  type: "bar",
  title: "Finalizadas por mês",
  subtitle: "01/09 a 25/09",
  xLabel: "Mês",
  xKind: "date",
  categories: ["2026-08", "2026-09"],
  series: [{ key: "frt", label: "FRT", kind: "minutes", values: [12.5, null] }],
};

const chartLabels = ptMessages.aiChatPage.chart;

describe("ChatChartView", () => {
  const types: ChatChartType[] = ["bar", "horizontal_bar", "stacked_bar", "line", "area", "stacked_area", "radar"];
  it.each(types)("mounts a %s chart with its title", (type) => {
    renderChart({ ...base, type, categories: ["a", "b", "c"], series: [{ ...base.series[0], values: [1, 2, 3] }] });
    expect(screen.getByText("Finalizadas por mês")).toBeInTheDocument();
  });

  it("offers the table the low-contrast palette obliges, with values formatted by kind", () => {
    renderChart(base);
    fireEvent.click(screen.getByRole("button", { name: chartLabels.showTable }));
    const table = screen.getByRole("table");
    expect(table).toHaveTextContent("12,5 min");
    // A missing value is shown as missing, never as zero.
    expect(table).toHaveTextContent(ptMessages.metricsOps.common.na);
    fireEvent.click(screen.getByRole("button", { name: chartLabels.showChart }));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("opens a table chart as a table without a toggle", () => {
    renderChart({ ...base, type: "table" });
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: chartLabels.showChart })).not.toBeInTheDocument();
  });

  it("names the folded pie slice in the reader's language", () => {
    renderChart({
      ...base,
      type: "donut",
      categories: ["Plano", "__other__"],
      series: [{ key: "n", label: "Conversas", kind: "number", values: [3, 9] }],
    });
    expect(screen.getByText(chartLabels.other)).toBeInTheDocument();
  });

  it("mounts a scatter on numeric x values", () => {
    renderChart({ ...base, type: "scatter", categories: undefined, xKind: "number", xValues: [1, 2] });
    expect(screen.getByText("Finalizadas por mês")).toBeInTheDocument();
  });
});
