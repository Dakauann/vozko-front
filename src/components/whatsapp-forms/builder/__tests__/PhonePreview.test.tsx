import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { Block, Document, Screen } from "@/lib/whatsapp-forms/types";

vi.mock("@/app/actions/medias", () => ({
  fetchMediaFileAction: vi.fn(() => new Promise(() => {})),
}));

import { PhonePreview } from "../PhonePreview";

function screenWith(blocks: Block[]): Screen {
  return { key: "s_preview0", title: "Seus dados", submitLabel: "Continuar", route: {}, blocks };
}

function show(blocks: Block[], extra: Partial<ComponentProps<typeof PhonePreview>> = {}) {
  const shown = screenWith(blocks);
  const document: Document = { schema: 1, categories: [], screens: [shown] };
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
      <PhonePreview document={document} screen={shown} {...extra} />
    </NextIntlClientProvider>,
  );
}

const field = (kind: NonNullable<Block["field"]>["kind"], extra: Partial<NonNullable<Block["field"]>> = {}): Block => ({
  key: `b_${kind}`,
  field: { key: `f_${kind}`, kind, label: `Rótulo ${kind}`, required: true, sensitive: false, ...extra },
});

describe("PhonePreview", () => {
  it("is a named form with the screen title and the submit button text", () => {
    show([]);
    const form = screen.getByRole("form", { name: "Pré-visualização da tela Seus dados" });
    expect(within(form).getByText("Seus dados")).toBeTruthy();
    expect(within(form).getByText("Continuar")).toBeTruthy();
    expect(within(form).getByText("Tela vazia. Adicione perguntas ou textos.")).toBeTruthy();
  });

  it("renders every display kind", () => {
    show([
      { key: "b_h", display: { kind: "heading", text: "Título grande" } },
      { key: "b_s", display: { kind: "subheading", text: "Subtítulo aqui" } },
      { key: "b_p", display: { kind: "paragraph", text: "Um parágrafo" } },
      { key: "b_c", display: { kind: "caption", text: "Uma legenda" } },
      { key: "b_i", display: { kind: "image" } },
      { key: "b_l", display: { kind: "link", text: "Saiba mais", url: "https://example.com" } },
    ]);
    expect(screen.getByRole("heading", { level: 2, name: "Título grande" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "Subtítulo aqui" })).toBeTruthy();
    expect(screen.getByText("Um parágrafo")).toBeTruthy();
    expect(screen.getByText("Uma legenda")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Imagem" })).toBeTruthy();
    expect(screen.getByText("Saiba mais")).toBeTruthy();
  });

  it("renders every text, date and file input with its label", () => {
    const kinds = ["short_text", "email", "phone", "number", "long_text", "single_choice_dropdown", "date", "photo", "document"] as const;
    show(kinds.map((kind) => field(kind)));
    for (const kind of kinds) expect(screen.getByText(`Rótulo ${kind}`)).toBeTruthy();
    expect(screen.getByText("Tirar ou escolher foto")).toBeTruthy();
    expect(screen.getByText("Escolher arquivo")).toBeTruthy();
  });

  it("renders a date range as start and end", () => {
    show([field("date_range")]);
    expect(screen.getByText("Rótulo date_range")).toBeTruthy();
    expect(screen.getByText("Início")).toBeTruthy();
    expect(screen.getByText("Fim")).toBeTruthy();
  });

  it("renders the options of every choice kind", () => {
    const options = [
      { id: "o_a", title: "Comprar", description: "À vista" },
      { id: "o_b", title: "Alugar" },
    ];
    for (const kind of ["single_choice_radio", "multi_choice_checkbox", "multi_choice_chips"] as const) {
      const { unmount } = show([field(kind, { options })]);
      expect(screen.getByText(`Rótulo ${kind}`)).toBeTruthy();
      expect(screen.getByText("Comprar")).toBeTruthy();
      expect(screen.getByText("Alugar")).toBeTruthy();
      unmount();
    }
  });

  it("renders an opt in with its terms link, the question text and the optional mark", () => {
    show([
      field("opt_in", { label: "Aceito receber mensagens", termsUrl: "https://example.com/termos" }),
      field("short_text", { label: "Apelido", required: false, question: "Como prefere ser chamado?", help: "Até 20 letras" }),
    ]);
    expect(screen.getByText("Aceito receber mensagens")).toBeTruthy();
    expect(screen.getByText("Leia mais")).toBeTruthy();
    expect(screen.getByText("Como prefere ser chamado?")).toBeTruthy();
    expect(screen.getByText("Opcional · Até 20 letras")).toBeTruthy();
  });

  it("selects a block on click and marks the conditional and the flagged ones", () => {
    const onSelectBlock = vi.fn();
    show(
      [
        field("single_choice_radio", { options: [{ id: "o_a", title: "Sim" }] }),
        { ...field("short_text", { label: "Por quê?" }), visibleIf: { fieldKey: "f_single_choice_radio", value: "o_a" } },
      ],
      { onSelectBlock, selectedBlock: "b_short_text", flagged: new Set(["b_short_text"]) },
    );
    expect(screen.getByText("Aparece conforme Rótulo single_choice_radio")).toBeTruthy();
    expect(screen.getByLabelText("Tem ajustes pendentes")).toBeTruthy();
    const pressed = screen.getAllByRole("button", { pressed: true });
    expect(pressed).toHaveLength(1);
    fireEvent.click(screen.getByText("Rótulo single_choice_radio"));
    expect(onSelectBlock).toHaveBeenCalledWith("b_single_choice_radio");
  });

  it("offers to insert between blocks only when editing", () => {
    const onInsertAt = vi.fn();
    const { unmount } = show([field("email")], { onInsertAt, onSelectBlock: () => {} });
    const inserts = screen.getAllByRole("button", { name: "Adicionar aqui" });
    expect(inserts).toHaveLength(2);
    fireEvent.click(inserts[1]);
    expect(onInsertAt).toHaveBeenCalledWith(1);
    unmount();
    show([field("email")]);
    expect(screen.queryByRole("button", { name: "Adicionar aqui" })).toBeNull();
  });
});
