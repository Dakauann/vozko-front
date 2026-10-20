import { describe, expect, it } from "vitest";

import { SHORTCUT_VARIABLES, resolveShortcutVariables, unresolvedVariables } from "./variables";

const values = { leadName: "Maria Clara Souza", leadPhone: "5511988887777", operatorName: "Ana" };

describe("resolveShortcutVariables", () => {
  it("fills every documented variable from what the composer knows", () => {
    expect(
      resolveShortcutVariables("Oi {{primeiro_nome}}! Aqui é {{atendente}}. Confirma {{nome}} no {{telefone}}?", values),
    ).toEqual({ text: "Oi Maria! Aqui é Ana. Confirma Maria Clara Souza no 5511988887777?", unresolved: [] });
  });

  it("accepts spaces inside the braces and any letter case", () => {
    expect(resolveShortcutVariables("Oi {{ Primeiro_Nome }}", values).text).toBe("Oi Maria");
  });

  it("keeps a variable it cannot fill exactly as written and reports it", () => {
    expect(resolveShortcutVariables("Oi {{nome}}, sou {{atendente}}", { operatorName: "Ana" })).toEqual({
      text: "Oi {{nome}}, sou Ana",
      unresolved: ["nome"],
    });
  });

  it("does not use a phone number as the customer's name", () => {
    expect(resolveShortcutVariables("Oi {{primeiro_nome}}", { leadName: "+55 11 98888-7777" }).unresolved).toEqual([
      "primeiro_nome",
    ]);
  });

  it("treats a blank value as missing", () => {
    expect(resolveShortcutVariables("{{atendente}}", { operatorName: "   " }).unresolved).toEqual(["atendente"]);
  });

  it("reports an unknown variable once, however often it appears", () => {
    expect(resolveShortcutVariables("{{cupom}} e {{cupom}}", values)).toEqual({
      text: "{{cupom}} e {{cupom}}",
      unresolved: ["cupom"],
    });
  });

  it("leaves text without variables untouched", () => {
    expect(resolveShortcutVariables("Bom dia!", values)).toEqual({ text: "Bom dia!", unresolved: [] });
  });
});

describe("unresolvedVariables", () => {
  it("finds every placeholder still in the composer, so none reaches a customer", () => {
    expect(unresolvedVariables("Oi {{nome}}, seu {{ cupom }} vence. {{nome}}")).toEqual(["nome", "cupom"]);
  });

  it("finds nothing in plain text or single braces", () => {
    expect(unresolvedVariables("Preço {R$ 10} e chaves {{}}")).toEqual([]);
  });
});

describe("SHORTCUT_VARIABLES", () => {
  it("documents exactly the variables the resolver fills", () => {
    const names = SHORTCUT_VARIABLES.map((variable) => variable.name);
    expect(names).toEqual(["nome", "primeiro_nome", "telefone", "atendente"]);
    const filled = resolveShortcutVariables(names.map((name) => `{{${name}}}`).join(" "), values);
    expect(filled.unresolved).toEqual([]);
  });
});
