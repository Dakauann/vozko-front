import { describe, expect, it } from "vitest";

import { SECRET_NAME_MAX_LENGTH, isValidSecretName, secretTemplateGroup, secretUsageSnippets } from "./secret-name";

describe("isValidSecretName", () => {
  it.each([
    ["unifecaf_senha", true],
    ["a", true],
    ["api_key_2", true],
    ["_", true],
    ["9", true],
    ["a".repeat(SECRET_NAME_MAX_LENGTH), true],
  ])("accepts %j, the same names the backend stores", (name, expected) => {
    expect(isValidSecretName(name)).toBe(expected);
  });

  it.each([
    [""],
    ["a".repeat(SECRET_NAME_MAX_LENGTH + 1)],
    ["Senha"],
    ["api-key"],
    ["api key"],
    ["senha."],
    ["ção"],
    [" senha"],
    ["senha\n"],
  ])("refuses %j, which the backend would answer with invalid_name", (name) => {
    expect(isValidSecretName(name)).toBe(false);
  });
});

describe("secretUsageSnippets", () => {
  it("gives the template for HTTP nodes and the call for code nodes", () => {
    expect(secretUsageSnippets("unifecaf_senha")).toEqual({
      template: "{{secret.unifecaf_senha}}",
      code: "secrets.get('unifecaf_senha')",
    });
  });
});

describe("secretTemplateGroup", () => {
  it("offers each workspace secret as a template in the variable picker", () => {
    expect(secretTemplateGroup(["api_key", "senha"])).toEqual({
      label: "Segredos",
      vars: [
        { template: "{{secret.api_key}}", description: "api_key" },
        { template: "{{secret.senha}}", description: "senha" },
      ],
    });
  });

  it("is null without secrets, so the picker shows no empty group", () => {
    expect(secretTemplateGroup([])).toBeNull();
  });
});
