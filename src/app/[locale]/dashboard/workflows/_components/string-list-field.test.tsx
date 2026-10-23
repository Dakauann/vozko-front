import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { StringListField } from "./string-list-field";

const copy = ptMessages.workflowsPage.stringList;

function renderField(value: string[], onChange = vi.fn()) {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
      <StringListField label="Eventos aceitos" value={value} onChange={onChange} />
    </NextIntlClientProvider>,
  );
  return onChange;
}

describe("StringListField", () => {
  it("adds a typed value on Enter and on the button", () => {
    const onChange = renderField(["pedido_pago"]);
    const input = screen.getByLabelText("Eventos aceitos");
    fireEvent.change(input, { target: { value: " carrinho " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith(["pedido_pago", "carrinho"]);
    fireEvent.change(input, { target: { value: "boleto" } });
    fireEvent.click(screen.getByRole("button", { name: copy.add }));
    expect(onChange).toHaveBeenLastCalledWith(["pedido_pago", "boleto"]);
  });

  it("removes a value and says an empty list accepts everything", () => {
    const onChange = renderField(["pedido_pago"]);
    fireEvent.click(screen.getByRole("button", { name: "Remover pedido_pago" }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("explains the empty list", () => {
    renderField([]);
    expect(screen.getByText(copy.empty)).toBeInTheDocument();
  });
});
