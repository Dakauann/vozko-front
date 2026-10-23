import { describe, expect, it } from "vitest";

import {
  AGENT_CALL_TRIGGER,
  agentCallInputIssues,
  agentCallInputsOfGraph,
  emptyAgentCallInput,
  httpBodySchemaSources,
  importBodySchema,
  readAgentCallInputs,
  readReplyFields,
  type AgentCallInput,
} from "./agent-call";
import type { WorkflowGraph } from "./types";

function input(name: string, extra: Partial<AgentCallInput> = {}): AgentCallInput {
  return { ...emptyAgentCallInput(), name, ...extra };
}

describe("readAgentCallInputs", () => {
  it("reads the stored list with an empty type as text, like the backend", () => {
    expect(
      readAgentCallInputs([{ name: "cpf", type: "", description: "CPF do aluno", required: true, example: "123" }]),
    ).toEqual([{ name: "cpf", type: "string", description: "CPF do aluno", required: true, example: "123" }]);
  });

  it("reads nothing from a missing or malformed value instead of throwing", () => {
    expect(readAgentCallInputs(undefined)).toEqual([]);
    expect(readAgentCallInputs("cpf")).toEqual([]);
    expect(readAgentCallInputs([null, 3])).toEqual([]);
  });
});

describe("agentCallInputIssues", () => {
  it("accepts an empty list, since a trigger without inputs is valid", () => {
    expect(agentCallInputIssues([])).toEqual([]);
  });

  it("names every rule the backend refuses on save", () => {
    expect(
      agentCallInputIssues([
        input(""),
        input("Cpf"),
        input("cpf"),
        input("cpf"),
        input("nota", { type: "decimal" as AgentCallInput["type"] }),
      ]),
    ).toEqual([
      { index: 0, code: "name_missing" },
      { index: 1, code: "name_pattern" },
      { index: 3, code: "name_duplicate" },
      { index: 4, code: "type_unknown" },
    ]);
  });

  it("checks the trimmed name, as the backend trims before matching", () => {
    expect(agentCallInputIssues([input(" cpf ")])).toEqual([]);
  });
});

describe("importBodySchema", () => {
  it("copies the top level body fields of an HTTP tool into inputs", () => {
    const result = importBodySchema(
      [],
      [
        { name: "cpfAluno", type: "string", description: "CPF", required: true, example: "123" },
        { name: "endereco", type: "object", description: "Endereço", required: false, properties: [{ name: "rua", type: "string" }] },
        { name: "idade", type: "number", description: "Idade", required: false, example: 18 },
      ],
    );
    expect(result.inputs).toEqual([
      { name: "cpf_aluno", type: "string", description: "CPF", required: true, example: "123" },
      { name: "endereco", type: "object", description: "Endereço", required: false, example: "" },
      { name: "idade", type: "number", description: "Idade", required: false, example: "18" },
    ]);
    expect(result.added).toBe(3);
    expect(result.skipped).toEqual([]);
  });

  it("keeps the inputs already declared and skips names that would repeat", () => {
    const result = importBodySchema([input("cpf", { description: "meu" })], [{ name: "cpf", type: "string" }, { name: "nome" }]);
    expect(result.inputs.map((i) => [i.name, i.description])).toEqual([
      ["cpf", "meu"],
      ["nome", ""],
    ]);
    expect(result.added).toBe(1);
    expect(result.skipped).toEqual(["cpf"]);
  });

  it("skips fields whose name cannot become a valid input name", () => {
    const result = importBodySchema([], [{ name: "çã" }, { type: "string" }]);
    expect(result.inputs).toEqual([]);
    expect(result.skipped).toEqual(["çã", ""]);
  });

  it("reads an unknown body type as text", () => {
    expect(importBodySchema([], [{ name: "x", type: "date" }]).inputs[0].type).toBe("string");
  });
});

describe("agentCallInputsOfGraph", () => {
  it("reads the inputs of the agent-call trigger of a workflow", () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: "t1", type: "trigger_webhook", position: { x: 0, y: 0 }, config: {} },
        { id: "t2", type: AGENT_CALL_TRIGGER, position: { x: 0, y: 0 }, config: { inputs: [{ name: "cpf", required: true }] } },
      ],
      edges: [],
    };
    expect(agentCallInputsOfGraph(graph)).toEqual([input("cpf", { required: true })]);
  });

  it("is null when the workflow has no agent-call trigger", () => {
    expect(agentCallInputsOfGraph({ nodes: [], edges: [] })).toBeNull();
    expect(agentCallInputsOfGraph(undefined)).toBeNull();
  });
});

describe("readReplyFields", () => {
  it("reads the stored list of key and value", () => {
    expect(readReplyFields([{ key: "status", value: "{{node.n5.status}}" }, { key: "mensagem", value: 3 }])).toEqual([
      { key: "status", value: "{{node.n5.status}}" },
      { key: "mensagem", value: "3" },
    ]);
  });

  it("reads a key and value map sorted by key, as the backend does", () => {
    expect(readReplyFields({ b: "2", a: "1" })).toEqual([
      { key: "a", value: "1" },
      { key: "b", value: "2" },
    ]);
  });

  it("keeps rows without a key so the author can finish typing", () => {
    expect(readReplyFields([{ key: "", value: "x" }])).toEqual([{ key: "", value: "x" }]);
  });

  it("reads nothing from a missing value", () => {
    expect(readReplyFields(undefined)).toEqual([]);
  });
});

describe("httpBodySchemaSources", () => {
  it("lists the HTTP tools of an agent that declare body fields", () => {
    expect(
      httpBodySchemaSources([
        { name: "transfer_to_human" },
        { name: "http_request", config: { method: "POST", url: "https://api/matricula", body_schema: [{ name: "cpf" }, { name: "nome" }] } },
        { name: "http_request", config: { method: "GET", url: "https://api/status" } },
      ]),
    ).toEqual([{ key: "1", method: "POST", url: "https://api/matricula", fields: 2, bodySchema: [{ name: "cpf" }, { name: "nome" }] }]);
  });

  it("is empty for an agent without HTTP tools", () => {
    expect(httpBodySchemaSources(undefined)).toEqual([]);
  });
});
