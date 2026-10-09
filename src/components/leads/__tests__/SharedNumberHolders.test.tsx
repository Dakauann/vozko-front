import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";
import type { SharedNumber } from "@/lib/leads/detail-summary";

import { SharedNumberHolders } from "../SharedNumberHolders";

function renderHolders(shared: SharedNumber | undefined, variant: "row" | "sheet", linked = false) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <SharedNumberHolders shared={shared} variant={variant} linked={linked} />
    </NextIntlClientProvider>,
  );
}

const shared: SharedNumber = {
  number: "551141990000",
  holders: [
    { leadId: "lead-2", name: "João Souza" },
    { leadId: "lead-3", name: "Bruna Souza" },
  ],
  more: false,
};

describe("SharedNumberHolders", () => {
  it("names the other holders on the detail row, each one a link to its lead", () => {
    const { container } = renderHolders(shared, "row", true);
    expect(container).toHaveTextContent("também de João Souza e Bruna Souza");
    expect(screen.getByRole("link", { name: "João Souza" })).toHaveAttribute("href", "/dashboard/leads/lead-2");
    expect(screen.getByRole("link", { name: "Bruna Souza" })).toHaveAttribute("href", "/dashboard/leads/lead-3");
  });

  it("names the other holders in the sheet without leaving it", () => {
    const { container } = renderHolders(shared, "sheet");
    expect(container).toHaveTextContent("Este telefone também está em João Souza e Bruna Souza.");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("says there are others beyond the names shown", () => {
    const { container } = renderHolders({ ...shared, more: true }, "row");
    expect(container).toHaveTextContent("também de João Souza, Bruna Souza e outros");
  });

  it("names an unnamed holder by its number, or as a lead without a name", () => {
    const { container } = renderHolders(
      { number: "551141990000", holders: [{ leadId: "lead-4", number: "5511900023301" }, { leadId: "lead-5" }], more: false },
      "row",
    );
    expect(container).toHaveTextContent("também de +55 (11) 90002-3301 e Lead sem nome");
  });

  it("shows nothing for a number nobody else holds", () => {
    const { container } = renderHolders(undefined, "row");
    expect(container).toBeEmptyDOMElement();
  });
});
