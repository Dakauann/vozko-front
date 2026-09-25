import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { ChartSkeleton } from "./primitives";

function renderSkeleton(height?: number) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ChartSkeleton height={height} />
    </NextIntlClientProvider>,
  );
}

describe("ChartSkeleton", () => {
  it("announces an indeterminate load, never a fake percentage", () => {
    renderSkeleton();

    const bar = screen.getByRole("progressbar", { name: ptMessages.metricsOps.common.loading });
    expect(bar).not.toHaveAttribute("aria-valuenow");
    expect(bar.closest("[aria-busy]")).toHaveAttribute("aria-busy", "true");
  });

  it("creeps toward the end without ever reaching it on its own", () => {
    renderSkeleton();

    const fill = screen.getByRole("progressbar").firstElementChild as HTMLElement;
    expect(fill.className).toContain("animate-progress-creep");
    expect(fill.className).toContain("motion-reduce:animate-none");
  });

  it("keeps the height of the content it stands in for", () => {
    const { container } = renderSkeleton(260);

    expect((container.firstElementChild as HTMLElement).style.height).toBe("260px");
  });
});
