import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";
import type { CustomFieldDefinition } from "@/lib/crm/custom-fields";

import CustomFieldInput from "../CustomFieldInput";

function definition(overrides: Partial<CustomFieldDefinition>): CustomFieldDefinition {
  return {
    id: "f1",
    workspaceId: "ws",
    objectType: "lead",
    key: "interesses",
    label: "Interesses",
    type: "multiselect",
    options: ["Saúde", "Educação", "Esporte"],
    optionTones: { Saúde: "chart-2" },
    required: false,
    sensitive: false,
    position: 0,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

function renderInput(field: CustomFieldDefinition, value: unknown, onChange = vi.fn()) {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <CustomFieldInput field={field} value={value} onChange={onChange} />
    </NextIntlClientProvider>,
  );
  return onChange;
}

describe("CustomFieldInput", () => {
  it("edits a multiselect as toggles that keep the option order", () => {
    const onChange = renderInput(definition({}), ["Esporte"]);

    expect(screen.getByRole("group", { name: "Interesses" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Esporte" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Saúde" })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "Saúde" }));
    expect(onChange).toHaveBeenLastCalledWith(["Saúde", "Esporte"]);
  });

  it("clears a multiselect when the last choice is removed", () => {
    const onChange = renderInput(definition({}), ["Esporte"]);
    fireEvent.click(screen.getByRole("button", { name: "Esporte" }));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it("paints an option with its tone swatch", () => {
    renderInput(definition({}), []);
    const toned = screen.getByRole("button", { name: "Saúde" });
    expect(toned.querySelector("[data-tone='chart-2']")).not.toBeNull();
  });

  it("marks a required field in its label and shows the error", () => {
    render(
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <CustomFieldInput field={definition({ type: "text", required: true, label: "Escola" })} value="" onChange={vi.fn()} error="Obrigatório" />
      </NextIntlClientProvider>,
    );
    expect(screen.getByLabelText("Escola *")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Obrigatório")).toBeInTheDocument();
  });

  it("sends numbers as numbers and an empty number as no value", () => {
    const onChange = renderInput(definition({ type: "number", label: "Filhos" }), 2);
    fireEvent.change(screen.getByLabelText("Filhos"), { target: { value: "3" } });
    expect(onChange).toHaveBeenLastCalledWith(3);
    fireEvent.change(screen.getByLabelText("Filhos"), { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });
});
