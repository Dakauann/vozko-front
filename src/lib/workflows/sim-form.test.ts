import { describe, expect, it } from "vitest";

import type { Document, Field } from "@/lib/whatsapp-forms/types";

import { formRunAnswers, isMaskedFormField } from "./sim-form";

function field(key: string, kind: Field["kind"], overrides: Partial<Field> = {}): Field {
  return { key, kind, label: key, required: false, sensitive: false, ...overrides };
}

const DOCUMENT: Document = {
  schema: 1,
  categories: ["LEAD_GENERATION"],
  screens: [
    {
      key: "s1",
      title: "Dados",
      submitLabel: "Continuar",
      route: { next: "s2" },
      blocks: [
        { key: "b1", field: field("name", "short_text") },
        { key: "b2", field: field("city", "single_choice_radio", { options: [{ id: "rec", title: "Recife" }] }) },
        { key: "b3", display: { kind: "heading", text: "Mais" } },
        { key: "b4", field: field("topics", "multi_choice_chips", { options: [{ id: "a", title: "Bolsa" }, { id: "b", title: "Horário" }] }) },
      ],
    },
    {
      key: "s2",
      title: "Datas",
      submitLabel: "Enviar",
      route: {},
      blocks: [
        { key: "b5", field: field("birth", "date") },
        { key: "b6", field: field("stay", "date_range") },
        { key: "b7", field: field("optin", "opt_in") },
        { key: "b8", field: field("cpf", "short_text", { sensitive: true }) },
        { key: "b9", field: field("rg", "document") },
      ],
    },
  ],
};

describe("formRunAnswers", () => {
  it("gives the flow each answer as production stores it in form.<key>", () => {
    expect(
      formRunAnswers(DOCUMENT, {
        name: { key: "name", kind: "short_text", text: "Ana" },
        city: { key: "city", kind: "single_choice_radio", optionIds: ["rec"] },
        topics: { key: "topics", kind: "multi_choice_chips", optionIds: ["a", "b"] },
        birth: { key: "birth", kind: "date", text: "1990-10-20" },
        stay: { key: "stay", kind: "date_range", range: { start: "2026-11-01", end: "2026-11-03" } },
        optin: { key: "optin", kind: "opt_in", checked: false },
        cpf: { key: "cpf", kind: "short_text", text: "12345678900" },
        rg: { key: "rg", kind: "document", files: [{ id: "f1", name: "rg.pdf", mimeType: "application/pdf" }] },
      }),
    ).toEqual({
      name: "Ana",
      city: "Recife",
      topics: "Bolsa, Horário",
      birth: "20/10/1990",
      stay: "01/11/2026 a 03/11/2026",
      optin: "Não",
      cpf: "••••",
      rg: "••••",
    });
  });

  it("leaves out what the customer did not answer and keys the form does not have", () => {
    expect(
      formRunAnswers(DOCUMENT, {
        name: { key: "name", kind: "short_text", text: "  " },
        city: { key: "city", kind: "single_choice_radio", optionIds: [] },
        stay: { key: "stay", kind: "date_range", range: { start: "2026-11-01", end: "" } },
        ghost: { key: "ghost", kind: "short_text", text: "x" },
        optin: { key: "optin", kind: "opt_in", checked: true },
      }),
    ).toEqual({ optin: "Sim" });
  });
});

describe("isMaskedFormField", () => {
  it("masks sensitive fields and every file field, as production does", () => {
    expect(isMaskedFormField(field("cpf", "short_text", { sensitive: true }))).toBe(true);
    expect(isMaskedFormField(field("photo", "photo"))).toBe(true);
    expect(isMaskedFormField(field("rg", "document"))).toBe(true);
    expect(isMaskedFormField(field("name", "short_text"))).toBe(false);
  });
});
