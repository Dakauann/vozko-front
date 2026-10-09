import { describe, expect, it } from "vitest";

import {
  CLASSIFICATION_PRESET_TONES,
  CUSTOM_FIELD_TONES,
  classificationField,
  classificationPreset,
  isFilledValue,
  optionTone,
  readableClassificationField,
  readableFields,
  toggleChoice,
  type CustomFieldDefinition,
} from "../custom-fields";

function definition(overrides: Partial<CustomFieldDefinition>): CustomFieldDefinition {
  return {
    id: "f1",
    workspaceId: "ws",
    objectType: "lead",
    key: "classificacao",
    label: "Classificação",
    type: "select",
    options: ["Positivo", "Negativo"],
    required: false,
    sensitive: false,
    position: 0,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

describe("custom field tones", () => {
  it("offers exactly the fixed palette keys", () => {
    expect([...CUSTOM_FIELD_TONES]).toEqual(["chart-1", "chart-2", "chart-3", "chart-4", "chart-5", "neutral"]);
  });

  it("reads the tone of an option and nothing for an untoned or unknown one", () => {
    const field = definition({ optionTones: { Positivo: "chart-2", Negativo: "rainbow" as never } });
    expect(optionTone(field, "Positivo")).toBe("chart-2");
    expect(optionTone(field, "Negativo")).toBeUndefined();
    expect(optionTone(field, "Outro")).toBeUndefined();
    expect(optionTone(definition({}), "Positivo")).toBeUndefined();
  });
});

describe("classificationField", () => {
  it("finds the field holding the classification role", () => {
    const plain = definition({ id: "a", role: undefined });
    const classification = definition({ id: "b", role: "classification" });
    expect(classificationField([plain, classification])?.id).toBe("b");
    expect(classificationField([plain])).toBeUndefined();
  });
});

describe("readableFields", () => {
  it("keeps only the definitions the server marked readable for this viewer", () => {
    const fields = [
      definition({ id: "a", readable: true }),
      definition({ id: "b", readable: false, sensitive: true }),
      definition({ id: "c" }),
    ];
    expect(readableFields(fields).map((field) => field.id)).toEqual(["a"]);
  });
});

describe("readableClassificationField", () => {
  it("gives the classification only when the server lets this viewer read it", () => {
    expect(readableClassificationField([definition({ id: "a", role: "classification", readable: true })])?.id).toBe("a");
    expect(readableClassificationField([definition({ id: "a", role: "classification", readable: false })])).toBeUndefined();
    expect(readableClassificationField([definition({ id: "a", readable: true })])).toBeUndefined();
  });
});

describe("isFilledValue", () => {
  it("treats missing, blank and empty list values as not filled", () => {
    expect(isFilledValue(undefined)).toBe(false);
    expect(isFilledValue(null)).toBe(false);
    expect(isFilledValue("  ")).toBe(false);
    expect(isFilledValue([])).toBe(false);
    expect(isFilledValue("Positivo")).toBe(true);
    expect(isFilledValue(["A"])).toBe(true);
    expect(isFilledValue(0)).toBe(true);
    expect(isFilledValue(false)).toBe(true);
  });
});

describe("toggleChoice", () => {
  it("adds and removes a choice keeping the option order", () => {
    const options = ["A", "B", "C"];
    expect(toggleChoice(undefined, "B", options)).toEqual(["B"]);
    expect(toggleChoice(["C"], "A", options)).toEqual(["A", "C"]);
    expect(toggleChoice(["A", "C"], "A", options)).toEqual(["C"]);
    expect(toggleChoice("A", "B", options)).toEqual(["B"]);
  });
});

describe("classificationPreset", () => {
  const copy = {
    label: "Classificação",
    options: { positive: "Positivo", negative: "Negativo", toWin: "A conquistar", notInformed: "Não informado" },
  };

  it("builds a sensitive select with the role and one tone per option, leaving the legal basis for the person to write", () => {
    const preset = classificationPreset(copy);
    expect(preset).toEqual({
      objectType: "lead",
      key: "classificacao",
      label: "Classificação",
      type: "select",
      options: ["Positivo", "Negativo", "A conquistar", "Não informado"],
      optionTones: {
        Positivo: CLASSIFICATION_PRESET_TONES.positive,
        Negativo: CLASSIFICATION_PRESET_TONES.negative,
        "A conquistar": CLASSIFICATION_PRESET_TONES.toWin,
        "Não informado": CLASSIFICATION_PRESET_TONES.notInformed,
      },
      required: false,
      sensitive: true,
      legalBasis: "",
      role: "classification",
    });
  });

  it("never paints a classification in the brand green and keeps Não informado hollow", () => {
    expect(Object.values(CLASSIFICATION_PRESET_TONES)).not.toContain("chart-1");
    expect(CLASSIFICATION_PRESET_TONES.notInformed).toBe("neutral");
  });
});
