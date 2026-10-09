import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { LeadViewToggle } from "../LeadViewToggle";

function renderToggle(value: "table" | "map", onChange = vi.fn()) {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <LeadViewToggle value={value} onChange={onChange} />
    </NextIntlClientProvider>,
  );
  return onChange;
}

describe("LeadViewToggle", () => {
  it("offers Tabela and Mapa in that order, under one label", () => {
    renderToggle("table");
    const group = screen.getByRole("group", { name: "Ver como" });
    expect(Array.from(group.querySelectorAll("button")).map((button) => button.textContent)).toEqual(["Tabela", "Mapa"]);
    expect(screen.getByRole("button", { name: "Tabela" })).toHaveAttribute("aria-pressed", "true");
  });

  it("switches to the map", () => {
    const onChange = renderToggle("table");
    fireEvent.click(screen.getByRole("button", { name: "Mapa" }));
    expect(onChange).toHaveBeenCalledWith("map");
  });
});
