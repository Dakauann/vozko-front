import { describe, expect, it } from "vitest";

import { IDENTIFIER_NAME_MAX_LENGTH, isIdentifierName, toIdentifierName } from "./identifier-name";

describe("isIdentifierName", () => {
  it.each([
    ["cpf", true],
    ["data_nascimento", true],
    ["campo_2", true],
    ["a".repeat(IDENTIFIER_NAME_MAX_LENGTH), true],
    ["", false],
    ["a".repeat(IDENTIFIER_NAME_MAX_LENGTH + 1), false],
    ["Cpf", false],
    ["data-nascimento", false],
    ["data nascimento", false],
    ["ção", false],
  ])("matches the backend rule ^[a-z0-9_]{1,64}$ for %j", (name, expected) => {
    expect(isIdentifierName(name)).toBe(expected);
  });
});

describe("toIdentifierName", () => {
  it.each([
    ["cpfAluno", "cpf_aluno"],
    ["Data de Nascimento", "data_de_nascimento"],
    ["X-Api-Key", "x_api_key"],
    ["__token__", "token"],
    ["e-mail", "e_mail"],
  ])("turns %j into a name the backend accepts", (raw, expected) => {
    expect(toIdentifierName(raw)).toBe(expected);
    expect(isIdentifierName(toIdentifierName(raw))).toBe(true);
  });

  it("cuts long names to the maximum length", () => {
    expect(toIdentifierName("a".repeat(80))).toHaveLength(IDENTIFIER_NAME_MAX_LENGTH);
  });

  it("gives an empty name when nothing usable is left, so the caller asks for one", () => {
    expect(toIdentifierName("çã!")).toBe("");
  });
});
