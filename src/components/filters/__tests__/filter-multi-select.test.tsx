import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import enMessages from "@/i18n/messages/en.json";

import { FilterMultiSelect } from "../filter-multi-select";

function renderOpen() {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <FilterMultiSelect
        triggerLabel="Status"
        icon={<span />}
        options={[
          { value: "a", label: "Aberto" },
          { value: "b", label: "Fechado" },
        ]}
        selected={["a"]}
        onToggle={vi.fn()}
        onClear={vi.fn()}
        searchPlaceholder="Buscar"
        emptyMessage="Nada"
      />
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: /Status/ }));
}

describe("FilterMultiSelect", () => {
  it("draws the check in dark ink on the green box", () => {
    renderOpen();
    const row = screen.getByRole("option", { name: /Aberto/ });
    const check = row.querySelector("svg");
    expect(check).not.toBeNull();
    expect(check!.getAttribute("class")).toContain("text-primary-foreground");
    expect(check!.getAttribute("class")).not.toContain("text-white");
  });

  it("takes the clear label from the viewer's locale", () => {
    renderOpen();
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });
});
