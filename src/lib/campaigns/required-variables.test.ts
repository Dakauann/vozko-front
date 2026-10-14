import { describe, expect, it } from "vitest";

import {
  missingVariablesOf,
  missingVariablesReport,
  requiredVariablesOf,
  similarColumn,
} from "./required-variables";

const required = requiredVariablesOf(
  ["{{nome}}", "{{data}}"],
  ["nome_cliente", "numer_cliente"],
  [{ key: "numer_cliente", label: "Número do cliente" }, { key: "plano", label: "Plano contratado" }],
);

describe("requiredVariablesOf", () => {
  it("keeps where each variable comes from and lists a key once", () => {
    expect(required.map((v) => [v.key, v.source])).toEqual([
      ["{{nome}}", "template"],
      ["{{data}}", "template"],
      ["nome_cliente", "workflow"],
      ["numer_cliente", "workflow"],
      ["plano", "agent"],
    ]);
    expect(required.find((v) => v.key === "plano")?.label).toBe("Plano contratado");
  });
});

describe("missingVariablesOf", () => {
  it("reads template values by position and the others from the metadata", () => {
    const contact = {
      variables: ["Celsa", " "],
      metadata: { nome_cliente: "Celsa", number_cliente: "119", plano: "ouro" },
    };
    expect(missingVariablesOf(contact, required).map((v) => v.key)).toEqual(["{{data}}", "numer_cliente"]);
  });

  it("reads template values keyed by position", () => {
    const contact = { variables: { "0": "Celsa", "1": "09/10" }, metadata: { nome_cliente: "a", numer_cliente: "1", plano: "b" } };
    expect(missingVariablesOf(contact, required)).toEqual([]);
  });

  it("treats a missing contact as missing everything", () => {
    expect(missingVariablesOf(undefined, required)).toEqual(required);
  });
});

describe("missingVariablesReport", () => {
  it("counts each missing variable and points to the column that looks like it", () => {
    const contacts = [
      { variables: ["a", "b"], metadata: { nome_cliente: "a", number_cliente: "1", plano: "x" } },
      { variables: ["a", "b"], metadata: { nome_cliente: "", number_cliente: "2", plano: "x" } },
      { variables: ["a", "b"], metadata: { nome_cliente: "a", numer_cliente: "3", plano: "x" } },
    ];
    const report = missingVariablesReport(contacts, required, ["nome_cliente", "number_cliente", "plano"]);
    expect(report.contacts).toBe(2);
    expect(report.variables.map((m) => [m.variable.key, m.contacts, m.suggestion])).toEqual([
      ["nome_cliente", 1, undefined],
      ["numer_cliente", 2, "number_cliente"],
    ]);
  });

  it("reports nothing when every contact is complete", () => {
    const contact = { variables: ["a", "b"], metadata: { nome_cliente: "a", numer_cliente: "1", plano: "x" } };
    expect(missingVariablesReport([contact], required, [])).toEqual({ contacts: 0, variables: [] });
  });
});

describe("similarColumn", () => {
  it("suggests a near spelling but never an unrelated column or the key itself", () => {
    expect(similarColumn("numer_cliente", ["telefone", "Number_Cliente"])).toBe("Number_Cliente");
    expect(similarColumn("numer_cliente", ["telefone", "cidade"])).toBeUndefined();
    expect(similarColumn("plano", ["plano"])).toBeUndefined();
  });
});
