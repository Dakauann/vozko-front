import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { BindingChoice, BindingSource, VariableBinding } from "@/lib/leads/sends";

import { VariableBindingFields } from "../VariableBindingFields";

const sources = ptMessages.leadSends.bindings.sources;

const CHOICES: BindingChoice[] = [
  { source: "literal" },
  { source: "lead.first_name" },
  { source: "lead.district" },
  { source: "lead.custom:interesse" },
];

const LABELS: Record<string, string> = {
  literal: sources.literal,
  "lead.first_name": sources.firstName,
  "lead.district": sources.district,
  "lead.custom:interesse": "Campo: Interesse",
};

function renderBindings(values: VariableBinding[], onChange = vi.fn()) {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <VariableBindingFields
        slots={["1", "2"]}
        binding={{ choices: CHOICES, values, onChange, labelOf: (source: BindingSource) => LABELS[source] ?? source }}
      />
    </NextIntlClientProvider>,
  );
  return onChange;
}

function sourcePicker(slot: string) {
  return screen.getByRole("combobox", { name: ptMessages.leadSends.bindings.source.replace("{slot}", `{{${slot}}}`) });
}

describe("VariableBindingFields", () => {
  it("shows where each variable comes from", () => {
    renderBindings([{ source: "lead.first_name" }, { source: "literal", value: "Prisma" }]);
    expect(sourcePicker("1")).toHaveTextContent(sources.firstName);
    expect(sourcePicker("2")).toHaveTextContent(sources.literal);
    expect(screen.getByRole("textbox", { name: ptMessages.leadSends.bindings.literalValue.replace("{slot}", "{{2}}") })).toHaveValue("Prisma");
    expect(screen.queryByRole("textbox", { name: ptMessages.leadSends.bindings.literalValue.replace("{slot}", "{{1}}") })).toBeNull();
  });

  it("binds a variable to a lead field", async () => {
    const onChange = renderBindings([{ source: "lead.first_name" }, { source: "literal", value: "" }]);
    fireEvent.keyDown(sourcePicker("2"), { key: "ArrowDown" });
    const list = await screen.findByRole("listbox");
    fireEvent.keyDown(within(list).getByRole("option", { name: "Campo: Interesse" }), { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(1, { source: "lead.custom:interesse" });
  });

  it("keeps the typed fixed text", () => {
    const onChange = renderBindings([{ source: "lead.first_name" }, { source: "literal", value: "" }]);
    fireEvent.change(screen.getByRole("textbox", { name: ptMessages.leadSends.bindings.literalValue.replace("{slot}", "{{2}}") }), {
      target: { value: "Unidade Norte" },
    });
    expect(onChange).toHaveBeenCalledWith(1, { source: "literal", value: "Unidade Norte" });
  });

  it("starts a fixed text empty when the source switches to it", async () => {
    const onChange = renderBindings([{ source: "lead.first_name" }, { source: "lead.district" }]);
    fireEvent.keyDown(sourcePicker("1"), { key: "ArrowDown" });
    const list = await screen.findByRole("listbox");
    fireEvent.keyDown(within(list).getByRole("option", { name: sources.literal }), { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(0, { source: "literal", value: "" });
  });
});
