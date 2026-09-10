import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import { DataChart, Sparkline } from "./dense-charts";

const chart = vi.hoisted(() => ({ setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() }));
vi.mock("./echarts-runtime", () => ({ init: () => chart }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("chart accessibility and lifecycle", () => {
  it("provides exact values in a keyboard-accessible table and disposes the renderer", async () => {
    const view = render(<NextIntlClientProvider locale="en" messages={{ denseCharts: { viewData: "View data", unavailable: "Chart unavailable" } }}>
      <DataChart label="Volume" option={{}} columns={["Day", "Comments"]} rows={[["2026-09-01", 123]]} />
    </NextIntlClientProvider>);
    await waitFor(() => expect(chart.setOption).toHaveBeenCalled());
    expect(screen.getByRole("img", { name: "Volume" })).toBeInTheDocument();
    expect(screen.getByText("View data").tagName).toBe("SUMMARY");
    expect(screen.getByText("123")).toBeInTheDocument();
    view.unmount();
    expect(chart.dispose).toHaveBeenCalledOnce();
  });
  it("re-resolves chart colours when the page theme changes", async () => {
    render(<NextIntlClientProvider locale="en" messages={{ denseCharts: { viewData: "View data", unavailable: "Chart unavailable" } }}>
      <DataChart label="Volume" option={{}} columns={[]} rows={[]} />
    </NextIntlClientProvider>);
    await waitFor(() => expect(chart.setOption).toHaveBeenCalledOnce());
    document.documentElement.classList.toggle("dark");
    await waitFor(() => expect(chart.setOption).toHaveBeenCalledTimes(2));
    document.documentElement.classList.remove("dark");
  });
});

describe("sparse mini charts", () => {
  it("breaks the line over absent days and null measurements", () => {
    const { container } = render(<Sparkline label="Daily score" points={[
      { date: "2026-09-01", value: 10 }, { date: "2026-09-03", value: 20 },
      { date: "2026-09-04", value: null }, { date: "2026-09-05", value: 30 },
    ]} />);
    const path = container.querySelectorAll("path")[1].getAttribute("d")!;
    expect(path.match(/M/g)).toHaveLength(3);
    expect(path).not.toContain("L");
  });
  it("renders a single observation as a visible dot and no observations as an empty track", () => {
    const { container, rerender } = render(<Sparkline label="Daily score" points={[{ date: "2026-09-01", value: 0 }]} />);
    expect(container.querySelector("circle")).toHaveAttribute("r", "3");
    rerender(<Sparkline label="Daily score" points={[]} />);
    expect(container.querySelector("svg")).toBeNull();
  });
});
