import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import { AttendanceSectionError } from "@/lib/attendance/sections";

import { SectionState } from "./section-state";

function renderState(query: Parameters<typeof SectionState>[0]["query"]) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <SectionState query={query}>
        <p>conteúdo</p>
      </SectionState>
    </NextIntlClientProvider>,
  );
}

describe("SectionState", () => {
  it("shows the section while it has not failed", () => {
    renderState({ isError: false, error: null, isFetching: false, refetch: vi.fn() });
    expect(screen.getByText("conteúdo")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("replaces a failed section with an error instead of an empty chart", () => {
    renderState({ isError: true, error: new AttendanceSectionError("boom", 500), isFetching: false, refetch: vi.fn() });
    expect(screen.queryByText("conteúdo")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(ptMessages.metricsOps.common.sectionError);
  });

  it("says the server is busy on a 503", () => {
    renderState({ isError: true, error: new AttendanceSectionError("busy", 503), isFetching: false, refetch: vi.fn() });
    expect(screen.getByRole("alert")).toHaveTextContent(ptMessages.metricsOps.common.sectionBusy);
  });

  it("retries only this section", () => {
    const refetch = vi.fn();
    renderState({ isError: true, error: new AttendanceSectionError("boom"), isFetching: false, refetch });
    fireEvent.click(screen.getByRole("button", { name: ptMessages.metricsOps.common.retry }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
