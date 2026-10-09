import { describe, expect, it } from "vitest";

import { classificationPreset, type CustomFieldDefinition } from "@/lib/crm/custom-fields";

import {
  draftFromDefinition,
  draftFromInput,
  draftIsComplete,
  draftPayload,
  emptyFieldDraft,
  type FieldDraft,
} from "../custom-field-draft";

function draft(overrides: Partial<FieldDraft>): FieldDraft {
  return { ...emptyFieldDraft(), ...overrides };
}

describe("draftIsComplete", () => {
  it("needs a label everywhere and an explicit sensitivity answer on a lead field", () => {
    expect(draftIsComplete("opportunity", draft({ label: "" }))).toBe(false);
    expect(draftIsComplete("opportunity", draft({ label: "Segmento" }))).toBe(true);
    expect(draftIsComplete("lead", draft({ label: "Escola" }))).toBe(false);
    expect(draftIsComplete("lead", draft({ label: "Escola", sensitive: false }))).toBe(true);
    expect(draftIsComplete("lead", draft({ label: "Opinião", sensitive: true, legalBasis: "Consentimento do titular" }))).toBe(true);
  });

  it("needs a written legal basis before a sensitive lead field can be saved", () => {
    expect(draftIsComplete("lead", draft({ label: "Opinião", sensitive: true }))).toBe(false);
    expect(draftIsComplete("lead", draft({ label: "Opinião", sensitive: true, legalBasis: "   " }))).toBe(false);
  });
});

describe("draftPayload", () => {
  it("derives the key from the label and sends the explicit sensitivity of a lead field", () => {
    const payload = draftPayload("lead", draft({ label: "Escola atual", sensitive: false, legalBasis: "ignored" }));
    expect(payload).toEqual({
      objectType: "lead",
      key: "escola_atual",
      label: "Escola atual",
      type: "text",
      required: false,
      sensitive: false,
      legalBasis: "",
      role: "",
      optionTones: {},
    });
  });

  it("sends the options with their tones, dropping blank options", () => {
    const payload = draftPayload(
      "lead",
      draft({
        label: "Interesse",
        type: "select",
        sensitive: true,
        legalBasis: "Consentimento",
        classification: true,
        options: [
          { key: "a", value: "Alto", tone: "chart-2" },
          { key: "b", value: "  " },
          { key: "c", value: "Baixo" },
        ],
      }),
    );
    expect(payload).toMatchObject({
      type: "select",
      options: ["Alto", "Baixo"],
      optionTones: { Alto: "chart-2" },
      sensitive: true,
      legalBasis: "Consentimento",
      role: "classification",
    });
  });

  it("never asks the sensitivity question of an opportunity field", () => {
    const payload = draftPayload("opportunity", draft({ label: "Segmento", sensitive: true, classification: true, type: "select", options: [{ key: "a", value: "SMB" }] }));
    expect(payload).not.toHaveProperty("sensitive");
    expect(payload).not.toHaveProperty("legalBasis");
    expect(payload).not.toHaveProperty("role");
  });

  it("keeps the role only on a select field", () => {
    expect(draftPayload("lead", draft({ label: "Notas", sensitive: false, classification: true }))).toMatchObject({ role: "" });
  });

  it("refuses a label that yields no key", () => {
    expect(draftPayload("opportunity", draft({ label: "???" }))).toBeNull();
  });
});

describe("drafts from definitions and presets", () => {
  it("round-trips a stored definition", () => {
    const stored: CustomFieldDefinition = {
      id: "f1",
      workspaceId: "ws",
      objectType: "lead",
      key: "interesse",
      label: "Interesse",
      type: "select",
      options: ["Alto", "Baixo"],
      optionTones: { Alto: "chart-3" },
      required: true,
      sensitive: true,
      legalBasis: "Consentimento",
      role: "classification",
      position: 0,
      createdAt: "",
      updatedAt: "",
    };
    const d = draftFromDefinition(stored);
    expect(d).toMatchObject({ id: "f1", key: "interesse", sensitive: true, classification: true, required: true });
    expect(draftPayload("lead", d)).toMatchObject({ key: "interesse", options: ["Alto", "Baixo"], optionTones: { Alto: "chart-3" } });
  });

  it("opens the classification preset waiting for the person to write its legal basis", () => {
    const preset = classificationPreset({
      label: "Classificação",
      options: { positive: "Positivo", negative: "Negativo", toWin: "A conquistar", notInformed: "Não informado" },
    });
    const d = draftFromInput(preset);
    expect(d.legalBasis).toBe("");
    expect(draftIsComplete("lead", d)).toBe(false);
    const written = { ...d, legalBasis: "Consentimento" };
    expect(draftIsComplete("lead", written)).toBe(true);
    expect(draftPayload("lead", written)).toEqual({ ...preset, role: "classification", legalBasis: "Consentimento" });
  });
});
