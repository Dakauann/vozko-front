import { describe, expect, it } from "vitest";

import {
  knownRefLabels,
  readVariableCatalog,
  searchVariables,
  templateSegments,
  variableBadges,
  variableGroupsOf,
  variableTemplate,
  type CatalogVariable,
} from "./variable-catalog";

function variable(overrides: Partial<CatalogVariable> = {}): CatalogVariable {
  return {
    ref: "input.cpf",
    label: "Enviado pelo agente › cpf",
    group: "trigger",
    kind: "trigger",
    source: null,
    type: "text",
    example: null,
    availability: "always",
    ...overrides,
  };
}

const WIRE = {
  variables: [
    { ref: "input.cpf", label: "Enviado pelo agente › cpf", group: "trigger", kind: "trigger", source: null, type: "text", example: "123", availability: "always" },
    { ref: "last.message_id", label: "Envio › id", group: "nodes", kind: "node", source: { nodeId: "n1", nodeName: "Boas-vindas" }, type: "text", example: null, availability: "some_paths" },
    { ref: "sys.date", label: "Data de hoje", group: "system", kind: "system", source: null, type: "date", example: "2026-10-22", availability: "always" },
  ],
};

describe("readVariableCatalog", () => {
  it("reads the backend catalog in the order it was sent", () => {
    const catalog = readVariableCatalog(WIRE);
    expect(catalog?.unreadable).toBe(0);
    expect(catalog?.variables.map((item) => item.ref)).toEqual(["input.cpf", "last.message_id", "sys.date"]);
    expect(catalog?.variables[1]).toEqual({
      ref: "last.message_id",
      label: "Envio › id",
      group: "nodes",
      kind: "node",
      source: { nodeId: "n1", nodeName: "Boas-vindas" },
      type: "text",
      example: null,
      availability: "some_paths",
    });
  });

  it("refuses an envelope without a variables list, so the picker shows an error instead of an empty list", () => {
    expect(readVariableCatalog(null)).toBeNull();
    expect(readVariableCatalog({})).toBeNull();
    expect(readVariableCatalog({ variables: "x" })).toBeNull();
    expect(readVariableCatalog([])).toBeNull();
  });

  it("reads a Go nil list as an empty catalog", () => {
    expect(readVariableCatalog({ variables: null })).toEqual({ variables: [], unreadable: 0 });
  });

  it("counts entries with an unknown group, kind, type or availability instead of guessing them", () => {
    const base = WIRE.variables[0];
    const catalog = readVariableCatalog({
      variables: [
        base,
        { ...base, ref: "a", group: "other" },
        { ...base, ref: "b", kind: "other" },
        { ...base, ref: "c", type: "other" },
        { ...base, ref: "d", availability: "sometimes" },
        { ...base, ref: "", label: "vazio" },
        { ...base, ref: "e", source: { nodeId: 3 } },
        { ...base, ref: "f", example: 3 },
      ],
    });
    expect(catalog?.variables.map((item) => item.ref)).toEqual(["input.cpf"]);
    expect(catalog?.unreadable).toBe(7);
  });

  it("keeps one entry per ref, so the list never renders duplicate keys", () => {
    const base = WIRE.variables[1];
    const catalog = readVariableCatalog({ variables: [base, { ...base, label: "outro" }] });
    expect(catalog?.variables).toHaveLength(1);
    expect(catalog?.variables[0].label).toBe("Envio › id");
    expect(catalog?.unreadable).toBe(1);
  });
});

describe("variableGroupsOf", () => {
  it("groups in the order the backend sent the groups", () => {
    const groups = variableGroupsOf([
      variable({ ref: "sys.date", group: "system" }),
      variable({ ref: "input.cpf", group: "trigger" }),
      variable({ ref: "sys.time", group: "system" }),
    ]);
    expect(groups.map((group) => [group.group, group.variables.map((item) => item.ref)])).toEqual([
      ["system", ["sys.date", "sys.time"]],
      ["trigger", ["input.cpf"]],
    ]);
  });
});

describe("searchVariables", () => {
  const list = [variable({ ref: "webhook.body.nome", label: "Corpo do webhook › nome" }), variable({ ref: "sys.date", label: "Data de hoje" })];

  it("matches the label or the ref, ignoring case", () => {
    expect(searchVariables(list, "CORPO").map((item) => item.ref)).toEqual(["webhook.body.nome"]);
    expect(searchVariables(list, "sys.da").map((item) => item.ref)).toEqual(["sys.date"]);
  });

  it("returns everything for a blank query", () => {
    expect(searchVariables(list, "  ")).toEqual(list);
  });
});

describe("variableBadges", () => {
  it("marks defaults, partial availability and the node that defines it", () => {
    expect(variableBadges(variable({ kind: "default" }))).toEqual([{ kind: "default" }]);
    expect(variableBadges(variable({ kind: "system" }))).toEqual([{ kind: "default" }]);
    expect(variableBadges(variable({ kind: "node", availability: "some_paths", source: { nodeId: "n1", nodeName: "Boas-vindas" } }))).toEqual([
      { kind: "some_paths" },
      { kind: "source", nodeName: "Boas-vindas" },
    ]);
    expect(variableBadges(variable({ kind: "trigger" }))).toEqual([]);
  });
});

describe("variableTemplate", () => {
  it("wraps the ref as the backend reads it", () => {
    expect(variableTemplate("input.cpf")).toBe("{{input.cpf}}");
  });
});

describe("templateSegments", () => {
  it("splits text into plain parts and references", () => {
    expect(templateSegments("Olá {{ lead_name }}, seu CPF {{input.cpf}}.")).toEqual([
      { text: "Olá " },
      { text: "{{ lead_name }}", ref: "lead_name" },
      { text: ", seu CPF " },
      { text: "{{input.cpf}}", ref: "input.cpf" },
      { text: "." },
    ]);
  });

  it("keeps text without references whole", () => {
    expect(templateSegments("sem nada")).toEqual([{ text: "sem nada" }]);
    expect(templateSegments("")).toEqual([]);
  });
});

describe("knownRefLabels", () => {
  it("names the references the catalog knows, once each, in reading order", () => {
    const list = [variable({ ref: "input.cpf", label: "CPF" }), variable({ ref: "sys.date", label: "Data de hoje" })];
    expect(knownRefLabels("{{sys.date}} {{x.y}} {{input.cpf}} {{sys.date}}", list)).toEqual([
      { ref: "sys.date", label: "Data de hoje" },
      { ref: "input.cpf", label: "CPF" },
    ]);
  });
});
