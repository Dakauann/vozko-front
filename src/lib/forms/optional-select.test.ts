import { describe, expect, it } from "vitest";

import { EMPTY_CHOICE, emptyChoiceLabel, fromSelectValue } from "./optional-select";

describe("optional selects", () => {
  it("offer their placeholder as a choice that clears the value", () => {
    // "Departamento da conversa" must stay reachable after picking Vendas.
    expect(emptyChoiceLabel({ required: false, placeholder: "Departamento da conversa" })).toBe(
      "Departamento da conversa",
    );
    expect(fromSelectValue(EMPTY_CHOICE)).toBe("");
  });

  it("leave required selects without an empty choice", () => {
    expect(emptyChoiceLabel({ required: true, placeholder: "Escolha" })).toBeNull();
  });

  it("need a placeholder to name the empty choice", () => {
    expect(emptyChoiceLabel({ required: false })).toBeNull();
    expect(emptyChoiceLabel({ required: false, placeholder: "  " })).toBeNull();
  });

  it("pass real values through", () => {
    expect(fromSelectValue("dept-sales")).toBe("dept-sales");
  });
});
