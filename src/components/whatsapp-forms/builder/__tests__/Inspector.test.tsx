import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import { blockSelection, readSelection } from "@/lib/whatsapp-forms/builder-store";
import { indexProblems } from "@/lib/whatsapp-forms/problems";
import type { Document, Field, Options } from "@/lib/whatsapp-forms/types";

vi.mock("@/app/actions/medias", () => ({
  fetchMediaFileAction: vi.fn(() => new Promise(() => {})),
  uploadMediaAction: vi.fn(),
}));

import { Inspector } from "../Inspector";

const options: Options = {
  fieldKinds: ["short_text", "number", "document"],
  displayKinds: ["heading"],
  categories: ["OTHER"],
  limits: {
    labels: { short_text: 20, number: 20, document: 80 },
    options: {},
    displayText: { heading: 80 },
    help: 80,
    optionTitle: 30,
    optionDescription: 300,
    submitLabel: 35,
    componentsPerScreen: 50,
    imagesPerScreen: 3,
    linksPerScreen: 2,
    optInsPerScreen: 5,
    pickersPerScreen: 1,
    routeBranches: 10,
    uploads: 30,
    uploadSizeKb: 25600,
    imageBytes: 307200,
    textInputMaxChars: 80,
    textAreaMaxChars: 600,
    documentMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
  },
  bindings: [],
  customFields: [],
  starters: [],
  flowJsonVersion: "7.3",
};

function documentWith(field: Field): Document {
  return { schema: 1, categories: [], screens: [{ key: "s_one00000", title: "Tela", submitLabel: "Enviar", route: {}, blocks: [{ key: "b_field000", field }] }] };
}

function show(field: Field, problems = indexProblems([])) {
  let document = documentWith(field);
  const onApply = vi.fn((operation: (doc: Document) => Document) => {
    document = operation(document);
  });
  const onType = vi.fn((_group: string, operation: (doc: Document) => Document) => {
    document = operation(document);
  });
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
      <Inspector document={document} selection={readSelection(blockSelection("b_field000"))} options={options} problems={problems} readOnly={false} onApply={onApply} onType={onType} />
    </NextIntlClientProvider>,
  );
  return { current: () => document.screens[0].blocks[0].field, onApply, onType };
}

const base = { key: "f_field000", label: "Campo", required: false, sensitive: false } as const;

describe("Inspector accepted file types", () => {
  it("lists only the groups of types the backend allows and explains that none picked means all", () => {
    show({ ...base, kind: "document" });
    expect(screen.getByText("Tipos de arquivo aceitos")).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "PDF" })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Imagens" })).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: "Word" })).toBeNull();
    expect(screen.getByText("Sem nenhum marcado, aceita todos os tipos que a Meta aceita.")).toBeTruthy();
  });

  it("writes the picked group's types to the field and clears them when unpicked", () => {
    const field = show({ ...base, kind: "document", mimeTypes: ["application/pdf"] });
    expect(screen.getByRole("checkbox", { name: "PDF" }).getAttribute("data-state")).toBe("checked");
    fireEvent.click(screen.getByRole("checkbox", { name: "Imagens" }));
    expect(field.current()?.mimeTypes).toEqual(["application/pdf", "image/jpeg", "image/png"]);
  });

  it("drops the list entirely when the last group is unpicked", () => {
    const field = show({ ...base, kind: "document", mimeTypes: ["application/pdf"] });
    fireEvent.click(screen.getByRole("checkbox", { name: "PDF" }));
    expect(field.current()).not.toHaveProperty("mimeTypes");
  });

  it("does not offer file types on other kinds", () => {
    show({ ...base, kind: "short_text" });
    expect(screen.queryByText("Tipos de arquivo aceitos")).toBeNull();
  });
});

describe("Inspector format pattern", () => {
  it("offers the pattern under Avançado for short text and number, with the help text hint", () => {
    for (const kind of ["short_text", "number"] as const) {
      const field = show({ ...base, kind });
      expect(screen.getByText("Avançado")).toBeTruthy();
      expect(screen.getByText("Precisa do texto de ajuda preenchido, explicando o formato para quem responde.")).toBeTruthy();
      fireEvent.change(screen.getByLabelText("Formato (expressão regular)"), { target: { value: "^[0-9]{5}$" } });
      expect(field.current()?.pattern).toBe("^[0-9]{5}$");
      cleanup();
    }
  });

  it("shows the backend problem on the pattern and on the missing help", () => {
    show({ ...base, kind: "short_text", pattern: "(" }, indexProblems([
      { screen: "s_one00000", block: "b_field000", property: "pattern", code: "invalid" },
      { screen: "s_one00000", block: "b_field000", property: "help", code: "required" },
    ]));
    expect(screen.getByText("Valor inválido.")).toBeTruthy();
    expect(screen.getByText("Preencha este campo.")).toBeTruthy();
  });

  it("does not offer a pattern on other kinds", () => {
    show({ ...base, kind: "document" });
    expect(screen.queryByText("Avançado")).toBeNull();
  });
});
