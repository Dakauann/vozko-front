import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { PinnedOutputSection } from "./pinned-output-section";

function renderSection(props: Partial<ComponentProps<typeof PinnedOutputSection>> = {}) {
  const onChange = vi.fn();
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="UTC">
      <PinnedOutputSection nodeId="n55" pin={undefined} edgeLabels={["success", "error"]} unsaved={false} onChange={onChange} {...props} />
    </NextIntlClientProvider>,
  );
  return onChange;
}

const pin = { output: { status_code: 200 }, edge: "success", source: "run:abcdef123456", pinned_at: "2026-10-20T12:00:00Z" };

describe("PinnedOutputSection", () => {
  it("says the pin is for tests only and never published", () => {
    renderSection();
    expect(screen.getByText("Usada só nos testes. Não vai para a versão publicada.")).toBeInTheDocument();
  });

  it("pins a hand written output with the chosen connection", () => {
    const onChange = renderSection();
    fireEvent.click(screen.getByRole("button", { name: "Fixar saída à mão" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: '{"ok": true}' } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(onChange).toHaveBeenCalledWith("n55", expect.objectContaining({ output: { ok: true }, source: "manual" }));
    expect(onChange.mock.calls[0][1].edge).toBeUndefined();
  });

  it("refuses JSON that is not an object and keeps the editor open", () => {
    const onChange = renderSection();
    fireEvent.click(screen.getByRole("button", { name: "Fixar saída à mão" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "[1]" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("A saída precisa ser um objeto JSON, entre chaves.");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows where an existing pin came from and clears it", () => {
    const onChange = renderSection({ pin });
    expect(screen.getByText("Copiada da execução abcdef12")).toBeInTheDocument();
    expect(screen.getByText("success")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remover saída fixada" }));
    expect(onChange).toHaveBeenCalledWith("n55", null);
  });

  it("edits an existing pin starting from its output, and the edit becomes a manual pin", () => {
    const onChange = renderSection({ pin });
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe('{\n  "status_code": 200\n}');
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(onChange).toHaveBeenCalledWith("n55", expect.objectContaining({ output: { status_code: 200 }, edge: "success", source: "manual" }));
  });

  it("shows a withheld pin as a hidden output, read-only, never editable as null", () => {
    const onChange = renderSection({ pin: { output: null, withheld: true, source: "run:abcdef123456", pinned_at: "2026-10-20T12:00:00Z" } });
    expect(screen.getByText("Saída oculta")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remover saída fixada" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Fixar saída à mão" })).toBeNull();
    expect(screen.queryByText("null")).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});
