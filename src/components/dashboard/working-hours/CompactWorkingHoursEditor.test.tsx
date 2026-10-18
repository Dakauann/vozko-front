import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { WorkingHoursSpec } from "@/lib/working-hours/types";

import { CompactWorkingHoursEditor } from "./WorkingHoursEditor";

const weekdays: WorkingHoursSpec = {
  timezone: "America/Sao_Paulo",
  days: Object.fromEntries(["mon", "tue", "wed", "thu", "fri"].map((day) => [day, [{ start: "09:00", end: "18:00" }]])),
};
const wh = ptMessages.workingHours;

function renderEditor(onChange = vi.fn()) {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
      <CompactWorkingHoursEditor value={weekdays} onChange={onChange} />
    </NextIntlClientProvider>,
  );
  return onChange;
}

describe("CompactWorkingHoursEditor", () => {
  it("shows the hours as one summary line and never offers turning them off", () => {
    renderEditor();

    expect(screen.getByText("Seg a Sex, das 09:00 às 18:00")).toBeInTheDocument();
    expect(screen.getByText("America/Sao Paulo")).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(wh.startLabel)).not.toBeInTheDocument();
  });

  it("opens a day by pressing its chip", () => {
    const onChange = renderEditor();

    fireEvent.click(screen.getByRole("button", { name: wh.editHours }));
    const saturday = screen.getByRole("button", { name: wh.days.sat });
    expect(saturday).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(saturday);

    expect(onChange).toHaveBeenCalledWith({ ...weekdays, days: { ...weekdays.days, sat: [{ start: "09:00", end: "18:00" }] } });
  });

  it("edits a window inline", () => {
    const onChange = renderEditor();

    fireEvent.click(screen.getByRole("button", { name: wh.editHours }));
    fireEvent.change(screen.getAllByLabelText(wh.endLabel)[0], { target: { value: "17:00" } });

    expect(onChange).toHaveBeenCalledWith({ ...weekdays, days: { ...weekdays.days, mon: [{ start: "09:00", end: "17:00" }] } });
  });
});
