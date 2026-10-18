import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import { BUTTON_TEXT_LIMIT, FOOTER_TEXT_LIMIT } from "@/lib/whatsapp-templates/builder";
import { BUTTON_ACTION_KINDS } from "@/lib/whatsapp-templates/exit";

import ComponentEditor from "../ComponentEditor";
import type { DraggableComponent } from "../DragDropBuilder";

const exit = ptMessages.templateExit;
const onChange = vi.fn();

function renderEditor(component: DraggableComponent, allowedKinds: readonly string[] = BUTTON_ACTION_KINDS) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ComponentEditor component={component} onChange={onChange} category="MARKETING" allowedKinds={allowedKinds} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => onChange.mockReset());

describe("ComponentEditor exit settings", () => {
  it("gives each quick reply an action under its text", async () => {
    renderEditor({ id: "b", type: "BUTTONS", data: { buttons: [{ id: "q", type: "QUICK_REPLY", text: "SAIR" }] } });
    fireEvent.click(screen.getByRole("combobox", { name: exit.action.label }));
    fireEvent.click(await screen.findByRole("option", { name: exit.kinds.opt_out }));
    expect(onChange).toHaveBeenCalledWith({
      id: "b",
      type: "BUTTONS",
      data: { buttons: [{ id: "q", type: "QUICK_REPLY", text: "SAIR", action: { kind: "opt_out", params: {}, confirmation: "" } }] },
    });
  });

  it("offers only the quick reply actions the server allows this viewer", async () => {
    renderEditor({ id: "b", type: "BUTTONS", data: { buttons: [{ id: "q", type: "QUICK_REPLY", text: "SAIR" }] } }, ["hand_off", "opt_out"]);
    fireEvent.click(screen.getByRole("combobox", { name: exit.action.label }));
    const names = (await screen.findAllByRole("option")).map((option) => option.textContent);
    expect(names).toEqual([exit.kinds.none, exit.kinds.opt_out, exit.kinds.hand_off]);
  });

  it("offers no action while the allowed kinds are unknown", async () => {
    renderEditor({ id: "b", type: "BUTTONS", data: { buttons: [{ id: "q", type: "QUICK_REPLY", text: "SAIR" }] } }, []);
    fireEvent.click(screen.getByRole("combobox", { name: exit.action.label }));
    const names = (await screen.findAllByRole("option")).map((option) => option.textContent);
    expect(names).toEqual([exit.kinds.none]);
  });

  it("explains that the footer text shows the exit and keeps only the exit confirmation", () => {
    renderEditor({ id: "f", type: "FOOTER", data: { text: "Digite /sair para sair" } });
    expect(screen.getByText(exit.builder.footerHint)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /adicionar/i })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(exit.confirmation.label), { target: { value: "Pronto, você saiu." } });
    expect(onChange).toHaveBeenCalledWith({
      id: "f",
      type: "FOOTER",
      data: { text: "Digite /sair para sair", exitConfirmation: "Pronto, você saiu." },
    });
  });
});

describe("ComponentEditor text limits", () => {
  it("caps the footer at the shared footer limit", () => {
    renderEditor({ id: "f", type: "FOOTER", data: { text: "" } });
    expect(screen.getAllByRole("textbox")[0]).toHaveAttribute("maxLength", String(FOOTER_TEXT_LIMIT));
  });

  it.each(["QUICK_REPLY", "URL", "PHONE_NUMBER"] as const)("caps a %s button text at the shared button limit", (type) => {
    renderEditor({ id: "b", type: "BUTTONS", data: { buttons: [{ id: "x", type, text: "" }] } });
    expect(screen.getAllByRole("textbox")[0]).toHaveAttribute("maxLength", String(BUTTON_TEXT_LIMIT));
  });
});
